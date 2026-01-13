/**
 * 通用工具函数
 */
import { imageConfig, imageBaseUrl } from '../config';
import { imageList } from '../image-list/index';

/**
 * 从数组中随机选择一个元素
 */
export function randomSelect<T>(array: T[]): T | null {
  if (array.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
}

/**
 * 验证路径是否在配置中
 */
export function isValidPath(pathname: string): boolean {
  const configKey = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return configKey in imageConfig;
}

/**
 * 获取路径对应的图片目录
 */
export function getImageDir(pathname: string): string | null {
  const configKey = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const configItem = imageConfig[configKey as keyof typeof imageConfig];
  return configItem ? configItem.dir : null;
}

/**
 * 过滤图片文件
 */
export function isImageFile(filename: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(filename);
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  message: string,
  status: number = 500,
  additionalInfo?: Record<string, any>
): Response {
  return new Response(
    JSON.stringify({
      error: message,
      ...additionalInfo,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * 创建重定向响应
 */
export function createRedirectResponse(
  url: string,
  status: number = 302,
  cacheMaxAge: number = 3600
): Response {
  // 如果缓存时间为 0，使用 no-cache 禁用缓存
  const cacheControl = cacheMaxAge === 0 
    ? 'no-cache, no-store, must-revalidate' 
    : `public, max-age=${cacheMaxAge}`;
  
  return new Response(null, {
    status,
    headers: {
      Location: url,
      'Cache-Control': cacheControl,
    },
  });
}

/**
 * 根据文件扩展名获取 MIME 类型
 */
export function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'avif': 'image/avif',
    'svg': 'image/svg+xml',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * 修改已有响应，设置正确的响应头以确保浏览器显示而不是下载
 * @param response - 已有的响应对象
 * @param filename - 图片文件名（用于确定 Content-Type）
 * @param cacheMaxAge - 缓存时间（秒），0 表示不缓存
 * @returns 修改后的响应对象
 */
export async function fixImageResponseHeaders(
  response: Response,
  filename: string,
  cacheMaxAge: number = 3600
): Promise<Response> {
  // 获取图片数据
  const imageData = await response.arrayBuffer();
  
  // 确定 Content-Type（优先使用原响应的 Content-Type，否则根据文件名推断）
  const originalContentType = response.headers.get('Content-Type');
  const contentType = originalContentType || getContentType(filename);
  
  // 构建响应头
  const headers: HeadersInit = {
    'Content-Type': contentType,
    'Content-Disposition': 'inline', // 关键：设置为 inline 而不是 attachment，确保浏览器显示图片
    'Content-Length': imageData.byteLength.toString(),
  };
  
  // 设置缓存控制
  if (cacheMaxAge === 0) {
    // API接口：不缓存，确保每次访问都能随机选择不同的图片
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    headers['Pragma'] = 'no-cache';
    headers['Expires'] = '0';
  } else {
    // 静态图片文件：设置强缓存
    // 使用 immutable 提示浏览器该资源不会改变，可以永久缓存
    headers['Cache-Control'] = `public, max-age=${cacheMaxAge}, immutable`;
  }
  
  // 返回修改后的响应
  return new Response(imageData, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * 获取图片内容并返回，设置正确的响应头以确保浏览器显示而不是下载
 * @param imageUrl - 图片的完整 URL
 * @param filename - 图片文件名（用于确定 Content-Type）
 * @param cacheMaxAge - 缓存时间（秒），0 表示不缓存
 * @returns 包含图片内容的 Response
 */
export async function createImageResponse(
  imageUrl: string,
  filename: string,
  cacheMaxAge: number = 0
): Promise<Response> {
  try {
    // 获取图片内容
    const imageResponse = await fetch(imageUrl);
    
    if (!imageResponse.ok) {
      return createErrorResponse('Failed to fetch image', imageResponse.status);
    }

    // 使用 fixImageResponseHeaders 来设置正确的响应头
    return await fixImageResponseHeaders(imageResponse, filename, cacheMaxAge);
  } catch (error) {
    return createErrorResponse(
      'Failed to fetch image',
      500,
      { message: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * 生成 API 介绍页面
 * @param baseUrl - 基础 URL（协议 + 域名）
 * @returns 包含 HTML 内容的 Response
 */
export function generateApiDocPage(baseUrl: string): Response {
  const availablePaths = Object.keys(imageConfig);
  // 计算所有 API 图片总数量
  const totalImageCount = Object.values(imageList).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
  // 使用第一个路径作为背景图片
  const backgroundImageUrl = availablePaths.length > 0 ? `${baseUrl}${availablePaths[0]}` : '';
  
  const examples = availablePaths.map((path, index) => {
    const configItem = imageConfig[path as keyof typeof imageConfig];
    const exampleUrl = `${baseUrl}${path}`;
    const displayName = configItem?.name || path;
    const imageCount = Array.isArray(imageList[path]) ? imageList[path].length : 0;
    return `
      <div class="api-example" data-api-path="${path}">
        <div class="api-header">
          <div class="api-title-row">
            <span class="api-name">${displayName}</span>
            <div class="api-url-box">
              <code>${exampleUrl}</code>
              <button class="copy-icon" onclick="copyToClipboard('${exampleUrl}')" title="复制链接">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          </div>
          <div class="api-stats" id="api-stats-${index}">
            <div class="api-stat-item">
              <span class="api-stat-label">累计用户数:</span>
              <span class="api-stat-value" id="api-users-${index}">-</span>
            </div>
            <div class="api-stat-item">
              <span class="api-stat-label">API 调用总数:</span>
              <span class="api-stat-value" id="api-calls-${index}">-</span>
            </div>
            <div class="api-stat-item">
              <span class="api-stat-label">图片数量:</span>
              <span class="api-stat-value">${imageCount}</span>
            </div>
            <div class="api-stat-item">
              <span class="api-stat-label">加载耗时:</span>
              <span class="api-stat-value" id="api-latency-${index}">-</span>
            </div>
          </div>
        </div>
        <div class="api-preview">
          <img src="${exampleUrl}" alt="${displayName}" loading="lazy" style="cursor: pointer;" data-index="${index}" data-url="${exampleUrl}" onload="measureLatency(this)" onclick="refreshImage(this)" title="点击刷新图片" />
        </div>
      </div>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yao の API</title>
  <link rel="icon" type="image/x-icon" href="${imageBaseUrl}/icons/favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @font-face {
      font-family: 'English';
      src: local('JetBrains Mono');
      unicode-range: U+0041-005A, U+0061-007A; /* A-Z, a-z */
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'English', 'JetBrains Mono', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      /* 背景图降低存在感，只做氛围 */
      background: #f8fafc url('${backgroundImageUrl}') center center / cover no-repeat fixed;
      min-height: 100vh;
      padding: 56px 20px;
      position: relative;
      overflow-x: hidden;
    }
    
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      /* 纯模糊遮罩 */
      background: transparent;
      pointer-events: none;
      z-index: 0;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      position: relative;
      z-index: 1;
    }
    
    .header {
      text-align: center;
      margin-bottom: 64px;
      animation: fadeInDown 0.8s ease;
    }
    
    @keyframes fadeInDown {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .header h1 {
      font-size: 64px;
      font-weight: 800;
      letter-spacing: -2px;
      margin-bottom: 16px;
      position: relative;
      display: inline-block;
      background: linear-gradient(120deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #667eea 75%, #764ba2 100%);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: gradientFlow 4s ease infinite;
      filter: drop-shadow(0 4px 12px rgba(102, 126, 234, 0.4));
    }
    
    .header h1::before {
      content: '';
      position: absolute;
      top: 50%;
      left: -40px;
      width: 28px;
      height: 3px;
      background: linear-gradient(90deg, transparent, #667eea);
      border-radius: 2px;
      transform: translateY(-50%);
    }
    
    .header h1::after {
      content: '';
      position: absolute;
      top: 50%;
      right: -40px;
      width: 28px;
      height: 3px;
      background: linear-gradient(90deg, #764ba2, transparent);
      border-radius: 2px;
      transform: translateY(-50%);
    }
    
    @keyframes gradientFlow {
      0% { background-position: 0% center; }
      50% { background-position: 100% center; }
      100% { background-position: 0% center; }
    }
    
    .header p {
      font-size: 18px;
      color: #64748b;
      font-weight: 500;
      letter-spacing: 1px;
      margin-bottom: 28px;
    }
    
    .visitor-stats {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 32px;
      margin-top: 24px;
      flex-wrap: wrap;
    }
    
    .stat-item {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      padding: 14px 20px;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.5);
      box-shadow: 
        0 2px 16px rgba(0, 0, 0, 0.04),
        inset 0 1px 0 rgba(255, 255, 255, 0.8);
      transition: all 0.2s ease;
    }
    
    .stat-item:hover {
      background: rgba(255, 255, 255, 0.75);
      transform: translateY(-2px);
      box-shadow: 
        0 6px 24px rgba(0, 0, 0, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.9);
    }
    
    .stat-icon {
      width: 20px;
      height: 20px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
    }
    
    .stat-icon svg {
      width: 20px;
      height: 20px;
      display: block;
      fill: currentColor;
    }
    
    .stat-label {
      font-size: 16px;
      color: #475569;
      font-weight: 500;
      text-shadow: none;
    }
    
    .stat-value {
      font-size: 18px;
      font-weight: 700;
      color: #1e293b;
      text-shadow: none;
      min-width: 40px;
      text-align: center;
      cursor: help;
    }
    
    .content {
      display: flex;
      flex-direction: column;
      gap: 28px;
    }
    
    .card {
      background: rgba(255, 255, 255, 0.65);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      border-radius: 24px;
      padding: 32px;
      border: 1px solid rgba(255, 255, 255, 0.5);
      box-shadow: 
        0 4px 32px rgba(0, 0, 0, 0.06),
        inset 0 1px 0 rgba(255, 255, 255, 0.8);
      transition: all 0.3s ease;
      animation: fadeInUp 0.6s ease backwards;
      position: relative;
      overflow: hidden;
    }
    
    .card::before {
      display: none;
    }
    
    .card:nth-child(1) { animation-delay: 0.1s; }
    .card:nth-child(2) { animation-delay: 0.2s; }
    .card:nth-child(3) { animation-delay: 0.3s; }
    
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .card:hover {
      background: rgba(255, 255, 255, 0.75);
      box-shadow: 
        0 8px 40px rgba(0, 0, 0, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.9);
      transform: translateY(-4px);
    }
    
    .section-title {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin-bottom: 20px;
      color: #1e293b;
      text-shadow: none;
      position: relative;
      display: inline-block;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .section-title::after {
      content: '';
      position: absolute;
      bottom: -6px;
      left: 0;
      width: 40px;
      height: 3px;
      background: linear-gradient(90deg, #667eea, #f093fb);
      border-radius: 2px;
    }
    
    .section-text {
      font-size: 16px;
      color: #475569;
      line-height: 1.8;
      margin-bottom: 28px;
      text-shadow: none;
    }
    
    .api-examples-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    
    .api-example {
      background: linear-gradient(160deg, rgba(255, 255, 255, 0.92) 0%, rgba(248, 250, 255, 0.88) 50%, rgba(245, 247, 255, 0.85) 100%);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 18px;
      padding: 18px;
      border: none;
      box-shadow: 
        0 0 0 1px rgba(255, 255, 255, 0.6),
        0 4px 20px rgba(102, 126, 234, 0.08),
        0 8px 40px rgba(118, 75, 162, 0.05);
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }
    
    .api-example::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 18px;
      padding: 1.5px;
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.25), rgba(240, 147, 251, 0.2), rgba(118, 75, 162, 0.15));
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
      opacity: 0.5;
      transition: opacity 0.3s ease;
    }
    
    .api-example::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent);
      pointer-events: none;
    }
    
    .api-example:hover {
      transform: translateY(-6px) scale(1.01);
      box-shadow: 
        0 0 0 1px rgba(255, 255, 255, 0.8),
        0 12px 32px rgba(102, 126, 234, 0.15),
        0 20px 50px rgba(118, 75, 162, 0.08);
    }
    
    .api-example:hover::before {
      opacity: 1;
    }
    
    .api-header {
      margin-bottom: 12px;
    }
    
    .api-path {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    
    .api-stats {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(226, 232, 240, 0.6);
    }
    
    .api-stat-item {
      display: flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, rgba(248, 250, 255, 0.9) 0%, rgba(245, 247, 255, 0.85) 100%);
      backdrop-filter: blur(10px);
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid rgba(102, 126, 234, 0.1);
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.06);
      transition: all 0.2s ease;
    }
    
    .api-stat-item:hover {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(250, 251, 255, 0.92) 100%);
      border-color: rgba(102, 126, 234, 0.2);
    }
    
    .api-stat-label {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
      text-shadow: none;
    }
    
    .api-stat-value {
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
      text-shadow: none;
      min-width: 30px;
      text-align: center;
    }
    
    .api-title-row {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 14px;
    }
    
    .api-name {
      font-size: 15px;
      font-weight: 600;
      color: #1f2937;
    }
    
    .api-url-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(0, 0, 0, 0.03);
      border-radius: 8px;
      padding: 8px 12px;
      border: 1px solid rgba(0, 0, 0, 0.06);
    }
    
    .api-url-box code {
      flex: 1;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #475569;
      word-break: break-all;
    }
    
    .copy-icon {
      background: none;
      border: none;
      padding: 4px;
      cursor: pointer;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s;
    }
    
    .copy-icon:hover {
      background: rgba(0, 0, 0, 0.06);
      color: #1f2937;
    }
    
    .api-path code {
      background: linear-gradient(135deg, rgba(248, 250, 255, 0.95) 0%, rgba(245, 247, 255, 0.9) 100%);
      backdrop-filter: blur(10px);
      color: #334155;
      padding: 10px 16px;
      border-radius: 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      font-weight: 500;
      border: 1px solid rgba(226, 232, 240, 0.8);
      text-shadow: none;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
    }
    
    .gallery-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 28px;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(12px);
      color: #374151;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 500;
      font-size: 14px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      transition: all 0.25s ease;
    }
    
    .gallery-btn:hover {
      background: rgba(255, 255, 255, 1);
      border-color: rgba(0, 0, 0, 0.12);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      transform: translateY(-1px);
    }
    
    .copy-btn {
      background: #1f2937;
      backdrop-filter: blur(10px);
      border: none;
      color: #ffffff;
      padding: 10px 18px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s ease;
      text-shadow: none;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
    }
    
    .copy-btn:hover {
      background: #374151;
      transform: translateY(-1px);
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
    }
    
    .copy-btn:active {
      transform: translateY(0);
    }
    
    .api-description {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 20px;
      text-shadow: none;
    }
    
    .api-description code {
      background: linear-gradient(135deg, rgba(248, 250, 255, 0.95) 0%, rgba(245, 247, 255, 0.9) 100%);
      backdrop-filter: blur(5px);
      padding: 4px 10px;
      border-radius: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      color: #667eea;
      border: 1px solid rgba(102, 126, 234, 0.15);
      text-shadow: none;
    }
    
    .section-text code {
      background: linear-gradient(135deg, rgba(248, 250, 255, 0.95) 0%, rgba(245, 247, 255, 0.9) 100%);
      padding: 3px 10px;
      border-radius: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      color: #667eea;
      border: 1px solid rgba(102, 126, 234, 0.15);
      font-weight: 500;
    }
    
    .api-preview {
      margin-top: 14px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      transition: transform 0.3s ease;
      display: inline-block;
      max-width: 280px;
    }
    
    .api-preview:hover {
      transform: scale(1.02);
    }
    
    .api-preview img {
      max-width: 100%;
      height: auto;
      display: block;
      border-radius: 12px;
      max-height: 180px;
      object-fit: contain;
    }
    
    .footer {
      text-align: center;
      margin-top: 72px;
      padding-top: 32px;
      color: #64748b;
      font-size: 15px;
      text-shadow: none;
      display: flex;
      flex-direction: column;
      gap: 16px;
      align-items: center;
    }
    
    .supporters {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #475569;
      flex-wrap: wrap;
      justify-content: center;
    }
    
    .supporter-logos {
      display: inline-flex;
      align-items: center;
      gap: 12px;
    }
    
    .supporter-logos a {
      display: flex;
      transition: transform 0.2s, opacity 0.2s;
    }
    
    .supporter-logos a:hover {
      transform: scale(1.1);
      opacity: 0.8;
    }
    
    .supporter-logo {
      height: 26px;
      width: auto;
      object-fit: contain;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
    }

    .supporters-text {
      font-size: 15px;
      color: #475569;
      text-shadow: none;
    }

    .beian {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px 24px;
      font-size: 13px;
      color: #64748b;
    }

    a.beian-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      text-decoration: none !important;
      color: #64748b !important;
      transition: color 0.2s;
    }
    
    a.beian-item:hover {
      color: #1f2937 !important;
    }
    
    a.beian-item:visited {
      color: #64748b !important;
    }

    .beian-item img {
      width: 16px;
      height: 16px;
      object-fit: contain;
      display: block;
      border-radius: 2px;
    }
    
    @media (max-width: 768px) {
      body {
        padding: 24px 16px;
      }
      
      .container {
        max-width: 100%;
      }
      
      .header h1 {
        font-size: 36px;
        letter-spacing: -1px;
      }
      
      .header h1::before,
      .header h1::after {
        display: none;
      }
      
      .header p {
        font-size: 14px;
        letter-spacing: 0;
      }
      
      .card {
        padding: 20px;
        border-radius: 16px;
      }
      
      .section-title {
        font-size: 20px;
      }
      
      .section-text {
        font-size: 14px;
        line-height: 1.7;
      }
      
      .api-examples-grid {
        grid-template-columns: 1fr;
        gap: 16px;
      }
      
      .api-example {
        padding: 16px;
        border-radius: 14px;
      }
      
      .api-path {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }
      
      .api-name {
        font-size: 14px;
        text-align: center;
      }
      
      .api-path code {
        font-size: 12px;
        padding: 10px 14px;
        word-break: break-all;
      }
      
      .copy-btn {
        width: 100%;
        padding: 12px;
      }
      
      .visitor-stats {
        flex-direction: column;
        gap: 12px;
        align-items: stretch;
      }
      
      .stat-item {
        padding: 12px 16px;
        font-size: 14px;
        justify-content: space-between;
      }
      
      .stat-label {
        font-size: 13px;
      }
      
      .stat-value {
        font-size: 15px;
      }
      
      .api-stats {
        flex-direction: column;
        gap: 10px;
      }
      
      .api-stat-item {
        width: 100%;
        justify-content: space-between;
        padding: 10px 14px;
      }
      
      .api-stat-label {
        font-size: 12px;
      }
      
      .api-stat-value {
        font-size: 13px;
      }
      
      .api-preview {
        max-width: 100%;
      }
      
      .api-preview img {
        max-height: 200px;
      }
      
      .gallery-btn {
        width: 100%;
        justify-content: center;
        padding: 14px 24px;
      }
      
      .footer {
        margin-top: 48px;
        padding-top: 24px;
      }
      
      .supporters {
        flex-wrap: wrap;
        justify-content: center;
      }
      
      .supporter-logo {
        height: 20px;
      }
      
      .content {
        gap: 20px;
      }
    }
    
    @media (max-width: 480px) {
      body {
        padding: 20px 12px;
      }
      
      .header h1 {
        font-size: 28px;
      }
      
      .card {
        padding: 16px;
        border-radius: 14px;
      }
      
      .section-title {
        font-size: 18px;
      }
      
      .section-text {
        font-size: 13px;
      }
      
      .stat-item {
        padding: 10px 12px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Yao の API</h1>
      <p>使用 AVIF 格式的高质量图片 API</p>
      <!-- 访客统计 -->
      <div id="visitor-stats" class="visitor-stats">
        <div class="stat-item">
          <span class="stat-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </span>
          <span class="stat-label">累计用户数:</span>
          <span id="visitor-stats-users" class="stat-value">-</span>
        </div>
        <div class="stat-item">
          <span class="stat-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 11.5a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
            </svg>
          </span>
          <span class="stat-label">API 调用总数:</span>
          <span id="visitor-stats-total-calls" class="stat-value">-</span>
        </div>
        <div class="stat-item">
          <span class="stat-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M12 8a1 1 0 0 1 1 1v2.59l2.7 2.7a1 1 0 0 1-1.42 1.42l-3-3A1 1 0 0 1 11 12V9a1 1 0 0 1 1-1zm0-6a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/>
            </svg>
          </span>
          <span class="stat-label">过去 1 小时调用:</span>
          <span id="visitor-stats-hour-calls" class="stat-value">-</span>
        </div>
        <div class="stat-item">
          <span class="stat-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M4 6h16v2H4zm2 4h12v2H6zm3 4h6v2H9z"/>
            </svg>
          </span>
          <span class="stat-label">所有 API 图片总数:</span>
          <span class="stat-value" title="${totalImageCount.toLocaleString()}">${totalImageCount.toLocaleString()}</span>
        </div>
      </div>
    </div>
    
    <div class="content">
      <div class="card">
        <h2 class="section-title">简介</h2>
        <p class="section-text">
          访问指定路径即可获取随机图片。本站 API 图片分辨率最低 <code>2K</code>，统一采用 <code>AVIF</code> 格式。得益于 AVIF 基于 AV1 视频编码的高压缩率（通常比 JPEG/PNG 缩小 50% 以上），可以在使用极少带宽的同时保持较高的清晰度。
        </p>
        <p class="section-text">
          国内使用 <code>ESA</code> / <code>EdgeOne</code> 混合加速，海外使用 <code>Cloudflare</code>。
        </p>
        <p class="section-text" style="margin-top: 8px; padding-top: 12px; border-top: 1px dashed rgba(102, 126, 234, 0.2);">
          <strong>图片版权</strong>、<strong>其他问题</strong>、<strong>新接口需求</strong> 或 <strong>交流讨论</strong>，请联系：<br>
          邮箱：<code>chuyao@yaoxc.com</code><br>
          QQ 群：<code>1080225907</code><br>
          博客：<a href="https://blog.2o.nz" target="_blank" rel="noopener" style="color: #667eea; text-decoration: none; font-weight: 500;">blog.2o.nz</a>
        </p>
        <div style="margin-top: 16px; text-align: center;">
          <a href="/gallery" class="gallery-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            浏览图库
          </a>
        </div>
      </div>
      
      <div class="card">
        <h2 class="section-title">使用方法</h2>
        <p class="section-text">直接在浏览器中访问以下路径，或使用 <code>&lt;img&gt;</code> 标签引用：</p>
        <div class="api-examples-grid">
          ${examples}
        </div>
      </div>
      
    </div>
    
    <div class="footer">
      <div class="supporters">
        <span class="supporters-text">感谢</span>
        <span class="supporter-logos">
          <a href="https://www.aliyun.com/product/esa" target="_blank" rel="noopener" title="阿里云 ESA">
            <img class="supporter-logo" src="${imageBaseUrl}/icons/foot-esa.png" alt="阿里云ESA" />
          </a>
          <a href="https://cloud.tencent.com/product/teo" target="_blank" rel="noopener" title="腾讯云 EdgeOne">
            <img class="supporter-logo" src="${imageBaseUrl}/icons/foot-edgeone.png" alt="腾讯云EdgeOne" />
          </a>
          <a href="https://www.cloudflare.com" target="_blank" rel="noopener" title="Cloudflare">
            <img class="supporter-logo" src="${imageBaseUrl}/icons/foot-cloudflare.png" alt="Cloudflare" />
          </a>
        </span>
        <span class="supporters-text">的大力支持</span>
      </div>
      <div class="beian">
        <a class="beian-item" href="https://www.beian.gov.cn/portal/registerSystemInfo?recordcode=51080202020049" target="_blank" rel="noopener">
          <img src="${imageBaseUrl}/icons/foot-ga.png" alt="公安备案图标" />
          川公网安备51080202020049号
        </a>
        <a class="beian-item" href="https://beian.miit.gov.cn" target="_blank" rel="noopener">
          <img src="${imageBaseUrl}/icons/foot-icp.png" alt="ICP备案图标" />
          蜀ICP备2024102137号
        </a>
      </div>
    </div>
  </div>
  
  <script>
    // 记录每个图片的加载开始时间
    const loadStartTimes = {};
    
    // 初始化所有图片的加载时间记录
    document.querySelectorAll('.api-preview img').forEach(img => {
      const index = img.dataset.index;
      loadStartTimes[index] = performance.now();
    });
    
    // 测量图片加载耗时
    function measureLatency(img) {
      const index = img.dataset.index;
      const startTime = loadStartTimes[index];
      if (startTime) {
        const latency = Math.round(performance.now() - startTime);
        const el = document.getElementById('api-latency-' + index);
        if (el) {
          el.textContent = latency + 'ms';
        }
      }
    }
    
    // 刷新图片
    function refreshImage(img) {
      const index = img.dataset.index;
      const baseUrl = img.dataset.url;
      loadStartTimes[index] = performance.now();
      const el = document.getElementById('api-latency-' + index);
      if (el) el.textContent = '...';
      img.src = baseUrl + '?t=' + Date.now();
    }
    
    function copyToClipboard(text) {
      navigator.clipboard.writeText(text).then(() => {
        // 静默复制，不显示提示
      }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      });
    }
    
    // Umami 统计数据获取和显示
    (function() {
      const UMAMI_BASE_URL = 'https://umami.2o.nz';
      const WEBSITE_ID = 'f3200a83-8a62-463f-afb1-72f029ee2115';
      // 注意：需要配置 Umami Share ID，如果没有 Share ID，将使用网站总统计
      // 获取 Share ID 的方法：登录 Umami 后台 -> Settings -> Websites -> 编辑网站 -> 启用 Share URL
      const SHARE_ID = 'DyRysjiYHzzcsc5l'; // Umami Share ID，从 share URL 中提取
      
      let shareDataCache = null;
      // 注意：不要使用 3600_000 这种数字分隔符，兼容更多浏览器
      const SHARE_CACHE_TTL = 3600000; // 1小时
      
      /**
       * 格式化数字为 k/w 格式
       */
      function formatNumber(num) {
        if (num >= 10000) {
          const w = num / 10000;
          if (w % 1 === 0) {
            return w + 'w';
          }
          return w.toFixed(2) + 'w';
        } else if (num >= 1000) {
          const k = num / 1000;
          if (k % 1 === 0) {
            return k + 'k';
          }
          return k.toFixed(2) + 'k';
        }
        return num.toString();
      }
      
      /**
       * 数字动画效果
       */
      function animateNumber(element, targetValue, duration = 1500) {
        if (!element) return;
        
        const startValue = 0;
        const startTime = performance.now();
        
        function easeOutCubic(t) {
          return 1 - Math.pow(1 - t, 3);
        }
        
        function update(currentTime) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easedProgress = easeOutCubic(progress);
          
          const currentValue = Math.floor(startValue + (targetValue - startValue) * easedProgress);
          const formatted = formatNumber(currentValue);
          element.textContent = formatted;
          element.title = targetValue.toLocaleString();
          
          if (progress < 1) {
            requestAnimationFrame(update);
          } else {
            element.textContent = formatNumber(targetValue);
            element.title = targetValue.toLocaleString();
          }
        }
        
        requestAnimationFrame(update);
      }
      
      /**
       * 获取 Umami Share 数据（websiteId 和 token）
       */
      async function getUmamiShareData() {
        if (!SHARE_ID) return null;
        
        const now = Date.now();
        if (shareDataCache && (now - shareDataCache.timestamp) < SHARE_CACHE_TTL) {
          return shareDataCache.data;
        }
        
        try {
          const url = UMAMI_BASE_URL + '/api/share/' + SHARE_ID;
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error('获取 Umami 分享信息失败: ' + response.status);
          }
          
          const data = await response.json();
          shareDataCache = { data, timestamp: now };
          return data;
        } catch (error) {
          console.error('Failed to get Umami share data:', error);
          return null;
        }
      }
      
      /**
       * 获取网站统计数据（使用 Share Token 方式）
       */
      async function getWebsiteStatsWithShare(startAt = 0, endAt = Date.now()) {
        try {
          const shareData = await getUmamiShareData();
          if (!shareData) return null;
          
          const { websiteId, token } = shareData;
          
          const params = new URLSearchParams({
            startAt: startAt.toString(),
            endAt: endAt.toString(),
            unit: 'hour',
            timezone: 'Asia/Shanghai',
            compare: 'false',
          });
          
          const statsUrl = UMAMI_BASE_URL + '/api/websites/' + websiteId + '/stats?' + params.toString();
          const response = await fetch(statsUrl, {
            headers: {
              'x-umami-share-token': token,
            },
          });
          
          if (!response.ok) {
            if (response.status === 401) {
              // Token 过期，清除缓存并重试一次
              shareDataCache = null;
              return await getWebsiteStatsWithShare();
            }
            throw new Error('获取统计数据失败: ' + response.status);
          }
          
          const data = await response.json();
          const pageviewsValue = typeof data.pageviews === 'object' && data.pageviews !== null 
            ? data.pageviews.value 
            : (data.pageviews || 0);
          const visitorsValue = typeof data.visitors === 'object' && data.visitors !== null 
            ? data.visitors.value 
            : (data.visitors || 0);
          
          return {
            pageviews: { value: pageviewsValue },
            uniques: { value: visitorsValue },
          };
        } catch (error) {
          console.error('Failed to fetch Umami website stats with share:', error);
          return null;
        }
      }
      
      /**
       * 获取特定页面的统计数据（使用 path: eq.xxx 参数）
       */
      async function getPageStatsWithShare(pagePath, startAt = 0, endAt = Date.now()) {
        try {
          const shareData = await getUmamiShareData();
          if (!shareData) return null;

          const { websiteId, token } = shareData;

          const params = new URLSearchParams({
            startAt: startAt.toString(),
            endAt: endAt.toString(),
            unit: 'hour',
            timezone: 'Asia/Shanghai',
            compare: 'false',
            path: 'eq.' + pagePath,
          });

          const statsUrl = UMAMI_BASE_URL + '/api/websites/' + websiteId + '/stats?' + params.toString();
          const response = await fetch(statsUrl, {
            headers: {
              'x-umami-share-token': token,
            },
          });

          if (!response.ok) {
            if (response.status === 401) {
              shareDataCache = null;
              return await getPageStatsWithShare(pagePath, startAt, endAt);
            }
            return null;
          }

          const data = await response.json();
          const pageviewsValue = typeof data.pageviews === 'object' && data.pageviews !== null 
            ? data.pageviews.value 
            : (data.pageviews || 0);
          const visitorsValue = typeof data.visitors === 'object' && data.visitors !== null 
            ? data.visitors.value 
            : (data.visitors || 0);

          return {
            pageviews: pageviewsValue,
            visitors: visitorsValue,
          };
        } catch (error) {
          console.error('Failed to fetch page stats:', error);
          return null;
        }
      }
      
      /**
       * 初始化访客统计
       */
      async function initVisitorStats() {
        try {
          const totalCallsEl = document.getElementById('visitor-stats-total-calls');
          const usersEl = document.getElementById('visitor-stats-users');
          const hourCallsEl = document.getElementById('visitor-stats-hour-calls');
          
          if (!totalCallsEl || !usersEl || !hourCallsEl) return;
          
          // 显示初始值
          totalCallsEl.textContent = '0';
          usersEl.textContent = '0';
          hourCallsEl.textContent = '0';
          
          // 尝试获取统计数据
          let stats = null;
          
          // 优先使用 Share Token 方式（如果配置了 Share ID）
          if (SHARE_ID) {
            const now = Date.now();
            const oneHourAgo = now - 60 * 60 * 1000;
            stats = await getWebsiteStatsWithShare(0, now);
            var lastHourStats = await getWebsiteStatsWithShare(oneHourAgo, now);
          }
          
          // 如果 Share Token 方式失败或未配置，可以尝试其他方式
          // 注意：Umami 的公开 API 可能需要 Share URL 才能获取统计数据
          // 如果没有配置 Share ID，统计数据将无法显示
          
          if (stats) {
            const totalViews = stats.pageviews.value || 0;
            const uniqueVisitors = stats.uniques.value || 0;
            const lastHourViews = lastHourStats?.pageviews?.value || 0;
            
            animateNumber(totalCallsEl, totalViews);
            animateNumber(usersEl, uniqueVisitors);
            animateNumber(hourCallsEl, lastHourViews);
          } else {
            // 如果获取失败，显示占位符
            totalCallsEl.textContent = '-';
            usersEl.textContent = '-';
            hourCallsEl.textContent = '-';
            console.warn('无法获取 Umami 统计数据。请配置 SHARE_ID 或检查 Umami 设置。');
          }
        } catch (error) {
          console.error('Failed to init visitor stats:', error);
          const totalCallsEl = document.getElementById('visitor-stats-total-calls');
          const usersEl = document.getElementById('visitor-stats-users');
          const hourCallsEl = document.getElementById('visitor-stats-hour-calls');
          if (totalCallsEl) totalCallsEl.textContent = '-';
          if (usersEl) usersEl.textContent = '-';
          if (hourCallsEl) hourCallsEl.textContent = '-';
        }
      }
      
      /**
       * 初始化每个API的统计
       */
      async function initApiStats() {
        try {
          const apiExamples = document.querySelectorAll('.api-example');
          const apiPaths = Array.from(apiExamples).map(el => el.getAttribute('data-api-path'));
          
          if (!apiPaths.length || !SHARE_ID) return;
          
          const now = Date.now();
          
          // 并行获取所有API的统计数据
          const statsPromises = apiPaths.map(async (path, index) => {
            const stats = await getPageStatsWithShare(path, 0, now);
            return { path, index, stats };
          });
          
          const results = await Promise.all(statsPromises);
          
          results.forEach(({ index, stats }) => {
            const usersEl = document.getElementById('api-users-' + index);
            const callsEl = document.getElementById('api-calls-' + index);
            
            if (usersEl && callsEl) {
              if (stats) {
                animateNumber(usersEl, stats.visitors || 0);
                animateNumber(callsEl, stats.pageviews || 0);
              } else {
                usersEl.textContent = '-';
                callsEl.textContent = '-';
              }
            }
          });
        } catch (error) {
          console.error('Failed to init API stats:', error);
        }
      }
      
      // 页面加载完成后初始化统计
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          initVisitorStats();
          initApiStats();
        });
      } else {
        initVisitorStats();
        initApiStats();
      }
    })();
  </script>
  <script defer src="https://umami.2o.nz/script.js" data-website-id="f3200a83-8a62-463f-afb1-72f029ee2115"></script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}

/**
 * 生成图库页面
 */
export function generateGalleryPage(baseUrl: string): Response {
  const apiConfigs = Object.entries(imageConfig).map(([path, config]) => {
    const images = imageList[path as keyof typeof imageList] ?? [];
    return {
      path,
      name: config.name,
      dir: config.dir,
      images: images,
      count: images.length
    };
  });

  const apiTabs = apiConfigs.map((api, index) => `
    <li class="nav-item${index === 0 ? ' active' : ''}" data-index="${index}" data-path="${api.path}">
      <span class="nav-name">${api.name}</span>
      <span class="nav-count">${api.count}</span>
    </li>
  `).join('');

  const apiPanels = apiConfigs.map((api, index) => {
    // 转义 JSON 以安全嵌入 HTML 属性
    const imagesJson = JSON.stringify(api.images).replace(/'/g, '&#39;');
    // 使用图片资源站 URL
    const imgBase = `${imageBaseUrl}${api.dir}/`;
    return `
      <div class="tab-panel${index === 0 ? ' active' : ''}" data-index="${index}" data-images='${imagesJson}' data-base="${imgBase}">
        <div class="gallery-grid" id="gallery-${index}"></div>
        <div class="load-more-container" id="load-more-${index}">
          <button class="load-more-btn" onclick="loadMore(${index})">加载更多</button>
        </div>
      </div>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>图库 - Yao の API</title>
  <link rel="icon" type="image/x-icon" href="${imageBaseUrl}/icons/favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'JetBrains Mono', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #f8fafc;
      min-height: 100vh;
      color: #1f2937;
    }
    
    .layout {
      display: flex;
      min-height: 100vh;
    }
    
    .sidebar {
      width: 240px;
      background: #fff;
      border-right: 1px solid rgba(0, 0, 0, 0.06);
      padding: 24px 0;
      position: fixed;
      top: 0;
      left: 0;
      height: 100vh;
      overflow-y: auto;
      z-index: 100;
    }
    
    .sidebar-header {
      padding: 0 20px 24px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      margin-bottom: 16px;
    }
    
    .sidebar-header h1 {
      font-size: 20px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 8px;
    }
    
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #64748b;
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
    }
    
    .back-link:hover {
      color: #1f2937;
    }
    
    .nav-list {
      list-style: none;
    }
    
    .nav-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: #64748b;
      transition: all 0.15s;
      border-left: 3px solid transparent;
    }
    
    .nav-item:hover {
      background: rgba(0, 0, 0, 0.02);
      color: #374151;
    }
    
    .nav-item.active {
      background: rgba(0, 0, 0, 0.03);
      color: #1f2937;
      border-left-color: #1f2937;
    }
    
    .nav-count {
      background: rgba(0, 0, 0, 0.05);
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      color: #64748b;
    }
    
    .nav-item.active .nav-count {
      background: #1f2937;
      color: #fff;
    }
    
    .main {
      flex: 1;
      margin-left: 240px;
      padding: 32px;
    }
    
    .tab-panel {
      display: none;
    }
    
    .tab-panel.active {
      display: block;
    }
    
    .gallery-grid {
      column-count: 3;
      column-gap: 20px;
    }
    
    @media (max-width: 1200px) {
      .gallery-grid { column-count: 2; }
    }
    
    @media (max-width: 768px) {
      .gallery-grid { column-count: 1; }
    }
    
    .gallery-item {
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      background: #fff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      transition: all 0.2s ease;
      cursor: pointer;
      break-inside: avoid;
      margin-bottom: 20px;
    }
    
    .gallery-item:hover {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      transform: translateY(-2px);
    }
    
    .gallery-item img {
      width: 100%;
      height: auto;
      display: block;
      transition: transform 0.3s ease;
    }
    
    .gallery-item:hover img {
      transform: scale(1.02);
    }
    
    .gallery-item .overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 40%);
      opacity: 0;
      transition: opacity 0.2s;
      display: flex;
      align-items: flex-end;
      padding: 12px;
    }
    
    .gallery-item:hover .overlay {
      opacity: 1;
    }
    
    .overlay .filename {
      color: #fff;
      font-size: 11px;
      word-break: break-all;
    }
    
    .load-more-container {
      text-align: center;
      margin-top: 32px;
      display: none;
    }
    
    .load-more-container.visible {
      display: block;
    }
    
    .load-more-btn {
      padding: 12px 32px;
      background: #1f2937;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s;
    }
    
    .load-more-btn:hover {
      background: #374151;
    }
    
    /* 移动端适配 */
    @media (max-width: 768px) {
      .sidebar {
        width: 100%;
        height: auto;
        position: relative;
        border-right: none;
        border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      }
      
      .layout {
        flex-direction: column;
      }
      
      .main {
        margin-left: 0;
        padding: 20px;
      }
      
      .nav-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 0 16px;
      }
      
      .nav-item {
        padding: 8px 14px;
        border-left: none;
        border-radius: 8px;
        border: 1px solid rgba(0, 0, 0, 0.06);
      }
      
      .nav-item.active {
        background: #1f2937;
        color: #fff;
        border-color: #1f2937;
      }
      
      .nav-item.active .nav-count {
        background: rgba(255, 255, 255, 0.2);
      }
      
      .gallery-grid {
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 12px;
      }
    }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1>图库</h1>
        <a href="/" class="back-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          返回首页
        </a>
      </div>
      <ul class="nav-list">
        ${apiTabs}
      </ul>
    </aside>
    
    <main class="main">
      ${apiPanels}
    </main>
  </div>
  
  <script>
    const MAX_PAGE_SIZE = 12;
    const pageState = {};
    let isLoading = false;
    
    // 根据屏幕大小计算每次加载的图片数量
    function getPageSize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      let cols = 3;
      if (width <= 768) cols = 1;
      else if (width <= 1200) cols = 2;
      
      // 估算每行能显示的图片数，乘以屏幕能显示的行数
      const avgItemHeight = 300;
      const rows = Math.ceil(height / avgItemHeight) + 1;
      const count = cols * rows;
      
      return Math.min(count, MAX_PAGE_SIZE);
    }
    
    // 初始化
    document.querySelectorAll('.tab-panel').forEach((panel, index) => {
      pageState[index] = { loaded: 0, hasMore: true };
    });
    
    // 获取当前激活的标签索引
    function getActiveIndex() {
      const activeItem = document.querySelector('.nav-item.active');
      return activeItem ? parseInt(activeItem.dataset.index) : 0;
    }
    
    // 切换标签
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = item.dataset.index;
        
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        
        item.classList.add('active');
        document.querySelector('.tab-panel[data-index="' + index + '"]').classList.add('active');
        
        // 首次切换时加载
        if (pageState[index].loaded === 0) {
          loadMore(parseInt(index));
        }
      });
    });
    
    // Umami 上报防盗刷保护
    const ALLOWED_HOSTS = ['api.yaooa.cn', 'localhost', '127.0.0.1'];
    const trackedImages = new Set();
    
    // Umami 上报函数（带防盗刷）
    function trackImageView(imagePath) {
      try {
        // 防盗刷：检查当前页面域名是否是允许的域名
        const currentHost = location.hostname;
        if (!ALLOWED_HOSTS.some(h => currentHost === h || currentHost.endsWith('.' + h))) {
          console.warn('[Umami] 非法域名，拒绝上报:', currentHost);
          return;
        }
        // 防盗刷：检查是否已上报过（同一图片不重复上报）
        if (trackedImages.has(imagePath)) return;
        trackedImages.add(imagePath);
        
        const payload = {
          type: 'event',
          payload: {
            website: 'f3200a83-8a62-463f-afb1-72f029ee2115',
            url: imagePath,
            hostname: location.hostname,
            referrer: document.referrer || '',
            title: imagePath.split('/').pop() || imagePath,
            language: navigator.language?.split('-')[0] || 'en',
            event_name: 'pageview',
          },
        };
        fetch('https://umami.2o.nz/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {});
      } catch (e) {}
    }
    
    function loadMore(index) {
      if (isLoading || !pageState[index].hasMore) return;
      isLoading = true;
      
      const panel = document.querySelector('.tab-panel[data-index="' + index + '"]');
      const grid = document.getElementById('gallery-' + index);
      const images = JSON.parse(panel.dataset.images);
      const baseUrl = panel.dataset.base;
      
      const pageSize = getPageSize();
      const start = pageState[index].loaded;
      const end = Math.min(start + pageSize, images.length);
      
      for (let i = start; i < end; i++) {
        const img = images[i];
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.innerHTML = \`
          <img src="\${baseUrl}\${img}" alt="\${img}" loading="lazy" />
          <div class="overlay">
            <span class="filename">\${img}</span>
          </div>
        \`;
        // 图片加载完成时上报 umami
        const imgEl = item.querySelector('img');
        imgEl.addEventListener('load', () => {
          trackImageView(baseUrl + img);
        });
        item.addEventListener('click', () => {
          window.open(baseUrl + img, '_blank');
        });
        grid.appendChild(item);
      }
      
      pageState[index].loaded = end;
      pageState[index].hasMore = end < images.length;
      
      isLoading = false;
    }
    
    // 无限滚动
    function handleScroll() {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      
      // 距离底部 300px 时加载更多
      if (scrollTop + windowHeight >= docHeight - 300) {
        const activeIndex = getActiveIndex();
        loadMore(activeIndex);
      }
    }
    
    // 节流
    let scrollTimer = null;
    window.addEventListener('scroll', () => {
      if (scrollTimer) return;
      scrollTimer = setTimeout(() => {
        handleScroll();
        scrollTimer = null;
      }, 100);
    });
    
    // 初始加载第一个标签
    loadMore(0);
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

