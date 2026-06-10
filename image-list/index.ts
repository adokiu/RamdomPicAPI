/**
 * 图片列表索引
 * 由 scripts/convert_images_inplace.py 自动生成
 */
import acgFj from './acg-fj.js';
import fj from './fj.js';
import mbAcgFj from './mb-acg-fj.js';
import mbDfproject from './mb-dfproject.js';
import mbLty from './mb-lty.js';
import mbMiku from './mb-miku.js';
import mbMoe from './mb-moe.js';
import mbSr from './mb-sr.js';
import mbYs from './mb-ys.js';
import pcDfproject from './pc-dfproject.js';
import pcLty from './pc-lty.js';
import pcMiku from './pc-miku.js';
import pcMoe from './pc-moe.js';
import pcSr from './pc-sr.js';
import pcYs from './pc-ys.js';

export const imageList: Record<string, string[]> = {
  '/acg-fj': acgFj,
  '/fj': fj,
  '/mb-acg-fj': mbAcgFj,
  '/mb-dfproject': mbDfproject,
  '/mb-lty': mbLty,
  '/mb-miku': mbMiku,
  '/mb-moe': mbMoe,
  '/mb-sr': mbSr,
  '/mb-ys': mbYs,
  '/pc-dfproject': pcDfproject,
  '/pc-lty': pcLty,
  '/pc-miku': pcMiku,
  '/pc-moe': pcMoe,
  '/pc-sr': pcSr,
  '/pc-ys': pcYs,
};

export default imageList;
