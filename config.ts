/**
 * 随机图片API配置
 * 配置路径映射：访问路径 -> 图片目录
 */
export type ImageConfigItem = {
  dir: string;
  name: string;
};

export const imageConfig = {
  '/pc-miku': { dir: '/images/pc-miku', name: 'PC 初音' },
  '/mb-miku': { dir: '/images/mb-miku', name: '移动端初音' },
  '/acg-fj': { dir: '/images/acg-fj', name: 'ACG 风景' },
  '/pc-lty': { dir: '/images/pc-lty', name: 'PC 洛天依' },
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

