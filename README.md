# Haryana State Zone

Responsive Hindi news web app / installable PWA for Haryana State Zone.

## Deploy
This repository includes a GitHub Actions Pages workflow. In GitHub, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**. Pushes to `main` then deploy the static frontend.

## Current architecture
- Static frontend hosted on GitHub Pages.
- News currently loads from the existing Haryana State Zone API endpoint configured in `app.js`.
- The frontend refreshes every 60 seconds and opens stories inside the app.
- The current news API still runs on the existing service. To remove that dependency completely, migrate the backend/database/feed-sync jobs to a separate host and update `API_URL`.

## Important
The API may only return summaries when publishers do not provide full article text. The app does not fabricate missing article details.
