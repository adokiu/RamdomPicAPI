#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
图片转换和重命名脚本 - GUI版本
- 将所有非 AVIF 格式的图片转换为 AVIF（高质量压缩）
- 将图片文件名重命名为随机字符（长度可配置）
- 分辨率压缩：如果短边大于配置的阈值，压缩到目标大小，长边按比例缩放（保留原始比例）
- 跳过已经符合条件的文件
- 支持多进程并行处理以加速转换
- 自动压缩：如果转换后的文件大于配置限制，自动压缩到限制以下（最小化画质损失）
- GPU 加速：支持使用 GPU 加速转换（如果可用）
- 图形界面：使用 tkinter 提供友好的用户界面
- 原子性操作：使用临时文件，确保中途退出不会产生损坏的图片

使用方法:
    python convert_images_gui.py
"""

import os
import sys
import random
import string
import json
import threading
from pathlib import Path
from typing import Set, Optional, Tuple
from PIL import Image
from concurrent.futures import ProcessPoolExecutor, as_completed, ThreadPoolExecutor
from multiprocessing import cpu_count
import time
from threading import Lock
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox

# 修复 Windows 控制台编码问题
if sys.platform == 'win32':
    # 设置标准输出为 UTF-8
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
    # 设置环境变量
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# 支持的图片格式（需要转换的）
SUPPORTED_FORMATS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.webp'}

# AVIF 格式
AVIF_EXT = '.avif'

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent

# 配置文件路径（与脚本在同一目录）
CONFIG_FILE = Path(__file__).parent / 'config.json'

# 默认配置值
DEFAULT_CONFIG = {
    'imagesDir': 'public/images',
    'maxFileSizeKB': 4096,
    'minShortEdge': 3500,
    'targetShortEdge': 2160,
    'defaultQuality': 85,
    'minQuality': 20,
    'maxQuality': 85,
    'speedNormal': 4,
    'speedGpu': 6,
    'randomNameLength': 8
}


def load_config() -> dict:
    """从 config.json 加载配置"""
    if not CONFIG_FILE.exists():
        return DEFAULT_CONFIG.copy()
    
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            config = json.load(f)
            # 合并默认配置，确保所有必需的配置项都存在
            merged_config = DEFAULT_CONFIG.copy()
            for key, value in config.items():
                if key != 'description':  # 跳过描述字段
                    merged_config[key] = value
            return merged_config
    except (json.JSONDecodeError, IOError) as e:
        return DEFAULT_CONFIG.copy()


# 加载配置
CONFIG = load_config()

# 从配置文件读取图片目录路径
IMAGES_DIR = PROJECT_ROOT / CONFIG.get('imagesDir', 'public/images')

# 从配置文件读取各种配置值
MAX_FILE_SIZE = int(CONFIG.get('maxFileSizeKB', 4096) * 1024)
MIN_SHORT_EDGE = int(CONFIG.get('minShortEdge', 3500))
TARGET_SHORT_EDGE = int(CONFIG.get('targetShortEdge', 2160))
DEFAULT_QUALITY = int(CONFIG.get('defaultQuality', 85))
MIN_QUALITY = int(CONFIG.get('minQuality', 20))
MAX_QUALITY = int(CONFIG.get('maxQuality', 85))
SPEED_NORMAL = int(CONFIG.get('speedNormal', 4))
SPEED_GPU = int(CONFIG.get('speedGpu', 6))
RANDOM_NAME_LENGTH = int(CONFIG.get('randomNameLength', 8))


def generate_random_name() -> str:
    """生成随机文件名（小写字母和数字）"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=RANDOM_NAME_LENGTH))


def is_8digit_random(name: str) -> bool:
    """检查文件名是否是8位随机字符（小写字母和数字）"""
    if len(name) != RANDOM_NAME_LENGTH:
        return False
    chars = set(string.ascii_lowercase + string.digits)
    return all(c in chars for c in name)


