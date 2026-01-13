/**
 * 阿里云 ESA Pages 边缘函数入口
 * 处理所有请求，返回首页、图库或 302 重定向
 */
import { imageConfig, imageBaseUrl } from '../config';
import { imageList } from '../image-list/index';
import { generateApiDocPage, generateGalleryPage } from './utils';

/**
 * 从 image-list 获取图片列表
 */
function getImageList(pathKey: string): string[] {
  return imageList[pathKey] || [];
}

/**
 * ESA 边缘函数入口
 */
export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // /images/ 路径重定向到图片资源站
    if (pathname.startsWith('/images/')) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${imageBaseUrl}${pathname}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // 根路径返回首页
    if (pathname === '/' || pathname === '') {
      return generateApiDocPage(url.origin);
    }

    // 图库路径
    if (pathname === '/gallery') {
      return generateGalleryPage(url.origin);
    }

    // API 路径匹配
    const configItem = imageConfig[pathname as keyof typeof imageConfig];
    if (!configItem) {
      return new Response(JSON.stringify({ 
        error: 'Path not found',
        availablePaths: Object.keys(imageConfig)
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 从预生成的列表获取图片
    const images = getImageList(pathname);
    if (images.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No images found',
        hint: "Run Python script to generate image list"
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 随机选择并 302 重定向到图片资源站
    const randomImage = images[Math.floor(Math.random() * images.length)];
    const imageUrl = `${imageBaseUrl}${configItem.dir}/${randomImage}`;

    return new Response(null, {
      status: 302,
      headers: {
        'Location': imageUrl,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  },
};
