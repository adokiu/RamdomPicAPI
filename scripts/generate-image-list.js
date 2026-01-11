/**
 * 生成图片列表脚本
 * 从 config.ts 读取配置并生成图片列表
 */
const fs = require('fs');
const path = require('path');

// 从 config.ts 读取配置
function readConfigFromTS() {
  const configPath = path.join(__dirname, '..', 'config.ts');
  const configContent = fs.readFileSync(configPath, 'utf-8');
  
  // 使用正则表达式提取 imageConfig 对象
  // 匹配 export const imageConfig = { ... } 的内容
  const configMatch = configContent.match(/export\s+const\s+imageConfig\s*=\s*\{([^}]+)\}/s);
  
  if (!configMatch) {
    throw new Error('无法从 config.ts 中读取 imageConfig 配置');
  }
  
  const configBody = configMatch[1];
  const imageConfig = {};
  
  // 解析配置项：匹配 'key': 'value' 或 'key': 'value', // comment
  const entryRegex = /['"`]([^'"`]+)['"`]\s*:\s*['"`]([^'"`]+)['"`]/g;
  let match;
  
  while ((match = entryRegex.exec(configBody)) !== null) {
    const key = match[1];
    const value = match[2];
    // 确保 key 以 / 开头
    imageConfig[key.startsWith('/') ? key : `/${key}`] = value;
  }
  
  return imageConfig;
}

const imageConfig = readConfigFromTS();

function getImageList(imageDir) {
  // 如果 imageDir 已经包含 /public，则直接使用；否则加上 public 前缀
  let publicPath;
  if (imageDir.startsWith('/public')) {
    publicPath = path.join(__dirname, '..', imageDir);
  } else {
    publicPath = path.join(__dirname, '..', 'public', imageDir);
  }
  
  if (!fs.existsSync(publicPath)) {
    console.warn(`Directory not found: ${publicPath}`);
    return [];
  }
  
  const files = fs.readdirSync(publicPath);
  return files.filter(file => 
    /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(file)
  );
}

function generateImageLists() {
  const lists = {};
  
  console.log('从 config.ts 读取配置...');
  console.log('配置项:', Object.keys(imageConfig).join(', '));
  console.log('\n扫描图片文件...\n');
  
  for (const [pathKey, dir] of Object.entries(imageConfig)) {
    const images = getImageList(dir);
    lists[pathKey] = images;
    console.log(`${pathKey} -> ${dir}: 找到 ${images.length} 张图片`);
    if (images.length > 0) {
      console.log(`  示例: ${images.slice(0, 3).join(', ')}${images.length > 3 ? '...' : ''}`);
    }
  }
  
  // 生成 image-list.ts 文件，供运行时使用
  const outputPath = path.join(__dirname, '..', 'image-list.ts');
  const tsContent = `/**
 * 图片列表配置
 * 此文件由 scripts/generate-image-list.js 自动生成
 * 请勿手动编辑，修改 config.ts 后重新运行生成脚本
 */

export const imageList: Record<string, string[]> = ${JSON.stringify(lists, null, 2)};

`;
  
  fs.writeFileSync(outputPath, tsContent);
  
  console.log(`\n✅ 已生成: image-list.ts`);
  console.log(`   包含 ${Object.keys(lists).length} 个路径的图片列表`);
  
  return lists;
}

if (require.main === module) {
  generateImageLists();
}

module.exports = { generateImageLists };

