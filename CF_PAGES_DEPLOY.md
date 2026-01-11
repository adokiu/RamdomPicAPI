# Cloudflare Pages 部署指南

## 问题说明

Cloudflare Pages 在构建后是静态环境，**不提供文件系统 API**，无法在运行时读取目录列表。因此需要使用**预生成的图片列表**。

## 解决方案

项目使用 `image-list.ts` 文件存储预生成的图片列表，该文件在构建时由 `scripts/generate-image-list.js` 自动生成。

## 部署步骤

### 1. 构建前生成图片列表

在构建前，确保运行生成脚本：

```bash
npm run generate
```

或者使用自动构建脚本（推荐）：

```bash
npm run build:pages
```

### 2. Cloudflare Pages 配置

#### 方式一：使用 GitHub Actions 自动部署

在 `.github/workflows/deploy.yml` 中添加构建命令：

```yaml
- name: Build
  run: |
    npm install
    npm run generate
    # 其他构建步骤...
```

#### 方式二：在 Cloudflare Pages 构建设置中配置

在 Cloudflare Pages 的构建设置中：

- **构建命令**: `npm run build:pages` 或 `npm run generate && npm run type-check`
- **输出目录**: `public`（或根据你的配置）
- **根目录**: `/`（项目根目录）

### 3. 函数路由

项目使用 `functions/[path].ts` 作为 Cloudflare Pages Functions，支持通配符路径：

- 访问 `/pc-miku` → 由 `functions/[path].ts` 处理
- 函数从 `image-list.ts` 读取图片列表
- 随机选择并重定向到图片

### 4. 重要提示

⚠️ **每次添加或删除图片后，必须重新运行 `npm run generate` 并重新部署！**

因为图片列表是在构建时生成的，运行时无法动态读取文件系统。

## 验证部署

部署后，访问你的 API 路径，例如：
- `https://your-domain.pages.dev/pc-miku`

应该能够随机返回图片。如果返回 "No images found"，说明 `image-list.ts` 未正确生成或未包含在构建中。

## 故障排查

1. **错误: "No images found"**
   - 检查构建日志，确认 `npm run generate` 已执行
   - 检查 `image-list.ts` 是否存在于构建输出中
   - 确认 `image-list.ts` 包含正确的路径和图片列表

2. **错误: "Path not found"**
   - 检查 `config.ts` 中的路径配置
   - 确认访问的路径与配置中的路径匹配

3. **函数不工作**
   - 检查 `functions/[path].ts` 是否存在
   - 确认 TypeScript 编译通过
   - 检查 Cloudflare Pages 函数日志

