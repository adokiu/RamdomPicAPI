/**
 * 通用工具函数
 */
import { imageConfig, pcImageConfig, mobileImageConfig, adaptiveRoutes, imageBaseUrl } from '../config';
import { imageList } from '../image-list/index';
import { indexTemplate } from './templates/index';
import { galleryTemplate } from './templates/gallery';

/**
 * 根据 User-Agent 判断是否为移动端
 */
export function isMobile(ua: string): boolean {
  return /Mobile|Android|iPhone|iPad|iPod|webOS|BlackBerry|Opera Mini|IEMobile/i.test(ua);
}

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
 */
export async function fixImageResponseHeaders(
  response: Response,
  filename: string,
  cacheMaxAge: number = 3600
): Promise<Response> {
  const imageData = await response.arrayBuffer();
  const originalContentType = response.headers.get('Content-Type');
  const contentType = originalContentType || getContentType(filename);

  const headers: HeadersInit = {
    'Content-Type': contentType,
    'Content-Disposition': 'inline',
    'Content-Length': imageData.byteLength.toString(),
  };

  if (cacheMaxAge === 0) {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    headers['Pragma'] = 'no-cache';
    headers['Expires'] = '0';
  } else {
    headers['Cache-Control'] = `public, max-age=${cacheMaxAge}, immutable`;
  }

  return new Response(imageData, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * 获取图片内容并返回，设置正确的响应头以确保浏览器显示而不是下载
 */
export async function createImageResponse(
  imageUrl: string,
  filename: string,
  cacheMaxAge: number = 0
): Promise<Response> {
  try {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return createErrorResponse('Failed to fetch image', imageResponse.status);
    }
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
function buildCard(path: string, index: number, baseUrl: string, category: string): string {
  const configItem = imageConfig[path as keyof typeof imageConfig];
  const displayName = configItem?.name || path;
  const imageCount = Array.isArray(imageList[path]) ? imageList[path].length : 0;
  const exampleUrl = `${baseUrl}${path}`;
  return `
    <div class="api-card" data-api-path="${path}" data-category="${category}">
      <div class="api-preview">
        <div class="img-loading"></div>
        <img src="${exampleUrl}" alt="${displayName}" loading="lazy" data-index="${index}" data-url="${exampleUrl}" onload="measureLatency(this)" onclick="refreshImage(this)" title="点击刷新图片" />
      </div>
      <div class="api-card-body">
        <div class="api-card-header">
          <span class="api-card-name">${displayName}</span>
          <button class="copy-btn" onclick="copyToClipboard('${exampleUrl}', this)" title="复制链接">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
        </div>
        <div class="api-url"><code>${exampleUrl}</code></div>
        <div class="api-card-tags">
          <span class="api-card-tag" id="api-latency-${index}">-</span>
          <span class="api-card-count">${imageCount} 张</span>
          <span class="api-card-tag">用户 <span id="api-users-${index}">-</span></span>
          <span class="api-card-tag">调用 <span id="api-calls-${index}">-</span></span>
        </div>
      </div>
    </div>
  `;
}

export function generateApiDocPage(baseUrl: string): Response {
  const totalImageCount = Object.values(imageList).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);

  let globalIndex = 0;
  const pcCards = Object.keys(pcImageConfig).map(path => buildCard(path, globalIndex++, baseUrl, 'pc'));
  const mobileCards = Object.keys(mobileImageConfig).map(path => buildCard(path, globalIndex++, baseUrl, 'mobile'));

  const adaptiveCards = Object.entries(adaptiveRoutes).map(([adaptivePath, route]) => {
    const pcCount = Array.isArray(imageList[route.pc]) ? imageList[route.pc].length : 0;
    const mbCount = Array.isArray(imageList[route.mobile]) ? imageList[route.mobile].length : 0;
    const totalCount = pcCount + mbCount;
    const exampleUrl = `${baseUrl}${adaptivePath}`;
    const adaptiveIdx = globalIndex++;
    return `
      <div class="api-card api-card-adaptive" data-api-path="${adaptivePath}" data-category="adaptive">
        <div class="api-preview">
          <div class="img-loading"></div>
          <img src="${exampleUrl}" alt="预览" loading="lazy" data-index="${adaptiveIdx}" data-url="${exampleUrl}" onload="measureLatency(this)" onclick="refreshImage(this)" title="点击刷新" />
        </div>
        <div class="api-card-body">
          <div class="api-card-header">
            <span class="api-card-name">${route.name}</span>
            <button class="copy-btn" onclick="copyToClipboard('${exampleUrl}', this)" title="复制链接">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
          <div class="api-url"><code>${exampleUrl}</code></div>
          <div class="api-card-tags">
            <span class="api-card-tag" id="api-latency-${adaptiveIdx}">-</span>
            <span class="api-card-count">${totalCount} 张</span>
            <span class="api-card-tag">用户 <span id="api-users-${adaptiveIdx}">-</span></span>
            <span class="api-card-tag">调用 <span id="api-calls-${adaptiveIdx}">-</span></span>
          </div>
        </div>
      </div>
    `;
  });

  const allExamples = adaptiveCards.join('') + pcCards.join('') + mobileCards.join('');

  const html = indexTemplate(baseUrl, imageBaseUrl, totalImageCount, allExamples);

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
    const imagesJson = JSON.stringify(api.images).replace(/'/g, '&#39;');
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

  const html = galleryTemplate(imageBaseUrl, apiTabs, apiPanels);

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
