# Engineer Homepage Bilingual Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add approved Chinese and English 20-second workflow animations to the engineer recruiting page while implementing and retaining the complete confirmed partner-page copy.

**Architecture:** Keep animation production separate from the React runtime. A deterministic JavaScript SVG renderer drives both the browser preview and local frame sequence; FFmpeg exports localized WebM, MP4, and poster assets. The React page chooses localized media by hostname and falls back to the poster without affecting the existing application workflow.

**Tech Stack:** React 19, Tailwind CSS 4, Lucide React, plain HTML/CSS/JavaScript animation source, Playwright CLI, FFmpeg, Node test runner.

## Global Constraints

- The video supplements the confirmed homepage copy and does not replace or remove any confirmed section.
- Deliver separate Chinese and English video assets; never mix languages in one video.
- Duration is exactly 20 seconds; playback is muted, inline, autoplay, and loop.
- Under `prefers-reduced-motion: reduce`, do not autoplay and show the poster.
- AI is not presented as producing a final diagnosis or authorizing field action.
- Do not claim guaranteed orders, guaranteed cost savings, universal brand authorization, nationwide local stock, or statutory industry certification.
- Target each primary video asset at 3 MB or less, with 5 MB as the hard ceiling; target each poster below 250 KB.
- Do not add a paid video service or ship animation-rendering dependencies to site visitors.
- The approved Chinese copy source is `.Codex/memory/工程师端首页文案确认表.md`.
- Do not push or deploy until the user reviews the browser animation preview and then approves the integrated page.

## File Structure

- Create `tools/engineer-video/index.html`: standalone reviewer preview with locale, play, pause, replay, and timeline controls.
- Create `tools/engineer-video/engineer-service-animation.js`: shared 20-second scene data and deterministic SVG/HTML frame renderer.
- Create `tools/engineer-video/styles.css`: preview and 16:9 animation-stage styling.
- Create `tools/engineer-video/render.mjs`: SVG-frame generation and FFmpeg export orchestration for both locales.
- Create `frontend/public/media/engineer-service-flywheel-{cn,en}.{webm,mp4}`: final localized video files.
- Create `frontend/public/media/engineer-service-flywheel-{cn,en}-poster.webp`: localized poster images.
- Create `frontend/src/components/Engineer/EngineerOverviewVideo.jsx`: locale-aware playback, reduced-motion, and failure fallback.
- Modify `frontend/src/components/Engineer/EngineerRecruitingPage.jsx`: implement the confirmed copy structure and add the independent overview-video section.
- Create `frontend/tests/engineer-overview-video-contract.test.mjs`: video integration, localization, fallback, and asset contracts.
- Modify `frontend/tests/brand-assets-contract.test.mjs`: update engineer-page copy contracts to the confirmed bilingual narrative.
- Modify `frontend/tests/cn-primary-ui-language-contract.test.mjs`: update Chinese recruiting-page contracts to the confirmed natural business copy.

---

### Task 1: Build The Reviewable Bilingual Animation Preview

**Files:**
- Create: `tools/engineer-video/index.html`
- Create: `tools/engineer-video/engineer-service-animation.js`
- Create: `tools/engineer-video/styles.css`

**Interfaces:**
- Produces: exported `DURATION_MS`, `LOCALES`, `renderSvg(locale, timeMs)`, and `renderFrame(stage, locale, timeMs)` functions.
- Produces: query parameters `?locale=cn|en&render=0|1&time=<milliseconds>` for human review and deterministic browser screenshots.

- [ ] **Step 1: Define the six-scene localized timeline in `engineer-service-animation.js`**

Use one data structure with the approved Chinese and English text:

