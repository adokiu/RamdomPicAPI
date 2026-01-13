/**
 * 随机图片 API - 纯 302 重定向
 * 适用于 Cloudflare Pages / EdgeOne Pages / ESA Pages
 * 从预生成的 image-list.ts 读取图片列表，302 重定向到图片资源站
 */
import { imageConfig, imageBaseUrl } from '../config';
import { imageList } from '../image-list/index';
import { generateApiDocPage, generateGalleryPage } from '../src/utils';

/**
 * 从 image-list.ts 获取图片列表
 */
function getImageList(pathKey: string): string[] {
  return imageList[pathKey] || [];
}

export async function onRequest(
  context: {
    request: Request;
    params: { path: string | string[] };
    env?: {
      ASSETS?: {
        fetch: (request: Request) => Promise<Response>;
      };
    };
  }
): Promise<Response> {
  const { request, params, env } = context;
  
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const pathname = url.pathname;
  const pathSegments = Array.isArray(params.path) ? params.path : [params.path];
  const paramPath = `/${pathSegments[0]}`;
  
  // 静态文件透传（/icons/ 等 public 目录文件，但不包括 /images/）
  if (pathname.startsWith('/icons/') || pathname === '/favicon.ico') {
    if (env?.ASSETS?.fetch) {
      return env.ASSETS.fetch(new Request(new URL(pathname, url.origin)));
    }
    return new Response(null, { status: 404 });
  }
  
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
  if (pathname === '/' || pathSegments[0] === '' || pathSegments.length === 0) {
    return generateApiDocPage(url.origin);
  }
  
  // 图库路径
  if (pathname === '/gallery' || pathSegments[0] === 'gallery') {
    return generateGalleryPage(url.origin);
  }
  
  // API 路径匹配
  const configItem = imageConfig[paramPath as keyof typeof imageConfig];
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
  const images = getImageList(paramPath);
  if (images.length === 0) {
    return new Response(JSON.stringify({ 
      error: 'No images found',
      hint: "Run 'npm run generate' to generate image list"
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
}

