# Personal Market Brief Dashboard

A clean, mobile-first dashboard for a Singapore-based financial advisor. It groups world finance and technology headlines, Singapore policy updates, market gainers, crypto, commodities, FX movements against SGD, and official source links into one page.

## How it updates

- `scripts/update-data.js` refreshes `data/dashboard.json`.
- `.github/workflows/update-dashboard.yml` runs daily at 06:30 Singapore time and commits the refreshed snapshot.
- `.github/workflows/pages.yml` deploys the static site to GitHub Pages from `main`.

## Local commands

```bash
npm run check
node scripts/update-data.js
```

The dashboard itself is static, so it can be served by any local static server or GitHub Pages.

## Source notes

Official source buttons are included for MAS, SGX, MOF, gov.sg, IRAS, CPF, IMDA, LIA Singapore, NASDAQ, NYSE, CME Group, and MAS FID. Some market data categories depend on public data endpoints or pages that may rate-limit automated access, so every card has an official verification link and a polished empty state.
