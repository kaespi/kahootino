Puppeteer Simulator for Kahootino

Overview

- A headless-browser simulator that opens multiple player pages against your running Kahootino server.

Prerequisites

- Node.js (16+ recommended)
- Chrome/Chromium (Puppeteer will download a compatible Chromium by default)
- A running Kahootino server serving `public/` (see `php -S` example)

Quick start

1. From the repo root, start the PHP built-in server (or your preferred web server):

```powershell
# from repo root
php -S localhost:8000 -t public
```

2. Install dependencies:

```powershell
npm install
```

3. Run the simulator (20 players by default):

```powershell
# default: BASE_URL=http://localhost:8000, QUIZ_CODE=default, PLAYERS=20
npm run simulate
```

Environment variables

- `BASE_URL` — base URL where `player.php` is served (default: `http://localhost:8000`)
- `QUIZ_CODE` — quiz code to join (default: `default`)
- `PLAYERS` — number of concurrent headless players (default: `20`)
- `HEADLESS` — if set to `false` the browser runs visible windows (default: `true`)
- `AUTO_HOST` — if set to `1`, the simulator will POST to `api/host_action.php` to advance the quiz phases automatically
- `HOST_COUNTDOWN` — seconds to wait for players to answer when `AUTO_HOST=1` (default: `12`)
- `JOIN_STAGGER_MS` — ms delay between player joins to avoid bursting the server (default: `120`)

Notes
- The simulator fills the nickname input and clicks `Join` on the real `player.php` UI, so it exercises the same client-side logic (Ably/SSE, localStorage, etc.).
- If you use `AUTO_HOST=1`, ensure your `config.local.php` allows host actions or that the host API is reachable.
- Adjust `PLAYERS` based on machine resources.

Example runs
```powershell
# visible browsers, 10 players
$env:HEADLESS='false'; $env:PLAYERS='10'; npm run simulate

# automated host, 30 players
$env:AUTO_HOST='1'; $env:PLAYERS='30'; npm run simulate
```
