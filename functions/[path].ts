/**
 * Cloudflare Pages Functions 实现
 * 使用通配符路径处理所有图片路径请求
 * 从预生成的 image-list.ts 读取图片列表（构建时生成）
 */
import { imageConfig } from '../config';
import { imageList } from '../image-list';
import { createImageResponse, fixImageResponseHeaders } from '../src/utils';

// 服务器侧打点，避免直接访问静态图片时漏计数
async function sendUmamiPageview(url: URL, title: string, request: Request) {
  try {
    // Umami /api/send 端点格式：使用 POST 请求，type 必须是 "event" 或 "identify"
    const websiteId = 'f3200a83-8a62-463f-afb1-72f029ee2115';
    const referrer = request.headers.get('Referer') || '';
    const userAgent = request.headers.get('User-Agent') || 'Server';
    const language = request.headers.get('Accept-Language')?.split(',')[0]?.split('-')[0] || 'en';
    
    // Umami API 格式：type 必须是 "event" 或 "identify"
    const payload = {
      type: 'event',
      payload: {
        website: websiteId,
        url: url.pathname,
        hostname: url.hostname,
        referrer: referrer,
        title: title || url.pathname,
        language: language,
        // event_name 用于标识事件类型，pageview 是页面浏览
        event_name: 'pageview',
      },
    };
    
    console.log('[Umami] Tracking:', url.pathname, title);
    const response = await fetch('https://umami.2o.nz/api/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[Umami] Track failed:', response.status, response.statusText, errorText);
    } else {
      console.log('[Umami] Track success:', url.pathname);
    }
  } catch (err) {
    // 打点失败不影响主流程
    console.error('[Umami] Track error:', err);
  }
}

// 确保在 Cloudflare Pages 中不会因提前返回而取消异步任务
async function track(
  context: { waitUntil?: (p: Promise<any>) => void; request: Request },
  url: URL,
  title: string
) {
  const promise = sendUmamiPageview(url, title, context.request);
  if (typeof context.waitUntil === 'function') {
    // 生产环境：使用 waitUntil 确保请求完成
    context.waitUntil(promise);
  } else {
    // 开发环境：等待请求完成（最多等待500ms），确保计数被发送
    // 使用 Promise.race 设置超时，避免阻塞太久
    try {
      await Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 500))
      ]);
    } catch (err) {
      // 超时或失败不影响主流程，但至少尝试发送了请求
      if (err instanceof Error && err.message !== 'Timeout') {
        console.error('[Umami] Track promise rejected:', err);
      }
    }
  }
}

/**
 * 从 image-list.ts 获取图片列表
 */
function getImageList(pathKey: string): string[] {
  return imageList[pathKey] || [];
}

export async function onRequest(
  context: {
    request: Request;
    params: { path: string };
    env?: {
      ASSETS?: {
        fetch: (request: Request) => Promise<Response>;
      };
    };
    waitUntil?: (p: Promise<any>) => void;
  }
): Promise<Response> {
  const { request, params, env } = context;
  
  // 只允许 GET 请求
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const url = new URL(request.url);
  // 使用完整的 pathname 来检查，更可靠
  const pathname = url.pathname;
  const paramPath = `/${params.path}`;
  
  // 如果路径以 /images/ 开头，说明是静态文件请求
  // 使用 ASSETS.fetch() 或 fetch() 获取静态文件
  if (pathname.startsWith('/images/')) {
    const filename = pathname.split('/').pop() || '';
    // 静态图片也计数
    await track({ ...context, request }, url, filename);
    
    // 优先使用 env.ASSETS.fetch()（Cloudflare Pages 推荐方式）
    if (env?.ASSETS?.fetch) {
      const staticRequest = new Request(new URL(pathname, url.origin));
      const staticResponse = await env.ASSETS.fetch(staticRequest);
      if (staticResponse.ok) {
        // 确保静态文件也设置正确的响应头，防止下载
        // 静态图片文件设置强缓存（1年 = 31536000秒）
        return await fixImageResponseHeaders(staticResponse, filename, 31536000);
      }
    } else {
      // 备用方案：使用 fetch() 获取静态文件
      const staticFileUrl = new URL(pathname, url.origin);
      const staticResponse = await fetch(staticFileUrl);
      if (staticResponse.ok) {
        // 确保静态文件也设置正确的响应头，防止下载
        // 静态图片文件设置强缓存（1年 = 31536000秒）
        return await fixImageResponseHeaders(staticResponse, filename, 31536000);
      }
    }
    return new Response(null, { status: 404 });
  }
  
  // 使用 paramPath 来匹配配置的路径（不包含 /images/ 前缀）
  const configItem = imageConfig[paramPath as keyof typeof imageConfig];
  const imageDir = configItem?.dir;
  
  // API 访问计数（无论后续是否命中路径）
  await track({ ...context, request }, url, paramPath);

  if (!configItem || !imageDir) {
    return new Response(
      JSON.stringify({ 
        error: 'Path not found',
        availablePaths: Object.keys(imageConfig)
      }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const resolvedDir = imageDir;
    const imageListArray = getImageList(paramPath);
    
    if (imageListArray.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No images found',
          hint: `Please run 'npm run generate' to generate image list before building`
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 随机选择一张图片
    const randomIndex = Math.floor(Math.random() * imageListArray.length);
    const selectedImage = imageListArray[randomIndex];
    const imagePath = `${resolvedDir}/${selectedImage}`;
    
    // 返回 302 重定向到实际图片路径（只改变路径，不改变 host）
    // 禁用缓存，确保每次访问都能随机选择不同的图片
    return new Response(null, {
      status: 302,
      headers: {
        'Location': imagePath,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
    
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

