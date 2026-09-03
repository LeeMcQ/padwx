# PadWx

Live SANSA weather for Hartebeesthoek (HBK) and Matjiesfontein (MTJ).

Phone URL after Pages is on:

`https://leemcq.github.io/YOUR-REPO-NAME/`

Widget: `https://leemcq.github.io/YOUR-REPO-NAME/widget.html?site=mtj`

## Setup on GitHub (about 3 minutes)

1. On GitHub, open **your** account and click **New repository**.
2. Name it `padwx` or `padwerke`. Set it to **Public**. Create it.  
   If you already have `LeeMcQ/padwx`, open that repo instead.
3. In the repo, click **Add file → Upload files**.
4. Drop in **everything** from `padwx-github.zip` (keep the folders: `.github/workflows/` and `scripts/`).
5. Commit to the **main** branch.
6. Open **Settings → Pages**.
7. Under **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/ (root)**
   - Save
8. Wait about a minute, then open  
   `https://leemcq.github.io/YOUR-REPO-NAME/`  
   on your phone in Chrome. Menu → **Add to Home screen**.

## Hourly weather

GitHub Actions file `.github/workflows/update.yml` pulls SANSA every hour and writes `weather.json`.

First time: repo **Actions** tab → allow workflows if GitHub asks.

## Files

| File | What it is |
|---|---|
| `index.html` | The website / Android app |
| `widget.html` | Compact home-screen glance |
| `weather.json` | Latest HBK + MTJ readings |
| `scripts/fetch-weather.mjs` | SANSA Grafana fetch |
| `.github/workflows/update.yml` | Hourly refresh |
