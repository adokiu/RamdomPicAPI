import os
import shutil
import uuid
from concurrent.futures import ProcessPoolExecutor
from multiprocessing import cpu_count

import imagesize

INPUT_ROOT = r"E:\CodeProject\randomPicAPI\待处理图片"
OUTPUT_ROOT = r"E:\CodeProject\randomPicAPI\已处理图片"

LANDSCAPE_W, LANDSCAPE_H = 2560, 1440
PORTRAIT_W, PORTRAIT_H = 1440, 2560
LOWRES_LANDSCAPE_W, LOWRES_LANDSCAPE_H = 1920, 1080
LOWRES_PORTRAIT_W, LOWRES_PORTRAIT_H = 1080, 1920

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".avif", ".webp", ".bmp", ".gif"}


def get_unique_dst_path(dst_dir: str, filename: str) -> str:
    dst = os.path.join(dst_dir, filename)
    if not os.path.exists(dst):
        return dst
    name, ext = os.path.splitext(filename)
    while True:
        new_name = f"{name}_{uuid.uuid4().hex[:8]}{ext}"
        dst = os.path.join(dst_dir, new_name)
        if not os.path.exists(dst):
            return dst


def process_image(args: tuple[str, str]) -> tuple[str, str]:
    src_path, dst_root = args
    filename = os.path.basename(src_path)
    try:
        w, h = imagesize.get(src_path)
        if w < 0 or h < 0:
            return ("fail", filename)

        if w >= h:
            category = "低分辨率-横屏" if w < LOWRES_LANDSCAPE_W or h < LOWRES_LANDSCAPE_H else "横屏"
        else:
            category = "低分辨率-竖屏" if w < LOWRES_PORTRAIT_W or h < LOWRES_PORTRAIT_H else "竖屏"

        target_dir = os.path.join(dst_root, category)
        os.makedirs(target_dir, exist_ok=True)
        dst = get_unique_dst_path(target_dir, filename)
        shutil.move(src_path, dst)
        return ("ok", category)
    except Exception:
        return ("fail", filename)


def collect_images(root_dir: str) -> list[str]:
    images = []
    for dirpath, _, filenames in os.walk(root_dir):
        for filename in filenames:
            ext = os.path.splitext(filename)[1].lower()
            if ext in IMAGE_EXTS:
                images.append(os.path.join(dirpath, filename))
    return images


def process_subfolder(sub_name: str) -> None:
    src_root = os.path.join(INPUT_ROOT, sub_name)
    dst_root = os.path.join(OUTPUT_ROOT, sub_name)

    if not os.path.isdir(src_root):
        return

    for category in ("横屏", "竖屏", "低分辨率-横屏", "低分辨率-竖屏"):
        os.makedirs(os.path.join(dst_root, category), exist_ok=True)

    images = collect_images(src_root)
    if not images:
        print(f"[{sub_name}] 未找到图片")
        return

    total = len(images)
    print(f"[{sub_name}] 发现 {total} 张图片，开始分类...")

    args_list = [(img, dst_root) for img in images]
    workers = min(cpu_count() or 4, 16)

    ok = 0
    fail = 0
    stats = {"横屏": 0, "竖屏": 0, "低分辨率-横屏": 0, "低分辨率-竖屏": 0}

    with ProcessPoolExecutor(max_workers=workers) as executor:
        for result in executor.map(process_image, args_list, chunksize=64):
            status, info = result
            if status == "ok":
                ok += 1
                stats[info] += 1
            else:
                fail += 1

    print(f"[{sub_name}] 完成: 成功 {ok}/{total}, 失败 {fail}")
    for category in ("横屏", "竖屏", "低分辨率-横屏", "低分辨率-竖屏"):
        print(f"  {category}: {stats[category]}")
    print()


def main():
    if not os.path.exists(INPUT_ROOT):
        print(f"输入根目录不存在: {INPUT_ROOT}")
        return

    subfolders = [d for d in os.listdir(INPUT_ROOT) if os.path.isdir(os.path.join(INPUT_ROOT, d))]
    if not subfolders:
        print(f"未在 {INPUT_ROOT} 下发现任何子文件夹")
        return

    print(f"待处理子文件夹: {subfolders}\n")

    for sub_name in subfolders:
        process_subfolder(sub_name)


if __name__ == "__main__":
    main()
