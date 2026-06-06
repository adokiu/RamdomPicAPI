import os
import shutil
from PIL import Image

INPUT_DIR = r"E:\CodeProject\randomPicAPI\待处理图片\洛天依"
OUTPUT_DIR = r"E:\CodeProject\randomPicAPI\已处理图片\洛天依"

LANDSCAPE_W, LANDSCAPE_H = 2560, 1440
PORTRAIT_W, PORTRAIT_H = 1440, 2560

LANDSCAPE_DIR = os.path.join(OUTPUT_DIR, "横屏")
PORTRAIT_DIR = os.path.join(OUTPUT_DIR, "竖屏")
LOWRES_DIR = os.path.join(OUTPUT_DIR, "低分辨率")

for d in [LANDSCAPE_DIR, PORTRAIT_DIR, LOWRES_DIR]:
    os.makedirs(d, exist_ok=True)

INPUT_DIRS = [
    INPUT_DIR,
    os.path.join(OUTPUT_DIR, "超分"),
]

for src_dir in INPUT_DIRS:
    if not os.path.exists(src_dir):
        print(f"跳过不存在的目录: {src_dir}")
        continue

    for filename in os.listdir(src_dir):
        ext = os.path.splitext(filename)[1].lower()
        if ext not in {".jpg", ".jpeg", ".png", ".avif", ".webp", ".bmp", ".gif"}:
            continue

        src = os.path.join(src_dir, filename)
        try:
            with Image.open(src) as img:
                w, h = img.size

                if w >= h:
                    # 横屏或正方形标准
                    if w < LANDSCAPE_W or h < LANDSCAPE_H:
                        dst = os.path.join(LOWRES_DIR, filename)
                    else:
                        dst = os.path.join(LANDSCAPE_DIR, filename)
                else:
                    # 竖屏标准
                    if w < PORTRAIT_W or h < PORTRAIT_H:
                        dst = os.path.join(LOWRES_DIR, filename)
                    else:
                        dst = os.path.join(PORTRAIT_DIR, filename)

                shutil.copy2(src, dst)
                print(f"已分类: {filename} ({w}x{h}) -> {os.path.basename(os.path.dirname(dst))}")
        except Exception as e:
            print(f"处理失败: {filename}, 错误: {e}")

print("\n分类完成")
print(f"横屏: {len(os.listdir(LANDSCAPE_DIR))}")
print(f"竖屏: {len(os.listdir(PORTRAIT_DIR))}")
print(f"低分辨率: {len(os.listdir(LOWRES_DIR))}")
