/**
 * Vercel Pages API 路由实现
 * 适用于 Vercel Node.js Functions
 */
import { imageConfig } from '../config';
import { readdir } from 'fs/promises';
import { join } from 'path';

/**
 * 从文件系统获取图片列表
 */
async function getImageList(imageDir: string): Promise<string[]> {
  try {
    // 图片文件在 public 目录下
    // 移除 imageDir 开头的 /，因为 join 会处理路径分隔符
    const cleanDir = imageDir.startsWith('/') ? imageDir.slice(1) : imageDir;
    const publicPath = join(process.cwd(), 'public', cleanDir);
    console.log('Reading directory:', publicPath);
    const files = await readdir(publicPath);
    console.log('Found files:', files);
    
    const imageFiles = files.filter(file => 
      /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(file)
    );
    console.log('Image files:', imageFiles);
    return imageFiles;
  } catch (error) {
    console.error('Error reading directory:', error);
    return [];
  }
}

export default async function handler(req: Request): Promise<Response> {
  // 只允许 GET 请求
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

  // 移除 /api 前缀（如果存在）
  const cleanPath = pathname.replace(/^\/api/, '');
  const configKey = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  
  const imageDir = imageConfig[configKey as keyof typeof imageConfig];
  
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
    const imageList = await getImageList(imageDir);
    
    if (imageList.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No images found',
          hint: `Please add images to public${imageDir} directory`
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 随机选择一张图片
    const randomIndex = Math.floor(Math.random() * imageList.length);
    const selectedImage = imageList[randomIndex];
    
    // 重定向到图片
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

// Vercel Function 配置
// 使用 Node.js runtime 以支持文件系统访问
export const config = {
  runtime: 'nodejs20.x',
};

