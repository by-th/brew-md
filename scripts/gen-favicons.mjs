// Rasterize public/favicon.svg into the PNG sizes browsers / iOS / PWA want.
// Run: node scripts/gen-favicons.mjs   (sharp is a devDependency)
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const svgPath = fileURLToPath(new URL('../public/favicon.svg', import.meta.url));
const svg = readFileSync(svgPath);
const out = (name) => fileURLToPath(new URL('../public/' + name, import.meta.url));

const targets = [
  [16, 'favicon-16.png'],
  [32, 'favicon-32.png'],
  [180, 'apple-touch-icon.png'],
  [192, 'icon-192.png'],
  [512, 'icon-512.png'],
];

for (const [size, name] of targets) {
  await sharp(svg, { density: 512 }).resize(size, size).png().toFile(out(name));
  console.log('wrote', name, size + 'x' + size);
}