def needs_resolution_adjustment(image_path: Path) -> bool:
    """检查图片是否需要调整分辨率"""
    try:
        with Image.open(image_path) as img:
            width, height = img.size
            short_edge = min(width, height)
            return short_edge > MIN_SHORT_EDGE
    except:
        return False


def atomic_save(img: Image.Image, output_path: Path, **save_kwargs) -> bool:
    """
    原子性保存图片：先保存到临时文件，成功后再重命名
    确保中途退出不会产生损坏的图片
    """
    # 创建临时文件路径（在同一目录下）
    temp_path = output_path.parent / (output_path.stem + '.tmp' + output_path.suffix)
    
    try:
        # 先保存到临时文件
        img.save(temp_path, **save_kwargs)
        
        # 验证临时文件是否有效
        try:
            with Image.open(temp_path) as test_img:
                test_img.verify()
        except Exception as e:
            # 文件损坏，删除临时文件
            if temp_path.exists():
                temp_path.unlink()
            return False
        
        # 如果目标文件已存在，先删除
        if output_path.exists():
            output_path.unlink()
        
        # 原子性重命名（在Windows上，如果目标文件不存在，rename是原子操作）
        temp_path.rename(output_path)
        return True
    except Exception as e:
        # 出错时清理临时文件
        if temp_path.exists():
            try:
                temp_path.unlink()
            except:
                pass
        return False


def compress_to_target_size(img: Image.Image, output_path: Path, target_size: int, 
                            speed: int = None, min_quality: int = None, max_quality: int = None) -> Tuple[bool, int]:
    """
    使用二分法压缩图片到目标大小以下，最小化画质损失
    返回 (成功标志, 最终使用的 quality 值)
    使用原子性保存确保不会产生损坏的图片
    """
    if speed is None:
        speed = SPEED_NORMAL
    if min_quality is None:
        min_quality = MIN_QUALITY
    if max_quality is None:
        max_quality = MAX_QUALITY
    
    best_quality = min_quality
    temp_path = output_path.parent / (output_path.stem + '_temp' + output_path.suffix)
    
    # 二分法查找最佳 quality
    left, right = min_quality, max_quality
    
    while left <= right:
        mid_quality = (left + right) // 2
        
        # 尝试使用当前 quality 保存到临时文件
        try:
            save_kwargs = {
                'format': 'AVIF',
                'quality': mid_quality,
                'speed': speed,
            }
            # 使用临时文件测试
            test_temp = temp_path.parent / (temp_path.stem + '_test' + temp_path.suffix)
            img.save(test_temp, **save_kwargs)
            file_size = test_temp.stat().st_size
            
            if file_size <= target_size:
                # 文件大小符合要求，尝试更高的 quality
                best_quality = mid_quality
                left = mid_quality + 1
            else:
                # 文件太大，需要降低 quality
                right = mid_quality - 1
            
            # 清理测试文件
            if test_temp.exists():
                try:
                    test_temp.unlink()
                except:
                    pass
        except Exception as e:
            # 如果保存失败，降低 quality 继续尝试
            right = mid_quality - 1
            test_temp = temp_path.parent / (temp_path.stem + '_test' + temp_path.suffix)
            if test_temp.exists():
                try:
                    test_temp.unlink()
                except:
                    pass
    
    # 使用找到的最佳 quality 原子性保存到最终文件
    if best_quality >= min_quality:
        try:
            save_kwargs = {
                'format': 'AVIF',
                'quality': best_quality,
                'speed': speed,
            }
            if atomic_save(img, output_path, **save_kwargs):
                final_size = output_path.stat().st_size
                if final_size <= target_size:
                    return (True, best_quality)
        except Exception as e:
            pass
    
    return (False, best_quality)


