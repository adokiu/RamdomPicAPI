/**
 * 统计服务模块
 * 用于获取每个API的累计用户数和调用总数
 */

const UMAMI_BASE_URL = 'https://umami.2o.nz';
const WEBSITE_ID = 'f3200a83-8a62-463f-afb1-72f029ee2115';
const SHARE_ID = 'DyRysjiYHzzcsc5l';

export interface ApiStats {
  path: string;
  users: number;
  calls: number;
}

export interface TotalStats {
  totalUsers: number;
  totalCalls: number;
  hourCalls: number;
}

let shareDataCache: { data: any; timestamp: number } | null = null;
const SHARE_CACHE_TTL = 3600_000; // 1小时

/**
 * 获取 Umami Share 数据
 */
async function getUmamiShareData(): Promise<{ websiteId: string; token: string } | null> {
  if (!SHARE_ID) return null;
  
  const now = Date.now();
  if (shareDataCache && (now - shareDataCache.timestamp) < SHARE_CACHE_TTL) {
    return shareDataCache.data;
  }
  
  try {
    const url = `${UMAMI_BASE_URL}/api/share/${SHARE_ID}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`获取 Umami 分享信息失败: ${response.status}`);
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
 * 获取网站统计数据
 */
async function getWebsiteStats(startAt: number = 0, endAt: number = Date.now()): Promise<{ pageviews: number; visitors: number } | null> {
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
    
    const statsUrl = `${UMAMI_BASE_URL}/api/websites/${websiteId}/stats?${params.toString()}`;
    const response = await fetch(statsUrl, {
      headers: {
        'x-umami-share-token': token,
      },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        // Token 过期，清除缓存并重试一次
        shareDataCache = null;
        return await getWebsiteStats(startAt, endAt);
      }
      throw new Error(`获取统计数据失败: ${response.status}`);
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
    console.error('Failed to fetch Umami website stats:', error);
    return null;
  }
}

/**
 * 获取页面统计数据（按路径）
 */
async function getPageStats(path: string, startAt: number = 0, endAt: number = Date.now()): Promise<{ pageviews: number; visitors: number } | null> {
  try {
    const shareData = await getUmamiShareData();
    if (!shareData) return null;
    
    const { websiteId, token } = shareData;
    
    const params = new URLSearchParams({
      startAt: startAt.toString(),
      endAt: endAt.toString(),
      unit: 'hour',
      timezone: 'Asia/Shanghai',
      url: path, // 按路径过滤
    });
    
    const statsUrl = `${UMAMI_BASE_URL}/api/websites/${websiteId}/pageviews?${params.toString()}`;
    const response = await fetch(statsUrl, {
      headers: {
        'x-umami-share-token': token,
      },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        shareDataCache = null;
        return await getPageStats(path, startAt, endAt);
      }
      // 如果API不支持按路径查询，返回null
      return null;
    }
    
    const data = await response.json();
    // Umami的pageviews API返回格式可能不同，需要根据实际返回调整
    // 这里假设返回的是数组，包含各个页面的统计数据
    if (Array.isArray(data)) {
      const pageData = data.find((item: any) => item.url === path);
      if (pageData) {
        return {
          pageviews: pageData.pageviews || 0,
          visitors: pageData.visitors || 0,
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Failed to fetch page stats for ${path}:`, error);
    return null;
  }
}

/**
 * 获取所有API的统计数据
 */
export async function getAllApiStats(apiPaths: string[]): Promise<{ apiStats: ApiStats[]; totalStats: TotalStats }> {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  
  // 获取总体统计
  const totalStatsData = await getWebsiteStats(0, now);
  const hourStatsData = await getWebsiteStats(oneHourAgo, now);
  
  const totalStats: TotalStats = {
    totalUsers: totalStatsData?.visitors || 0,
    totalCalls: totalStatsData?.pageviews || 0,
    hourCalls: hourStatsData?.pageviews || 0,
  };
  
  // 获取每个API的统计（如果支持）
  const apiStatsPromises = apiPaths.map(async (path) => {
    const stats = await getPageStats(path, 0, now);
    return {
      path,
      users: stats?.visitors || 0,
      calls: stats?.pageviews || 0,
    };
  });
  
  const apiStats = await Promise.all(apiStatsPromises);
  
  return { apiStats, totalStats };
}

/**
 * 格式化数字（k/w格式）
 */
export function formatNumber(num: number): string {
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

