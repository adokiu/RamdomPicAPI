/**
 * 随机图片 API - 纯 302 重定向
 * 适用于 Cloudflare Pages / EdgeOne Pages / ESA Pages
 * 从预生成的 image-list.ts 读取图片列表，302 重定向到图片资源站
 */
import { imageConfig, adaptiveRoutes, imageBaseUrl } from '../config.js';
import { imageList } from '../image-list/index.js';
import { generateApiDocPage, generateGalleryPage, isMobile } from '../src/utils.js';

/**
 * 从 image-list.ts 获取图片列表
 */
function getImageList(pathKey: string): string[] {
  return imageList[pathKey] || [];
}

const UMAMI_WEBSITE_ID = '42dd4d2a-b57c-4021-8fb0-ad9373348ca7';

export async function onRequest(
  context: {
    request: Request;
    params: { path: string | string[] };
    env?: {
      ASSETS?: {
        fetch: (request: Request) => Promise<Response>;
      };
    };
    waitUntil?: (promise: Promise<any>) => void;
  }
): Promise<Response> {
  const { request, params, env, waitUntil } = context;
  
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

  function trackUmami(req: Request): Promise<void> {
    return new Promise((resolve) => {
      try {
        const u = new URL(req.url);
        const payload = {
          type: 'event',
          payload: {
            website: UMAMI_WEBSITE_ID,
            hostname: u.hostname,
            url: u.pathname,
            referrer: req.headers.get('referer') || '',
            language: req.headers.get('accept-language') || '',
            title: u.pathname,
          },
        };
        fetch('https://umami.2o.nz/api/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': req.headers.get('user-agent') || '',
          },
          body: JSON.stringify(payload),
        }).then(() => resolve()).catch(() => resolve());
      } catch (e) {
        resolve();
      }
    });
  }

  // 自适应路由：根据 UA 决定使用 PC 还是移动端图片列表
  const adaptiveRoute = adaptiveRoutes[paramPath];
  if (adaptiveRoute) {
    const ua = request.headers.get('user-agent') || '';
    const targetPath = isMobile(ua) ? adaptiveRoute.mobile : adaptiveRoute.pc;
    const targetConfig = imageConfig[targetPath];
    const images = getImageList(targetPath);
    if (images.length === 0) {
      return new Response(JSON.stringify({ error: 'No images found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (waitUntil) {
      waitUntil(trackUmami(request));
    } else {
      trackUmami(request);
    }
    const randomImage = images[Math.floor(Math.random() * images.length)];
    const imageUrl = `${imageBaseUrl}${targetConfig.dir}/${randomImage}`;
    return new Response(null, {
      status: 302,
      headers: {
        'Location': imageUrl,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  // API 路径匹配
  const configItem = imageConfig[paramPath as keyof typeof imageConfig];
  if (!configItem) {
    return new Response(JSON.stringify({ 
      error: 'Path not found',
      availablePaths: [...Object.keys(imageConfig), ...Object.keys(adaptiveRoutes)]
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
  
  if (waitUntil) {
    waitUntil(trackUmami(request));
  } else {
    trackUmami(request);
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

