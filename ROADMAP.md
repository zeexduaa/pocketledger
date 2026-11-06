# Roadmap

Where PocketLedger is going: a simple, private money tracker that's quick enough to use every day.

Sizes are rough guesses (S = a few hours, M = about a day, L = several days, XL = a week or more).

## ✅ v0.1: the basics

- Add expenses and income, browse by month, totals and balance
- Spending by category, CSV export, saved in the browser
- Unit tests and CI

## v0.2: everyday use

- [ ] **Edit an entry**: tap an entry to change its amount, category, date or note (M)
- [x] **Undo delete**: a short "Undo" message instead of a confirmation dialog (S)
- [ ] **Search and filter**: by text, category, type and amount range (M)
- [x] **Remember the last category** used for each type (S)
- [x] **Commit package-lock.json** and switch CI to `npm ci` (S)
- [ ] **Linting and formatting**: ESLint + Prettier in CI (S)

## v0.3: your own setup

- [ ] **Custom categories**: add, rename, recolour and hide categories (L)
- [ ] **Currency setting**: choose a currency and number format (M)
- [ ] **Multiple accounts**: cash, bank, card, with a balance per account (L)
- [ ] **Start of month**: for people paid on, say, the 25th (M)

## v0.4: budgets and planning

- [ ] **Monthly budgets per category**, with progress bars and warnings (L)
- [ ] **Recurring entries**: rent, salary, subscriptions added automatically (L)
- [ ] **Savings goals** with progress (M)

## v0.5: insights

- [ ] **Trends**: spending per month over the last year, as a chart (M)
- [ ] **Category drill-down**: tap a category to see its entries (S)
- [ ] **Year summary** (M)

## v0.6: your data

- [ ] **CSV import** with column matching, so you can bring in bank exports (L)
- [ ] **Full backup and restore** as a JSON file (M)
- [ ] **Move storage to IndexedDB** for large ledgers, with a migration from localStorage (L)

## v1.0: release

- [ ] **Installable app (PWA)** that works fully offline (M)
- [ ] **Accessibility pass**: screen reader labels, keyboard use, contrast (M)
- [ ] **End-to-end tests** with Playwright for the main flows (M)
- [ ] **Translations** and number formats for other languages (M)
- [ ] **Deploy to GitHub Pages** from CI (S)
