'use strict';
/*
 * Coolify Deploy Status - Stream Deck plugin (view-only).
 *
 * Shows the latest Coolify deployment status + elapsed time of one application
 * on a key, rendered as an SVG image. Pressing the key opens the deployment log.
 *
 * Runs on the Stream Deck bundled Node.js 24 runtime - uses the global
 * WebSocket / fetch, so the plugin has zero npm dependencies.
 *
 * Settings
 *   global (shared by every key): { baseUrl, token }
 *   per action:                   { appUuid, appName, label, pollSeconds }
 */
const fs = require('fs');
const path = require('path');

// ---- CLI args from Stream Deck ---------------------------------------------
const args = {};
for (let i = 0; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a && a.startsWith('-')) args[a.slice(1)] = process.argv[i + 1];
}
const PORT = args.port;
const PLUGIN_UUID = args.pluginUUID;
const REGISTER_EVENT = args.registerEvent;
const ACTION_UUID = 'dev.chaul.coolifydeploy.status';

// ---- optional config.json (self-host convenience; never shipped/committed) --
let CONFIG = { baseUrl: '', token: '' };
try {
  const c = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  CONFIG.baseUrl = c.baseUrl || '';
  CONFIG.token = c.token || '';
} catch (_) {}

const LOG_FILE = path.join(__dirname, 'plugin.log');
function log(msg) {
  try { fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`); } catch (_) {}
}

let ws;
let globalSettings = {};
let migrated = false;
const contexts = new Map(); // context -> { settings, timer, lastUrl }

// ---- websocket ------------------------------------------------------------
function connect() {
  ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
  ws.addEventListener('open', () => {
    send({ event: REGISTER_EVENT, uuid: PLUGIN_UUID });
    send({ event: 'getGlobalSettings', context: PLUGIN_UUID });
    log('registered');
  });
  ws.addEventListener('message', (ev) => {
    let msg; try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString()); } catch (_) { return; }
    handle(msg);
  });
  ws.addEventListener('close', () => process.exit(0));
  ws.addEventListener('error', (e) => log('ws error: ' + (e && e.message)));
}
function send(obj) {
  try { ws.send(JSON.stringify(obj)); } catch (e) { log('send failed: ' + e.message); }
}

function handle(msg) {
  const { event, context, payload } = msg;
  switch (event) {
    case 'didReceiveGlobalSettings': {
      globalSettings = (payload && payload.settings) || {};
      // one-time migration: adopt config.json values if no global settings yet
      if (!migrated && !globalSettings.baseUrl && CONFIG.baseUrl) {
        migrated = true;
        globalSettings = { baseUrl: CONFIG.baseUrl, token: CONFIG.token };
        send({ event: 'setGlobalSettings', context: PLUGIN_UUID, payload: globalSettings });
        log('migrated config.json -> global settings');
      }
      for (const ctx of contexts.keys()) poll(ctx);
      break;
    }
    case 'willAppear':
      contexts.set(context, { settings: (payload && payload.settings) || {}, timer: null, lastUrl: null });
      poll(context);
      break;
    case 'willDisappear': {
      const c = contexts.get(context);
      if (c && c.timer) clearTimeout(c.timer);
      contexts.delete(context);
      break;
    }
    case 'didReceiveSettings': {
      const c = contexts.get(context) || { timer: null };
      c.settings = (payload && payload.settings) || {};
      contexts.set(context, c);
      poll(context);
      break;
    }
    case 'keyDown': {
      const c = contexts.get(context);
      if (c && c.lastUrl) send({ event: 'openUrl', payload: { url: c.lastUrl } });
      break;
    }
    case 'sendToPlugin':
      onPICommand(context, (payload || {}));
      break;
  }
}

// ---- property-inspector commands ---------------------------------------------
async function onPICommand(context, payload) {
  if (payload.cmd !== 'listApps') return;
  const baseUrl = String(payload.baseUrl || globalSettings.baseUrl || CONFIG.baseUrl || '').replace(/\/+$/, '');
  const token = payload.token || globalSettings.token || CONFIG.token || '';
  const reply = (p) => send({ event: 'sendToPropertyInspector', context, action: ACTION_UUID, payload: p });
  if (!baseUrl || !token) { reply({ event: 'apps', ok: false, error: 'Enter Base URL and API token.' }); return; }
  try {
    const list = await fetchJson(`${baseUrl}/api/v1/applications`, authHeaders(token));
    const apps = (Array.isArray(list) ? list : [])
      .map((a) => ({ uuid: a.uuid, name: a.name || a.uuid, fqdn: String(a.fqdn || '').split(',')[0] }))
      .filter((a) => a.uuid)
      .sort((a, b) => a.name.localeCompare(b.name));
    reply({ event: 'apps', ok: true, apps });
  } catch (e) {
    reply({ event: 'apps', ok: false, error: describeErr(e) });
  }
}

// ---- polling -----------------------------------------------------------------
function authHeaders(token) { return { Authorization: `Bearer ${token}`, Accept: 'application/json' }; }

function resolve(ctx) {
  const s = ctx.settings || {};
  const baseUrl = String(globalSettings.baseUrl || CONFIG.baseUrl || '').replace(/\/+$/, '');
  const token = globalSettings.token || CONFIG.token || '';
  const appUuid = s.appUuid || '';
  let label = s.label || '';
  if (!label && s.appName) label = shortLabel(s.appName);
  return { baseUrl, token, appUuid, label: label || 'APP', pollOverride: Number(s.pollSeconds) || 0 };
}
function shortLabel(name) {
  const n = String(name).trim();
  return n.length <= 6 ? n.toUpperCase() : n.slice(0, 6);
}

async function fetchJson(url, headers) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(t); }
}

function classify(dep) {
  const raw = String(dep.status || '').toLowerCase();
  const start = Date.parse(dep.created_at) || Date.now();
  const endTs = Date.parse(dep.finished_at || dep.updated_at || '') || Date.now();
  let state = 'unknown';
  let building = false;
  if (['in_progress', 'running', 'building', 'in-progress'].includes(raw)) { state = 'building'; building = true; }
  else if (['queued', 'pending'].includes(raw)) { state = 'queued'; building = true; }
  else if (raw === 'finished') state = 'ok';
  else if (raw === 'failed') state = 'failed';
  else if (raw.startsWith('cancel')) state = 'cancelled';
  const elapsedMs = building ? Date.now() - start : Math.max(0, endTs - start);
  const ageMs = building ? 0 : Math.max(0, Date.now() - endTs);
  return { state, building, elapsedMs, ageMs, commit: String(dep.commit_message || '').split('\n')[0] };
}

function scheduleNext(key, ms) {
  const c = contexts.get(key);
  if (!c) return;
  if (c.timer) clearTimeout(c.timer);
  c.timer = setTimeout(() => poll(key), ms);
}

async function poll(key) {
  const ctx = contexts.get(key);
  if (!ctx) return;
  const { baseUrl, token, appUuid, label, pollOverride } = resolve(ctx);

  if (!baseUrl || !token) { render(key, { state: 'setup', label, msg: 'set URL+token' }); scheduleNext(key, 10000); return; }
  if (!appUuid) { render(key, { state: 'setup', label, msg: 'pick app' }); scheduleNext(key, 10000); return; }

  try {
    const [listRes, runRes] = await Promise.allSettled([
      fetchJson(`${baseUrl}/api/v1/deployments/applications/${appUuid}?take=1`, authHeaders(token)),
      fetchJson(`${baseUrl}/api/v1/deployments`, authHeaders(token)),
    ]);
    if (listRes.status !== 'fulfilled') throw listRes.reason || new Error('list failed');

    let dep = ((listRes.value && listRes.value.deployments) || [])[0] || null;

    if (runRes.status === 'fulfilled' && Array.isArray(runRes.value)) {
      const live = runRes.value.find((d) =>
        (d.deployment_url && d.deployment_url.includes(appUuid)) ||
        (dep && d.application_id != null && String(d.application_id) === String(dep.application_id)) ||
        (dep && d.application_name && d.application_name === dep.application_name));
      if (live) dep = Object.assign({}, dep, live);
    }

    if (!dep) { render(key, { state: 'none', label }); scheduleNext(key, 30000); return; }

    const info = classify(dep);
    ctx.lastUrl = baseUrl + (dep.deployment_url || '/');
    render(key, Object.assign({ label }, info));
    scheduleNext(key, pollOverride ? pollOverride * 1000 : (info.building ? 3000 : 15000));
  } catch (e) {
    log('poll error [' + label + ']: ' + (e && e.message));
    render(key, { state: 'error', label, msg: shortErr(e) });
    scheduleNext(key, 15000);
  }
}

function shortErr(e) {
  const m = String((e && e.message) || e || 'err');
  if (/abort/i.test(m)) return 'timeout';
  if (/HTTP 401|HTTP 403/.test(m)) return 'auth';
  if (/HTTP 404/.test(m)) return 'bad uuid?';
  if (/HTTP 5\d\d/.test(m)) return 'server';
  if (/ENOTFOUND|EAI_AGAIN|fetch failed/i.test(m)) return 'offline';
  return m.slice(0, 12);
}
function describeErr(e) {
  const m = String((e && e.message) || e || 'error');
  if (/abort/i.test(m)) return 'Request timed out.';
  if (/HTTP 401|HTTP 403/.test(m)) return 'Auth failed - check the API token.';
  if (/HTTP 404/.test(m)) return 'Not found - is API access enabled in Coolify?';
  if (/HTTP 5\d\d/.test(m)) return 'Coolify returned a server error.';
  if (/ENOTFOUND|EAI_AGAIN|fetch failed/i.test(m)) return 'Cannot reach that Base URL.';
  return m;
}

// ---- rendering ----------------------------------------------------------------
function fmtElapsed(ms) {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), ss = s % 60;
  if (m < 60) return `${m}:${String(ss).padStart(2, '0')}`;
  const h = Math.floor(m / 60);
  return `${h}h${String(m % 60).padStart(2, '0')}`;
}
function fmtDur(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${String(s % 60).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60}m`;
}
function fmtAge(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function xml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

const THEME = {
  building: { bg: '#B26B00', fg: '#FFFFFF', word: 'BUILD' },
  queued: { bg: '#6B5F00', fg: '#FFFFFF', word: 'QUEUE' },
  ok: { bg: '#1A7F37', fg: '#FFFFFF', word: 'OK' },
  failed: { bg: '#B42318', fg: '#FFFFFF', word: 'FAIL' },
  cancelled: { bg: '#57534E', fg: '#E7E5E4', word: 'CXL' },
  none: { bg: '#3F3F46', fg: '#D4D4D8', word: '--' },
  unknown: { bg: '#3F3F46', fg: '#D4D4D8', word: '?' },
  setup: { bg: '#1E3A5F', fg: '#DBEAFE', word: 'SETUP' },
  error: { bg: '#7F1D1D', fg: '#FECACA', word: 'ERR' },
};

function render(key, v) {
  const t = THEME[v.state] || THEME.unknown;
  let sub = '', foot = '';
  if (v.state === 'building' || v.state === 'queued') {
    sub = fmtElapsed(v.elapsedMs || 0);
    foot = v.commit ? v.commit.slice(0, 18) : '';
  } else if (v.state === 'ok' || v.state === 'failed' || v.state === 'cancelled') {
    sub = fmtDur(v.elapsedMs || 0);
    foot = fmtAge(v.ageMs || 0);
  } else if (v.state === 'error' || v.state === 'setup') {
    sub = v.msg || '';
  } else if (v.state === 'none') {
    sub = 'no deploys';
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
<rect width="144" height="144" rx="20" fill="${t.bg}"/>
<rect width="144" height="52" rx="20" fill="#000000" opacity="0.16"/>
<text x="72" y="34" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="${t.fg}" text-anchor="middle">${xml(v.label || '')}</text>
<text x="72" y="86" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="800" fill="${t.fg}" text-anchor="middle">${xml(t.word)}</text>
<text x="72" y="114" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="700" fill="${t.fg}" text-anchor="middle">${xml(sub)}</text>
<text x="72" y="135" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="500" fill="${t.fg}" opacity="0.8" text-anchor="middle">${xml(foot)}</text>
</svg>`;

  send({ event: 'setImage', context: key, payload: { image: 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64'), target: 0 } });
  send({ event: 'setTitle', context: key, payload: { title: '', target: 0 } });
}

// ---- go --------------------------------------------------------------------
if (!PORT || !REGISTER_EVENT || !PLUGIN_UUID) { log('missing launch args'); process.exit(1); }
process.on('uncaughtException', (e) => log('uncaught: ' + ((e && e.stack) || e)));
process.on('unhandledRejection', (e) => log('unhandledRejection: ' + ((e && e.message) || e)));
connect();
