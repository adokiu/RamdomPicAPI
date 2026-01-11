import { imageConfig, supportedImageTypes, cacheMaxAge } from '../config';

/**
 * 获取目录下所有图片文件的列表
 * 注意：在边缘计算环境中，需要根据实际平台调整文件读取方式
 */
async function getImageList(imagePath: string): Promise<string[]> {
  // 这里返回图片文件名列表
  // 实际部署时，需要根据平台特性实现：
  // - Cloudflare Workers: 使用 KV 或 R2 存储图片列表
  // - Vercel: 使用文件系统或 API 路由
  // - EdgeOne/ESA: 使用相应的存储方案
  
  // 示例：假设图片文件名已知，实际应从存储中获取
  // 这里提供一个基础实现，需要根据实际部署平台调整
  return [];
}

/**
 * 从数组中随机选择一个元素
 */
function randomSelect<T>(array: T[]): T | null {
  if (array.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
}

/**
 * 处理随机图片请求
 */
export default async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 移除开头的斜杠，匹配配置
  const configKey = pathname.startsWith('/') ? pathname : `/${pathname}`;
  
  // 查找匹配的图片目录
  const imageDir = imageConfig[configKey as keyof typeof imageConfig];
  
  if (!imageDir) {
    return new Response(
      JSON.stringify({ 
        error: 'Path not found',
        availablePaths: Object.keys(imageConfig)
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  try {
    // 获取图片列表
    const imageList = await getImageList(imageDir);
    
    if (imageList.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No images found in directory' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // 随机选择一张图片
    const selectedImage = randomSelect(imageList);
    
    if (!selectedImage) {
      return new Response(
        JSON.stringify({ error: 'Failed to select image' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // 构建图片URL
    const imageUrl = `${imageDir}/${selectedImage}`;
    
    // 重定向到图片或直接返回图片
    // 根据部署平台，可能需要直接返回图片内容
    return Response.redirect(imageUrl, 302);
    
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

