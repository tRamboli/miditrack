// Crops the source icon to its rounded-square body and applies a rounded-rect
// alpha mask so the surrounding purple background becomes transparent.
// Outputs build/icon.png (1024x1024) for electron-builder + the renderer.

import sharp from 'sharp';
import { mkdir, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const SRC = process.env.ICON_SRC ??
  '/Users/ronentahor/.claude/image-cache/685f90fc-708e-4a96-a84c-da4e90bc15f6/1.png';
const DST = resolve(projectRoot, 'build/icon.png');
const RENDERER_DST = resolve(projectRoot, 'src/renderer/public/icon.png');

// Source rounded-square content bounds (1024x1024 source). The purple
// background is everything outside this region.
const CROP_LEFT = 88;
const CROP_TOP = 88;
const CROP_SIZE = 850;
const CORNER_RADIUS_RATIO = 0.18; // approx the icon's own corner radius

const OUTPUT_SIZE = 1024;
const cornerRadius = Math.round(OUTPUT_SIZE * CORNER_RADIUS_RATIO);

const maskSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${OUTPUT_SIZE}" height="${OUTPUT_SIZE}">
     <rect x="0" y="0" width="${OUTPUT_SIZE}" height="${OUTPUT_SIZE}"
           rx="${cornerRadius}" ry="${cornerRadius}" fill="white"/>
   </svg>`
);

await mkdir(dirname(DST), { recursive: true });
await mkdir(dirname(RENDERER_DST), { recursive: true });

await sharp(SRC)
  .extract({ left: CROP_LEFT, top: CROP_TOP, width: CROP_SIZE, height: CROP_SIZE })
  .resize(OUTPUT_SIZE, OUTPUT_SIZE)
  .composite([{ input: maskSvg, blend: 'dest-in' }])
  .png({ compressionLevel: 9 })
  .toFile(DST);

await copyFile(DST, RENDERER_DST);

console.log(`Wrote ${DST}`);
console.log(`Wrote ${RENDERER_DST}`);
