# about-me — resume site

## Commands
- `npm run build` — YAML → `dist/index.html` (+ assets)
- `npm run dev`   — build + `npx serve dist -l 5173`
- `npm run pdf`   — build + Puppeteer renders `dist/resume{,-<variant>}.pdf`

Node **24** (pinned in CI). Puppeteer downloads Chromium on `npm install`.

## Architecture
- `data/base.yaml` = canonical resume; `data/overlays/*.yaml` deep-merge on top per variant.
- `build.js` compiles `src/template.hbs` + `src/partials/*.hbs`, embeds all variants as JSON in `<script id="variants">`.
- `src/switcher.js` swaps section HTML on `?variant=<name>` by matching `data-section="…"` attributes.
- Variants: `sre`, `platform`, `backend` (must match `src/template.hbs <select>` options and `VARIANTS` in `scripts/generate-pdf.js`).

## Overlay merge rules (in `build.js`)
- Objects: recursive deep-merge, overlay wins per key.
- Arrays + scalars: **overlay replaces base** (no per-item merge). Reorder or override lists wholesale.

## PDF generation
- `scripts/generate-pdf.js` uses `page.emulateMediaType('screen')` — the `@media print` block in `styles.css` is a Cmd+P fallback only, NOT the canonical PDF path.
- PDF-only style tweaks live in `page.addStyleTag({...})` inside `generate-pdf.js`, not in `styles.css`.
- Viewport 1500×1600 + `scale: 0.9` + `.resume { max-width: 1300px }` tuned so content lands on 2 A4 pages with correct sidebar proportion. Adjust these together.
- CSS Grid does not paginate cleanly in Chrome print; that's why we went Puppeteer + screen media.

## UI gotchas
- `.variant-picker` (dropdown + Download PDF) is `display: none` by default. Reveal with `?debug=true` (handled in `switcher.js`).
- `data-section` values are the contract between `template.hbs`, section partials, and `switcher.js`. Renaming one requires updating all three.

## Repo naming
- Local dir: `me`. GitHub remote: `duy0611/about-me`. Live URL: `https://duy0611.github.io/about-me/`.

## Deploy
- `.github/workflows/deploy.yml` runs `npm run pdf` (not `npm run build`) so PDFs are included in the Pages artifact.
- GitHub Pages source must be set to **GitHub Actions** in repo settings (one-time).