```js
export const DURATION_MS = 20000;

export const COPY = {
  cn: [
    '客户需求进入系统',
    'AI 咨询接待 · 任务整理',
    '运营协调 · 匹配资源',
    '工程师确认 · 解决问题',
    '服务数据沉淀 · AI 持续学习',
    '知识技能 · 供应链 · 品牌获客 · 工程师培训',
  ],
  en: [
    'Service requests enter the workflow',
    'AI intake · Structured work orders',
    'Operations coordination · Resource matching',
    'Engineer confirmation · Problem resolution',
    'Service data captured · Continuous AI learning',
    'Knowledge · Supply chain · Shared marketing · Engineer training',
  ],
};
```

Add the localized final lockups exactly as approved in the design spec. Compute all animation state from `timeMs`; do not use random values or CSS animations that cannot be frozen for frame generation.

- [ ] **Step 2: Implement the 16:9 stage and the six visual transitions**

Use a 1920x1080 logical canvas rendered with HTML and inline SVG. Build a left-to-right flow for scenes 1-5 and transform the returned service record into a circular knowledge flywheel for scene 6. Keep all text within an 80% central safe area and use the supplied `/sagemro-logo.png` only for the final lockup.

- [ ] **Step 3: Add review controls in `index.html`**

Provide a compact toolbar outside the capture stage with:

```html
<button data-action="locale-cn">中文</button>
<button data-action="locale-en">English</button>
<button data-action="play">Play</button>
<button data-action="pause">Pause</button>
<button data-action="replay">Replay</button>
<input data-action="seek" type="range" min="0" max="20000" step="50">
```

The `render=1` query parameter hides controls and renders only the exact 16:9 stage for export.

- [ ] **Step 4: Start a local preview server**

Run:

```bash
cd /Users/joe/Projects/sagemro.com/.worktrees/engineer-entry-links-cn
python3 -m http.server 4180
```

Expected: preview opens at `http://localhost:4180/tools/engineer-video/?locale=cn` and locale switching changes all visible text.

- [ ] **Step 5: Verify the preview in a real browser**

Run Playwright CLI screenshots at `time=0`, `time=5000`, `time=10000`, and `time=14500` for both locales. Save review artifacts under `output/playwright/engineer-video-preview/` and confirm no text is clipped at 1280x720 or a 390px-wide viewport.

- [ ] **Step 6: User preview checkpoint**

Give the user the local preview URL. Stop before Task 2 until the user approves animation direction, text, timing, and visual hierarchy.

- [ ] **Step 7: Commit the approved preview source**

```bash
git add tools/engineer-video
git commit -m "feat(video): add bilingual engineer workflow preview"
```

Expected: only deterministic preview source is committed; review screenshots remain untracked.

---

### Task 2: Render And Verify Localized Media Assets

**Files:**
- Create: `tools/engineer-video/render.mjs`
- Create: `frontend/public/media/engineer-service-flywheel-cn.webm`
- Create: `frontend/public/media/engineer-service-flywheel-cn.mp4`
- Create: `frontend/public/media/engineer-service-flywheel-cn-poster.webp`
- Create: `frontend/public/media/engineer-service-flywheel-en.webm`
- Create: `frontend/public/media/engineer-service-flywheel-en.mp4`
- Create: `frontend/public/media/engineer-service-flywheel-en-poster.webp`

**Interfaces:**
- Consumes: `renderSvg(locale, timeMs)` from Task 1.
- Produces: six stable public media paths used by `EngineerOverviewVideo`.

- [ ] **Step 1: Implement deterministic SVG frame generation**

In `render.mjs`, generate 480 SVG frames per locale at 24 fps from the 20-second timeline. Import the same `renderSvg(locale, timeMs)` function used by the browser preview and write temporary SVG frames outside `frontend/public`.

The frame timing must be:

```js
const timeMs = (frameIndex / 24) * 1000;
const svg = renderSvg(locale, timeMs);
```

- [ ] **Step 2: Encode MP4 and WebM with FFmpeg**

Use these codec families and pixel format:

```bash
ffmpeg -framerate 24 -i frame-%04d.svg -c:v libx264 -pix_fmt yuv420p -movflags +faststart output.mp4
ffmpeg -framerate 24 -i frame-%04d.svg -c:v libvpx-vp9 -pix_fmt yuv420p -b:v 0 -crf 34 output.webm
```

