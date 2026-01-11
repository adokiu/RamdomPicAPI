/**
 * Cloudflare Workers 实现
 * 从 image-list.ts 读取图片列表
 */
import { imageConfig, cacheMaxAge } from '../config';
import { imageList } from '../image-list';
import { randomSelect, createErrorResponse, createRedirectResponse } from './utils';

/**
 * 从 image-list.ts 获取图片列表
 */
function getImageListFromConfig(pathKey: string): string[] {
  return imageList[pathKey] || [];
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    const configKey = pathname.startsWith('/') ? pathname : `/${pathname}`;
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
      // 从 image-list.ts 获取图片列表
      const imageListArray = getImageListFromConfig(configKey);
      
      if (imageListArray.length === 0) {
        return createErrorResponse('No images found', 404, {
          hint: `Please run 'node scripts/generate-image-list.js' to generate image list`
        });
      }

      // 随机选择
      const selectedImage = randomSelect(imageListArray);
      if (!selectedImage) {
        return createErrorResponse('Failed to select image', 500);
      }

      // 重定向到静态资源
      // 使用 0 缓存时间，确保每次访问都能随机选择不同的图片
      return createRedirectResponse(`${url.origin}${imageDir}/${selectedImage}`, 302, 0);
      
    } catch (error) {
      return createErrorResponse(
        'Internal server error',
        500,
        { message: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  },
};
