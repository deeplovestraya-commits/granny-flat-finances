# Granny Flat Finances

A private web app for tracking granny flat income and expenses — Airbnb earnings, direct leases, and all associated costs — with a financial year report and 50/50 profit split summary.

## Features

- **Password-protected** — admin and viewer roles
- **Airbnb income** — import monthly earnings PDFs (auto-parsed)
- **Direct leases** — add and manage fixed-term tenancies
- **Expenses** — drop invoices/receipts (PDF) or add manually, categorised for tax
- **Dashboard** — income/expense charts, recent activity, period filter
- **Reports** — financial year P&L with CSV and print/PDF export

## Tech stack

- Vanilla HTML/CSS/JS — no build step
- [Netlify Functions](https://docs.netlify.com/functions/overview/) for auth and data persistence
- [PDF.js](https://mozilla.github.io/pdf.js/) for client-side PDF parsing
- [Chart.js](https://www.chartjs.org/) for charts
- Hosted on [Netlify](https://www.netlify.com/)

## Project structure

```
granny-flat-finances/
├── index.html
├── netlify.toml
├── package.json
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   └── pdf-parser.js
├── netlify/
│   └── functions/
│       ├── tracker-auth.js   # login / role check
│       └── tracker-data.js   # read & write records.json
└── data/
    └── records.json          # all app data (committed as seed)
```

## Deploying to Netlify

See [DEPLOYING](#deploying) below.

---

## Deploying

### 1. Connect repo to Netlify

1. Go to [netlify.com](https://www.netlify.com/) and sign in
2. Click **Add new site → Import an existing project**
3. Choose **GitHub** and select `deeplovestraya-commits/granny-flat-finances`
4. Branch: `main` (or whichever branch you want to deploy)
5. Build command: `echo 'static site'` (already set in `netlify.toml`)
6. Publish directory: `.`
7. Click **Deploy site**

### 2. Set environment variables

In **Netlify → Site configuration → Environment variables**, add:

| Key | Value |
|-----|-------|
| `TRACKER_ADMIN_PASSWORD` | your chosen admin password |
| `TRACKER_VIEWER_PASSWORD` | your chosen viewer password |

### 3. Done

Your site will be live at a `*.netlify.app` URL. Open it, enter your password, and start tracking.

---

## Usage notes

- **Admin** can add/edit/delete all records and upload PDFs
- **Viewer** can see all data and export reports but cannot make changes
- Data is stored in `data/records.json` via the Netlify Function — changes persist between sessions
- Airbnb PDFs: go to **Airbnb → Hosting → Finance → Earnings → select month → Download PDF**, then drop it on the Income page
