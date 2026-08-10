#!/usr/bin/env node
'use strict';

/**
 * Render dist/*.html to dist/*.pdf via headless Chrome (Puppeteer).
 *
 * Renders using SCREEN media (not print) so PDFs match the browser view
 * exactly: sidebar tint, pill-styled skills, blue accents, fonts, layout.
 * Chrome paginates the tall document into A4 pages.
 *
 * Outputs:
 *   dist/resume.pdf              — default variant
 *   dist/resume-<variant>.pdf    — one per overlay (sre, platform, backend)
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const handler = require('serve-handler');
const puppeteer = require('puppeteer');

const DIST = path.join(__dirname, '..', 'dist');
const PORT = 5555;

const VARIANTS = [
  { name: 'default', file: 'resume.pdf', query: '' },
  { name: 'sre', file: 'resume-sre.pdf', query: '?variant=sre' },
  { name: 'platform', file: 'resume-platform.pdf', query: '?variant=platform' },
  { name: 'backend', file: 'resume-backend.pdf', query: '?variant=backend' },
];

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('pdf: dist/index.html missing — run `node build.js` first.');
    process.exit(1);
  }

  // Serve dist/ locally so Puppeteer loads via http:// (fonts + relative assets work).
  const server = http.createServer((req, res) => handler(req, res, { public: DIST }));
  await new Promise((resolve) => server.listen(PORT, resolve));
  const baseUrl = `http://localhost:${PORT}/`;
  console.log(`pdf: serving dist/ at ${baseUrl}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    for (const v of VARIANTS) {
      const page = await browser.newPage();
      // Screen media so backgrounds/pills/colors render.
      await page.emulateMediaType('screen');
      // Wide viewport so the resume takes a smaller proportional slice of the
      // rendered page (mirrors how the design looks on a normal monitor with
      // gutters on either side of the 960px card). Chrome scales the viewport
      // down to A4 width for the PDF, so 1400 → 794 ≈ 0.57× effective scale,
      // giving small-but-readable ~8pt body text and matching the visual
      // proportions of the on-screen layout.
      await page.setViewport({ width: 1500, height: 1600, deviceScaleFactor: 2 });

      const url = baseUrl + v.query;
      await page.goto(url, { waitUntil: 'networkidle0' });

      // PDF-only visual adjustments:
      //   - hide the variant picker (screen chrome)
      //   - white body so empty page bottoms don't tint
      //   - kill card margin/shadow so nothing pushes an extra blank page
      //   - widen the resume so the main column wraps fewer lines (denser)
      //   - remove `break-inside: avoid` on `.job` so jobs flow into the
      //     bottom of page 1 instead of being pushed to page 2 as a block
      //   - slightly tighten paddings / line-heights for print density
      await page.addStyleTag({
        content: `
          .variant-picker { display: none !important; }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .resume {
            max-width: 1300px !important;
            margin: 0 auto !important;
            box-shadow: none !important;
          }
          .resume__header    { padding: 18px 24px 12px !important; }
          .resume__sidebar-inner { padding: 18px 20px !important; }
          .resume__main      { padding: 18px 24px !important; }

          /* Let jobs flow across pages, but never split a single bullet or
             cut the company header off from its first bullet. */
          .job               { break-inside: auto !important; page-break-inside: auto !important;
                               margin-bottom: 14px !important; }
          .job__bullets li   { break-inside: avoid; page-break-inside: avoid;
                               line-height: 1.4 !important; margin-bottom: 4px !important; }
          .job__header       { break-after: avoid; page-break-after: avoid;
                               margin-bottom: 4px !important; }

          .block             { margin-bottom: 14px !important; }
          .block__title      { margin-bottom: 8px !important; padding-bottom: 4px !important; }

          .summary           { line-height: 1.45 !important; }

          /* Denser competency pills so sidebar isn't so tall */
          .competencies      { gap: 10px !important; }
          .competency__group { margin-bottom: 2px !important; }
          .competency__items { gap: 3px 5px !important; }
          .competency__items li { padding: 1px 6px !important; font-size: 10.5px !important; }

          /* Tighter education/certs/langs */
          .education__item   { margin-bottom: 8px !important; }
          .certifications li { padding: 2px 0 !important; font-size: 11px !important; }
          .languages li      { padding: 2px 0 !important; }

          /* Small self-contained sidebar blocks: keep on one page instead
             of leaving a lonely section heading behind. Experience and
             competencies are too tall to force this way — they must be
             allowed to break. */
          [data-section="languages"],
          [data-section="certifications"],
          .education__item { break-inside: avoid !important; page-break-inside: avoid !important; }
        `,
      });
      // Wait a beat for web fonts to settle.
      await page.evaluateHandle('document.fonts.ready');

      const outPath = path.join(DIST, v.file);
      await page.pdf({
        path: outPath,
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: false,
        margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
        // Small extra shrink so the resume lands on 2 A4 pages instead of
        // 3 with a mostly-empty tail page.
        scale: 0.9,
      });
      console.log(`pdf: wrote ${path.relative(process.cwd(), outPath)}`);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
