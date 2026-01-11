/**
 * 随机图片API配置
 * 配置路径映射：访问路径 -> 图片目录
 */
export const imageConfig = {
  // 访问 /a 时，从 /images/a 目录随机选择图片
  '/pc-miku': '/images/pc-miku',
  '/mb-miku': '/images/mb-miku',
} as const;

// 支持的图片格式
export const supportedImageTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
] as const;

// 默认缓存时间（秒）
export const cacheMaxAge = 3600; // 1小时

