// Shared icon helpers for the build scripts.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const assets = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const read = (f) => readFileSync(resolve(assets, f), 'utf8');
const strip = (svg) => svg.replace(/<\?xml[^>]*\?>/g, '').replace(/<\/?svg[^>]*>/g, '');

export const badgeSvg = read('badge.svg');
export const badgeInner = strip(badgeSvg);

const coolifyDataUri =
  'data:image/png;base64,' + readFileSync(resolve(assets, 'coolify-mark.png')).toString('base64');

/** App icon: the Coolify mark, unmodified. viewBox 256x256 to match the source. */
export function appIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <image href="${coolifyDataUri}" x="0" y="0" width="256" height="256"/>
</svg>`;
}

/**
 * Alternative app icon: Coolify mark with the deploy-status badge in the
 * lower-right, separated by a dark moat so it reads as a companion plugin.
 * Kept in case Marketplace review wants the mark differentiated.
 */
export function appIconWithBadgeSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <clipPath id="frame"><rect x="0" y="0" width="256" height="256"/></clipPath>
  <g clip-path="url(#frame)">
    <image href="${coolifyDataUri}" x="-38" y="-38" width="332" height="332"/>
  </g>
  <circle cx="214" cy="214" r="33" fill="#0C0C0D" stroke="#3A3A3E" stroke-width="2"/>
  <g transform="translate(182.5 182.5) scale(0.437)">${badgeInner}</g>
</svg>`;
}
