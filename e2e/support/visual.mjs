import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect } from '@playwright/test';
import { PNG } from 'playwright-core/lib/utilsBundle';

const e2eDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workerDir = path.resolve(e2eDir, '../worker');
const stateDir = path.join(e2eDir, '.state');

export const quoteExecutionOutputDir = path.resolve(e2eDir, '../output/playwright/quote-execution');

export function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function localD1(command, { json = false } = {}) {
  const args = [
    'wrangler', 'd1', 'execute', 'sagemro-db',
    '--local', '--persist-to', stateDir,
    '--command', command,
    '--yes',
  ];
  if (json) args.push('--json');
  const output = execFileSync('npx', args, {
    cwd: workerDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return json ? JSON.parse(output) : output;
}

export function localD1Rows(command) {
  return localD1(command, { json: true }).flatMap((result) => result.results || []);
}

function overlapArea(a, b) {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return width * height;
}

export async function assertVisualIntegrity(page, { scope = 'body' } = {}) {
  const rootLocator = typeof scope === 'string' ? page.locator(scope) : scope;
  const result = await rootLocator.evaluate((root) => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden'
        && style.display !== 'none'
        && Number(style.opacity) !== 0
        && rect.width > 0
        && rect.height > 0;
    };
    const rectFor = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };

    const viewportWidth = document.documentElement.clientWidth;
    const pageOverflow = Math.max(
      0,
      document.documentElement.scrollWidth - viewportWidth,
      document.body.scrollWidth - viewportWidth,
    );
    const rawTimezone = (root.innerText || '').includes('Asia/Shanghai');
    const wrappedButtons = [...root.querySelectorAll('button')]
      .filter(visible)
      .map((button) => {
        const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => node.textContent.trim()
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT,
        });
        const lineTops = [];
        while (walker.nextNode()) {
          const range = document.createRange();
          range.selectNodeContents(walker.currentNode);
          lineTops.push(...[...range.getClientRects()].map((rect) => Math.round(rect.top)));
        }
        return { text: (button.innerText || button.getAttribute('aria-label') || '').trim(), lines: new Set(lineTops).size };
      })
      .filter((button) => button.text && button.lines > 1);

    const controls = [...root.querySelectorAll('button, input, select, textarea')]
      .filter(visible)
      .map((element) => ({
        element,
        rect: rectFor(element),
        parent: element.parentElement,
        stickyAncestor: element.closest('.sticky'),
        text: (element.innerText || element.getAttribute('aria-label') || element.getAttribute('name') || element.tagName).trim(),
      }));
    const overlaps = [];
    for (let index = 0; index < controls.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < controls.length; otherIndex += 1) {
        const first = controls[index];
        const second = controls[otherIndex];
        if (first.element.contains(second.element) || second.element.contains(first.element)) continue;
        if (first.parent === second.parent) continue;
        if (first.stickyAncestor !== second.stickyAncestor
          && (first.stickyAncestor || second.stickyAncestor)) continue;
        const width = Math.max(0, Math.min(first.rect.right, second.rect.right) - Math.max(first.rect.left, second.rect.left));
        const height = Math.max(0, Math.min(first.rect.bottom, second.rect.bottom) - Math.max(first.rect.top, second.rect.top));
        const area = width * height;
        const smallerArea = Math.min(first.rect.width * first.rect.height, second.rect.width * second.rect.height);
        if (area > 16 && smallerArea > 0 && area / smallerArea > 0.08) {
          overlaps.push({ first: first.text, second: second.text, area });
        }
      }
    }

    return { pageOverflow, rawTimezone, wrappedButtons, overlaps };
  });

  expect(result.pageOverflow, `horizontal overflow: ${JSON.stringify(result)}`).toBeLessThanOrEqual(1);
  expect(result.rawTimezone, `raw Asia/Shanghai found: ${JSON.stringify(result)}`).toBe(false);
  expect(result.wrappedButtons, `wrapped button text: ${JSON.stringify(result.wrappedButtons)}`).toEqual([]);
  expect(result.overlaps, `overlapping controls: ${JSON.stringify(result.overlaps)}`).toEqual([]);
}

export async function captureVisual(page, name, { scope = 'body', fullPage = true } = {}) {
  mkdirSync(quoteExecutionOutputDir, { recursive: true });
  const filePath = path.join(quoteExecutionOutputDir, `${name}.png`);
  const rootLocator = typeof scope === 'string' ? page.locator(scope) : scope;
  if (scope !== 'body') {
    await rootLocator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
  }
  await assertVisualIntegrity(page, { scope });
  await page.screenshot({ path: filePath, fullPage, animations: 'disabled' });
  const bytes = statSync(filePath).size;
  expect(bytes, `${filePath} should contain screenshot bytes`).toBeGreaterThan(2_000);

  const image = PNG.sync.read(readFileSync(filePath));
  let nonWhitePixels = 0;
  const totalPixels = image.width * image.height;
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const red = image.data[offset];
    const green = image.data[offset + 1];
    const blue = image.data[offset + 2];
    const alpha = image.data[offset + 3];
    if (alpha > 16 && (red < 248 || green < 248 || blue < 248)) nonWhitePixels += 1;
  }
  expect(nonWhitePixels / totalPixels, `${filePath} should not be blank`).toBeGreaterThan(0.01);
  return filePath;
}

export async function captureBothViewports(page, name, options = {}) {
  const original = page.viewportSize();
  for (const viewport of [
    { suffix: 'desktop', width: 1440, height: 900 },
    { suffix: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(200);
    await captureVisual(page, `${name}-${viewport.suffix}`, options);
  }
  if (original) {
    await page.setViewportSize(original);
    await page.waitForTimeout(300);
  }
}

export function hasMaterialOverlap(first, second) {
  return overlapArea(first, second) > 16;
}
