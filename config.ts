/**
 * 随机图片 API 配置
 * 适用于 Cloudflare Pages / EdgeOne Pages / ESA Pages
 * 纯 302 重定向逻辑，图片列表从预生成的 image-list.ts 获取
 */

// 图片资源站 URL（不带末尾斜杠）
export const imageBaseUrl = 'https://img.yaooa.cn';

// PC 端接口配置
export const pcImageConfig = {
  '/pc-miku':  { dir: '/images/pc-miku',  name: 'PC 初音' },
  '/acg-fj':   { dir: '/images/acg-fj',   name: 'ACG 风景' },
  '/pc-lty':   { dir: '/images/pc-lty',   name: 'PC 洛天依' },
  '/pc-sr':    { dir: '/images/pc-sr',    name: 'PC 星穹铁道' },
} as const;

// 移动端接口配置
export const mobileImageConfig = {
  '/mb-miku':  { dir: '/images/mb-miku',  name: '移动端初音' },
} as const;

// 合并全部接口（向后兼容）
export const imageConfig = {
  ...pcImageConfig,
  ...mobileImageConfig,
} as const;

/** 自适应路由：同一端点根据设备类型返回不同目录的图片 */
export const adaptiveRoutes: Record<string, { pc: keyof typeof imageConfig; mobile: keyof typeof imageConfig; name: string }> = {
  '/miku': { pc: '/pc-miku', mobile: '/mb-miku', name: '初音自适应' },
};

export type ImageConfigItem = {
  dir: string;
  name: string;
};