Tune CRF only if needed to satisfy the visual-quality and 5 MB hard ceiling.

- [ ] **Step 3: Export localized poster images**

Capture the final flywheel composition without motion blur and encode WebP posters at the same aspect ratio. The poster must show the workflow and final localized lockup rather than a blank opening frame.

- [ ] **Step 4: Verify duration, dimensions, and file sizes**

Run:

```bash
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 frontend/public/media/engineer-service-flywheel-cn.mp4
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 frontend/public/media/engineer-service-flywheel-en.mp4
find frontend/public/media -type f -maxdepth 1 -print0 | xargs -0 ls -lh
```

Expected: both durations report approximately `20.000000`; each video is below 5 MB and each poster is below 250 KB.

- [ ] **Step 5: Inspect representative frames and posters**

Use `ffmpeg` to extract frames near 2.0s, 6.0s, 9.0s, 12.0s, and 14.5s for both languages. Inspect them for clipped text, unsafe imagery, mixed languages, incorrect brand mark, and unsupported claims.

- [ ] **Step 6: Commit the renderer and approved assets**

```bash
git add tools/engineer-video/render.mjs frontend/public/media
git commit -m "feat(video): render bilingual engineer overview assets"
```

---

### Task 3: Add Locale-Aware Video Playback With Fallbacks

**Files:**
- Create: `frontend/tests/engineer-overview-video-contract.test.mjs`
- Create: `frontend/src/components/Engineer/EngineerOverviewVideo.jsx`

**Interfaces:**
- Produces: `EngineerOverviewVideo({ locale })` where `locale` is `'cn'` or `'en'`.
- Consumes: the six `/media/engineer-service-flywheel-*` paths from Task 2.

- [ ] **Step 1: Write the failing component contract tests**

Assert that the new component contains:

```js
assert.match(source, /prefers-reduced-motion: reduce/);
assert.match(source, /muted/);
assert.match(source, /playsInline/);
assert.match(source, /autoPlay=\{!reduceMotion\}/);
assert.match(source, /loop/);
assert.match(source, /preload="metadata"/);
assert.match(source, /engineer-service-flywheel-cn\.webm/);
assert.match(source, /engineer-service-flywheel-en\.webm/);
assert.match(source, /onError/);
```

Also assert all six public assets exist and are non-empty.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
cd frontend
node --test tests/engineer-overview-video-contract.test.mjs
```

Expected: FAIL because `EngineerOverviewVideo.jsx` does not exist.

- [ ] **Step 3: Implement `EngineerOverviewVideo`**

Use `window.matchMedia('(prefers-reduced-motion: reduce)')` in an effect, track source failure, and render the poster-only fallback when reduced motion is active or both sources fail. The video must have an empty `aria-label` and `aria-hidden="true"` because equivalent textual meaning remains in the page.

- [ ] **Step 4: Run the focused test and verify GREEN**

```bash
cd frontend
node --test tests/engineer-overview-video-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit the playback component**

```bash
git add frontend/src/components/Engineer/EngineerOverviewVideo.jsx frontend/tests/engineer-overview-video-contract.test.mjs
git commit -m "feat(frontend): add localized engineer overview video"
```

---

### Task 4: Implement The Confirmed Page Structure And Add The Video

**Files:**
- Modify: `frontend/src/components/Engineer/EngineerRecruitingPage.jsx`
- Modify: `frontend/tests/brand-assets-contract.test.mjs`
- Modify: `frontend/tests/cn-primary-ui-language-contract.test.mjs`
- Modify: `frontend/tests/engineer-overview-video-contract.test.mjs`

**Interfaces:**
- Consumes: `EngineerOverviewVideo({ locale })` from Task 3.
- Preserves: `submitEngineerApplication`, `onOpenLogin`, locale hostname selection, application modal, and customer-home links.

- [ ] **Step 1: Update contract tests to the confirmed Chinese page copy and structure**

Add assertions for these confirmed Chinese anchors:

