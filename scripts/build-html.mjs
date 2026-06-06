import { generateApiDocPage, generateGalleryPage } from '../dist/src/utils.js';
import fs from 'fs';

async function build() {
  fs.mkdirSync('public', { recursive: true });
  const indexRes = generateApiDocPage('');
  const indexHtml = await indexRes.text();
  fs.writeFileSync('public/index.html', indexHtml);

  fs.mkdirSync('public/gallery', { recursive: true });
  const galleryRes = generateGalleryPage('');
  const galleryHtml = await galleryRes.text();
  fs.writeFileSync('public/gallery/index.html', galleryHtml);
}

build().catch(err => { console.error(err); process.exit(1); });
