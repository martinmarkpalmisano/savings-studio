# Savings Studio — tiered savings calculator

A responsive, no-backend savings calculator that works on GitHub Pages and can be added to a phone's home screen. All calculations run on the device; nothing is uploaded.

## Features

- Two editable interest tiers (default: **3.50% AER for the first €15,000**, **1.25% AER on the excess**).
- Italian tax estimate: default **26% interest withholding** at each monthly credit (editable). Net interest remains in the account and compounds.
- Optional **0.20% annual deposit-account stamp duty** can be enabled and edited.
- Gross interest, interest tax, net interest and optional stamp duty are shown for each month.
- Net monthly interest is credited **into the balance and never withdrawn**.
- Optional monthly top-ups (applied at month-end).
- Monthly-interest and balance charts, month-by-month statement with year filters, two-tier interest breakdown.
- Download the full history as CSV.
- Settings remembered on each device. Use **Share your settings** for a link that opens the same scenario on another device.
- Mobile-friendly, light/dark switch, installable as a PWA, available offline once loaded online.
- No libraries, server, paid services, build tools, external API calls, or account required.

## Publish on GitHub Pages

1. Sign in to GitHub and create a **new public repository**, for example `savings-studio`.
2. Upload **everything in this folder**, preserving the folder structure. `index.html` needs to sit at the **root** of the repository, not inside an extra `tiered-savings-calculator` folder. The `assets/` directory must be alongside it.
3. Commit the files to `main`.
4. In the repository, visit **Settings → Pages → Build and deployment**.
5. Choose **Source: Deploy from a branch**, **Branch: main**, **Folder: /(root)**, then **Save**.
6. Once published, the link will look like `https://YOUR-USERNAME.github.io/savings-studio/`.

Official GitHub guide: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

If uploading by Git from VS Code, run from the folder containing `index.html`:

```bash
git init
git add .
git commit -m "Launch tiered savings calculator"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/savings-studio.git
git push -u origin main
```

The GitHub repository must be created before adding the remote. Use your real username in the URL. GitHub Pages is a public website: do **not** enter bank account identifiers or other secrets in files committed to the repository. The calculator itself stores only numeric scenarios on the device.

## Use it on your phone

Open the published link in a browser. On iPhone Safari, use **Share → Add to Home Screen**. On Android Chrome, use the browser menu → **Install app** or **Add to Home screen**. Once you have opened the site, the PWA's static files are cached for offline use in supported browsers. Settings remain local to each device, but you can share a URL containing a scenario.

## Local development / testing

From this directory:

```bash
python -m http.server 8000
```

Visit http://localhost:8000 and changes to source files become visible on refresh. (The service worker may cache an older copy; in DevTools, unregister the worker or use a private browsing session during development.)

Run the built-in test suite if Node.js is installed:

```bash
node --test tests/calc.test.mjs
```

## How calculations work

For each rate, effective monthly rate is `(1 + AER/100)^(1/12) - 1`. Each month's opening balance is split at the tier threshold: `first = min(balance, threshold)` and `excess = max(balance - threshold, 0)`. Each tier's gross monthly interest is rounded to cents. Configured interest withholding (26% by default for Italian bank deposits) is deducted when interest is paid monthly. Only net credited interest compounds, and any optional deposit is added at month-end. If enabled, annual stamp duty is approximated using the chosen rate (0.20% by default) on the year-end balance every 12 months, with a €1 minimum. Actual stamp duty can differ according to statement dates and bank terms. The gross comparison excludes all taxes and stamp duty.

This is an illustrative model, not an exact prediction of a specific bank's statement. Banks may accrue interest daily, pay on a non-calendar schedule, change rates, use different rounding, or apply taxes and fees differently. Display-currency changes **do not perform currency conversion**.

## Project files

- `index.html` — app layout
- `assets/styles.css` — mobile-responsive styling
- `assets/app.mjs` — UI and charts
- `assets/calc.mjs` — calculation logic (also used in tests)
- `assets/favicon.svg`, `assets/icon-192.png`, `assets/icon-512.png` — site and home-screen icons
- `manifest.webmanifest`, `sw.js` — home-screen support and offline cache
- `.nojekyll` — static publishing without Jekyll
- `tests/calc.test.mjs` — deterministic calculation checks