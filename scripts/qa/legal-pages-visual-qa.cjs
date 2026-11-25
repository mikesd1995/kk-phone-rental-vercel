'use strict';

// Read-only, local-only browser QA for customer-facing Terms / Privacy pages.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const widths = [320, 375, 390, 430, 480, 768, 1024, 1440];
const routes = ['/privacy/', '/terms/', '/en/privacy/', '/en/terms/'];
const base = 'http://127.0.0.1:4173';
const output = path.resolve(process.cwd(), 'artifacts/storefront-visual-qa/legal');
const findings = [];

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const route of routes) {
      for (const width of widths) {
        // Dark-mode smoke tests on representative mobile and desktop sizes.
        const schemes = width === 390 || width === 1024 ? ['light', 'dark'] : ['light'];
        for (const scheme of schemes) {
          const context = await browser.newContext({
            viewport: { width, height: width <= 480 ? 844 : 900 },
            colorScheme: scheme,
            reducedMotion: 'reduce',
            deviceScaleFactor: 1
          });
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', error => errors.push(String(error.message || error)));
          const url = base + route;
          const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
          if (!response || response.status() !== 200) {
            throw new Error('LEGAL_ROUTE_HTTP_ERROR ' + url + ' ' + (response && response.status()));
          }
          const metrics = await page.evaluate(() => {
            const root = document.documentElement;
            const body = document.body;
            const main = document.querySelector('.legal-main');
            const heading = document.querySelector('h1');
            const links = Array.from(document.querySelectorAll('.legal-nav a'));
            const sections = document.querySelectorAll('.legal-section').length;
            const css = getComputedStyle(body);
            return {
              scrollWidth: root.scrollWidth,
              innerWidth: window.innerWidth,
              title: heading?.innerText || '',
              mainVisible: Boolean(main && main.getBoundingClientRect().width > 0),
              sectionCount: sections,
              navTargetMinHeight: Math.min(...links.map(link => link.getBoundingClientRect().height)),
              background: css.backgroundColor,
              color: css.color,
              fontFamily: css.fontFamily
            };
          });
          const locale = route.startsWith('/en/') ? 'en' : 'th';
          const actualLocale = await page.locator('html').getAttribute('lang');
          if (actualLocale !== locale) throw new Error('LEGAL_LANGUAGE_MISMATCH ' + route + ' ' + actualLocale);
          const switchLinks = page.locator('.legal-lang-switch a');
          if (await switchLinks.count() !== 2) throw new Error('LEGAL_LANGUAGE_SWITCH_MISSING ' + route);
          const alternate = locale === 'en' ? route.slice(3) : '/en' + route;
          const alternateHref = await switchLinks.nth(locale === 'en' ? 0 : 1).getAttribute('href');
          if (alternateHref !== alternate) throw new Error('LEGAL_SWITCH_WRONG_TARGET ' + route + ' ' + alternateHref);
          if (errors.length) throw new Error('LEGAL_BROWSER_ERROR ' + errors.join('; '));
          if (!metrics.mainVisible || !metrics.title || metrics.sectionCount < 7) {
            throw new Error('LEGAL_CONTENT_MISSING ' + route + ' ' + width + ' ' + scheme);
          }
          if (metrics.scrollWidth > metrics.innerWidth + 1) {
            throw new Error('LEGAL_HORIZONTAL_OVERFLOW ' + route + ' ' + width + ' ' + scheme + ' ' + JSON.stringify(metrics));
          }
          if (metrics.navTargetMinHeight < 43) {
            throw new Error('LEGAL_NAV_TAP_TARGET_TOO_SMALL ' + route + ' ' + width + ' ' + scheme);
          }
          const name = route.slice(1, -1).replace(/\//g, '-') + '-' + width + '-' + scheme;
          await page.screenshot({ path: path.join(output, name + '.png'), fullPage: false, animations: 'disabled' });
          findings.push({ route, width, scheme, ...metrics, status: 'PASS' });
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(output, 'metrics.json'), JSON.stringify({ check: 'legal-pages', read_only: true, results: findings }, null, 2) + '\n');
  const rows = findings.map(item => '| ' + item.route + ' | ' + item.width + ' | ' + item.scheme + ' | PASS |').join('\n');
  fs.writeFileSync(path.join(output, 'summary.md'), '# Legal pages visual QA\n\nAll checks use a local static server; no Production writes or customer access.\n\n| Page | Width | Theme | Status |\n| --- | ---: | --- | --- |\n' + rows + '\n');
  process.stdout.write('LEGAL_VISUAL_QA_PASS: ' + findings.length + ' checks\n');
}

main().catch(error => {
  process.stderr.write(String(error.stack || error) + '\n');
  process.exitCode = 1;
});
