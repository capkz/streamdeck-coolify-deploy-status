// Generates Marketplace listing images (icon, thumbnail, gallery) into assets/marketing/.
// Reuses the plugin's real key rendering. Run: npm run listing-assets
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { appIconWithBadgeSvg } from './lib-icons.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'assets', 'marketing');
mkdirSync(out, { recursive: true });

const png = (svg, w) => new Resvg(svg, { fitTo: { mode: 'width', value: w }, background: 'rgba(0,0,0,0)' }).render().asPng();

// pre-rendered composite app icon, embedded as a data URI so it composites cleanly
const appIconUri = 'data:image/png;base64,' + png(appIconWithBadgeSvg(), 512).toString('base64');
const appIcon = (x, y, size) =>
  `<clipPath id="appIconClip"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${Math.round(size * 0.16)}"/></clipPath>` +
  `<image href="${appIconUri}" x="${x}" y="${y}" width="${size}" height="${size}" clip-path="url(#appIconClip)"/>`;

// ---- the plugin's key renderer (mirrors plugin.js) --------------------------
const THEME = {
  building: { bg: '#B26B00', word: 'BUILD' },
  queued: { bg: '#6B5F00', word: 'QUEUE' },
  ok: { bg: '#1A7F37', word: 'OK' },
  failed: { bg: '#B42318', word: 'FAIL' },
  cancelled: { bg: '#57534E', word: 'CXL' },
  setup: { bg: '#1E3A5F', word: 'SETUP' },
};
const xml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

function key({ state, label, sub, foot }, x = 0, y = 0, scale = 1) {
  const t = THEME[state];
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <rect width="144" height="144" rx="20" fill="${t.bg}"/>
    <rect width="144" height="52" rx="20" fill="#000000" opacity="0.16"/>
    <text x="72" y="34" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#fff" text-anchor="middle">${xml(label)}</text>
    <text x="72" y="86" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="800" fill="#fff" text-anchor="middle">${xml(t.word)}</text>
    <text x="72" y="114" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="700" fill="#fff" text-anchor="middle">${xml(sub || '')}</text>
    <text x="72" y="135" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="500" fill="#fff" opacity="0.8" text-anchor="middle">${xml(foot || '')}</text>
  </g>`;
}

const page = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="960" viewBox="0 0 1920 960">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#212228"/><stop offset="1" stop-color="#141519"/></linearGradient></defs>
<rect width="1920" height="960" fill="url(#g)"/>${inner}</svg>`;
const text = (x, y, s, str, opts = {}) =>
  `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${s}" font-weight="${opts.w || 700}" fill="${opts.fill || '#f4f4f5'}" text-anchor="${opts.anchor || 'start'}">${xml(str)}</text>`;

// ---- thumbnail 1920x960 (icon sizes are built by build-icons.mjs) ----------
writeFileSync(resolve(out, 'thumbnail.png'), png(page(`
  ${appIcon(150, 300, 360)}
  ${text(150, 760, 92, 'Coolify Deploy Status', { w: 800 })}
  ${text(154, 828, 40, 'Your latest deploy — building, failed, or done — on a key.', { fill: '#a1a1aa', w: 600 })}
  ${key({ state: 'building', label: 'API', sub: '2:14', foot: '' }, 1180, 200, 1.7)}
  ${key({ state: 'ok', label: 'FE', sub: '3m52s', foot: '4m ago' }, 1470, 200, 1.7)}
  ${key({ state: 'failed', label: 'WEB', sub: '41s', foot: '1h ago' }, 1325, 470, 1.7)}
`), 1920));

// ---- 3. gallery: all states ----------------------------------------------
const states = [
  { state: 'building', label: 'API', sub: '2:14', foot: 'Merge PR #128' },
  { state: 'queued', label: 'API', sub: '0:03', foot: '' },
  { state: 'ok', label: 'FE', sub: '3m52s', foot: '4m ago' },
  { state: 'failed', label: 'WEB', sub: '41s', foot: '1h ago' },
  { state: 'cancelled', label: 'API', sub: '18s', foot: '2h ago' },
  { state: 'setup', label: 'APP', sub: 'pick app', foot: '' },
];
writeFileSync(resolve(out, 'gallery-1-states.png'), png(page(`
  ${text(150, 150, 66, 'Every deployment state, at a glance', { w: 800 })}
  ${states.map((s, i) => key(s, 170 + (i % 3) * 560, 260 + Math.floor(i / 3) * 340, 2.1)).join('')}
`), 1920));

// ---- 4. gallery: timing detail -----------------------------------------
writeFileSync(resolve(out, 'gallery-2-timing.png'), png(page(`
  ${text(150, 150, 66, 'Live build timer + commit, then duration + age', { w: 800 })}
  ${key({ state: 'building', label: 'API', sub: '2:14', foot: 'Merge PR #128' }, 260, 300, 3.0)}
  ${text(300, 300, 30, 'while building', { fill: '#d4a24a', w: 700 })}
  ${key({ state: 'ok', label: 'FE', sub: '3m52s', foot: '4m ago' }, 1160, 300, 3.0)}
  ${text(1200, 300, 30, 'after it finishes', { fill: '#4ca35a', w: 700 })}
  ${text(150, 830, 34, 'Press a key to open that deployment’s log page in your browser.', { fill: '#a1a1aa', w: 600 })}
`), 1920));

// ---- 5. gallery: property inspector mock -------------------------------
const field = (y, labelStr, valueStr, ph = false) => `
  <text x="360" y="${y}" font-family="Arial" font-size="24" fill="#9a9a9a" text-anchor="end">${xml(labelStr)}</text>
  <rect x="380" y="${y - 26}" width="1050" height="42" rx="6" fill="#3d3d3d" stroke="#4d4d4d"/>
  <text x="398" y="${y}" font-family="Arial" font-size="24" fill="${ph ? '#7d7d7d' : '#ffffff'}">${xml(valueStr)}</text>`;
writeFileSync(resolve(out, 'gallery-3-setup.png'), png(page(`
  ${text(150, 150, 66, 'Pick an app — loaded live from the Coolify API', { w: 800 })}
  <rect x="230" y="240" width="1460" height="470" rx="16" fill="#2d2d2d" stroke="#3f3f3f"/>
  ${field(330, 'Base URL', 'https://coolify.example.com')}
  ${field(410, 'API token', '••••••••••••••••••')}
  ${field(510, 'Application', 'API  (api.example.com)')}
  ${field(590, 'Key label', 'API')}
  <text x="398" y="660" font-family="Arial" font-size="22" fill="#5bbd6b">3 applications loaded.</text>
`), 1920));

console.log('listing assets ->', out);
