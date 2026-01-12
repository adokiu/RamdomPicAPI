/**
 * 图库页面路由处理
 */
import { generateGalleryPage } from '../src/utils';

export async function onRequest(
  context: {
    request: Request;
  }
): Promise<Response> {
  const url = new URL(context.request.url);
  return generateGalleryPage(url.origin);
}
