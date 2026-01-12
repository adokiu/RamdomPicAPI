/**
 * 通用边缘函数实现
 * 适用于 ESA (Edge Service API) / EdgeOne 等边缘计算平台
 * 这些平台通常使用与 Cloudflare Workers 类似的 fetch API
 */
import { imageConfig, cacheMaxAge } from '../config';
import { imageList } from '../image-list';
import { randomSelect, createErrorResponse, createImageResponse, getImageDir, generateApiDocPage, generateGalleryPage } from './utils';

/**
 * 从 image-list.ts 获取图片列表
 */
function getImageListFromConfig(pathKey: string): string[] {
  return imageList[pathKey] || [];
}

/**
 * 边缘函数主处理函数
 * 适用于 ESA / EdgeOne 等平台
 * 
 * @param request - 请求对象
 * @param env - 环境变量和绑定（根据平台调整，可选）
 * @returns 响应对象
 */
export default async function handler(
  request: Request,
  env?: any
): Promise<Response> {
  // 只允许 GET 请求
  if (request.method !== 'GET') {
    return createErrorResponse('Method not allowed', 405);
  }

  const url = new URL(request.url);
  const pathname = url.pathname;

  // 如果访问根路径，返回 API 介绍页面
  if (pathname === '/' || pathname === '') {
    return generateApiDocPage(url.origin);
  }

  // 如果访问图库页面
  if (pathname === '/gallery') {
    return generateGalleryPage(url.origin);
  }

  // 获取对应的图片目录
  const imageDir = getImageDir(pathname);
  
  if (!imageDir) {
    return createErrorResponse('Path not found', 404, {
      availablePaths: Object.keys(imageConfig)
    });
  }

  try {
    // 从 image-list.ts 获取图片列表
    const configKey = pathname.startsWith('/') ? pathname : `/${pathname}`;
    let imageListArray = getImageListFromConfig(configKey);
    
    if (imageListArray.length === 0) {
      return createErrorResponse('No images found', 404, {
        hint: `Please run 'node scripts/generate-image-list.js' to generate image list`
      });
    }

    // 随机选择一张图片
    const selectedImage = randomSelect(imageListArray);
    if (!selectedImage) {
      return createErrorResponse('Failed to select image', 500);
    }

    // 构建图片 URL 并直接返回图片内容（只改变路径，不改变 host）
    // 使用 createImageResponse 确保浏览器显示图片而不是下载
    // 使用 0 缓存时间，确保每次访问都能随机选择不同的图片
    const imageUrl = `${imageDir}/${selectedImage}`;
    return await createImageResponse(imageUrl, selectedImage, 0);
    
  } catch (error) {
    return createErrorResponse(
      'Internal server error',
      500,
      { message: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * 导出为 fetch handler（适用于大多数边缘计算平台）
 */
export { handler as fetch };

