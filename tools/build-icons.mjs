// Build Stream Deck icons from assets/*.svg.  Run: npm run icons
//
//   pluginIcon   -> PNG 28 + 56   (plugin list / Marketplace; colour is fine here)
//   actionKey    -> PNG 72 + 144  (default key image; repainted at runtime)
//   actionIcon   -> SVG           (actions list; white strokes, Stream Deck theme-adapts)
//   categoryIcon -> SVG           (actions-list group header; same)
import { readFileSync, writeFileSync, copyFileSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = resolve(root, 'assets');
const out = resolve(root, 'dev.chaul.coolifydeploy.sdPlugin', 'imgs');
mkdirSync(out, { recursive: true });

const rasterTargets = {
  pluginIcon: ['icon.svg', 28],
  actionKey: ['key.svg', 72],
};
const svgTargets = {
  actionIcon: 'action.svg',
  categoryIcon: 'category.svg',
};

const png = (svg, size) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: 'rgba(0,0,0,0)' }).render().asPng();

for (const [name, [file, base]] of Object.entries(rasterTargets)) {
  const svg = readFileSync(resolve(assets, file), 'utf8');
  writeFileSync(resolve(out, `${name}.png`), png(svg, base));
  writeFileSync(resolve(out, `${name}@2x.png`), png(svg, base * 2));
  console.log(`${name}: ${base}px + ${base * 2}px`);
}

for (const [name, file] of Object.entries(svgTargets)) {
  // single SVG only - no PNG sibling, so Stream Deck never has to disambiguate
  for (const ext of ['png', '@2x.png']) { try { rmSync(resolve(out, `${name}.${ext}`)); } catch {} }
  copyFileSync(resolve(assets, file), resolve(out, `${name}.svg`));
  console.log(`${name}.svg (theme-adaptive)`);
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
