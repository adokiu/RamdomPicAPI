/**
 * 首页 HTML 模板
 * 简约高级风格：大面积留白、精致排版、微妙动效
 */

export function indexTemplate(
  baseUrl: string,
  imageBaseUrl: string,
  totalImageCount: number,
  examples: string
): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Doki Image API</title>
  <link rel="icon" type="image/x-icon" href="/icons/favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --bg: #0a0a0a;
      --bg-elevated: #121212;
      --bg-card: #161616;
      --bg-glass: rgba(10, 10, 10, 0.72);
      --border: rgba(255,255,255,0.06);
      --border-hover: rgba(255,255,255,0.14);
      --border-strong: rgba(255,255,255,0.18);
      --text-primary: #f5f5f5;
      --text-secondary: #999;
      --text-tertiary: #5a5a5a;
      --accent: #fff;
      --glow: rgba(255, 255, 255, 0.04);
    }

    html { scroll-behavior: smooth; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.5;
      color: var(--text-secondary);
      background: var(--bg);
      min-height: 100vh;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* 微妙网格背景 */
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background-image:
        radial-gradient(circle at 1px 1px, rgba(255,255,255,0.025) 1px, transparent 0);
      background-size: 56px 56px;
      pointer-events: none;
      z-index: 0;
      mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 75%);
      -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 75%);
    }

    /* 顶部柔和光晕 */
    body::after {
      content: '';
      position: fixed;
      top: -300px;
      left: 50%;
      transform: translateX(-50%);
      width: 1000px;
      height: 600px;
      background: radial-gradient(ellipse at center, rgba(255,255,255,0.04) 0%, transparent 60%);
      pointer-events: none;
      z-index: 0;
    }

    .container {
      max-width: 1240px;
      margin: 0 auto;
      padding: 96px 40px 80px;
      position: relative;
      z-index: 1;
    }

    /* 头部 */
    .header {
      margin-bottom: 64px;
      animation: fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      opacity: 0;
      transform: translateY(30px);
    }

    .header h1 {
      font-size: 64px;
      font-weight: 600;
      letter-spacing: -3px;
      line-height: 1.15;
      color: var(--text-primary);
      margin-bottom: 16px;
      background: linear-gradient(180deg, #ffffff 0%, #b8b8b8 100%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .header-desc {
      font-size: 16px;
      font-weight: 400;
      color: var(--text-secondary);
      line-height: 1.5;
    }

    .header-note {
      font-size: 13px;
      color: var(--text-tertiary);
      margin-top: 8px;
    }

    /* 统计指标 */
    .metrics {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px 12px;
      margin-top: 24px;
      font-size: 13px;
      color: var(--text-tertiary);
    }

    .metrics .metric-num {
      color: var(--text-primary);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .metric-divider {
      color: var(--border-hover);
    }

    /* 内容区域 */
    .section {
      margin-top: 64px;
      animation: fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards;
      opacity: 0;
      transform: translateY(30px);
    }

    .section-header {
      display: flex;
      align-items: baseline;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .section-title-group {
      display: flex;
      align-items: baseline;
      gap: 14px;
    }

    .section-title {
      font-size: 28px;
      font-weight: 600;
      letter-spacing: -1px;
      color: var(--text-primary);
    }

    .section-desc {
      font-size: 15px;
      color: var(--text-tertiary);
      max-width: 560px;
      line-height: 1.7;
    }


    .gallery-btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 14px 28px;
      background: var(--text-primary);
      color: var(--bg);
      text-decoration: none;
      border-radius: 12px;
      font-weight: 600;
      font-size: 14px;
      margin-top: 32px;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      box-shadow: 0 0 0 rgba(255,255,255,0);
    }

    .gallery-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 32px rgba(255,255,255,0.1);
    }

    .gallery-btn svg {
      transition: transform 0.3s ease;
    }

    .gallery-btn:hover svg {
      transform: translateX(2px);
    }

    /* API 卡片网格 */
    .api-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 20px;
    }

    .api-card {
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 0;
      position: relative;
      overflow: hidden;
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.4s ease, box-shadow 0.4s ease;
      animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      opacity: 0;
      transform: translateY(20px);
      display: flex;
      flex-direction: column;
    }

    .api-card:nth-child(1) { animation-delay: 0.05s; }
    .api-card:nth-child(2) { animation-delay: 0.1s; }
    .api-card:nth-child(3) { animation-delay: 0.15s; }
    .api-card:nth-child(4) { animation-delay: 0.2s; }
    .api-card:nth-child(5) { animation-delay: 0.25s; }
    .api-card:nth-child(6) { animation-delay: 0.3s; }

    .api-card:hover {
      transform: translateY(-4px);
      border-color: var(--border-hover);
      box-shadow: 0 24px 48px -16px rgba(0,0,0,0.5);
    }

    /* 卡片顶部光泽 */
    .api-card::after {
      content: '';
      position: absolute;
      top: 0;
      left: 20%;
      right: 20%;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent);
      opacity: 0;
      transition: opacity 0.4s ease;
    }

    .api-card:hover::after {
      opacity: 1;
    }

    .api-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .api-card-name {
      font-size: 17px;
      font-weight: 600;
      color: var(--text-primary);
      letter-spacing: -0.3px;
    }

    .api-card-body {
      padding: 14px 20px 18px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .api-card-tags {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .api-card-tag {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-tertiary);
      background: rgba(255,255,255,0.03);
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid var(--border);
      font-variant-numeric: tabular-nums;
    }

    .api-card-count {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-tertiary);
      background: rgba(255,255,255,0.03);
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid var(--border);
      font-variant-numeric: tabular-nums;
    }

    .api-url code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text-tertiary);
      word-break: break-all;
    }

    .copy-btn {
      background: none;
      border: none;
      padding: 6px;
      cursor: pointer;
      color: var(--text-tertiary);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: color 0.2s, background 0.2s, transform 0.2s;
      flex-shrink: 0;
    }

    .copy-btn:hover {
      color: var(--text-primary);
      background: rgba(255,255,255,0.06);
    }

    .copy-btn:active {
      transform: scale(0.92);
    }

    .copy-btn.copied {
      color: #4ade80;
    }

    .latency-excellent { color: #4ade80; }
    .latency-good      { color: #60a5fa; }
    .latency-fair      { color: #fbbf24; }
    .latency-poor      { color: #fb923c; }
    .latency-bad       { color: #ef4444; }

    .api-preview {
      overflow: hidden;
      cursor: pointer;
      position: relative;
      flex-shrink: 0;
    }

    .api-preview img {
      width: 100%;
      height: 200px;
      object-fit: cover;
      display: block;
      transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .api-card:hover .api-preview img {
      transform: scale(1.03);
    }

    .api-card[data-category="pc"] .api-preview img,
    .api-card[data-category="adaptive"] .api-preview img {
      height: 180px;
    }

    .api-card[data-category="mobile"] .api-preview img {
      height: 280px;
    }

    .api-preview::before {
      content: '点击刷新';
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 2;
      font-size: 11px;
      font-weight: 500;
      color: var(--text-primary);
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      padding: 5px 10px;
      border-radius: 999px;
      opacity: 0;
      transform: translateY(-4px);
      transition: opacity 0.3s ease, transform 0.3s ease;
      pointer-events: none;
    }

    .api-preview:hover::before {
      opacity: 1;
      transform: translateY(0);
    }

    .img-loading {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg);
      z-index: 1;
      transition: opacity 0.3s ease;
    }

    .img-loading::after {
      content: '';
      width: 24px;
      height: 24px;
      border: 2px solid var(--border);
      border-top-color: var(--text-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .api-preview.loaded .img-loading {
      opacity: 0;
      pointer-events: none;
    }

    .api-preview:hover img {
      transform: scale(1.04);
    }

    /* 自适应路由卡片 */
    .api-card-adaptive {
      background: linear-gradient(135deg, var(--bg-elevated) 0%, rgba(74, 222, 128, 0.02) 100%);
      border-color: rgba(74, 222, 128, 0.12);
    }

    .api-card-adaptive:hover {
      border-color: rgba(74, 222, 128, 0.25);
    }

    .api-card-badge {
      font-size: 11px;
      font-weight: 600;
      color: #4ade80;
      background: rgba(74, 222, 128, 0.08);
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid rgba(74, 222, 128, 0.15);
      letter-spacing: 0.3px;
    }

    .api-adaptive-info {
      display: flex;
      gap: 24px;
      margin-bottom: 14px;
      flex-wrap: wrap;
    }

    .adaptive-source {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-secondary);
    }

    .adaptive-icon svg {
      width: 14px;
      height: 14px;
      display: block;
      color: var(--text-tertiary);
    }

    .adaptive-desc {
      font-size: 13px;
      color: var(--text-tertiary);
      line-height: 1.5;
    }

    .api-adaptive-previews {
      display: flex;
      gap: 16px;
      margin-top: 16px;
      align-items: flex-start;
    }

    .api-adaptive-previews .api-preview {
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--border);
      background: var(--bg);
      cursor: pointer;
      position: relative;
      flex: 1 1 50%;
      min-width: 0;
    }

    .api-adaptive-previews .api-preview img {
      width: 100%;
      height: 200px;
      object-fit: cover;
      display: block;
    }

    @media (max-width: 640px) {
      .api-adaptive-previews .api-preview img {
        max-height: 160px;
      }
    }

    /* 分类筛选 Tab */
    .category-tabs {
      display: flex;
      gap: 6px;
      margin-bottom: 28px;
      flex-wrap: wrap;
    }

    .category-tab {
      padding: 8px 20px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s ease;
    }

    .category-tab:hover {
      color: var(--text-primary);
      border-color: var(--border-hover);
    }

    .category-tab.active {
      color: var(--bg);
      background: var(--text-primary);
      border-color: var(--text-primary);
    }

    /* 页脚 */
    .footer {
      margin-top: 200px;
      padding-top: 56px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: center;
      text-align: center;
    }

    .supporters {
      display: flex;
      align-items: center;
      gap: 14px;
      color: var(--text-tertiary);
      font-size: 13px;
      flex-wrap: wrap;
      justify-content: center;
      letter-spacing: 0.2px;
    }

    .supporter-logos {
      display: inline-flex;
      align-items: center;
      gap: 14px;
    }

    .supporter-logos a {
      display: flex;
      transition: opacity 0.3s;
      opacity: 0.75;
    }

    .supporter-logos a:hover {
      opacity: 1;
    }

    .supporter-logo {
      height: 22px;
      width: auto;
      object-fit: contain;
      filter: brightness(0) invert(1);
      opacity: 0.85;
    }

    .beian {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 20px;
      font-size: 14px;
      color: var(--text-tertiary);
    }

    a.beian-item {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--text-tertiary);
      text-decoration: none;
      transition: color 0.2s;
    }

    a.beian-item:hover {
      color: var(--text-primary);
    }

    .beian-item img {
      width: 20px;
      height: 20px;
      object-fit: contain;
      opacity: 0.6;
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* 版权声明 */
    .copyright-link-inline {
      font-size: 12px;
      margin-left: 8px;
    }
    .copyright-link-inline::before {
      content: '|';
      color: var(--border);
      margin-right: 8px;
    }
    .copyright-link-inline a {
      color: var(--text-tertiary);
      text-decoration: none;
      transition: color 0.3s ease;
    }
    .copyright-link-inline a:hover {
      color: var(--text-primary);
    }

    /* 模态框 */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 1000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .modal-overlay.active {
      display: flex;
      opacity: 1;
    }
    .modal-content {
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 16px;
      width: 100%;
      max-width: 680px;
      max-height: 80vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transform: translateY(20px);
      transition: transform 0.3s ease;
    }
    .modal-overlay.active .modal-content {
      transform: translateY(0);
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .modal-header h3 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }
    .modal-close {
      background: none;
      border: none;
      color: var(--text-tertiary);
      font-size: 24px;
      cursor: pointer;
      line-height: 1;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      transition: color 0.3s ease, background 0.3s ease;
    }
    .modal-close:hover {
      color: var(--text-primary);
      background: rgba(255,255,255,0.05);
    }
    .modal-body {
      padding: 20px;
      overflow-y: auto;
      font-size: 13px;
      line-height: 1.8;
      color: var(--text-secondary);
    }
    .modal-body p {
      margin-bottom: 12px;
    }
    .modal-body h4 {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 20px 0 12px;
    }

    /* 响应式 */
    @media (max-width: 1024px) {
      .container { max-width: 100%; padding: 80px 32px 60px; }
      .header h1 { font-size: 64px; letter-spacing: -2.5px; }
      .api-grid { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
    }

    @media (max-width: 768px) {
      .container { padding: 64px 20px 56px; }
      .header { margin-bottom: 48px; }
      .header h1 { font-size: 44px; letter-spacing: -1.5px; margin-bottom: 14px; }
      .section { margin-top: 48px; }
      .section-title { font-size: 24px; }
      .api-grid { grid-template-columns: 1fr; gap: 16px; }
      .footer { margin-top: 140px; padding-top: 40px; }
    }

    @media (max-width: 480px) {
      .header h1 { font-size: 36px; letter-spacing: -1px; }
      .modal-overlay { padding: 10px; }
      .modal-content { max-height: 90vh; border-radius: 12px; }
      .modal-body { padding: 16px; font-size: 12px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>Doki Image API</h1>
      <p class="header-desc">随机高质量图片 API，AVIF 格式</p>
      <div class="metrics">
        <span class="metric-item"><span class="metric-num" id="visitor-stats-users">-</span>  累计用户</span>
        <span class="metric-item"><span class="metric-num" id="visitor-stats-total-calls">-</span>  API 累计调用</span>
        <span class="metric-item"><span class="metric-num" id="visitor-stats-hour-calls">-</span>  1h内 累计调用</span>
        <span class="metric-item"><span class="metric-num">${totalImageCount.toLocaleString()}</span>  张图片</span>
        <a class="metric-item" href="https://blog.2o.nz" target="_blank" rel="noopener" style="text-decoration:none;"><span class="metric-num">我的博客</span></a>
      </div>
      <p class="header-note">中国大陆 EdgeOne，港澳台及海外 Cloudflare。增加图片，版权问题联系 x@coci.cc</p>
      <a href="/gallery" class="gallery-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
        浏览图库
      </a>
    </header>

    <section class="section" id="endpoints">
      <div class="section-header">
        <div class="section-title-group">
          <h2 class="section-title">使用方法</h2>
        </div>
      </div>
      <div class="category-tabs">
        <button class="category-tab active" data-category="adaptive" onclick="filterCategory('adaptive')">自适应</button>
        <button class="category-tab" data-category="pc" onclick="filterCategory('pc')">PC</button>
        <button class="category-tab" data-category="mobile" onclick="filterCategory('mobile')">移动端</button>
      </div>
      <div class="api-grid">
        ${examples}
      </div>
    </section>

    <footer class="footer">
      <div class="supporters">
        <span>感谢</span>
        <span class="supporter-logos">
          <a href="https://cloud.tencent.com/product/teo" target="_blank" rel="noopener" title="腾讯云 EdgeOne">
            <img class="supporter-logo" src="/icons/foot-edgeone.png" alt="腾讯云EdgeOne" />
          </a>
          <a href="https://www.cloudflare.com" target="_blank" rel="noopener" title="Cloudflare">
            <img class="supporter-logo" src="/icons/foot-cloudflare.png" alt="Cloudflare" />
          </a>
        </span>
        <span>的大力支持</span>
        <span class="copyright-link-inline">
          <a href="javascript:void(0)" onclick="showCopyrightModal()">版权声明与投诉指引</a>
        </span>
      </div>
      <div class="beian">
        <a class="beian-item" href="https://www.beian.gov.cn/portal/registerSystemInfo?recordcode=51080202020049" target="_blank" rel="noopener">
          <img src="/icons/foot-ga.png" alt="公安备案图标" />
          川公网安备51080202020049号
        </a>
        <a class="beian-item" href="https://beian.miit.gov.cn" target="_blank" rel="noopener">
          <img src="/icons/foot-icp.png" alt="ICP备案图标" />
          蜀ICP备2024102137号
        </a>
      </div>
    </footer>
  </div>

  <div id="copyright-modal" class="modal-overlay" onclick="closeCopyrightModal(event)">
    <div class="modal-content" onclick="event.stopPropagation()">
      <div class="modal-header">
        <h3>版权声明与投诉指引</h3>
        <button class="modal-close" onclick="closeCopyrightModal()">&times;</button>
      </div>
      <div class="modal-body">
        <p>本站（Doki Image API）一贯高度重视知识产权的保护，并严格遵守中华人民共和国各项知识产权法律、法规及其他具有法律约束力的规范性文件。本站认为著作权人依法享有的著作权等权利应当得到尊重和法律应有的保护，坚决反对任何违反《中华人民共和国著作权法》及其相关法律法规的行为。为尊重和保护知识产权，保护各方的权利与利益，本站特作出如下声明：</p>
        <p><strong>1、</strong>一切用户在使用本站图片时均被视为已经仔细阅读本条款并完全同意。凡以任何方式访问本站，或直接、间接使用本站图片资料者，均被视为自愿接受本站相关声明和用户服务协议的约束。</p>
        <p><strong>2、</strong>本站上的所有图片均为网络收集而来，仅供个人欣赏、学习和研究使用，请用户下载后于24小时之内删除，并不得用于任何商业用途。本站只对图片的展示提供服务，但不承担任何法律责任。</p>
        <p><strong>3、</strong>本站仅提供图片的随机展示服务，不会对上传图片内容作任何形式的编辑修改，自身不会长期存储、控制、编辑或修改被链接的第三方存储的内容或其表现形式。</p>
        <p><strong>4、</strong>访问本站的用户必须明白，本站对所提供展示的图片不拥有任何权利，其版权归该图片的合法拥有者所有，请用户在下载使用前必须详细阅读并遵守原作者的"使用许可协议"。</p>
        <p><strong>5、</strong>本站所有图片和相关资料，如果侵犯了第三方的知识产权或其他权利，责任由使用者或转载者本人承担，本站对此不承担任何责任。</p>
        <p><strong>6、</strong>本站不保证为向用户提供便利而设置的外部链接的准确性和完整性，同时，对于该外部链接指向的不由本站实际控制的任何网页上的内容，本站不承担任何责任。</p>
        <p><strong>7、</strong>除注明之服务条款外，其它因不当使用本站图片而导致的任何意外、疏忽、合约毁坏、诽谤、版权或其他知识产权侵犯及其所造成的任何损失，本站概不负责，亦不承担任何法律责任。</p>
        <p><strong>8、</strong>本站无法完全保证本站提供的图片资源的准确性、安全性和完整性，对于因第三方恶意修改或因黑客攻击等原因造成的图片侵权或其他缺陷，导致用户受到侵害或侵权，本站不承担任何责任。</p>
        <p><strong>9、</strong>本站网页内的资料提供者拥有该网页上资料的版权，未经本站的明确许可，任何人不得非法复制；不得盗链本站图片资源。本站对其自行开发的或和他人共同开发的所有内容，包括网站设计、布局结构、服务等拥有全部知识产权，未经本站的许可，任何人不得作全部或部分复制或仿造。</p>
        <p><strong>10、</strong>本站尊重著作权人的合法权益，不允许受版权保护的图片以公开形式发布，如果发现请联系我们（见下方投诉指引）提交版权证书，要求本站根据中国法律法规的有关规定采取措施移除相关内容或断开相关链接。</p>
        <p><strong>11、</strong>本声明未涉及的问题请参见国家有关法律法规，当本声明与国家有关法律法规冲突时，以国家法律法规为准。</p>
        <p><strong>12、</strong>本站相关声明版权及其修改权、更新权和最终解释权均属本站所有。</p>
        <h4>投诉指引</h4>
        <p>本站不允许受版权保护的图片以公开形式发布，如果发现请联系我们提交版权证书，我们会第一时间处理，请确保您已阅读并理解此政策。</p>
        <p>附注：根据二○○二年一月一日《计算机软件保护条例》规定：为了学习和研究软件内含的设计思想和原理，通过安装、显示、传输或者存储软件等方式使用软件的，可以不经软件著作权人许可，不向其支付报酬。</p>
        <p>关于数字千年版权法案（DMCA）：本站接受受版权保护的内容DMCA侵权通知。</p>
        <p>关于此站内其它站上的侵权内容：针对未存储在本站服务器上的图片存储的文件提出侵犯通知，请联系该存储服务商提供版权侵犯通知。本站无权删除外部服务器上的文件，因此可能不会处理与该图片相关的版权侵权通知。</p>
        <p>关于我们网站上的侵权内容：受版权证书保护的图片页面我们会删除链接，要联系本站提交版权侵权通知，您必须使用邮件联系。通过提交版权侵犯通知，如果严重侵犯了贵方版权利益，我们将承担所有包括起诉费在内的损失赔偿责任。</p>
        <p><strong>投诉邮件：x@coci.cc</strong></p>
        <p>只有发送邮件且您的侵权通知必须包含以下所有内容，我们才能被接受：</p>
        <p>您认为受版权保护的图片的详细信息，包括其在本站网站内的页面。<br>您是版权所有者或有版权代理所有者的信息或证明（我们一般会在收到投诉后48小时内处理）。<br>声明："我坚持使用上述涉嫌侵权的版权材料未经版权所有者，其代理人或法律的授权。我发誓，通知中的信息会受到法律处罚，确保无误，并且我是版权所有者或被授权代表涉嫌侵权的专有权的所有者行为。"</p>
      </div>
    </div>
  </div>

  <script>
    function showCopyrightModal() {
      const modal = document.getElementById('copyright-modal');
      if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
        document.body.style.overflow = 'hidden';
      }
    }
    function closeCopyrightModal(event) {
      if (event && event.target !== event.currentTarget) return;
      const modal = document.getElementById('copyright-modal');
      if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
          modal.style.display = 'none';
          document.body.style.overflow = '';
        }, 300);
      }
    }

    const loadStartTimes = {};
    const adaptiveDelays = {};
    document.querySelectorAll('.api-preview img').forEach(img => {
      const index = img.dataset.index;
      if (index) loadStartTimes[index] = performance.now();
    });

    function measureLatency(img) {
      img.parentElement?.classList.add('loaded');
      const index = img.dataset.index;
      const adaptiveIdx = img.dataset.adaptiveIdx;
      const adaptivePart = img.dataset.adaptivePart;
      const startTime = index ? loadStartTimes[index] : null;
      if (!startTime) return;
      const latency = Math.round(performance.now() - startTime);

      function setLatencyColor(el, ms) {
        el.classList.remove('latency-excellent', 'latency-good', 'latency-fair', 'latency-poor', 'latency-bad');
        if (ms <= 500) el.classList.add('latency-excellent');
        else if (ms <= 1500) el.classList.add('latency-good');
        else if (ms <= 2500) el.classList.add('latency-fair');
        else if (ms <= 4000) el.classList.add('latency-poor');
        else el.classList.add('latency-bad');
      }

      if (adaptiveIdx && adaptivePart) {
        if (!adaptiveDelays[adaptiveIdx]) adaptiveDelays[adaptiveIdx] = {};
        adaptiveDelays[adaptiveIdx][adaptivePart] = latency;
        const values = Object.values(adaptiveDelays[adaptiveIdx]).filter(v => typeof v === 'number');
        if (values.length > 0) {
          const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
          const el = document.getElementById('api-latency-' + adaptiveIdx);
          if (el) {
            el.textContent = avg + 'ms';
            setLatencyColor(el, avg);
          }
        }
        return;
      }

      const el = document.getElementById('api-latency-' + index);
      if (el) {
        el.textContent = latency + 'ms';
        setLatencyColor(el, latency);
      }
    }

    function refreshImage(img) {
      img.parentElement?.classList.remove('loaded');
      const index = img.dataset.index;
      const baseUrl = img.dataset.url;
      const adaptiveIdx = img.dataset.adaptiveIdx;
      if (!index) return;
      loadStartTimes[index] = performance.now();

      if (adaptiveIdx) {
        const el = document.getElementById('api-latency-' + adaptiveIdx);
        if (el) el.textContent = '...';
      } else {
        const el = document.getElementById('api-latency-' + index);
        if (el) el.textContent = '...';
      }

      img.src = baseUrl + '?t=' + Date.now();
    }

    function filterCategory(category) {
      document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
      document.querySelector('.category-tab[data-category="' + category + '"]').classList.add('active');
      document.querySelectorAll('.api-card').forEach(card => {
        const cardCategory = card.getAttribute('data-category');
        if (cardCategory === category) {
          card.style.display = '';
          card.querySelectorAll('.api-preview img').forEach(img => {
            const idx = img.dataset.index;
            const baseUrl = img.dataset.url;
            if (idx && baseUrl) {
              loadStartTimes[idx] = performance.now();
              img.src = baseUrl + '?t=' + Date.now();
            }
          });
        } else {
          card.style.display = 'none';
        }
      });
    }
    filterCategory('adaptive');

    function copyToClipboard(text, btn) {
      const targetBtn = btn || (typeof event !== 'undefined' ? event.currentTarget : null);
      const showCopied = () => {
        if (!targetBtn) return;
        targetBtn.classList.add('copied');
        const originalHTML = targetBtn.innerHTML;
        targetBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        setTimeout(() => {
          targetBtn.classList.remove('copied');
          targetBtn.innerHTML = originalHTML;
        }, 1400);
      };
      navigator.clipboard.writeText(text).then(showCopied).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showCopied();
      });
    }

    // Umami 统计
    (function() {
      const UMAMI_BASE_URL = 'https://umami.2o.nz';
      const SHARE_ID = 'BnLmejxCHVWiAkh2';
      let shareDataCache = null;
      const SHARE_CACHE_TTL = 3600000;

      function formatNumber(num) {
        if (num >= 10000) { const w = num / 10000; return (w % 1 === 0 ? w : w.toFixed(2)) + 'w'; }
        else if (num >= 1000) { const k = num / 1000; return (k % 1 === 0 ? k : k.toFixed(2)) + 'k'; }
        return num.toString();
      }

      function animateNumber(element, targetValue, duration = 1500) {
        if (!element) return;
        const startValue = 0;
        const startTime = performance.now();
        function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
        function update(currentTime) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const currentValue = Math.floor(startValue + (targetValue - startValue) * easeOutCubic(progress));
          element.textContent = formatNumber(currentValue);
          element.title = targetValue.toLocaleString();
          if (progress < 1) requestAnimationFrame(update);
          else { element.textContent = formatNumber(targetValue); element.title = targetValue.toLocaleString(); }
        }
        requestAnimationFrame(update);
      }

      async function getUmamiShareData() {
        if (!SHARE_ID) return null;
        const now = Date.now();
        if (shareDataCache && (now - shareDataCache.timestamp) < SHARE_CACHE_TTL) return shareDataCache.data;
        try {
          const response = await fetch(UMAMI_BASE_URL + '/api/share/' + SHARE_ID);
          if (!response.ok) throw new Error('status: ' + response.status);
          const data = await response.json();
          shareDataCache = { data, timestamp: now };
          return data;
        } catch (error) { return null; }
      }

      async function getWebsiteStatsWithShare(startAt = 0, endAt = Date.now()) {
        try {
          const shareData = await getUmamiShareData();
          if (!shareData) return null;
          const { websiteId, token } = shareData;
          const params = new URLSearchParams({ startAt: startAt.toString(), endAt: endAt.toString() });
          const response = await fetch(UMAMI_BASE_URL + '/api/websites/' + websiteId + '/stats?' + params.toString(), { headers: { 'x-umami-share-token': token, 'x-umami-share-context': '1' } });
          if (!response.ok) return null;
          const data = await response.json();
          const pageviewsValue = typeof data.pageviews === 'object' && data.pageviews !== null ? data.pageviews.value : (data.pageviews || 0);
          const visitorsValue = typeof data.visitors === 'object' && data.visitors !== null ? data.visitors.value : (data.visitors || 0);
          return { pageviews: { value: pageviewsValue }, uniques: { value: visitorsValue } };
        } catch (error) { return null; }
      }

      async function getPageStatsWithShare(pagePath, startAt = 0, endAt = Date.now(), retryCount = 0) {
        try {
          const shareData = await getUmamiShareData();
          if (!shareData) return null;

          const { websiteId, token } = shareData;

          const params = new URLSearchParams({
            startAt: startAt.toString(),
            endAt: endAt.toString(),
            unit: 'hour',
            timezone: 'Asia/Shanghai',
            path: 'eq.' + pagePath,
          });

          const statsUrl = UMAMI_BASE_URL + '/api/websites/' + websiteId + '/stats?' + params.toString();
          const response = await fetch(statsUrl, {
            headers: {
              'x-umami-share-token': token,
              'x-umami-share-context': '1',
            },
          });

          if (!response.ok) {
            if (response.status === 401 && retryCount < 1) {
              shareDataCache = null;
              return await getPageStatsWithShare(pagePath, startAt, endAt, retryCount + 1);
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

      async function initVisitorStats() {
        try {
          const totalCallsEl = document.getElementById('visitor-stats-total-calls');
          const usersEl = document.getElementById('visitor-stats-users');
          const hourCallsEl = document.getElementById('visitor-stats-hour-calls');
          if (!totalCallsEl || !usersEl || !hourCallsEl) return;
          totalCallsEl.textContent = '0'; usersEl.textContent = '0'; hourCallsEl.textContent = '0';
          let stats = null, lastHourStats = null;
          if (SHARE_ID) {
            const now = Date.now();
            stats = await getWebsiteStatsWithShare(0, now);
            lastHourStats = await getWebsiteStatsWithShare(now - 3600000, now);
          }
          if (stats) {
            animateNumber(totalCallsEl, stats.pageviews.value || 0);
            animateNumber(usersEl, stats.uniques.value || 0);
            animateNumber(hourCallsEl, lastHourStats?.pageviews?.value || 0);
          } else {
            totalCallsEl.textContent = '-'; usersEl.textContent = '-'; hourCallsEl.textContent = '-';
          }
        } catch (error) {
          ['visitor-stats-total-calls','visitor-stats-users','visitor-stats-hour-calls'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '-';
          });
        }
      }

      async function initApiStats() {
        try {
          const cards = document.querySelectorAll('.api-card');
          if (!cards.length || !SHARE_ID) return;
          const now = Date.now();
          await Promise.all(Array.from(cards).map(async (card, index) => {
            const path = card.getAttribute('data-api-path');
            if (!path) return;
            const stats = await getPageStatsWithShare(path, 0, now);
            const usersEl = document.getElementById('api-users-' + index);
            const callsEl = document.getElementById('api-calls-' + index);
            if (usersEl && callsEl) {
              if (stats) { animateNumber(usersEl, stats.visitors || 0); animateNumber(callsEl, stats.pageviews || 0); }
              else { usersEl.textContent = '-'; callsEl.textContent = '-'; }
            }
          }));
        } catch (error) {}
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { initVisitorStats(); initApiStats(); });
      } else { initVisitorStats(); initApiStats(); }
    })();
  </script>
  <script defer src="https://umami.2o.nz/script.js" data-website-id="42dd4d2a-b57c-4021-8fb0-ad9373348ca7"></script>
</body>
</html>`;
}
