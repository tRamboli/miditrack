// Crops the source icon to its rounded-square body and applies a rounded-rect
// alpha mask so the surrounding purple background becomes transparent.
// The packaged app icon (build/icon.png) gets transparent padding so Windows /
// macOS don't clip the content at the edges; the renderer logo stays full-bleed.

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
// Fraction of each edge left transparent on the packaged icon so the artwork
// isn't clipped by OS icon masks / corner rounding. 0 = full-bleed.
const PADDING_RATIO = 0.09;

const bodySize = Math.round(OUTPUT_SIZE * (1 - 2 * PADDING_RATIO));
const cornerRadius = Math.round(bodySize * CORNER_RADIUS_RATIO);

const maskSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${bodySize}" height="${bodySize}">
     <rect x="0" y="0" width="${bodySize}" height="${bodySize}"
           rx="${cornerRadius}" ry="${cornerRadius}" fill="white"/>
   </svg>`
);

await mkdir(dirname(DST), { recursive: true });
await mkdir(dirname(RENDERER_DST), { recursive: true });

// Cropped, rounded artwork at full bleed — used as-is for the in-app logo.
const body = await sharp(SRC)
  .extract({ left: CROP_LEFT, top: CROP_TOP, width: CROP_SIZE, height: CROP_SIZE })
  .resize(bodySize, bodySize)
  .composite([{ input: maskSvg, blend: 'dest-in' }])
  .png({ compressionLevel: 9 })
  .toBuffer();

// Packaged icon: center the artwork on a transparent canvas with safe padding.
const pad = Math.round((OUTPUT_SIZE - bodySize) / 2);
await sharp(body)
  .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(DST);

// In-app title logo stays full-bleed (no surrounding chrome to clip it).
await sharp(body).resize(OUTPUT_SIZE, OUTPUT_SIZE).toFile(RENDERER_DST);

console.log(`Wrote ${DST}`);
console.log(`Wrote ${RENDERER_DST}`);
