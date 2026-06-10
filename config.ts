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
  '/fj':       { dir: '/images/fj',      name: '风景' },
  '/pc-lty':   { dir: '/images/pc-lty',   name: 'PC 洛天依' },
  '/pc-sr':    { dir: '/images/pc-sr',    name: 'PC 星穹铁道' },
  '/pc-dfproject': { dir: '/images/pc-dfproject', name: 'PC 东方Project' },
  '/pc-moe':   { dir: '/images/pc-moe',   name: 'PC 萌图' },
  '/pc-ys':    { dir: '/images/pc-ys',    name: 'PC 原神' },
} as const;

// 移动端接口配置
export const mobileImageConfig = {
  '/mb-miku':  { dir: '/images/mb-miku',  name: '移动端初音' },
  '/mb-acg-fj': { dir: '/images/mb-acg-fj', name: '移动端 ACG 风景' },
  '/mb-dfproject': { dir: '/images/mb-dfproject', name: '移动端东方Project' },
  '/mb-lty':   { dir: '/images/mb-lty',   name: '移动端洛天依' },
  '/mb-moe':   { dir: '/images/mb-moe',   name: '移动端萌图' },
  '/mb-sr':    { dir: '/images/mb-sr',    name: '移动端星穹铁道' },
  '/mb-ys':    { dir: '/images/mb-ys',    name: '移动端原神' },
} as const;

// 合并全部接口（向后兼容）
export const imageConfig = {
  ...pcImageConfig,
  ...mobileImageConfig,
} as const;

/** 自适应路由：同一端点根据设备类型返回不同目录的图片 */
export const adaptiveRoutes: Record<string, { pc: keyof typeof imageConfig; mobile: keyof typeof imageConfig; name: string }> = {
  '/miku': { pc: '/pc-miku', mobile: '/mb-miku', name: '初音自适应' },
  '/acg-fj': { pc: '/acg-fj', mobile: '/mb-acg-fj', name: 'ACG风景自适应' },
  '/dfproject': { pc: '/pc-dfproject', mobile: '/mb-dfproject', name: '东方Project自适应' },
  '/lty': { pc: '/pc-lty', mobile: '/mb-lty', name: '洛天依自适应' },
  '/moe': { pc: '/pc-moe', mobile: '/mb-moe', name: '萌图自适应' },
  '/sr': { pc: '/pc-sr', mobile: '/mb-sr', name: '星穹铁道自适应' },
  '/ys': { pc: '/pc-ys', mobile: '/mb-ys', name: '原神自适应' },
};

export type ImageConfigItem = {
  dir: string;
  name: string;
};