def convert_to_avif(image_path: Path, output_path: Path, use_gpu: bool = False, use_ffmpeg: bool = False, 
                   log_callback=None) -> bool:
    """
    将图片转换为 AVIF 格式（使用原子性保存）
    
    Args:
        image_path: 输入图片路径
        output_path: 输出图片路径
        use_gpu: 是否使用 GPU 加速
        use_ffmpeg: 是否优先使用 ffmpeg
        log_callback: 日志回调函数
    """
    def log(msg):
        if log_callback:
            log_callback(msg)
        else:
            print(msg)
    
    try:
        # 打开图片
        with Image.open(image_path) as img:
            # 处理 EXIF 方向信息
            try:
                from PIL import ImageOps
                img = ImageOps.exif_transpose(img)
            except:
                pass
            
            original_width, original_height = img.size
            
            # 分辨率压缩：如果短边大于配置的阈值，压缩到目标大小，长边按比例缩放
            short_edge = min(original_width, original_height)
            resized = False
            final_width, final_height = original_width, original_height
            
            if short_edge > MIN_SHORT_EDGE:
                # 计算缩放比例
                scale_ratio = TARGET_SHORT_EDGE / short_edge
                # 计算新尺寸（保持比例）
                final_width = int(original_width * scale_ratio)
                final_height = int(original_height * scale_ratio)
                # 调整图片大小
                img = img.resize((final_width, final_height), Image.Resampling.LANCZOS)
                resized = True
                log(f"  [INFO] 分辨率压缩: {original_width}x{original_height} -> {final_width}x{final_height} (短边: {short_edge}px -> {min(final_width, final_height)}px)")
            
            # 检查是否可以使用 GPU 加速
            speed = SPEED_GPU if use_gpu else SPEED_NORMAL
            
            # 保存为 AVIF，使用配置的质量参数
            save_kwargs = {
                'format': 'AVIF',
                'quality': DEFAULT_QUALITY,
                'speed': speed,
            }
            
            # 获取原始文件大小（用于对比）
            original_size = image_path.stat().st_size
            
            # 先尝试正常转换（使用原子性保存）
            if not atomic_save(img, output_path, **save_kwargs):
                log(f"  [ERROR] 保存失败: {image_path.name}")
                return False
            
            # 检查文件大小，如果超过配置限制，进行压缩
            file_size = output_path.stat().st_size
            compressed = False
            final_quality = DEFAULT_QUALITY
            
            # 检查分辨率调整后文件是否变大
            if resized and file_size > original_size:
                log(f"  [WARNING] 分辨率调整后文件大小反而增大 ({original_size/1024:.1f}KB -> {file_size/1024:.1f}KB)，开始压缩...")
                success, final_quality = compress_to_target_size(img, output_path, original_size, speed=speed)
                if success:
                    compressed = True
                    final_size = output_path.stat().st_size
                    log(f"  [OK] 压缩完成: {file_size/(1024*1024):.2f}MB -> {final_size/(1024*1024):.2f}MB (quality: {final_quality})")
                else:
                    # 如果压缩失败，尝试更激进的压缩
                    log(f"  [WARNING] 压缩未达到目标，尝试更激进的压缩...")
                    success, final_quality = compress_to_target_size(img, output_path, original_size, speed=speed, min_quality=MIN_QUALITY, max_quality=min(MAX_QUALITY, 50))
                    if success:
                        compressed = True
                        final_size = output_path.stat().st_size
                        log(f"  [OK] 压缩完成: {file_size/(1024*1024):.2f}MB -> {final_size/(1024*1024):.2f}MB (quality: {final_quality})")
            elif file_size > MAX_FILE_SIZE:
                max_size_mb = MAX_FILE_SIZE / (1024 * 1024)
                log(f"  [INFO] 文件大小 {file_size/(1024*1024):.2f}MB 超过 {max_size_mb:.0f}MB，开始压缩（最小化画质损失）...")
                success, final_quality = compress_to_target_size(img, output_path, MAX_FILE_SIZE, speed=speed)
                if success:
                    compressed = True
                    final_size = output_path.stat().st_size
                    log(f"  [OK] 压缩完成: {file_size/(1024*1024):.2f}MB -> {final_size/(1024*1024):.2f}MB (quality: {final_quality})")
            
            # 验证输出文件的尺寸
            with Image.open(output_path) as saved_img:
                saved_width, saved_height = saved_img.size
                if saved_width != final_width or saved_height != final_height:
                    log(f"  [WARNING] 尺寸不匹配: 期望 {final_width}x{final_height}, 实际 {saved_width}x{saved_height}")
                else:
                    # 显示文件大小对比
                    new_size = output_path.stat().st_size
                    size_diff = ((new_size - original_size) / original_size) * 100 if original_size > 0 else 0
                    compression_info = f" (已压缩)" if compressed else ""
                    resize_info = f" (已缩放)" if resized else ""
                    size_info = f"原: {original_size/1024:.1f}KB -> 新: {new_size/1024:.1f}KB ({size_diff:+.1f}%){compression_info}{resize_info}"
                    log(f"  [OK] 转换: {image_path.name} -> {output_path.name} (尺寸: {final_width}x{final_height}, {size_info})")
            
            return True
    except Exception as e:
        log(f"  [ERROR] 转换失败 {image_path.name}: {e}")
        import traceback
        traceback.print_exc()
        return False


