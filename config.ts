/**
 * 随机图片 API 配置
 * 适用于 Cloudflare Pages / EdgeOne Pages / ESA Pages
 * 纯 302 重定向逻辑，图片列表从预生成的 image-list.ts 获取
 */

// 图片资源站 URL（不带末尾斜杠）
export const imageBaseUrl = 'https://img.yaooa.cn';

// API 接口配置
export const imageConfig = {
  '/pc-miku': { dir: '/images/pc-miku', name: 'PC 初音' },
  '/mb-miku': { dir: '/images/mb-miku', name: '移动端初音' },
  '/acg-fj': { dir: '/images/acg-fj', name: 'ACG 风景' },
  '/pc-lty': { dir: '/images/pc-lty', name: 'PC 洛天依' },
  '/pc-sr': { dir: '/images/pc-sr', name: 'PC 星穹铁道' },
} as const;

export type ImageConfigItem = {
  dir: string;
  name: string;
};

