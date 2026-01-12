/**
 * Vercel Edge Function 实现
 * 适用于边缘计算环境（包括 Cloudflare Pages）
 */
import { imageConfig, cacheMaxAge } from '../config';
import { imageList } from '../image-list';

/**
 * 从 image-list.ts 获取图片列表
 */
function getImageList(pathKey: string): string[] {
  return imageList[pathKey] || [];
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const url = new URL(req.url);
  const pathname = url.pathname;

  const cleanPath = pathname.replace(/^\/api/, '');
  const configKey = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  
  const configItem = imageConfig[configKey as keyof typeof imageConfig];
  const imageDir = configItem?.dir;
  
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
    const imageListArray = getImageList(configKey);
    
    if (imageListArray.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No images found',
          hint: `Please run 'node scripts/generate-image-list.js' to generate image list`
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const randomIndex = Math.floor(Math.random() * imageListArray.length);
    const selectedImage = imageListArray[randomIndex];
    const imageUrl = `${imageDir}/${selectedImage}`;
    
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

export const config = {
  runtime: 'edge',
};