```text
设备维保最佳方案：AI知识飞轮+工程师技能实践。
咨询接待，任务整理
确认方案，解决问题
协调流程，沉淀记录
一个越来越懂客户的AI，让技术服务更高效
专注于技术服务
减少反复沟通，避免无效上门
知识技能持续进化，服务能力无限增长
从单打独斗，到共享规模化能力
共享更有竞争力的供应链
共享品牌和市场获客能力
共享持续进阶的工程师培训
逐步建立可信的工程师能力标准
```

Add English semantic equivalents to `brand-assets-contract.test.mjs`, including `AI knowledge flywheel`, `engineer expertise`, `shared supply chain`, `shared marketing`, and `engineer training`.

Assert that `EngineerRecruitingPage.jsx` imports and renders `<EngineerOverviewVideo locale={locale} />` after the complete hero and before detailed expandable content.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
cd frontend
node --test tests/engineer-overview-video-contract.test.mjs tests/brand-assets-contract.test.mjs tests/cn-primary-ui-language-contract.test.mjs
```

Expected: FAIL on missing confirmed copy and missing overview-video integration.

- [ ] **Step 3: Replace the outdated recruiting-page copy object with the confirmed bilingual structure**

Map C-03 through C-43 from the confirmation document into clear `cn` copy fields. Write natural English equivalents that preserve the same claim boundaries; do not mechanically translate Chinese sentence order where it reads unnaturally.

Retain these safety statements:

```text
内容为AI 生成，仅供参考。
AI 不能替代人工对安全问题的判断。现场人员应注意先停机并确认风险已隔离后，再判断下一步。
```

Keep the FAQ answer that AI analysis is reference-only and cannot replace engineer confirmation.

- [ ] **Step 4: Implement the approved information hierarchy**

Build the page in this order:

1. Existing brand navigation and primary application action.
2. Complete hero with the three-party flow: AI system, engineer, operations management.
3. Independent `20 秒了解协作模式` / `The model in 20 seconds` video section.
4. Three core benefits.
5. Safety boundary.
6. Detailed problem, eight-step service process, reusable team capability, and shared scale capabilities.
7. Cooperation model, engineer criteria, regional lead, application process, FAQ, and final call to action.
8. Existing application modal.

Use full-width sections and restrained 8px-or-less repeated cards. Do not place cards inside cards. Detailed sections may use native `<details>` elements where the confirmation document marks content as expandable.

- [ ] **Step 5: Run focused tests and verify GREEN**

```bash
cd frontend
node --test tests/engineer-overview-video-contract.test.mjs tests/brand-assets-contract.test.mjs tests/cn-primary-ui-language-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Run frontend lint and full tests**

