# Savings Studio — tiered savings calculator

A responsive, no-backend savings calculator that works on GitHub Pages and can be added to a phone's home screen. All calculations run on the device; nothing is uploaded.

## Features

- Switch **Use tiered interest** on or off. When off, the primary AER applies to the **entire balance**, and the threshold and second tier are hidden. Turn it back on to restore those saved values.
- Two editable interest tiers (default: **3.50% AER for the first €15,000**, **1.25% AER on the excess**).
- **Blended gross annual interest rate** automatically weighted by the amounts in each tier, with start/end figures and a rate column in the monthly and daily statements and CSV exports. Example: €59,514.16 at 3.50% on €15,000 and 1.00% on the excess produces about **1.63% gross p.a.** The rate changes as the account balance grows.
- Italian tax estimate: default **26% interest withholding** at each monthly credit (editable). Net interest remains in the account and compounds.
- Optional **0.20% annual deposit-account stamp duty** can be enabled and edited.
- Optional **monthly account-plan fee** (default **€9.99**, adjustable). A switch includes/excludes the fee each month.
- Subscriptions are assumed paid **outside the savings account**: they reduce overall economic profit, but do not reduce the account balance or its compounding.
- The monthly statement, charts, CSV and tax panel distinguish **net interest credited** from **net benefit after external fees**, and show the effective final value after fees.
- Gross interest, interest tax, net interest and optional stamp duty are shown for each month.
- Net monthly interest is credited **into the balance and never withdrawn**.
- Optional monthly top-ups (applied at month-end).
- **Daily or monthly interest-credit mode** (Daily by default); use the date picker to set when the simulation starts.
- Daily mode models Revolut Italy's daily p.a. rate / 365 (or / 366 in leap years), 26% withholding and interest cents carried until €0.01 can be paid. Monthly mode retains the effective AER/12 model.
- Dated day-by-day statement with a monthly period selector, net credited amounts, taxes, deposits, stamp duty, fees and closing balance; full daily CSV export.
- Monthly-interest and balance charts, month-by-month summary statement with year filters, two-tier interest breakdown.
- Download the full history as CSV.
- Settings remembered on each device. Use **Share your settings** for a link that opens the same scenario on another device.
- Mobile-friendly, light/dark switch, installable as a PWA, available offline once loaded online.
- No libraries, server, paid services, build tools, external API calls, or account required.

## Search discoverability

- The homepage has an English search title, accurate descriptions, canonical URL, social sharing tags, WebApplication structured data, and useful English/Italian guidance.
- XML sitemap: https://martinmarkpalmisano.github.io/savings-studio/sitemap.xml
- Submit that full sitemap URL in Google Search Console → **Sitemap**. After submission, use URL Inspection on the homepage to track indexing.
- No project-level `robots.txt` is used. Search crawlers only apply robots rules served at the **host root** (`https://martinmarkpalmisano.github.io/robots.txt`), not inside `/savings-studio/`. A project-level file would not control Googlebot crawling.
- Canonical points to the public GitHub Pages homepage; scenario query strings should consolidate to the same canonical page.
- Indexing and search positions are determined by Google and are not guaranteed.

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
node --test tests/*.test.mjs
```

## How calculations work

In **monthly payment mode**, For each rate, effective monthly rate is `(1 + AER/100)^(1/12) - 1`. In **daily mode**, rates are gross p.a. (not AER), and daily interest is the tier's closing balance multiplied by its annual rate and divided by 365 or 366 depending on the calendar year. The model carries fractional cents of **net** after-tax interest forward until one cent can be credited. It uses calendar months running from the chosen start date to the next monthly anniversary for top-ups and plan fees. Each month's opening balance is split at the tier threshold: `first = min(balance, threshold)` and `excess = max(balance - threshold, 0)`. When tiered interest is switched off, the entire opening balance earns the first AER and the excess tier earns nothing. The threshold and second AER are retained for later use. Each tier's gross monthly interest is rounded to cents. Configured interest withholding (26% by default for Italian bank deposits) is deducted when interest is paid monthly. Only net credited interest compounds, and any optional deposit is added at month-end. If enabled, annual stamp duty is approximated using the chosen rate (0.20% by default) on the year-end balance every 12 months, with a €1 minimum. Actual stamp duty can differ according to statement dates and bank terms. The gross comparison excludes all taxes and stamp duty. Plan fees are tracked separately as out-of-account spending: **account closing balance = deposits + after-tax interest − stamp duty**; **total economic profit = after-tax interest − stamp duty − plan fees**. Therefore, the equivalent final value after external fees is shown separately as the bank balance minus all monthly subscription costs.

This is an illustrative model, not an exact prediction of a specific bank's statement. In daily mode, the table dates correspond to the modeled day of interest accrual/crediting; actual bank settlement posting can differ by a day. The daily gross and tax accrual columns show fractions of cents, while credited payments are shown to cents. Banks may accrue interest daily, pay on a non-calendar schedule, change rates, use different rounding, or apply taxes and fees differently. Display-currency changes **do not perform currency conversion**.

## Project files

- `index.html` — app layout
- `assets/styles.css` — mobile-responsive styling
- `assets/app.mjs` — UI, monthly charts and the daily/monthly statement views
- `assets/daily.mjs` — real-date daily interest model
- `assets/calc.mjs` — calculation logic (also used in tests)
- `assets/favicon.svg`, `assets/icon-192.png`, `assets/icon-512.png` — site and home-screen icons
- `manifest.webmanifest`, `sw.js` — home-screen support and offline cache
- `.nojekyll` — static publishing without Jekyll
- `tests/calc.test.mjs`, `tests/daily.test.mjs` — deterministic calculation checks