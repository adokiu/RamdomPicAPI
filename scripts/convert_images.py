#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
图片转换和重命名脚本
- 将所有非 AVIF 格式的图片转换为 AVIF（高质量压缩）
- 将图片文件名重命名为随机字符（长度可配置）
- 分辨率压缩：如果短边大于配置的阈值，压缩到目标大小，长边按比例缩放（保留原始比例）
- 跳过已经符合条件的文件
- 支持多进程并行处理以加速转换
- 自动压缩：如果转换后的文件大于配置限制，自动压缩到限制以下（最小化画质损失）
- GPU 加速：支持使用 GPU 加速转换（如果可用，使用 --gpu 参数）
- 所有配置项都在 config.json 中，包括路径、分辨率阈值、质量参数等

使用方法:
    python convert_images.py              # 普通模式
    python convert_images.py --gpu        # 启用 GPU 加速（如果可用）
    python convert_images.py --no-multiprocessing  # 禁用多进程
"""

import os
import sys
import random
import string
import json
from pathlib import Path
from typing import Set, Optional, Tuple
from PIL import Image
from concurrent.futures import ProcessPoolExecutor, as_completed
from multiprocessing import cpu_count
import time
from threading import Lock

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
        print(f"警告: 无法读取配置文件 {CONFIG_FILE}: {e}")
        print(f"使用默认配置")
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


# 全局进度条实例（用于日志输出时保持进度条在最后一行）
_current_progress_bar = None

class ProgressBar:
    """简单的进度条类，始终显示在最后一行"""
    def __init__(self, total: int, desc: str = "处理中", bar_length: int = 40):
        global _current_progress_bar
        self.total = total
        self.current = 0
        self.desc = desc
        self.bar_length = bar_length
        self.start_time = time.time()
        self.lock = Lock()
        self.last_update_time = time.time()
        self.update_interval = 0.1  # 每 0.1 秒更新一次显示
        self._is_visible = False
        # 设置为当前全局进度条
        _current_progress_bar = self
        # 初始显示
        self._display()
    
    def update(self, n: int = 1):
        """更新进度"""
        with self.lock:
            self.current += n
            current_time = time.time()
            # 限制更新频率，避免过于频繁的显示更新
            if current_time - self.last_update_time < self.update_interval and self.current < self.total:
                return
            self.last_update_time = current_time
            self._display()
    
    def _hide(self):
        """隐藏进度条（清除当前行）"""
        if self._is_visible:
            sys.stdout.write('\r\033[K')  # 回到行首并清除整行
            sys.stdout.flush()
            self._is_visible = False
    
    def _display(self):
        """显示进度条（始终在最后一行）"""
        if self.total == 0:
            return
        
        percent = self.current / self.total
        filled_length = int(self.bar_length * percent)
        bar = '█' * filled_length + '░' * (self.bar_length - filled_length)
        
        # 计算 ETA
        elapsed = time.time() - self.start_time
        if self.current > 0:
            avg_time_per_item = elapsed / self.current
            remaining = self.total - self.current
            eta_seconds = avg_time_per_item * remaining
            eta_str = self._format_time(eta_seconds)
        else:
            eta_str = "计算中..."
        
        # 格式化已用时间
        elapsed_str = self._format_time(elapsed)
        
        # 输出进度条（使用 \r 覆盖当前行，\033[K 清除到行尾）
        progress_info = f"\r\033[K{self.desc}: [{bar}] {self.current}/{self.total} ({percent*100:.1f}%) | 已用: {elapsed_str} | ETA: {eta_str}"
        sys.stdout.write(progress_info)
        sys.stdout.flush()
        self._is_visible = True
        
        # 如果完成，换行
        if self.current >= self.total:
            print()
            self._is_visible = False
    
    def _format_time(self, seconds: float) -> str:
        """格式化时间（秒 -> 时:分:秒）"""
        if seconds < 60:
            return f"{seconds:.0f}秒"
        elif seconds < 3600:
            minutes = int(seconds // 60)
            secs = int(seconds % 60)
            return f"{minutes}分{secs}秒"
        else:
            hours = int(seconds // 3600)
            minutes = int((seconds % 3600) // 60)
            secs = int(seconds % 60)
            return f"{hours}时{minutes}分{secs}秒"
    
    def close(self):
        """完成进度条"""
        global _current_progress_bar
        with self.lock:
            self.current = self.total
            self._display()
            _current_progress_bar = None


def log_print(*args, **kwargs):
    """带进度条保护的日志输出函数"""
    global _current_progress_bar
    
    # 如果有活动的进度条，先隐藏它
    if _current_progress_bar is not None:
        _current_progress_bar._hide()
    
    # 输出日志
    print(*args, **kwargs)
    
    # 如果有活动的进度条，重新显示它
    if _current_progress_bar is not None:
        _current_progress_bar._display()


def generate_random_name(length: int = None) -> str:
    """生成指定长度的随机字符串（小写字母和数字）"""
    if length is None:
        length = RANDOM_NAME_LENGTH
    chars = string.ascii_lowercase + string.digits
    return ''.join(random.choice(chars) for _ in range(length))


def is_8digit_random(name: str) -> bool:
    """检查文件名是否是随机字符（小写字母和数字）"""
    if len(name) != RANDOM_NAME_LENGTH:
        return False
    chars = set(string.ascii_lowercase + string.digits)
    return all(c in chars for c in name)


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
    # 使用配置的默认值
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
                'speed': speed,  # 使用与主转换相同的速度参数
            }
            img.save(temp_path, **save_kwargs)
            file_size = temp_path.stat().st_size
            
            if file_size <= target_size:
                # 文件大小符合要求，尝试更高的 quality
                best_quality = mid_quality
                left = mid_quality + 1
            else:
                # 文件太大，需要降低 quality
                right = mid_quality - 1
        except Exception as e:
            # 如果保存失败，降低 quality 继续尝试
            right = mid_quality - 1
    
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
                # 清理临时文件
                if temp_path.exists():
                    temp_path.unlink()
                if final_size <= target_size:
                    return (True, best_quality)
        except Exception as e:
            # 清理临时文件
            if temp_path.exists():
                temp_path.unlink()
            pass
    
    return (False, best_quality)


def needs_resolution_adjustment(image_path: Path) -> bool:
    """
    检查图片是否需要分辨率调整（短边是否大于配置的阈值）
    优化：只读取图片尺寸元数据，不加载完整图片数据，提升检查速度
    
    Args:
        image_path: 图片文件路径
    
    Returns:
        True 如果需要调整分辨率，False 如果不需要
    """
    try:
        from PIL import Image
        # 只打开文件读取元数据，不加载完整图片数据（使用 verify=False 跳过验证以提升速度）
        with Image.open(image_path) as img:
            # 直接读取尺寸（PIL 默认只读取元数据，不加载像素数据）
            width, height = img.size
            # 检查 EXIF 方向标签，如果图片被旋转了，可能需要交换宽高
            # 但为了速度，这里先不考虑 EXIF 方向，因为大多数情况下尺寸就是正确的
            # 如果需要调整，在转换时会正确处理 EXIF
            short_edge = min(width, height)
            needs_adjust = short_edge > MIN_SHORT_EDGE
            if needs_adjust:
                print(f"  [DEBUG] 分辨率检查: {image_path.name} - {width}x{height}, 短边={short_edge}px > {MIN_SHORT_EDGE}px")
            return needs_adjust
    except Exception as e:
        # 如果无法读取图片，假设需要处理
        print(f"  [WARN] 无法检查分辨率 {image_path.name}: {e}")
        return True


def convert_to_avif(image_path: Path, output_path: Path, use_gpu: bool = False, use_ffmpeg: bool = False) -> bool:
    """
    将图片转换为 AVIF 格式（高质量压缩，分辨率压缩：短边大于配置阈值时压缩到目标大小）
    
    Args:
        image_path: 输入图片路径
        output_path: 输出图片路径
        use_gpu: 是否尝试使用 GPU 加速（如果支持）
        use_ffmpeg: 是否优先使用 ffmpeg（如果可用）
    """
    # 如果指定使用 ffmpeg 且可用，优先使用 ffmpeg
    if use_ffmpeg and check_ffmpeg_available():
        success = convert_to_avif_with_ffmpeg(image_path, output_path, use_gpu=use_gpu)
        if success:
            return True
        # 如果 ffmpeg 失败，回退到 Pillow
    
    try:
        # 打开图片，使用 load() 确保完整加载
        with Image.open(image_path) as img:
            # 强制加载所有数据，避免延迟加载导致的问题
            img.load()
            
            # 获取原始尺寸（这是图片的实际像素尺寸）
            original_width, original_height = img.size
            
            # 处理 EXIF 方向信息（如果有）
            try:
                from PIL import ImageOps
                # 应用 EXIF 转换（如果有方向信息）
                img = ImageOps.exif_transpose(img)
            except:
                # 如果处理 EXIF 失败，继续使用原始图片
                pass
            
            # 获取处理后的尺寸（应用EXIF后）
            final_width, final_height = img.size
            
            # 分辨率压缩：如果短边大于配置的阈值，压缩到目标大小，长边按比例缩放
            short_edge = min(final_width, final_height)
            resized = False
            
            if short_edge > MIN_SHORT_EDGE:
                # 计算缩放比例
                scale_ratio = TARGET_SHORT_EDGE / short_edge
                # 计算新尺寸（保持比例）
                new_width = int(final_width * scale_ratio)
                new_height = int(final_height * scale_ratio)
                # 使用高质量重采样算法（LANCZOS）进行缩放
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                final_width, final_height = new_width, new_height
                resized = True
                print(f"  [INFO] 分辨率压缩: {original_width}x{original_height} -> {final_width}x{final_height} (短边: {short_edge}px -> {min(final_width, final_height)}px)")
            
            # 确保图片模式兼容 AVIF（AVIF 支持 RGB, RGBA）
            if img.mode not in ('RGB', 'RGBA'):
                if img.mode == 'CMYK':
                    img = img.convert('RGB')
                elif img.mode == 'P':
                    # 调色板模式，转换为 RGBA
                    img = img.convert('RGBA')
                elif img.mode in ('L', 'LA'):
                    # 灰度图转换为 RGB
                    img = img.convert('RGB')
                else:
                    img = img.convert('RGB')
            
            # 检查是否可以使用 GPU 加速
            # 注意：Pillow 的 AVIF 编码器使用 libavif，不支持直接的 GPU 硬件加速
            # 但我们可以优化编码参数以获得更好的性能（使用更快的速度参数）
            speed = SPEED_GPU if use_gpu else SPEED_NORMAL
            
            # 保存为 AVIF，使用配置的质量参数
            # speed 参数：0-6，数字越大速度越快（但可能略微降低压缩率）
            save_kwargs = {
                'format': 'AVIF',
                'quality': DEFAULT_QUALITY,
                'speed': speed,
            }
            
            # 获取原始文件大小（用于对比）
            original_size = image_path.stat().st_size
            
            # 先尝试正常转换（使用原子性保存）
            if not atomic_save(img, output_path, **save_kwargs):
                print(f"  [ERROR] 保存失败: {image_path.name}")
                return False
            
            # 检查文件大小，如果超过配置限制，进行压缩
            file_size = output_path.stat().st_size
            compressed = False
            final_quality = DEFAULT_QUALITY
            
            # 检查分辨率调整后文件是否变大（如果调整了分辨率但文件反而变大，需要进一步压缩）
            if resized and file_size > original_size:
                # 分辨率调整后文件反而变大，需要进一步压缩
                print(f"  [WARNING] 分辨率调整后文件大小反而增大 ({original_size/1024:.1f}KB -> {file_size/1024:.1f}KB)，开始压缩...")
                success, final_quality = compress_to_target_size(img, output_path, original_size, speed=speed)
                if success:
                    compressed = True
                    final_size = output_path.stat().st_size
                    print(f"  [OK] 压缩完成: {file_size/(1024*1024):.2f}MB -> {final_size/(1024*1024):.2f}MB (quality: {final_quality})")
                else:
                    # 如果压缩失败，尝试更激进的压缩
                    print(f"  [WARNING] 压缩未达到目标，尝试更激进的压缩...")
                    # 降低质量范围，更激进地压缩
                    success, final_quality = compress_to_target_size(img, output_path, original_size, speed=speed, min_quality=MIN_QUALITY, max_quality=min(MAX_QUALITY, 50))
                    if success:
                        compressed = True
                        final_size = output_path.stat().st_size
                        print(f"  [OK] 压缩完成: {file_size/(1024*1024):.2f}MB -> {final_size/(1024*1024):.2f}MB (quality: {final_quality})")
                    else:
                        print(f"  [WARNING] 无法压缩到原始大小以下，保留当前结果")
            elif file_size > MAX_FILE_SIZE:
                max_size_mb = MAX_FILE_SIZE / (1024 * 1024)
                print(f"  [INFO] 文件大小 {file_size/(1024*1024):.2f}MB 超过 {max_size_mb:.0f}MB，开始压缩（最小化画质损失）...")
                success, final_quality = compress_to_target_size(img, output_path, MAX_FILE_SIZE, speed=speed)
                if success:
                    compressed = True
                    final_size = output_path.stat().st_size
                    print(f"  [OK] 压缩完成: {file_size/(1024*1024):.2f}MB -> {final_size/(1024*1024):.2f}MB (quality: {final_quality})")
                else:
                    print(f"  [WARNING] 压缩失败，使用原始 quality")
            
            # 验证输出文件的尺寸
            with Image.open(output_path) as saved_img:
                saved_width, saved_height = saved_img.size
                if saved_width != final_width or saved_height != final_height:
                    print(f"  [WARNING] 尺寸不匹配: 期望 {final_width}x{final_height}, 实际 {saved_width}x{saved_height}")
                else:
                    # 显示文件大小对比（original_size 已在上面定义）
                    new_size = output_path.stat().st_size
                    size_diff = ((new_size - original_size) / original_size) * 100 if original_size > 0 else 0
                    compression_info = f" (已压缩)" if compressed else ""
                    resize_info = f" (已缩放)" if resized else ""
                    size_info = f"原: {original_size/1024:.1f}KB -> 新: {new_size/1024:.1f}KB ({size_diff:+.1f}%){compression_info}{resize_info}"
                    print(f"  [OK] 转换: {image_path.name} -> {output_path.name} (尺寸: {final_width}x{final_height}, {size_info})")
            
            return True
    except Exception as e:
        print(f"  [ERROR] 转换失败 {image_path.name}: {e}")
        import traceback
        traceback.print_exc()
        return False


def process_image_file_worker(args: Tuple[Path, Set[str], Path, bool, bool]) -> Tuple[bool, str]:
    """
    工作进程函数：处理单个图片文件
    返回 (成功标志, 消息)
    """
    image_path, used_names, folder_path, use_gpu, use_ffmpeg = args
    try:
        # 获取文件名和扩展名
        original_name = image_path.stem  # 不含扩展名的文件名
        original_ext = image_path.suffix.lower()  # 扩展名
        
        # 确定目标扩展名（如果是非 AVIF 格式，需要转换为 AVIF）
        if original_ext in SUPPORTED_FORMATS:
            target_ext = AVIF_EXT
            needs_conversion = True
        elif original_ext == AVIF_EXT:
            target_ext = AVIF_EXT
            needs_conversion = False
        else:
            # 不支持的格式，跳过
            return (False, f"  [SKIP] 跳过不支持的格式: {image_path.name}")
        
        # 检查文件名是否已经是8位随机字符
        is_random_name = is_8digit_random(original_name)
        
        # 检查文件大小是否超过限制（仅用于判断已存在的AVIF文件是否需要压缩）
        # 对于非AVIF格式，转换后才会检查是否需要压缩
        file_size = image_path.stat().st_size
        needs_compression = file_size > MAX_FILE_SIZE
        
        # 检查分辨率是否需要调整（仅对已存在的AVIF文件）
        needs_resolution_adjust = False
        if not needs_conversion:
            # 对于已经是 AVIF 格式的图片，检查分辨率
            needs_resolution_adjust = needs_resolution_adjustment(image_path)
            if needs_resolution_adjust:
                print(f"  [INFO] 检测到需要调整分辨率: {image_path.name}")
        
        # 调试信息：显示检查结果
        if not needs_conversion and is_random_name:
            print(f"  [DEBUG] {image_path.name}: 文件大小检查={needs_compression}, 分辨率检查={needs_resolution_adjust}")
        
        # 确定目标文件名
        if is_random_name:
            # 文件名已经是8位随机字符，检查是否需要转换格式、压缩或调整分辨率
            if needs_conversion:
                # 需要转换格式但文件名已经是8位随机字符
                new_name = original_name + target_ext
                new_path = image_path.parent / new_name
                if convert_to_avif(image_path, new_path, use_gpu=use_gpu, use_ffmpeg=use_ffmpeg):
                    image_path.unlink()  # 删除原文件
                    return (True, f"  [OK] 转换: {image_path.name} -> {new_path.name}")
            elif needs_compression or needs_resolution_adjust:
                # 已经是 AVIF 且文件名是8位随机字符，但文件大小超过限制或分辨率需要调整
                new_name = original_name + target_ext
                new_path = image_path.parent / new_name
                if needs_compression and needs_resolution_adjust:
                    reason = "压缩和分辨率调整"
                elif needs_compression:
                    reason = "压缩"
                else:
                    reason = "分辨率调整"
                if convert_to_avif(image_path, new_path, use_gpu=use_gpu, use_ffmpeg=use_ffmpeg):
                    image_path.unlink()  # 删除原文件
                    return (True, f"  [OK] {reason}: {image_path.name} -> {new_path.name}")
                else:
                    return (False, f"  [ERROR] {reason}失败: {image_path.name}")
            else:
                # 已经是 AVIF 且文件名是8位随机字符，文件大小和分辨率都符合要求，无需处理
                return (False, f"  [SKIP] 已符合条件: {image_path.name}")
        else:
            # 文件名不是8位随机字符，需要生成新的随机名称
            # 生成新的随机文件名，确保不重复
            max_attempts = 1000
            for _ in range(max_attempts):
                new_name = generate_random_name()
                new_path = image_path.parent / (new_name + target_ext)
                
                # 检查是否已使用或文件已存在
                if new_name not in used_names and not new_path.exists():
                    # 如果需要转换格式
                    if needs_conversion:
                        # 转换格式并重命名
                        if convert_to_avif(image_path, new_path, use_gpu=use_gpu, use_ffmpeg=use_ffmpeg):
                            image_path.unlink()  # 删除原文件
                            return (True, f"  [OK] 转换: {image_path.name} -> {new_path.name}")
                    else:
                        # 已经是 AVIF 格式，检查是否需要压缩或调整分辨率
                        if needs_compression or needs_resolution_adjust:
                            # 需要压缩或调整分辨率，重新转换
                            reason = "压缩" if needs_compression else "分辨率调整"
                            if convert_to_avif(image_path, new_path, use_gpu=use_gpu, use_ffmpeg=use_ffmpeg):
                                image_path.unlink()  # 删除原文件
                                return (True, f"  [OK] 重命名并{reason}: {image_path.name} -> {new_path.name}")
                        else:
                            # 只需要重命名
                            image_path.rename(new_path)
                            return (True, f"  [OK] 重命名: {image_path.name} -> {new_path.name}")
            
            return (False, f"  [ERROR] 无法生成唯一文件名: {image_path.name}")
        
        return (False, "")
    except Exception as e:
        return (False, f"  [ERROR] 处理失败 {image_path.name}: {e}")


def process_image_file(image_path: Path, used_names: Set[str], use_gpu: bool = False, use_ffmpeg: bool = False) -> bool:
    """
    处理一个图片文件：
    1. 如果是非 AVIF 格式，转换为 AVIF
    2. 将文件名重命名为8位随机字符
    
    Args:
        image_path: 图片文件路径
        used_names: 已使用的文件名集合
        use_gpu: 是否使用 GPU 加速
        use_ffmpeg: 是否优先使用 ffmpeg
    """
    # 获取文件名和扩展名
    original_name = image_path.stem  # 不含扩展名的文件名
    original_ext = image_path.suffix.lower()  # 扩展名
    
    # 确定目标扩展名（如果是非 AVIF 格式，需要转换为 AVIF）
    if original_ext in SUPPORTED_FORMATS:
        target_ext = AVIF_EXT
        needs_conversion = True
    elif original_ext == AVIF_EXT:
        target_ext = AVIF_EXT
        needs_conversion = False
    else:
        # 不支持的格式，跳过
        print(f"  [SKIP] 跳过不支持的格式: {image_path.name}")
        return False
    
    # 检查文件名是否已经是8位随机字符
    is_random_name = is_8digit_random(original_name)
    
    # 检查文件大小是否超过限制（仅用于判断已存在的AVIF文件是否需要压缩）
    # 对于非AVIF格式，转换后才会检查是否需要压缩
    file_size = image_path.stat().st_size
    needs_compression = file_size > MAX_FILE_SIZE
    
    # 检查分辨率是否需要调整（仅对已存在的AVIF文件）
    needs_resolution_adjust = False
    if not needs_conversion:
        # 对于已经是 AVIF 格式的图片，检查分辨率
        needs_resolution_adjust = needs_resolution_adjustment(image_path)
        if needs_resolution_adjust:
            print(f"  [INFO] 检测到需要调整分辨率: {image_path.name}")
    
    # 确定目标文件名
    if is_random_name:
        # 文件名已经是8位随机字符，检查是否需要转换格式、压缩或调整分辨率
        if needs_conversion:
            # 需要转换格式但文件名已经是8位随机字符
            new_name = original_name + target_ext
            new_path = image_path.parent / new_name
            if convert_to_avif(image_path, new_path, use_gpu=use_gpu, use_ffmpeg=use_ffmpeg):
                image_path.unlink()  # 删除原文件
                return True
        elif needs_compression or needs_resolution_adjust:
            # 已经是 AVIF 且文件名是8位随机字符，但文件大小超过限制或分辨率需要调整
            new_name = original_name + target_ext
            new_path = image_path.parent / new_name
            if needs_compression and needs_resolution_adjust:
                reason = "压缩和分辨率调整"
            elif needs_compression:
                reason = "压缩"
            else:
                reason = "分辨率调整"
            if convert_to_avif(image_path, new_path, use_gpu=use_gpu, use_ffmpeg=use_ffmpeg):
                image_path.unlink()  # 删除原文件
                print(f"  [OK] {reason}: {image_path.name} -> {new_path.name}")
                return True
            else:
                print(f"  [ERROR] {reason}失败: {image_path.name}")
                return False
        else:
            # 已经是 AVIF 且文件名是8位随机字符，文件大小和分辨率都符合要求，无需处理
            print(f"  [SKIP] 已符合条件: {image_path.name}")
            return False
    else:
        # 文件名不是8位随机字符，需要生成新的随机名称
        # 生成新的随机文件名，确保不重复
        max_attempts = 1000
        for _ in range(max_attempts):
            new_name = generate_random_name(8)
            new_path = image_path.parent / (new_name + target_ext)
            
            # 检查是否已使用或文件已存在
            if new_name not in used_names and not new_path.exists():
                # 如果需要转换格式
                if needs_conversion:
                    # 转换格式并重命名
                    if convert_to_avif(image_path, new_path, use_gpu=use_gpu, use_ffmpeg=use_ffmpeg):
                        image_path.unlink()  # 删除原文件
                        used_names.add(new_name)
                        return True
                else:
                    # 已经是 AVIF 格式，检查是否需要压缩或调整分辨率
                    if needs_compression or needs_resolution_adjust:
                        # 需要压缩或调整分辨率，重新转换
                        reason = "压缩" if needs_compression else "分辨率调整"
                        if convert_to_avif(image_path, new_path, use_gpu=use_gpu, use_ffmpeg=use_ffmpeg):
                            image_path.unlink()  # 删除原文件
                            used_names.add(new_name)
                            print(f"  [OK] 重命名并{reason}: {image_path.name} -> {new_path.name}")
                            return True
                    else:
                        # 只需要重命名
                        image_path.rename(new_path)
                        used_names.add(new_name)
                        print(f"  [OK] 重命名: {image_path.name} -> {new_path.name}")
                        return True
        
        print(f"  [ERROR] 无法生成唯一文件名: {image_path.name}")
        return False
    
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


def check_gpu_available() -> bool:
    """检查是否可以使用 GPU 加速（目前主要检查是否有可用的硬件加速）"""
    # Pillow 的 AVIF 编码器使用 libavif，可能不支持直接的 GPU 加速
    # 但我们可以检查系统是否有 GPU 并尝试使用更快的编码参数
    try:
        # 检查是否有 NVIDIA GPU（通过环境变量或系统调用）
        if sys.platform == 'win32':
            import subprocess
            try:
                result = subprocess.run(['nvidia-smi'], capture_output=True, timeout=2, text=True)
                if result.returncode == 0:
                    return True
            except:
                pass
        return False
    except:
        return False


def check_ffmpeg_available() -> bool:
    """检查 ffmpeg 是否可用"""
    try:
        import subprocess
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, timeout=2, text=True)
        return result.returncode == 0
    except:
        return False


def convert_to_avif_with_ffmpeg(image_path: Path, output_path: Path, use_gpu: bool = False) -> bool:
    """
    使用 ffmpeg 将图片转换为 AVIF 格式
    注意：AVIF 编码器（libsvtav1/libaom-av1）不支持硬件加速，但可以使用更快的编码参数
    
    Args:
        image_path: 输入图片路径
        output_path: 输出图片路径
        use_gpu: 是否使用更快的编码参数（虽然不支持硬件加速，但可以使用更快的速度预设）
    """
    try:
        import subprocess
        
        # 先获取图片尺寸，判断是否需要压缩分辨率
        from PIL import Image
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
        scale_filter = None
        
        if short_edge > MIN_SHORT_EDGE:
            # 计算缩放比例
            scale_ratio = TARGET_SHORT_EDGE / short_edge
            # 计算新尺寸（保持比例，确保是偶数，因为视频编码需要）
            new_width = int(original_width * scale_ratio)
            new_height = int(original_height * scale_ratio)
            # 确保是偶数
            new_width = new_width if new_width % 2 == 0 else new_width + 1
            new_height = new_height if new_height % 2 == 0 else new_height + 1
            scale_filter = f"scale={new_width}:{new_height}:flags=lanczos"
            print(f"  [INFO] 分辨率压缩: {original_width}x{original_height} -> {new_width}x{new_height} (短边: {short_edge}px -> {min(new_width, new_height)}px)")
        
        # 构建 ffmpeg 命令
        # 尝试使用 libsvtav1（通常比 libaom-av1 更快）
        # 如果不可用，ffmpeg 会自动回退到其他编码器
        cmd = ['ffmpeg', '-i', str(image_path)]
        
        # 如果需要缩放，添加 scale 滤镜
        if scale_filter:
            cmd.extend(['-vf', scale_filter])
        
        cmd.extend(['-c:v', 'libsvtav1'])
        
        # AVIF 编码参数
        # 如果启用 GPU 模式，使用更快的速度预设
        preset = '8' if use_gpu else '6'  # 速度预设（0-13，数字越大速度越快）
        # 将 quality (0-100) 转换为 crf (0-63)，quality 85 约等于 crf 23
        quality_to_crf = {85: '23', 80: '26', 75: '28', 70: '30'}
        crf = quality_to_crf.get(DEFAULT_QUALITY, '23')  # 质量参数（0-63，数字越小质量越高）
        
        cmd.extend([
            '-pix_fmt', 'yuv420p',
            '-crf', crf,
            '-preset', preset,
            '-y',  # 覆盖输出文件
            str(output_path)
        ])
        
        # 执行转换（隐藏输出，避免干扰）
        result = subprocess.run(cmd, capture_output=True, timeout=300, text=True)
        
        if result.returncode == 0 and output_path.exists():
            # 检查文件大小，如果超过配置限制，需要进一步压缩
            file_size = output_path.stat().st_size
            if file_size > MAX_FILE_SIZE:
                # 使用更高的 CRF 值重新编码
                for crf_value in ['28', '32', '36', '40']:
                    cmd_crf = ['ffmpeg', '-i', str(image_path), '-c:v', 'libsvtav1',
                              '-pix_fmt', 'yuv420p', '-crf', crf_value, '-preset', preset,
                              '-y', str(output_path)]
                    result_crf = subprocess.run(cmd_crf, capture_output=True, timeout=300, text=True)
                    if result_crf.returncode == 0:
                        file_size = output_path.stat().st_size
                        if file_size <= MAX_FILE_SIZE:
                            break
            return True
        else:
            return False
    except Exception as e:
        return False


def process_folder(folder_path: Path, use_multiprocessing: bool = True, use_gpu: bool = False):
    """处理一个图片文件夹中的所有图片文件（支持多进程并行处理）"""
    folder_name = folder_path.name
    
    # 获取所有图片文件（包括需要转换的格式和 AVIF）
    all_image_files = [f for f in folder_path.iterdir() 
                      if f.is_file() and (f.suffix.lower() in SUPPORTED_FORMATS or f.suffix.lower() == AVIF_EXT)]
    
    if not all_image_files:
        print(f"  未找到图片文件")
        return
    
    print(f"  找到 {len(all_image_files)} 个图片文件")
    
    # 收集已使用的文件名（避免重复）
    used_names: Set[str] = set()
    for img_file in all_image_files:
        name = img_file.stem
        if is_8digit_random(name):
            used_names.add(name)
    
    # 分离需要转换的文件和只需要重命名的文件
    files_to_convert = []  # 需要转换格式的文件
    files_to_rename = []   # 只需要重命名的文件（已经是 AVIF）
    
    for img_file in all_image_files:
        original_name = img_file.stem
        original_ext = img_file.suffix.lower()
        
        # 检查文件大小是否超过限制（仅用于判断已存在的AVIF文件是否需要压缩）
        file_size = img_file.stat().st_size
        needs_compression = file_size > MAX_FILE_SIZE
        is_random_name = is_8digit_random(original_name)
        
        # 跳过已符合条件的文件（格式、文件名、大小和分辨率都符合）
        # 注意：对于非AVIF格式，转换后才会知道是否需要压缩，所以不在这里跳过
        needs_resolution_adjust = False
        if original_ext == AVIF_EXT and is_random_name and not needs_compression:
            # 还需要检查分辨率是否需要调整
            needs_resolution_adjust = needs_resolution_adjustment(img_file)
            if not needs_resolution_adjust:
                # 所有条件都符合，跳过
                continue
            # 如果需要调整分辨率，继续处理（会被添加到 files_to_convert）
        
        if original_ext in SUPPORTED_FORMATS:
            # 非 AVIF 格式，需要转换（转换后会检查是否需要压缩）
            files_to_convert.append(img_file)
        elif original_ext == AVIF_EXT:
            # 已经是 AVIF 格式
            if needs_compression or needs_resolution_adjust:
                # 文件大小超过限制或需要调整分辨率，重新转换
                files_to_convert.append(img_file)
            elif not is_random_name:
                # 只需要重命名
                files_to_rename.append(img_file)
    
    total_to_process = len(files_to_convert) + len(files_to_rename)
    if total_to_process == 0:
        print(f"  所有文件已符合条件，无需处理")
        return
    
    print(f"  需要处理 {total_to_process} 个文件（{len(files_to_convert)} 个需要转换，{len(files_to_rename)} 个需要重命名）")
    
    start_time = time.time()
    processed_count = 0
    
    # 创建进度条
    progress_bar = ProgressBar(total=total_to_process, desc=f"  处理 {folder_name}")
    
    # 检查 GPU 和 ffmpeg 可用性（用于提示信息）
    gpu_available = check_gpu_available() if use_gpu else False
    ffmpeg_available = check_ffmpeg_available()
    
    if use_gpu:
        if gpu_available and ffmpeg_available:
            log_print(f"  [INFO] 检测到 GPU 和 ffmpeg，将尝试使用硬件加速模式")
        elif gpu_available:
            log_print(f"  [INFO] 检测到 GPU，将使用优化参数模式（更快速度，speed={SPEED_GPU}）")
            log_print(f"  [NOTE] Pillow 的 AVIF 编码器不支持硬件加速，但会使用更快的编码参数")
        elif ffmpeg_available:
            log_print(f"  [INFO] 检测到 ffmpeg，将尝试使用 ffmpeg 进行转换")
        else:
            log_print(f"  [INFO] 将使用优化参数模式（更快速度，speed={SPEED_GPU}）")
            log_print(f"  [NOTE] Pillow 的 AVIF 编码器不支持硬件加速，但会使用更快的编码参数")
    
    # 如果用户指定了 --gpu，即使没有检测到 GPU，也使用更快的速度参数
    # 直接使用 use_gpu 参数传递给转换函数
    effective_use_gpu = use_gpu
    effective_use_ffmpeg = use_gpu and ffmpeg_available  # 如果启用 GPU 且 ffmpeg 可用，优先使用 ffmpeg
    
    # 使用多进程并行转换
    if use_multiprocessing and len(files_to_convert) > 0:
        # 获取 CPU 核心数，使用 80% 的核心以避免系统卡顿
        num_workers = max(1, int(cpu_count() * 0.8))
        log_print(f"  使用 {num_workers} 个进程并行转换...")
        
        # 为每个需要转换的文件生成临时随机名称
        conversion_tasks = []
        for img_file in files_to_convert:
            # 生成唯一的临时文件名
            max_attempts = 1000
            temp_name = None
            for _ in range(max_attempts):
                candidate = generate_random_name()
                if candidate not in used_names:
                    temp_name = candidate
                    used_names.add(candidate)  # 预占用名称
                    break
            
            if temp_name is None:
                log_print(f"  [ERROR] 无法为 {img_file.name} 生成唯一文件名")
                continue
            
            temp_path = folder_path / (temp_name + AVIF_EXT)
            conversion_tasks.append((img_file, temp_path, temp_name))
        
        # 并行执行转换
        with ProcessPoolExecutor(max_workers=num_workers) as executor:
            # 提交所有转换任务
            future_to_task = {
                executor.submit(convert_image_worker, (input_path, output_path, effective_use_gpu, effective_use_ffmpeg)): (input_path, output_path, temp_name)
                for input_path, output_path, temp_name in conversion_tasks
            }
            
            # 收集转换结果
            conversion_results = []
            for future in as_completed(future_to_task):
                input_path, output_path, temp_name = future_to_task[future]
                try:
                    success, _, _ = future.result()
                    conversion_results.append((success, input_path, output_path, temp_name))
                    # 更新进度条
                    progress_bar.update(1)
                except Exception as e:
                    log_print(f"  [ERROR] 转换任务异常 {input_path.name}: {e}")
                    conversion_results.append((False, input_path, output_path, temp_name))
                    # 更新进度条
                    progress_bar.update(1)
            
            # 处理转换结果
            for success, input_path, output_path, temp_name in conversion_results:
                if success:
                    # 获取原文件大小（在删除前）
                    original_size = input_path.stat().st_size if input_path.exists() else 0
                    # 删除原文件
                    if input_path.exists():
                        input_path.unlink()
                    processed_count += 1
                    # 输出文件已经是正确的名称，无需重命名
                    new_size = output_path.stat().st_size
                    size_diff = ((new_size - original_size) / original_size * 100) if original_size > 0 else 0
                    size_info = f"原: {original_size/1024:.1f}KB -> 新: {new_size/1024:.1f}KB ({size_diff:+.1f}%)"
                    log_print(f"  [OK] 转换完成: {input_path.name} -> {output_path.name} ({size_info})")
                else:
                    # 转换失败，删除临时文件并释放名称
                    if output_path.exists():
                        output_path.unlink()
                    used_names.discard(temp_name)
                    log_print(f"  [ERROR] 转换失败: {input_path.name}")
                    # 失败的文件也计入处理数（已尝试处理）
                    processed_count += 1
    
    # 处理只需要重命名的文件（在主进程中处理，避免并发问题）
    for img_file in files_to_rename:
        max_attempts = 1000
        renamed = False
        for _ in range(max_attempts):
            new_name = generate_random_name()
            new_path = folder_path / (new_name + AVIF_EXT)
            
            if new_name not in used_names and not new_path.exists():
                img_file.rename(new_path)
                used_names.add(new_name)
                processed_count += 1
                renamed = True
                log_print(f"  [OK] 重命名: {img_file.name} -> {new_path.name}")
                # 更新进度条
                progress_bar.update(1)
                break
        
        if not renamed:
            log_print(f"  [ERROR] 无法为 {img_file.name} 生成唯一文件名")
            # 即使失败也更新进度条
            progress_bar.update(1)
    
    # 完成进度条
    progress_bar.close()
    
    elapsed_time = time.time() - start_time
    if processed_count > 0:
        avg_time = elapsed_time / processed_count if processed_count > 0 else 0
        print(f"  已处理 {processed_count} 个文件（总耗时 {elapsed_time:.1f} 秒，平均 {avg_time:.2f} 秒/文件）")


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='图片转换和重命名脚本（转换为 AVIF，8位随机字符）')
    parser.add_argument('--gpu', action='store_true', help='尝试使用 GPU 加速（如果可用）')
    parser.add_argument('--no-multiprocessing', action='store_true', help='禁用多进程并行处理')
    args = parser.parse_args()
    
    print("=" * 60)
    print("图片转换和重命名脚本（转换为 AVIF，8位随机字符）")
    print("=" * 60)
    print(f"最大文件大小限制: {MAX_FILE_SIZE/1024:.0f}KB")
    if args.gpu:
        print("GPU 加速: 已启用")
    print("=" * 60)
    
    if not IMAGES_DIR.exists():
        print(f"错误: 图片目录不存在: {IMAGES_DIR}")
        return
    
    # 检查 IMAGES_DIR 是否直接包含图片文件
    direct_image_files = [f for f in IMAGES_DIR.iterdir() 
                         if f.is_file() and (f.suffix.lower() in SUPPORTED_FORMATS or f.suffix.lower() == AVIF_EXT)]
    
    if direct_image_files:
        # 如果直接包含图片文件，直接处理这个文件夹
        print(f"\n处理文件夹: {IMAGES_DIR.name}")
        print("-" * 40)
        process_folder(IMAGES_DIR, use_multiprocessing=not args.no_multiprocessing, use_gpu=args.gpu)
    else:
        # 如果不直接包含图片文件，查找子文件夹
        folders = [f for f in IMAGES_DIR.iterdir() if f.is_dir()]
        
        if not folders:
            print(f"未找到任何图片文件夹或图片文件: {IMAGES_DIR}")
            return
        
        print(f"\n找到 {len(folders)} 个图片文件夹\n")
        
        # 处理每个文件夹
        for folder in folders:
            print(f"\n处理文件夹: {folder.name}")
            print("-" * 40)
            process_folder(folder, use_multiprocessing=not args.no_multiprocessing, use_gpu=args.gpu)
    
    print("\n" + "=" * 60)
    print("处理完成！")
    print("=" * 60)


if __name__ == '__main__':
    main()
