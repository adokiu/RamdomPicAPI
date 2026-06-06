/**
 * 图库页 HTML 模板
 * 简约高级风格
 */

export function galleryTemplate(
  imageBaseUrl: string,
  apiTabs: string,
  apiPanels: string
): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>图库 - Doki Image API</title>
  <link rel="icon" type="image/x-icon" href="${imageBaseUrl}/icons/favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --bg: #0c0c0c;
      --bg-elevated: #141414;
      --border: rgba(255,255,255,0.06);
      --border-hover: rgba(255,255,255,0.12);
      --text-primary: #f5f5f5;
      --text-secondary: #888;
      --text-tertiary: #555;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      min-height: 100vh;
      color: var(--text-secondary);
    }

    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0);
      background-size: 48px 48px;
      pointer-events: none;
      z-index: 0;
      mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
      -webkit-mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
    }

    .layout {
      display: flex;
      min-height: 100vh;
      position: relative;
      z-index: 1;
    }

    .sidebar {
      width: 280px;
      background: var(--bg-elevated);
      border-right: 1px solid var(--border);
      padding: 40px 0;
      position: fixed;
      top: 0;
      left: 0;
      height: 100vh;
      overflow-y: auto;
      z-index: 100;
      display: flex;
      flex-direction: column;
    }

    .sidebar-header {
      padding: 0 32px 32px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 8px;
    }

    .sidebar-header h1 {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 12px;
      letter-spacing: -0.3px;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--text-tertiary);
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      transition: color 0.2s;
    }

    .back-link:hover {
      color: var(--text-secondary);
    }

    .nav-list {
      list-style: none;
      padding: 8px 0;
      flex: 1;
    }

    .nav-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 32px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: var(--text-tertiary);
      transition: color 0.15s, background 0.15s;
      border-left: 2px solid transparent;
      margin: 0 12px;
      border-radius: 0 8px 8px 0;
    }

    .nav-item:hover {
      background: rgba(255,255,255,0.02);
      color: var(--text-secondary);
    }

    .nav-item.active {
      background: rgba(255,255,255,0.03);
      color: var(--text-primary);
      border-left-color: var(--text-primary);
    }

    .nav-count {
      background: rgba(255,255,255,0.04);
      padding: 3px 10px;
      border-radius: 6px;
      font-size: 12px;
      color: var(--text-tertiary);
      border: 1px solid var(--border);
      font-variant-numeric: tabular-nums;
    }

    .nav-item.active .nav-count {
      background: var(--text-primary);
      color: var(--bg);
      border-color: var(--text-primary);
    }

    .main {
      flex: 1;
      margin-left: 280px;
      padding: 48px;
    }

    .tab-panel {
      display: none;
      animation: fadeIn 0.4s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .tab-panel.active {
      display: block;
    }

    .gallery-grid {
      column-count: 3;
      column-gap: 16px;
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
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      transition: border-color 0.4s ease, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
      break-inside: avoid;
      margin-bottom: 16px;
    }

    .gallery-item:hover {
      border-color: var(--border-hover);
      transform: translateY(-2px);
    }

    .gallery-item img {
      width: 100%;
      height: auto;
      display: block;
      transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .gallery-item:hover img {
      transform: scale(1.04);
    }

    .gallery-item .overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 60%);
      opacity: 0;
      transition: opacity 0.4s ease;
      display: flex;
      align-items: flex-end;
      padding: 16px;
    }

    .gallery-item:hover .overlay {
      opacity: 1;
    }

    .overlay .filename {
      color: rgba(255,255,255,0.9);
      font-size: 11px;
      word-break: break-all;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: 0.3px;
    }

    .load-more-container {
      text-align: center;
      margin-top: 48px;
      display: none;
    }

    .load-more-container.visible {
      display: block;
      animation: fadeIn 0.4s ease;
    }

    .load-more-btn {
      padding: 14px 40px;
      background: var(--bg-elevated);
      color: var(--text-secondary);
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: border-color 0.3s ease, color 0.3s ease, transform 0.2s ease;
    }

    .load-more-btn:hover {
      border-color: var(--border-hover);
      color: var(--text-primary);
      transform: translateY(-1px);
    }

    /* 移动端 */
    @media (max-width: 768px) {
      .sidebar {
        width: 100%;
        height: auto;
        position: relative;
        border-right: none;
        border-bottom: 1px solid var(--border);
        padding: 24px 0;
      }

      .layout { flex-direction: column; }
      .main { margin-left: 0; padding: 32px 24px; }

      .nav-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 0 20px;
      }

      .nav-item {
        padding: 8px 16px;
        border-left: none;
        border-radius: 8px;
        border: 1px solid var(--border);
        margin: 0;
      }

      .nav-item.active {
        background: var(--text-primary);
        color: var(--bg);
        border-color: var(--text-primary);
      }

      .nav-item.active .nav-count {
        background: var(--bg);
        color: var(--text-primary);
        border-color: var(--bg);
      }

      .gallery-grid {
        column-count: auto;
        display: grid;
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

    function getPageSize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      let cols = 3;
      if (width <= 768) cols = 1;
      else if (width <= 1200) cols = 2;
      const avgItemHeight = 300;
      const rows = Math.ceil(height / avgItemHeight) + 1;
      return Math.min(cols * rows, MAX_PAGE_SIZE);
    }

    document.querySelectorAll('.tab-panel').forEach((panel, index) => {
      pageState[index] = { loaded: 0, hasMore: true };
    });

    function getActiveIndex() {
      const activeItem = document.querySelector('.nav-item.active');
      return activeItem ? parseInt(activeItem.dataset.index) : 0;
    }

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = item.dataset.index;
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        item.classList.add('active');
        document.querySelector('.tab-panel[data-index="' + index + '"]').classList.add('active');
        if (pageState[index].loaded === 0) loadMore(parseInt(index));
      });
    });

    const ALLOWED_HOSTS = ['api.yaooa.cn', 'localhost', '127.0.0.1'];
    const trackedImages = new Set();

    function trackImageView(imagePath) {
      try {
        const currentHost = location.hostname;
        if (!ALLOWED_HOSTS.some(h => currentHost === h || currentHost.endsWith('.' + h))) return;
        if (trackedImages.has(imagePath)) return;
        trackedImages.add(imagePath);
        fetch('https://umami.2o.nz/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
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
          }),
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
        item.querySelector('img').addEventListener('load', () => { trackImageView(baseUrl + img); });
        item.addEventListener('click', () => { window.open(baseUrl + img, '_blank'); });
        grid.appendChild(item);
      }
      pageState[index].loaded = end;
      pageState[index].hasMore = end < images.length;
      isLoading = false;
    }

    function handleScroll() {
      const st = window.scrollY || document.documentElement.scrollTop;
      if (st + window.innerHeight >= document.documentElement.scrollHeight - 300) {
        loadMore(getActiveIndex());
      }
    }

    let scrollTimer = null;
    window.addEventListener('scroll', () => {
      if (scrollTimer) return;
      scrollTimer = setTimeout(() => { handleScroll(); scrollTimer = null; }, 100);
    });

    loadMore(0);
  </script>
</body>
</html>`;
}
