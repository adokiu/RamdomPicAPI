/**
 * Cloudflare Pages Functions 实现
 * 使用通配符路径处理所有图片路径请求
 * 从预生成的 image-list.ts 读取图片列表（构建时生成）
 */
import { imageConfig } from '../config';
import { imageList } from '../image-list';

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
    // 优先使用 env.ASSETS.fetch()（Cloudflare Pages 推荐方式）
    if (env?.ASSETS?.fetch) {
      const staticRequest = new Request(new URL(pathname, url.origin));
      const staticResponse = await env.ASSETS.fetch(staticRequest);
      if (staticResponse.ok) {
        return staticResponse;
      }
    } else {
      // 备用方案：使用 fetch() 获取静态文件
      const staticFileUrl = new URL(pathname, url.origin);
      const staticResponse = await fetch(staticFileUrl);
      if (staticResponse.ok) {
        return staticResponse;
      }
    }
    return new Response(null, { status: 404 });
  }
  
  // 使用 paramPath 来匹配配置的路径（不包含 /images/ 前缀）
  const imageDir = imageConfig[paramPath as keyof typeof imageConfig];
  
  if (!imageDir) {
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
    const imageUrl = `${url.origin}${imageDir}/${selectedImage}`;
    
    // 禁用缓存，确保每次访问都能随机选择不同的图片
    return new Response(null, {
      status: 302,
      headers: {
        Location: imageUrl,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
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

