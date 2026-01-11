# 图片转换和文件夹重命名脚本

## 功能

这个脚本会：
1. 将所有非 AVIF 格式的图片转换为 AVIF 格式
2. 将所有图片文件夹名转换为 base64 编码
3. 自动跳过已经符合条件的文件和文件夹
4. 自动更新 `config.ts` 中的路径映射

## 安装依赖

```bash
pip install -r scripts/requirements.txt
```

或者手动安装：

```bash
pip install Pillow pillow-avif-plugin
```

## 使用方法

在项目根目录运行：

```bash
python scripts/convert_images.py
```

或者在 Windows PowerShell 中：

```powershell
python scripts\convert_images.py
```

## 注意事项

1. **备份数据**：运行脚本前建议备份 `public/images` 目录和 `config.ts` 文件
2. **AVIF 支持**：确保已安装 `pillow-avif-plugin`，否则 AVIF 转换会失败
3. **文件覆盖**：脚本会删除原始图片文件（转换后），请确保有备份
4. **文件夹名**：文件夹名会被转换为 base64 编码，例如 `pc-miku` 会变成 `cGMtbWlrdQ`
5. **跳过逻辑**：
   - 已经是 `.avif` 格式的文件会被跳过
   - 文件夹名如果已经是 base64 编码（可以成功解码）会被跳过

## 示例输出

```
============================================================
图片转换和文件夹重命名脚本
============================================================

找到 1 个图片文件夹

处理文件夹: pc-miku
----------------------------------------
重命名文件夹: pc-miku -> cGMtbWlrdQ
  找到 45 个需要转换的文件，31 个 AVIF 文件（已跳过）
  ✓ 转换: image1.webp -> image1.avif
  ✓ 转换: image2.jpg -> image2.avif
  ...
  已转换 45 个文件

✓ 已更新配置文件: config.ts
  更新的映射:
    pc-miku -> cGMtbWlrdQ

============================================================
处理完成！
============================================================
```