```bash
cd frontend
npm run lint
npm test
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit the confirmed page integration**

```bash
git add frontend/src/components/Engineer/EngineerRecruitingPage.jsx frontend/tests/brand-assets-contract.test.mjs frontend/tests/cn-primary-ui-language-contract.test.mjs frontend/tests/engineer-overview-video-contract.test.mjs
git commit -m "feat(frontend): add engineer flywheel story and video"
```

---

### Task 5: Build And Perform Visual Verification

**Files:**
- Verify: `frontend/src/components/Engineer/EngineerRecruitingPage.jsx`
- Verify: `frontend/src/components/Engineer/EngineerOverviewVideo.jsx`
- Verify: `frontend/public/media/*`

**Interfaces:**
- Consumes: completed Tasks 1-4.
- Produces: desktop/mobile review screenshots and final verification evidence.

- [ ] **Step 1: Build the production frontend**

```bash
cd frontend
npm run build
```

Expected: Vite build exits 0 and `dist/media/` contains both language editions.

- [ ] **Step 2: Start the local Vite server**

```bash
cd frontend
npm run dev -- --host 0.0.0.0 --port 4173
```

Expected: local site is available at `http://localhost:4173/`.

- [ ] **Step 3: Verify both locale hosts in Playwright**

Use host mapping or Playwright request routing so the same local server is viewed as `engineer.sagemro.cn` and `engineer.sagemro.com`. Capture:

- Chinese desktop at 1440x1000.
- Chinese mobile at 390x844.
- English desktop at 1440x1000.
- English mobile at 390x844.

Expected: each host loads only its own localized video and text; no text overlaps, clips, or pushes controls outside their containers.

- [ ] **Step 4: Verify actual video playback and canvas pixels**

At 1s, 6s, 11s, and 14s, verify `video.currentTime` advances and screenshots contain nonblank, changing video pixels. Confirm the frame stays completely visible with `object-fit: contain`.

- [ ] **Step 5: Verify reduced-motion and media failure fallbacks**

Emulate reduced motion and confirm no autoplay occurs and the localized poster remains visible. Block both video URLs and confirm the page, login action, application action, and detailed content still work without console errors.

- [ ] **Step 6: Run the full repository CI-equivalent checks**

Run:

```bash
cd /Users/joe/Projects/sagemro.com/.worktrees/engineer-entry-links-cn/worker
npm test

cd /Users/joe/Projects/sagemro.com/.worktrees/engineer-entry-links-cn/frontend
npm run lint
npm test
npm run build

cd /Users/joe/Projects/sagemro.com/.worktrees/engineer-entry-links-cn/admin
npm run build
```

Expected: every command exits 0 before any push.

- [ ] **Step 7: User integrated-page checkpoint**

Give the user the local Chinese and English review URLs and the key desktop/mobile screenshots. Stop before push or deployment until the user explicitly approves.

- [ ] **Step 8: Commit any verification-driven corrections**

If visual verification requires changes, rerun the focused tests, lint, full tests, and build, then commit only those corrections:

```bash
git add tools/engineer-video frontend/public/media frontend/src/components/Engineer/EngineerOverviewVideo.jsx frontend/src/components/Engineer/EngineerRecruitingPage.jsx frontend/tests/engineer-overview-video-contract.test.mjs frontend/tests/brand-assets-contract.test.mjs frontend/tests/cn-primary-ui-language-contract.test.mjs
git commit -m "fix(frontend): polish engineer video presentation"
```

---

### Task 6: Synchronize Branches, Push, And Deploy After Approval

**Files:**
- No new source files unless conflict resolution is required.

**Interfaces:**
- Consumes: user-approved, fully verified commits on `china-edition`.
- Produces: matching international `main` and Chinese `china-edition` production releases.

- [ ] **Step 1: Confirm clean task diff and commit list**

Run `git status --short`, `git log --oneline origin/china-edition..HEAD`, and inspect every changed file. Ignore the pre-existing untracked `.superpowers/` review directory.

- [ ] **Step 2: Push `china-edition`**

```bash
git push origin china-edition
```

Expected: remote branch advances to the verified commit.

- [ ] **Step 3: Apply the same feature commits to `main`**

Cherry-pick the design, preview, media, component, and page-integration commits into `/Users/joe/Projects/sagemro.com/.worktrees/beta-readiness-main`. Resolve copy-contract conflicts by preserving each branch's approved locale behavior, rerun the full CI-equivalent checks, then push `main`.

- [ ] **Step 4: Verify the automatic Cloudflare deployments**

Watch the latest `deploy.yml` runs for `main` and `china-edition`. Expected: test and relevant deployment jobs succeed.

- [ ] **Step 5: Trigger the Chinese ECS production deployment**

```bash
gh workflow run aliyun-cn-deploy.yml --ref china-edition
run_id=$(gh run list --workflow aliyun-cn-deploy.yml --branch china-edition --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$run_id" --exit-status
```

Expected: the Aliyun ECS workflow and smoke checks succeed.

- [ ] **Step 6: Perform production smoke checks**

Confirm `engineer.sagemro.cn` serves the Chinese video and `engineer.sagemro.com` serves the English video. Confirm both application actions, engineer login actions, posters, video loops, and detailed confirmed copy remain available.
