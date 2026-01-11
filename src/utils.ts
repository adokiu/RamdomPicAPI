/**
 * 通用工具函数
 */
import { imageConfig } from '../config';

/**
 * 从数组中随机选择一个元素
 */
export function randomSelect<T>(array: T[]): T | null {
  if (array.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
}

/**
 * 验证路径是否在配置中
 */
export function isValidPath(pathname: string): boolean {
  const configKey = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return configKey in imageConfig;
}

/**
 * 获取路径对应的图片目录
 */
export function getImageDir(pathname: string): string | null {
  const configKey = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return imageConfig[configKey as keyof typeof imageConfig] || null;
}

/**
 * 过滤图片文件
 */
export function isImageFile(filename: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(filename);
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  message: string,
  status: number = 500,
  additionalInfo?: Record<string, any>
): Response {
  return new Response(
    JSON.stringify({
      error: message,
      ...additionalInfo,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * 创建重定向响应
 */
export function createRedirectResponse(
  url: string,
  status: number = 302,
  cacheMaxAge: number = 3600
): Response {
  // 如果缓存时间为 0，使用 no-cache 禁用缓存
  const cacheControl = cacheMaxAge === 0 
    ? 'no-cache, no-store, must-revalidate' 
    : `public, max-age=${cacheMaxAge}`;
  
  return new Response(null, {
    status,
    headers: {
      Location: url,
      'Cache-Control': cacheControl,
    },
  });
}

