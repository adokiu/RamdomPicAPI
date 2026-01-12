#!/usr/bin/env python3
"""
CDN 资源预热工具
- 图形界面设置 host 和线程数
- 显示进度条、ETA 和当前带宽
- 从 config.ts 和 image-list.ts 读取索引构建 URL
- 支持全量/增量预热模式
- 缓存已预热的 URL 记录
"""

import os
import re
import sys
import time
import json
import threading
import tkinter as tk
from tkinter import ttk, messagebox
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
from collections import deque
from datetime import datetime
import ssl

# 禁用 SSL 密钥日志，避免权限问题
if 'SSLKEYLOGFILE' in os.environ:
    del os.environ['SSLKEYLOGFILE']

# 获取脚本所在目录
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
CACHE_FILE = os.path.join(SCRIPT_DIR, 'warmup_cache.json')


def read_config():
    """从 config.ts 读取配置"""
    config_path = os.path.join(PROJECT_DIR, 'config.ts')
    with open(config_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 匹配 imageConfig 对象
    config_match = re.search(r"export\s+const\s+imageConfig\s*=\s*\{([\s\S]*?)\}\s*as\s+const", content)
    if not config_match:
        raise ValueError("无法从 config.ts 中读取 imageConfig 配置")
    
    config_body = config_match.group(1)
    image_config = {}
    
    # 解析配置项
    entry_pattern = re.compile(r"['\"]([^'\"]+)['\"]\s*:\s*\{\s*dir\s*:\s*['\"]([^'\"]+)['\"]")
    for match in entry_pattern.finditer(config_body):
        key = match.group(1)
        dir_path = match.group(2)
        if not key.startswith('/'):
            key = '/' + key
        image_config[key] = dir_path
    
    return image_config


def read_image_list():
    """从 image-list.ts 读取图片列表"""
    image_list_path = os.path.join(PROJECT_DIR, 'image-list.ts')
    with open(image_list_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    image_list = {}
    
    # 匹配每个路径的图片数组
    path_pattern = re.compile(r'"([^"]+)":\s*\[([\s\S]*?)\]')
    for match in path_pattern.finditer(content):
        path_key = match.group(1)
        images_str = match.group(2)
        
        # 提取所有图片文件名
        image_pattern = re.compile(r'"([^"]+)"')
        images = [m.group(1) for m in image_pattern.finditer(images_str)]
        image_list[path_key] = images
    
    return image_list


def get_api_list():
    """获取所有 API 路径列表"""
    config = read_config()
    return list(config.keys())


def build_urls(host, selected_api=None):
    """构建完整的 URL 列表
    
    Args:
        host: CDN 主机地址
        selected_api: 指定的 API 路径，None 表示全部
    """
    config = read_config()
    image_list = read_image_list()
    
    urls = []
    for path_key, dir_path in config.items():
        # 如果指定了 API，只处理该 API
        if selected_api and selected_api != "全部" and path_key != selected_api:
            continue
        images = image_list.get(path_key, [])
        for image in images:
            url = f"{host.rstrip('/')}{dir_path}/{image}"
            urls.append(url)
    
    return urls


def load_cache():
    """加载已预热的 URL 缓存"""
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return {"warmed_urls": [], "last_update": None}


def save_cache(cache):
    """保存已预热的 URL 缓存"""
    cache["last_update"] = datetime.now().isoformat()
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def get_incremental_urls(all_urls, cache):
    """获取增量 URL（未预热过的）"""
    warmed_set = set(cache.get("warmed_urls", []))
    return [url for url in all_urls if url not in warmed_set]


class BandwidthTracker:
    """带宽追踪器 - 基于实际时间窗口计算"""
    def __init__(self, window_seconds=5):
        self.samples = deque()  # (timestamp, bytes)
        self.lock = threading.Lock()
        self.window_seconds = window_seconds
        self.total_bytes = 0
        self.start_time = None
    
    def add_sample(self, bytes_downloaded, duration):
        now = time.time()
        with self.lock:
            if self.start_time is None:
                self.start_time = now
            self.samples.append((now, bytes_downloaded))
            self.total_bytes += bytes_downloaded
            # 清理过期样本
            cutoff = now - self.window_seconds
            while self.samples and self.samples[0][0] < cutoff:
                self.samples.popleft()
    
    def get_bandwidth(self):
        """获取最近时间窗口内的平均带宽"""
        now = time.time()
        with self.lock:
            if not self.samples:
                return 0
            # 清理过期样本
            cutoff = now - self.window_seconds
            while self.samples and self.samples[0][0] < cutoff:
                self.samples.popleft()
            if not self.samples:
                return 0
            # 计算时间窗口内的带宽
            window_bytes = sum(s[1] for s in self.samples)
            oldest = self.samples[0][0]
            elapsed = now - oldest
            if elapsed <= 0:
                return 0
            return window_bytes / elapsed  # bytes per second
    
    def get_average_bandwidth(self):
        """获取整体平均带宽"""
        with self.lock:
            if self.start_time is None:
                return 0
            elapsed = time.time() - self.start_time
            if elapsed <= 0:
                return 0
            return self.total_bytes / elapsed


class CDNWarmupApp:
    def __init__(self, root):
        self.root = root
        self.root.title("CDN 资源预热工具")
        self.root.geometry("600x500")
        self.root.resizable(True, True)
        
        self.is_running = False
        self.should_stop = False
        self.completed = 0
        self.failed = 0
        self.total = 0
        self.start_time = 0
        self.bandwidth_tracker = BandwidthTracker()
        self.cache = load_cache()
        self.warmed_this_session = []
        
        self.setup_ui()
    
    def setup_ui(self):
        # 主框架
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # 设置区域
        settings_frame = ttk.LabelFrame(main_frame, text="设置", padding="10")
        settings_frame.pack(fill=tk.X, pady=(0, 10))
        
        # Host 输入
        host_frame = ttk.Frame(settings_frame)
        host_frame.pack(fill=tk.X, pady=(0, 5))
        ttk.Label(host_frame, text="CDN Host:").pack(side=tk.LEFT)
        self.host_var = tk.StringVar(value="https://api.yaooa.cn")
        self.host_entry = ttk.Entry(host_frame, textvariable=self.host_var, width=40)
        self.host_entry.pack(side=tk.LEFT, padx=(10, 0), fill=tk.X, expand=True)
        
        # API 选择
        api_frame = ttk.Frame(settings_frame)
        api_frame.pack(fill=tk.X, pady=(0, 5))
        ttk.Label(api_frame, text="API 路径:").pack(side=tk.LEFT)
        try:
            api_list = ["全部"] + get_api_list()
        except:
            api_list = ["全部"]
        self.api_var = tk.StringVar(value="全部")
        self.api_combo = ttk.Combobox(api_frame, textvariable=self.api_var, values=api_list, state="readonly", width=20)
        self.api_combo.pack(side=tk.LEFT, padx=(10, 0))
        
        # 线程数输入
        thread_frame = ttk.Frame(settings_frame)
        thread_frame.pack(fill=tk.X, pady=(0, 5))
        ttk.Label(thread_frame, text="线程数:").pack(side=tk.LEFT)
        self.thread_var = tk.StringVar(value="10")
        self.thread_spinbox = ttk.Spinbox(thread_frame, from_=1, to=100, textvariable=self.thread_var, width=10)
        self.thread_spinbox.pack(side=tk.LEFT, padx=(10, 0))
        
        # 预热模式选择
        mode_frame = ttk.Frame(settings_frame)
        mode_frame.pack(fill=tk.X, pady=(0, 5))
        ttk.Label(mode_frame, text="预热模式:").pack(side=tk.LEFT)
        self.mode_var = tk.StringVar(value="incremental")
        ttk.Radiobutton(mode_frame, text="增量（仅新增）", variable=self.mode_var, value="incremental").pack(side=tk.LEFT, padx=(10, 0))
        ttk.Radiobutton(mode_frame, text="全量（全部重新预热）", variable=self.mode_var, value="full").pack(side=tk.LEFT, padx=(10, 0))
        
        # 缓存信息
        cache_frame = ttk.Frame(settings_frame)
        cache_frame.pack(fill=tk.X, pady=(0, 5))
        cached_count = len(self.cache.get("warmed_urls", []))
        last_update = self.cache.get("last_update", "从未")
        self.cache_label = ttk.Label(cache_frame, text=f"缓存: {cached_count} 个已预热 | 上次更新: {last_update[:19] if last_update and last_update != '从未' else last_update}")
        self.cache_label.pack(side=tk.LEFT)
        ttk.Button(cache_frame, text="清除缓存", command=self.clear_cache).pack(side=tk.RIGHT)
        
        # 按钮区域
        btn_frame = ttk.Frame(settings_frame)
        btn_frame.pack(fill=tk.X, pady=(10, 0))
        self.start_btn = ttk.Button(btn_frame, text="开始预热", command=self.start_warmup)
        self.start_btn.pack(side=tk.LEFT)
        self.stop_btn = ttk.Button(btn_frame, text="停止", command=self.stop_warmup, state=tk.DISABLED)
        self.stop_btn.pack(side=tk.LEFT, padx=(10, 0))
        
        # 统计信息区域
        stats_frame = ttk.LabelFrame(main_frame, text="统计信息", padding="10")
        stats_frame.pack(fill=tk.X, pady=(0, 10))
        
        # 统计标签
        self.stats_labels = {}
        stats_grid = ttk.Frame(stats_frame)
        stats_grid.pack(fill=tk.X)
        
        labels = [("total", "总数:"), ("completed", "已完成:"), ("failed", "失败:"), 
                  ("bandwidth", "带宽:"), ("eta", "剩余时间:")]
        for i, (key, text) in enumerate(labels):
            row = i // 3
            col = (i % 3) * 2
            ttk.Label(stats_grid, text=text).grid(row=row, column=col, sticky=tk.W, padx=(0, 5))
            label = ttk.Label(stats_grid, text="0")
            label.grid(row=row, column=col+1, sticky=tk.W, padx=(0, 20))
            self.stats_labels[key] = label
        
        # 进度条
        progress_frame = ttk.LabelFrame(main_frame, text="进度", padding="10")
        progress_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.progress_var = tk.DoubleVar(value=0)
        self.progress_bar = ttk.Progressbar(progress_frame, variable=self.progress_var, maximum=100)
        self.progress_bar.pack(fill=tk.X)
        
        self.progress_label = ttk.Label(progress_frame, text="0%")
        self.progress_label.pack(pady=(5, 0))
        
        # 日志区域
        log_frame = ttk.LabelFrame(main_frame, text="日志", padding="10")
        log_frame.pack(fill=tk.BOTH, expand=True)
        
        self.log_text = tk.Text(log_frame, height=8, state=tk.DISABLED)
        self.log_text.pack(fill=tk.BOTH, expand=True, side=tk.LEFT)
        
        scrollbar = ttk.Scrollbar(log_frame, orient=tk.VERTICAL, command=self.log_text.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.log_text.config(yscrollcommand=scrollbar.set)
    
    def log(self, message, force=False):
        """添加日志，限制更新频率避免 UI 卡死"""
        now = time.time()
        # 限制日志更新频率（除非是强制更新）
        if not force and hasattr(self, '_last_log_time') and now - self._last_log_time < 0.5:
            return
        self._last_log_time = now
        
        def _log():
            try:
                self.log_text.config(state=tk.NORMAL)
                self.log_text.insert(tk.END, f"{time.strftime('%H:%M:%S')} {message}\n")
                self.log_text.see(tk.END)
                self.log_text.config(state=tk.DISABLED)
            except:
                pass
        self.root.after(0, _log)
    
    def update_stats(self):
        if self.total > 0:
            progress = (self.completed + self.failed) / self.total * 100
            self.progress_var.set(progress)
            self.progress_label.config(text=f"{progress:.1f}%")
        
        self.stats_labels["total"].config(text=str(self.total))
        self.stats_labels["completed"].config(text=str(self.completed))
        self.stats_labels["failed"].config(text=str(self.failed))
        
        # 带宽
        bandwidth = self.bandwidth_tracker.get_bandwidth()
        if bandwidth > 1024 * 1024:
            bandwidth_str = f"{bandwidth / 1024 / 1024:.2f} MB/s"
        elif bandwidth > 1024:
            bandwidth_str = f"{bandwidth / 1024:.2f} KB/s"
        else:
            bandwidth_str = f"{bandwidth:.0f} B/s"
        self.stats_labels["bandwidth"].config(text=bandwidth_str)
        
        # ETA
        done = self.completed + self.failed
        if done > 0 and self.start_time > 0:
            elapsed = time.time() - self.start_time
            rate = done / elapsed
            remaining = self.total - done
            if rate > 0:
                eta_seconds = remaining / rate
                if eta_seconds > 3600:
                    eta_str = f"{eta_seconds / 3600:.1f} 小时"
                elif eta_seconds > 60:
                    eta_str = f"{eta_seconds / 60:.1f} 分钟"
                else:
                    eta_str = f"{eta_seconds:.0f} 秒"
                self.stats_labels["eta"].config(text=eta_str)
            else:
                self.stats_labels["eta"].config(text="计算中...")
        else:
            self.stats_labels["eta"].config(text="计算中...")
    
    def clear_cache(self):
        """清除预热缓存"""
        if self.is_running:
            messagebox.showwarning("警告", "预热进行中，无法清除缓存")
            return
        self.cache = {"warmed_urls": [], "last_update": None}
        save_cache(self.cache)
        self.update_cache_label()
        self.log("缓存已清除")
    
    def update_cache_label(self):
        """更新缓存信息标签"""
        cached_count = len(self.cache.get("warmed_urls", []))
        last_update = self.cache.get("last_update", "从未")
        text = f"缓存: {cached_count} 个已预热 | 上次更新: {last_update[:19] if last_update and last_update != '从未' else last_update}"
        self.cache_label.config(text=text)
    
    def download_url(self, url):
        """下载 URL 但不保存"""
        if self.should_stop:
            return False, 0, url
        
        try:
            start = time.time()
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Referer': url.rsplit('/', 1)[0] + '/',
            }
            req = Request(url, headers=headers)
            # 创建不验证证书的 SSL 上下文（CDN 可能使用不同证书）
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            with urlopen(req, timeout=30, context=ssl_context) as response:
                data = response.read()
                duration = time.time() - start
                self.bandwidth_tracker.add_sample(len(data), duration)
                return True, len(data), url
        except (URLError, HTTPError) as e:
            # 只记录第一个错误用于调试
            if self.failed == 0:
                self.log(f"首个失败: {e}", force=True)
            return False, 0, url
        except Exception as e:
            if self.failed == 0:
                self.log(f"首个异常: {e}", force=True)
            return False, 0, url
    
    def warmup_worker(self, urls):
        """预热工作线程"""
        thread_count = int(self.thread_var.get())
        
        with ThreadPoolExecutor(max_workers=thread_count) as executor:
            futures = {executor.submit(self.download_url, url): url for url in urls}
            
            for future in as_completed(futures):
                if self.should_stop:
                    break
                
                success, size, url = future.result()
                if success:
                    self.completed += 1
                    self.warmed_this_session.append(url)
                else:
                    self.failed += 1
                
                # 每完成 50 个更新一次 UI，减少更新频率
                if (self.completed + self.failed) % 50 == 0:
                    self.root.after(0, self.update_stats)
        
        self.root.after(0, self.warmup_finished)
    
    def start_warmup(self):
        if self.is_running:
            return
        
        host = self.host_var.get().strip()
        if not host:
            messagebox.showerror("错误", "请输入 CDN Host")
            return
        
        try:
            thread_count = int(self.thread_var.get())
            if thread_count < 1 or thread_count > 100:
                raise ValueError()
        except ValueError:
            messagebox.showerror("错误", "线程数必须是 1-100 之间的整数")
            return
        
        selected_api = self.api_var.get()
        self.log(f"正在读取索引... (API: {selected_api})")
        try:
            all_urls = build_urls(host, selected_api)
        except Exception as e:
            messagebox.showerror("错误", f"读取索引失败: {e}")
            return
        
        if not all_urls:
            messagebox.showerror("错误", "没有找到任何图片 URL")
            return
        
        # 根据模式选择 URL
        mode = self.mode_var.get()
        if mode == "incremental":
            urls = get_incremental_urls(all_urls, self.cache)
            self.log(f"增量模式: 全部 {len(all_urls)} 个，新增 {len(urls)} 个")
            if not urls:
                messagebox.showinfo("提示", "没有新增的 URL 需要预热")
                return
        else:
            urls = all_urls
            self.log(f"全量模式: 共 {len(urls)} 个 URL")
        
        self.is_running = True
        self.should_stop = False
        self.completed = 0
        self.failed = 0
        self.total = len(urls)
        self.start_time = time.time()
        self.bandwidth_tracker = BandwidthTracker()
        self.warmed_this_session = []
        
        self.start_btn.config(state=tk.DISABLED)
        self.stop_btn.config(state=tk.NORMAL)
        self.host_entry.config(state=tk.DISABLED)
        self.thread_spinbox.config(state=tk.DISABLED)
        
        self.log(f"开始预热 {self.total} 个 URL，使用 {thread_count} 线程")
        self.update_stats()
        
        # 启动工作线程
        thread = threading.Thread(target=self.warmup_worker, args=(urls,), daemon=True)
        thread.start()
    
    def stop_warmup(self):
        self.should_stop = True
        self.log("正在停止...")
    
    def warmup_finished(self):
        self.is_running = False
        self.start_btn.config(state=tk.NORMAL)
        self.stop_btn.config(state=tk.DISABLED)
        self.host_entry.config(state=tk.NORMAL)
        self.thread_spinbox.config(state=tk.NORMAL)
        
        self.update_stats()
        
        # 保存缓存
        if self.warmed_this_session:
            existing = set(self.cache.get("warmed_urls", []))
            existing.update(self.warmed_this_session)
            self.cache["warmed_urls"] = list(existing)
            save_cache(self.cache)
            self.update_cache_label()
            self.log(f"缓存已更新，共 {len(existing)} 个 URL")
        
        elapsed = time.time() - self.start_time
        if self.should_stop:
            self.log(f"预热已停止。完成 {self.completed}，失败 {self.failed}，耗时 {elapsed:.1f} 秒")
        else:
            self.log(f"预热完成！成功 {self.completed}，失败 {self.failed}，耗时 {elapsed:.1f} 秒")


def main():
    root = tk.Tk()
    app = CDNWarmupApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