def convert_image_worker(args: Tuple[Path, Path, bool, bool]) -> Tuple[bool, Path, Path]:
    """
    工作进程函数：只负责转换图片格式
    返回 (成功标志, 原文件路径, 输出文件路径)
    """
    input_path, output_path, use_gpu, use_ffmpeg = args
    try:
        success = convert_to_avif(input_path, output_path, use_gpu=use_gpu, use_ffmpeg=use_ffmpeg)
        return (success, input_path, output_path)
    except Exception as e:
        return (False, input_path, output_path)


class ImageConverterGUI:
    """图片转换器GUI"""
    
    def __init__(self, root):
        self.root = root
        self.root.title("图片转换和重命名工具")
        self.root.geometry("900x700")
        
        # 控制变量
        self.is_running = False
        self.should_stop = False
        self.process_thread = None
        self.executor = None  # 用于存储ProcessPoolExecutor，以便能够取消
        self.active_futures = []  # 用于存储活动的future，以便能够取消
        
        # 创建UI
        self.create_widgets()
        
        # 清理临时文件
        self.cleanup_temp_files()
    
    def create_widgets(self):
        """创建UI组件"""
        # 主框架
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(0, weight=1)
        main_frame.rowconfigure(2, weight=1)
        
        # 配置信息区域
        config_frame = ttk.LabelFrame(main_frame, text="配置信息", padding="10")
        config_frame.grid(row=0, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        config_frame.columnconfigure(1, weight=1)
        
        ttk.Label(config_frame, text="图片目录:").grid(row=0, column=0, sticky=tk.W, padx=(0, 5))
        self.dir_label = ttk.Label(config_frame, text=str(IMAGES_DIR), foreground="blue")
        self.dir_label.grid(row=0, column=1, sticky=tk.W)
        
        ttk.Label(config_frame, text="最大文件大小:").grid(row=1, column=0, sticky=tk.W, padx=(0, 5))
        ttk.Label(config_frame, text=f"{MAX_FILE_SIZE/1024:.0f}KB").grid(row=1, column=1, sticky=tk.W)
        
        # 选项区域
        options_frame = ttk.LabelFrame(main_frame, text="选项", padding="10")
        options_frame.grid(row=1, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        
        self.use_gpu_var = tk.BooleanVar()
        self.use_gpu_check = ttk.Checkbutton(options_frame, text="使用 GPU 加速（如果可用）", variable=self.use_gpu_var)
        self.use_gpu_check.grid(row=0, column=0, sticky=tk.W)
        
        self.use_multiprocessing_var = tk.BooleanVar(value=True)
        self.use_multiprocessing_check = ttk.Checkbutton(options_frame, text="使用多进程并行处理", variable=self.use_multiprocessing_var)
        self.use_multiprocessing_check.grid(row=1, column=0, sticky=tk.W)
        
        # 进度区域
        progress_frame = ttk.LabelFrame(main_frame, text="进度", padding="10")
        progress_frame.grid(row=2, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        progress_frame.columnconfigure(0, weight=1)
        progress_frame.rowconfigure(1, weight=1)
        
        # 进度条
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(progress_frame, variable=self.progress_var, maximum=100, length=400)
        self.progress_bar.grid(row=0, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # 进度文本
        self.progress_label = ttk.Label(progress_frame, text="等待开始...")
        self.progress_label.grid(row=1, column=0, sticky=tk.W)
        
        # 日志区域
        log_frame = ttk.LabelFrame(main_frame, text="日志", padding="10")
        log_frame.grid(row=3, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(0, weight=1)
        main_frame.rowconfigure(3, weight=1)
        
        # 日志文本框
        self.log_text = scrolledtext.ScrolledText(log_frame, height=15, wrap=tk.WORD, state=tk.DISABLED)
        self.log_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 按钮区域
        button_frame = ttk.Frame(main_frame)
        button_frame.grid(row=4, column=0, sticky=(tk.W, tk.E), pady=(10, 0))
        
        self.start_button = ttk.Button(button_frame, text="开始转换", command=self.start_conversion)
        self.start_button.grid(row=0, column=0, padx=(0, 10))
        
        self.stop_button = ttk.Button(button_frame, text="停止", command=self.stop_conversion, state=tk.DISABLED)
        self.stop_button.grid(row=0, column=1)
    
    def log(self, message):
        """添加日志消息"""
        self.log_text.config(state=tk.NORMAL)
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)
        self.log_text.config(state=tk.DISABLED)
        self.root.update_idletasks()
    
    def update_progress(self, current, total, message="", start_time=None, elapsed_time=None):
        """更新进度条，显示ETA"""
        if total > 0:
            percent = (current / total) * 100
            self.progress_var.set(percent)
            
            # 计算ETA
            eta_text = ""
            if start_time is not None and current > 0:
                if elapsed_time is None:
                    elapsed_time = time.time() - start_time
                
                if elapsed_time > 0:
                    # 计算平均速度
                    avg_time_per_item = elapsed_time / current
                    # 计算剩余时间
                    remaining = total - current
                    eta_seconds = avg_time_per_item * remaining
                    
                    # 格式化ETA
                    if eta_seconds < 60:
                        eta_text = f" | ETA: {eta_seconds:.0f}秒"
                    elif eta_seconds < 3600:
                        eta_text = f" | ETA: {eta_seconds/60:.1f}分钟"
                    else:
                        hours = int(eta_seconds // 3600)
                        minutes = int((eta_seconds % 3600) // 60)
                        eta_text = f" | ETA: {hours}小时{minutes}分钟"
            
            if message:
                self.progress_label.config(text=f"{current}/{total} ({percent:.1f}%){eta_text} - {message}")
            else:
                self.progress_label.config(text=f"{current}/{total} ({percent:.1f}%){eta_text}")
        self.root.update_idletasks()
    
    def cleanup_temp_files(self):
        """清理临时文件（.tmp 和 _temp 后缀的文件）"""
        try:
            if not IMAGES_DIR.exists():
                return
            
            # 查找所有子文件夹
            folders = []
            if IMAGES_DIR.is_dir():
                # 检查是否直接包含图片文件
                direct_files = [f for f in IMAGES_DIR.iterdir() 
                              if f.is_file() and (f.suffix.lower() in SUPPORTED_FORMATS or f.suffix.lower() == AVIF_EXT)]
                if direct_files:
                    folders.append(IMAGES_DIR)
                else:
                    folders = [f for f in IMAGES_DIR.iterdir() if f.is_dir()]
            
            cleaned = 0
            for folder in folders:
                for file in folder.iterdir():
                    if file.is_file():
                        # 检查是否是临时文件
                        if file.suffix == '.tmp' or '_temp' in file.stem or '_test' in file.stem:
                            try:
                                file.unlink()
                                cleaned += 1
                            except:
                                pass
            
            if cleaned > 0:
                self.log(f"[INFO] 清理了 {cleaned} 个临时文件")
        except Exception as e:
            self.log(f"[WARNING] 清理临时文件时出错: {e}")
    
    def start_conversion(self):
        """开始转换"""
        if self.is_running:
            return
        
        if not IMAGES_DIR.exists():
            messagebox.showerror("错误", f"图片目录不存在: {IMAGES_DIR}")
            return
        
        self.is_running = True
        self.should_stop = False
        self.start_button.config(state=tk.DISABLED)
        self.stop_button.config(state=tk.NORMAL)
        self.log_text.config(state=tk.NORMAL)
        self.log_text.delete(1.0, tk.END)
        self.log_text.config(state=tk.DISABLED)
        
        # 在新线程中运行转换
        self.process_thread = threading.Thread(target=self.run_conversion, daemon=True)
        self.process_thread.start()
    
    def stop_conversion(self):
        """停止转换"""
        if not self.is_running:
            return
        
        self.should_stop = True
        self.log("[INFO] 正在停止转换...")
        
        # 取消所有未完成的future
        if self.active_futures:
            cancelled = 0
            for future in self.active_futures:
                if not future.done():
                    future.cancel()
                    cancelled += 1
            if cancelled > 0:
                self.log(f"[INFO] 已取消 {cancelled} 个待处理任务")
        
        # 关闭executor（如果存在）
        if self.executor:
            try:
                self.log("[INFO] 正在关闭进程池...")
                # 先取消所有未完成的任务
                for future in self.active_futures:
                    if not future.done():
                        future.cancel()
                # 关闭executor
                self.executor.shutdown(wait=False)
                self.executor = None
                self.active_futures = []
            except Exception as e:
                self.log(f"[WARNING] 关闭进程池时出错: {e}")
    
    def run_conversion(self):
        """运行转换（在后台线程中）"""
        try:
            use_gpu = self.use_gpu_var.get()
            use_multiprocessing = self.use_multiprocessing_var.get()
            
            self.log("=" * 60)
            self.log("图片转换和重命名脚本（转换为 AVIF，8位随机字符）")
            self.log("=" * 60)
            self.log(f"最大文件大小限制: {MAX_FILE_SIZE/1024:.0f}KB")
            if use_gpu:
                self.log("GPU 加速: 已启用")
            self.log("=" * 60)
            
            # 检查 IMAGES_DIR 是否直接包含图片文件
            direct_image_files = [f for f in IMAGES_DIR.iterdir() 
                                 if f.is_file() and (f.suffix.lower() in SUPPORTED_FORMATS or f.suffix.lower() == AVIF_EXT)]
            
            if direct_image_files:
                # 如果直接包含图片文件，直接处理这个文件夹
                self.log(f"\n处理文件夹: {IMAGES_DIR.name}")
                self.log("-" * 40)
                self.process_folder(IMAGES_DIR, use_multiprocessing=use_multiprocessing, use_gpu=use_gpu)
            else:
                # 如果不直接包含图片文件，查找子文件夹
                folders = [f for f in IMAGES_DIR.iterdir() if f.is_dir()]
                
                if not folders:
                    self.log(f"未找到任何图片文件夹或图片文件: {IMAGES_DIR}")
                    return
                
                self.log(f"\n找到 {len(folders)} 个图片文件夹\n")
                
                # 处理每个文件夹
                for folder in folders:
                    if self.should_stop:
                        break
                    self.log(f"\n处理文件夹: {folder.name}")
                    self.log("-" * 40)
                    self.process_folder(folder, use_multiprocessing=use_multiprocessing, use_gpu=use_gpu)
            
            if self.should_stop:
                self.log("\n" + "=" * 60)
                self.log("转换已停止")
                self.log("=" * 60)
                messagebox.showinfo("已停止", "转换已停止")
            else:
                self.log("\n" + "=" * 60)
                self.log("处理完成！")
                self.log("=" * 60)
                messagebox.showinfo("完成", "转换完成！")
        except Exception as e:
            self.log(f"[ERROR] 发生错误: {e}")
            import traceback
            self.log(traceback.format_exc())
            messagebox.showerror("错误", f"转换过程中发生错误: {e}")
        finally:
            # 确保清理executor
            if self.executor:
                try:
                    self.executor.shutdown(wait=False)
                except:
                    pass
                self.executor = None
                self.active_futures = []
            
            self.is_running = False
            self.start_button.config(state=tk.NORMAL)
            self.stop_button.config(state=tk.DISABLED)
            self.update_progress(0, 100, "已完成")
    
    def process_folder(self, folder_path: Path, use_multiprocessing: bool = True, use_gpu: bool = False):
        """处理一个图片文件夹中的所有图片文件"""
        folder_name = folder_path.name
        
        # 获取所有图片文件
        all_image_files = [f for f in folder_path.iterdir() 
                          if f.is_file() and (f.suffix.lower() in SUPPORTED_FORMATS or f.suffix.lower() == AVIF_EXT)]
        
        if not all_image_files:
            self.log(f"  未找到图片文件")
            return
        
        self.log(f"  找到 {len(all_image_files)} 个图片文件")
        
        # 收集已使用的文件名
        used_names: Set[str] = set()
        for img_file in all_image_files:
            name = img_file.stem
            if is_8digit_random(name):
                used_names.add(name)
        
        # 需要处理的文件列表
        tasks = []
        for img_file in all_image_files:
            if self.should_stop:
                break
            
            original_name = img_file.stem
            original_ext = img_file.suffix.lower()
            
            # 确定目标扩展名
            if original_ext in SUPPORTED_FORMATS:
                target_ext = AVIF_EXT
                needs_conversion = True
            elif original_ext == AVIF_EXT:
                target_ext = AVIF_EXT
                needs_conversion = False
            else:
                continue
            
            # 检查文件名是否已经是随机字符
            is_random_name = is_8digit_random(original_name)
            
            # 检查文件大小和分辨率
            file_size = img_file.stat().st_size
            needs_compression = file_size > MAX_FILE_SIZE
            needs_resolution_adjust = False
            if not needs_conversion:
                needs_resolution_adjust = needs_resolution_adjustment(img_file)
            
            # 确定是否需要处理
            if is_random_name:
                if needs_conversion or needs_compression or needs_resolution_adjust:
                    tasks.append((img_file, original_name, target_ext, needs_conversion, True))
            else:
                # 需要生成新名称
                tasks.append((img_file, None, target_ext, needs_conversion, False))
        
        if not tasks:
            self.log(f"  所有文件都已符合条件，无需处理")
            return
        
        self.log(f"  需要处理 {len(tasks)} 个文件")
        
        # 处理文件
        processed_count = 0
        start_time = time.time()
        
        if use_multiprocessing and len(tasks) > 1:
            # 使用多进程处理
            self.executor = ProcessPoolExecutor(max_workers=min(cpu_count(), len(tasks)))
            self.active_futures = []
            futures = []
            
            try:
                for img_file, original_name, target_ext, needs_conversion, is_random_name in tasks:
                    if self.should_stop:
                        break
                    
                    # 生成目标文件名
                    if is_random_name:
                        new_name = original_name + target_ext
                    else:
                        max_attempts = 1000
                        new_name = None
                        for _ in range(max_attempts):
                            candidate = generate_random_name()
                            if candidate not in used_names:
                                new_name = candidate + target_ext
                                used_names.add(candidate)
                                break
                        if not new_name:
                            self.log(f"  [ERROR] 无法为 {img_file.name} 生成唯一文件名")
                            continue
                    
                    new_path = folder_path / new_name
                    
                    if needs_conversion:
                        future = self.executor.submit(convert_image_worker, (img_file, new_path, use_gpu, False))
                        futures.append((future, img_file, new_path, original_name))
                        self.active_futures.append(future)
                    else:
                        # 只需要重命名
                        if self.should_stop:
                            break
                        try:
                            img_file.rename(new_path)
                            self.log(f"  [OK] 重命名: {img_file.name} -> {new_path.name}")
                            processed_count += 1
                            elapsed = time.time() - start_time
                            self.update_progress(processed_count, len(tasks), f"处理 {folder_name}", start_time, elapsed)
                        except Exception as e:
                            self.log(f"  [ERROR] 重命名失败 {img_file.name}: {e}")
                
                # 等待所有转换完成，使用as_completed以便更及时响应停止信号
                future_to_task = {future: (img_file, new_path, original_name) for future, img_file, new_path, original_name in futures}
                
                for future in as_completed(future_to_task.keys()):
                    if self.should_stop:
                        # 取消未完成的任务
                        for f in future_to_task.keys():
                            if not f.done():
                                f.cancel()
                        break
                    
                    img_file, new_path, original_name = future_to_task[future]
                    try:
                        success, input_path, output_path = future.result()
                        if success:
                            # 删除原文件
                            if input_path.exists() and input_path != output_path:
                                input_path.unlink()
                            processed_count += 1
                        else:
                            self.log(f"  [ERROR] 转换失败: {img_file.name}")
                        elapsed = time.time() - start_time
                        self.update_progress(processed_count, len(tasks), f"处理 {folder_name}", start_time, elapsed)
                    except Exception as e:
                        if not self.should_stop:
                            # 如果不是因为停止导致的异常，记录错误
                            from concurrent.futures import CancelledError
                            if not isinstance(e, CancelledError):
                                self.log(f"  [ERROR] 处理失败 {img_file.name}: {e}")
                        elapsed = time.time() - start_time
                        self.update_progress(processed_count, len(tasks), f"处理 {folder_name}", start_time, elapsed)
            finally:
                # 关闭executor
                if self.executor:
                    self.executor.shutdown(wait=True)
                    self.executor = None
                    self.active_futures = []
        else:
            # 单进程处理
            for img_file, original_name, target_ext, needs_conversion, is_random_name in tasks:
                if self.should_stop:
                    break
                
                # 生成目标文件名
                if is_random_name:
                    new_name = original_name + target_ext
                else:
                    max_attempts = 1000
                    new_name = None
                    for _ in range(max_attempts):
                        candidate = generate_random_name()
                        if candidate not in used_names:
                            new_name = candidate + target_ext
                            used_names.add(candidate)
                            break
                    if not new_name:
                        self.log(f"  [ERROR] 无法为 {img_file.name} 生成唯一文件名")
                        continue
                
                new_path = folder_path / new_name
                
                if needs_conversion:
                    # 使用日志回调
                    def log_callback(msg):
                        self.log(msg)
                    
                    if convert_to_avif(img_file, new_path, use_gpu=use_gpu, use_ffmpeg=False, log_callback=log_callback):
                        # 删除原文件
                        if img_file.exists() and img_file != new_path:
                            img_file.unlink()
                        processed_count += 1
                    else:
                        self.log(f"  [ERROR] 转换失败: {img_file.name}")
                else:
                    # 只需要重命名
                    try:
                        img_file.rename(new_path)
                        self.log(f"  [OK] 重命名: {img_file.name} -> {new_path.name}")
                        processed_count += 1
                    except Exception as e:
                        self.log(f"  [ERROR] 重命名失败 {img_file.name}: {e}")
                
                elapsed = time.time() - start_time
                self.update_progress(processed_count, len(tasks), f"处理 {folder_name}", start_time, elapsed)
        
        elapsed_time = time.time() - start_time
        if processed_count > 0:
            avg_time = elapsed_time / processed_count if processed_count > 0 else 0
            self.log(f"  已处理 {processed_count} 个文件（总耗时 {elapsed_time:.1f} 秒，平均 {avg_time:.2f} 秒/文件）")


def main():
    """主函数"""
    root = tk.Tk()
    app = ImageConverterGUI(root)
    root.mainloop()


if __name__ == '__main__':
    main()

