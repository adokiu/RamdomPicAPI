/**
 * Cloudflare Pages Functions - 根路径处理
 * 当访问域名根路径时，显示 API 介绍页面
 */
import { generateApiDocPage } from '../src/utils';

export async function onRequest(
  context: {
    request: Request;
    env?: {
      ASSETS?: {
        fetch: (request: Request) => Promise<Response>;
      };
    };
  }
): Promise<Response> {
  const { request } = context;
  
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
  const baseUrl = `${url.protocol}//${url.host}`;
  
  // 使用共享的 generateApiDocPage 函数生成并返回 API 介绍页面
  return generateApiDocPage(baseUrl);
}

