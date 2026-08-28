// Build Stream Deck icons from assets/.  Run: npm run icons
//
//   pluginIcon   -> PNG 28 + 56   Coolify mark + deploy-status badge (plugin list / Marketplace)
//   actionKey    -> PNG 72 + 144  default key image (repainted at runtime)
//   actionIcon   -> SVG           actions list; white strokes, Stream Deck theme-adapts
//   categoryIcon -> SVG           actions-list group header; same
//   marketing/   -> PNG 256/288/512  hi-res app icon for the Marketplace listing
import { readFileSync, writeFileSync, copyFileSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { appIconWithBadgeSvg } from './lib-icons.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = resolve(root, 'assets');
const out = resolve(root, 'dev.chaul.coolifydeploy.sdPlugin', 'imgs');
mkdirSync(out, { recursive: true });

const png = (svg, w) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: w }, background: 'rgba(0,0,0,0)' }).render().asPng();

const APP_ICON = appIconWithBadgeSvg();

// raster targets: name -> [svg string, base px]
const rasterTargets = {
  pluginIcon: [APP_ICON, 28],
  actionKey: [readFileSync(resolve(assets, 'key.svg'), 'utf8'), 72],
};
const svgTargets = { actionIcon: 'action.svg', categoryIcon: 'category.svg' };

for (const [name, [svg, base]] of Object.entries(rasterTargets)) {
  writeFileSync(resolve(out, `${name}.png`), png(svg, base));
  writeFileSync(resolve(out, `${name}@2x.png`), png(svg, base * 2));
  console.log(`${name}: ${base}px + ${base * 2}px`);
}

for (const [name, file] of Object.entries(svgTargets)) {
  for (const ext of ['png', '@2x.png']) { try { rmSync(resolve(out, `${name}.${ext}`)); } catch {} }
  copyFileSync(resolve(assets, file), resolve(out, `${name}.svg`));
  console.log(`${name}.svg (theme-adaptive)`);
}

// hi-res app icon for the Marketplace listing (uploaded in the portal, not packaged)
const marketing = resolve(assets, 'marketing');
mkdirSync(marketing, { recursive: true });
for (const s of [256, 288, 512]) {
  writeFileSync(resolve(marketing, `icon-${s}.png`), png(APP_ICON, s));
  console.log(`marketing/icon-${s}.png`);
}
console.log('done ->', out);
