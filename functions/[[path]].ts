/**
 * Cloudflare Pages Functions 实现
 * 使用通配符路径处理所有图片路径请求
 * 从预生成的 image-list.ts 读取图片列表（构建时生成）
 * 支持 Pages 本地存储和 R2 存储两种模式
 */
import { imageConfig, storageConfig } from '../config';
import { imageList } from '../image-list';
import { createImageResponse, fixImageResponseHeaders, generateApiDocPage, generateGalleryPage } from '../src/utils';

// R2 存储桶类型定义
interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<R2Objects>;
}

interface R2Object {
  body: ReadableStream;
  httpMetadata?: {
    contentType?: string;
  };
  size: number;
  key: string;
}

interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
}

// 根据文件扩展名获取 Content-Type
function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'avif': 'image/avif',
    'webp': 'image/webp',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

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
    params: { path: string | string[] };
    env?: {
      ASSETS?: {
        fetch: (request: Request) => Promise<Response>;
      };
      [key: string]: any; // R2 绑定会动态添加
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
  // [[path]] 捕获的参数可能是数组或字符串
  const pathSegments = Array.isArray(params.path) ? params.path : [params.path];
  const paramPath = `/${pathSegments[0]}`;
  
  // 根路径返回首页
  if (pathname === '/' || pathSegments[0] === '' || pathSegments.length === 0) {
    const baseUrl = `${url.protocol}//${url.host}`;
    return generateApiDocPage(baseUrl);
  }
  
  // 图库路径
  if (pathname === '/gallery' || pathSegments[0] === 'gallery') {
    return generateGalleryPage(url.origin);
  }
  
  // 如果路径以 /images/ 开头，说明是静态文件请求
  if (pathname.startsWith('/images/')) {
    const filename = pathname.split('/').pop() || '';
    // 静态图片也计数
    await track({ ...context, request }, url, filename);
    
    // 根据存储配置选择读取方式
    if (storageConfig.type === 'r2') {
      // R2 存储模式：从 R2 读取并直接返回内容
      const r2Bucket = env?.[storageConfig.r2BindingName] as R2Bucket | undefined;
      if (!r2Bucket) {
        console.error(`R2 bucket binding '${storageConfig.r2BindingName}' not found`);
        return new Response('Storage not configured', { status: 500 });
      }
      
      // 构建 R2 key
      const r2Key = storageConfig.r2Prefix 
        ? `${storageConfig.r2Prefix}${pathname.slice(1)}`
        : pathname.startsWith('/') ? pathname.slice(1) : pathname;
      
      const object = await r2Bucket.get(r2Key);
      if (!object) {
        return new Response(JSON.stringify({ error: 'Image not found', r2Key, pathname }), { 
          status: 404, headers: { 'Content-Type': 'application/json' } 
        });
      }
      
      const contentType = object.httpMetadata?.contentType || getContentType(filename);
      return new Response(object.body, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': object.size.toString(),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'CDN-Cache-Control': 'max-age=31536000',
        },
      });
    } else {
      // Pages 本地存储模式：使用 ASSETS.fetch() 或 fetch()
      if (env?.ASSETS?.fetch) {
        const staticRequest = new Request(new URL(pathname, url.origin));
        const staticResponse = await env.ASSETS.fetch(staticRequest);
        if (staticResponse.ok) {
          return await fixImageResponseHeaders(staticResponse, filename, 31536000);
        }
      } else {
        const staticFileUrl = new URL(pathname, url.origin);
        const staticResponse = await fetch(staticFileUrl);
        if (staticResponse.ok) {
          return await fixImageResponseHeaders(staticResponse, filename, 31536000);
        }
      }
      return new Response(null, { status: 404 });
    }
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
    
    // 根据存储配置选择返回方式
    if (storageConfig.type === 'r2') {
      // R2 存储模式：直接从 R2 列目录并随机选择
      const r2Bucket = env?.[storageConfig.r2BindingName] as R2Bucket | undefined;
      if (!r2Bucket) {
        console.error(`R2 bucket binding '${storageConfig.r2BindingName}' not found`);
        return new Response('Storage not configured', { status: 500 });
      }
      
      // 构建 R2 前缀（R2 key 不带开头的 /）
      const prefix = storageConfig.r2Prefix 
        ? `${storageConfig.r2Prefix}${resolvedDir.slice(1)}/`
        : `${resolvedDir.slice(1)}/`;
      
      // 列出该目录下所有文件
      const listed = await r2Bucket.list({ prefix, limit: 1000 });
      if (!listed.objects || listed.objects.length === 0) {
        return new Response(JSON.stringify({ error: 'No images found in R2', prefix, resolvedDir }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // 随机选择一个文件
      const randomIndex = Math.floor(Math.random() * listed.objects.length);
      const selectedKey = listed.objects[randomIndex].key;
      
      // 构建重定向路径（加上开头的 /）
      const imagePath = `/${selectedKey}`;
      
      // 返回 302 重定向到图片路径
      return new Response(null, {
        status: 302,
        headers: {
          'Location': imagePath,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    } else {
      // Pages 本地存储模式：从 image-list.ts 读取列表
      const imageListArray = getImageList(paramPath);
      if (imageListArray.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'No images found',
          hint: `Please run 'npm run generate' to generate image list before building`
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      const randomIndex = Math.floor(Math.random() * imageListArray.length);
      const selectedImage = imageListArray[randomIndex];
      const imagePath = `${resolvedDir}/${selectedImage}`;
      
      return new Response(null, {
        status: 302,
        headers: {
          'Location': imagePath,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    }
    
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

