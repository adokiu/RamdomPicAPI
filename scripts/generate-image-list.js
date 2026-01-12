const fs = require('fs');
const path = require('path');

function readConfigFromTS() {
  const configPath = path.join(__dirname, '..', 'config.ts');
  const configContent = fs.readFileSync(configPath, 'utf-8');
  
  // 匹配新格式: '/path': { dir: '/images/xxx', name: 'xxx' }
  const configMatch = configContent.match(/export\s+const\s+imageConfig\s*=\s*\{([\s\S]*?)\}\s*as\s+const/);
  
  if (!configMatch) {
    throw new Error('无法从 config.ts 中读取 imageConfig 配置');
  }
  
  const configBody = configMatch[1];
  const imageConfig = {};
  
  // 解析新格式配置项
  const entryRegex = /['"]([^'"]+)['"]\s*:\s*\{\s*dir\s*:\s*['"]([^'"]+)['"]/g;
  let match;
  
  while ((match = entryRegex.exec(configBody)) !== null) {
    const key = match[1];
    const dir = match[2];
    const normalizedKey = key.startsWith('/') ? key : '/' + key;
    imageConfig[normalizedKey] = dir;
  }

  return imageConfig;
}

function getImageList(imageDir) {
  let publicPath;
  if (imageDir.startsWith('/public')) {
    publicPath = path.join(__dirname, '..', imageDir);
  } else {
    publicPath = path.join(__dirname, '..', 'public', imageDir);
  }

  if (!fs.existsSync(publicPath)) {
    console.warn('Directory not found: ' + publicPath);
    return [];
  }

  const files = fs.readdirSync(publicPath);
  return files.filter(file =>
    /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(file)
  );
}

function generateImageLists() {
  const imageConfig = readConfigFromTS();
  const lists = {};

  console.log('从 config.ts 读取配置...');
  console.log('配置项:', Object.keys(imageConfig).join(', '));
  console.log('\n扫描图片文件...\n');
  
  for (const [pathKey, dir] of Object.entries(imageConfig)) {
    const images = getImageList(dir);
    lists[pathKey] = images;
    console.log(pathKey + ' -> ' + dir + ': 找到 ' + images.length + ' 张图片');
    if (images.length > 0) {
      const examples = images.slice(0, 3).join(', ');
      console.log('  示例: ' + examples + (images.length > 3 ? '...' : ''));
    }
  }

  const outputPath = path.join(__dirname, '..', 'image-list.ts');
  const header = '/**\n * 图片列表配置\n * 此文件由 scripts/generate-image-list.js 自动生成\n * 请勿手动编辑，修改 config.ts 后重新运行生成脚本\n */\n\n';
  const tsContent = header + 'export const imageList: Record<string, string[]> = ' + JSON.stringify(lists, null, 2) + ';\n';

  fs.writeFileSync(outputPath, tsContent);
  
  console.log('\n✅ 已生成: image-list.ts');
  console.log('   包含 ' + Object.keys(lists).length + ' 个路径的图片列表');
  return lists;
}

if (require.main === module) {
  generateImageLists();
}

module.exports = { generateImageLists };
