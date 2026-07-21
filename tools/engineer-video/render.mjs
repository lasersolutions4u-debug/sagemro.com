import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { DURATION_MS } from './engineer-service-animation.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = require('sharp');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outputDir = path.join(root, 'frontend/public/media');
const workDir = path.join(root, 'output/engineer-video-frames');
const baseUrl = process.env.ENGINEER_VIDEO_BASE_URL || 'http://127.0.0.1:4180';
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const fps = 24;
const frameCount = (DURATION_MS / 1000) * fps;
const width = 1280;
const height = 720;
const locales = (process.env.ENGINEER_VIDEO_LOCALES || 'cn,en')
  .split(',')
  .map((locale) => locale.trim())
  .filter((locale) => locale === 'cn' || locale === 'en');
const keepFrames = process.env.KEEP_ENGINEER_VIDEO_FRAMES === '1';
const forceRender = process.env.FORCE_ENGINEER_VIDEO_RENDER === '1';

if (!existsSync(chromePath)) {
  throw new Error(`Chrome executable not found: ${chromePath}`);
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}`);
  }
}

function assertSize(filePath, maxBytes) {
  const size = statSync(filePath).size;
  if (size > maxBytes) {
    throw new Error(`${path.basename(filePath)} is ${(size / 1024 / 1024).toFixed(2)} MB; maximum is ${(maxBytes / 1024 / 1024).toFixed(2)} MB`);
  }
}

async function renderLocale(browser, locale) {
  const localeWorkDir = path.join(workDir, locale);
  mkdirSync(localeWorkDir, { recursive: true });
  const existingFrames = readdirSync(localeWorkDir).filter((fileName) => /^frame-\d{4}\.png$/.test(fileName));

  if (forceRender || existingFrames.length !== frameCount) {
    rmSync(localeWorkDir, { recursive: true, force: true });
    mkdirSync(localeWorkDir, { recursive: true });
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.goto(`${baseUrl}/tools/engineer-video/?locale=${locale}&render=1&time=0`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.EngineerServiceAnimation));

    for (let frame = 0; frame < frameCount; frame += 1) {
      const timeMs = (frame / fps) * 1000;
      await page.evaluate(({ nextLocale, nextTime }) => {
        window.EngineerServiceAnimation.renderFrame(document.querySelector('[data-stage]'), nextLocale, nextTime);
      }, { nextLocale: locale, nextTime: timeMs });
      await page.screenshot({ path: path.join(localeWorkDir, `frame-${String(frame).padStart(4, '0')}.png`) });
    }
    await page.close();
  }

  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/tools/engineer-video/?locale=${locale}&render=1&time=19400`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.EngineerServiceAnimation));
  await page.evaluate(({ nextLocale, nextTime }) => {
    window.EngineerServiceAnimation.renderFrame(document.querySelector('[data-stage]'), nextLocale, nextTime);
  }, { nextLocale: locale, nextTime: 19400 });

  const posterPath = path.join(outputDir, `engineer-service-flywheel-${locale}-poster.webp`);
  const posterPngPath = path.join(localeWorkDir, 'poster.png');
  await page.screenshot({ path: posterPngPath, type: 'png' });
  await page.close();

  await sharp(posterPngPath).webp({ quality: 82 }).toFile(posterPath);

  const inputPattern = path.join(localeWorkDir, 'frame-%04d.png');
  const mp4Path = path.join(outputDir, `engineer-service-flywheel-${locale}.mp4`);
  const webmPath = path.join(outputDir, `engineer-service-flywheel-${locale}.webm`);

  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(fps), '-i', inputPattern,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4Path,
  ]);

  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(fps), '-i', inputPattern,
    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34',
    '-deadline', 'realtime', '-cpu-used', '8', '-row-mt', '1',
    '-tile-columns', '2', '-threads', '8', '-pix_fmt', 'yuv420p', webmPath,
  ]);

  assertSize(mp4Path, 5 * 1024 * 1024);
  assertSize(webmPath, 5 * 1024 * 1024);
  assertSize(posterPath, 250 * 1024);
}

mkdirSync(outputDir, { recursive: true });
mkdirSync(workDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: chromePath });
let renderCompleted = false;
try {
  for (const locale of locales) {
    await renderLocale(browser, locale);
  }
  renderCompleted = true;
} finally {
  await browser.close();
  if (renderCompleted && !keepFrames) {
    for (const locale of locales) {
      rmSync(path.join(workDir, locale), { recursive: true, force: true });
    }
  }
}
