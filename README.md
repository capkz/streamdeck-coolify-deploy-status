# Coolify Deploy Status — Stream Deck plugin

View-only Stream Deck keys that show the **latest [Coolify](https://coolify.io) deployment**
of an application — building / queued / ok / failed — with elapsed time. Press a key to
open that deployment's log page in your browser.

| Key shows | When |
|---|---|
| amber `BUILD` + live `M:SS` + commit subject | a deployment is running |
| olive `QUEUE` | deployment queued, not started |
| green `OK` + build duration + "Xm ago" | last deployment succeeded |
| red `FAIL` + duration + age | last deployment failed |
| grey `CXL` | last deployment was cancelled |
| blue `SETUP` | needs Base URL / token / app selected |
| dark-red `ERR` + reason | can't reach Coolify or auth failed |

Polls every ~3 s while a build is running, ~15 s when idle (configurable per key).

## Requirements

- Stream Deck app **7.1+** (the plugin runs on the bundled Node.js 24 runtime; no npm dependencies)
- A Coolify instance with **API access enabled**: *Settings → Advanced → API and MCP → API access → Enabled*
- A Coolify **API token** with the **Read** permission: *Keys & Tokens → API Tokens*

> Security: the token is stored in Stream Deck **global settings** (local plaintext, like every
> other API-based Stream Deck plugin — it is not encrypted and not synced anywhere). It is kept
> out of per-key *action* settings so it never ends up in exported/backed-up profiles. Prefer a
> **Read**-scoped token, and restrict *Allowed API IPs* in Coolify. Rotate it if the machine is
> compromised.

## Setup

1. Install the plugin (`.streamDeckPlugin`), or from source (see below).
2. Drag **Coolify → Deploy Status** onto a key.
3. In the property inspector: enter your **Base URL** (e.g. `https://coolify.example.com`) and
   **API token**. These are saved once and shared by every Coolify key.
4. Pick an **Application** from the dropdown (loaded live from the API). Set a short **Key label**.
5. Repeat for each app/key you want to watch.

## Develop / build from source

```bash
npm install                 # installs @elgato/cli (dev only)
npm run link                # symlinks the .sdPlugin folder into Stream Deck
npm run restart             # (re)loads the plugin
npm run validate            # runs the Elgato manifest/plugin validator
npm run pack                # produces dev.chaul.coolifydeploy.streamDeckPlugin
```

Plugin debug log: `dev.chaul.coolifydeploy.sdPlugin/plugin.log`.

### Optional `config.json`

For a headless / self-host setup you can drop a `config.json` next to `plugin.js`
(see `config.example.json`). On first run its values are copied into Stream Deck global
settings and it is no longer needed. `config.json` is git-ignored — never commit a real token.

## How it reads Coolify

- App list: `GET /api/v1/applications`
- Latest deployment: `GET /api/v1/deployments/applications/{uuid}?take=1`
- Running deployments (merge for live state): `GET /api/v1/deployments`

All calls are `Authorization: Bearer <token>` and read-only.

## License

MIT © capkz
