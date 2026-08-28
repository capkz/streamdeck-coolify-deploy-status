// Rasterize assets/*.svg -> dev.chaul.coolifydeploy.sdPlugin/imgs/*.png at every size
// Stream Deck needs. Run: npm run icons
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = resolve(root, 'assets');
const out = resolve(root, 'dev.chaul.coolifydeploy.sdPlugin', 'imgs');
mkdirSync(out, { recursive: true });

// target file name -> [source svg, base size in px]  (@2x is generated automatically)
const targets = {
  pluginIcon: ['icon.svg', 28],
  categoryIcon: ['icon.svg', 28],
  actionIcon: ['action.svg', 20],
  actionKey: ['key.svg', 72],
};

function png(svg, size) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: 'rgba(0,0,0,0)' })
    .render()
    .asPng();
}

for (const [name, [file, base]] of Object.entries(targets)) {
  const svg = readFileSync(resolve(assets, file), 'utf8');
  writeFileSync(resolve(out, `${name}.png`), png(svg, base));
  writeFileSync(resolve(out, `${name}@2x.png`), png(svg, base * 2));
  console.log(`${name}: ${base}px + ${base * 2}px`);
}

// High-res icons for the Marketplace listing (uploaded in the portal, not packaged)
const marketing = resolve(assets, 'marketing');
mkdirSync(marketing, { recursive: true });
const iconSvg = readFileSync(resolve(assets, 'icon.svg'), 'utf8');
for (const s of [256, 512]) {
  writeFileSync(resolve(marketing, `icon-${s}.png`), png(iconSvg, s));
  console.log(`marketing/icon-${s}.png`);
}
console.log('done ->', out);
