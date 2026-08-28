# Changelog

## 1.0.0

- Initial release.
- `Deploy Status` action: shows the latest Coolify deployment of one application
  (building / queued / ok / failed / cancelled) with elapsed time, rendered as an SVG key.
- Property inspector loads the application list live from the Coolify API.
- Base URL + API token stored in shared global settings; app selection + label per key.
- Press a key to open the deployment log page.
- Adaptive polling (~3 s while building, ~15 s idle); per-key override.
- Runs on the Stream Deck bundled Node.js 24 runtime — zero npm dependencies.
