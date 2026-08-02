# C-Lite 折弯模拟器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 SAGEMRO 现有行业工具体系中上线 `/tools/bend-simulator`，让访客输入材料、厚度、板宽、机床能力和多段折弯轮廓后，立即得到可解释的模具/工艺建议、吨位风险和可播放的 2D/伪 3D 动画，并能在需要工程师复核时提交带结构化上下文的公开线索。

**Architecture:** 浏览器端采用纯函数确定性计算引擎，2D 轮廓是唯一权威几何；SVG 负责 2D 展开/成形和轻量伪 3D 预览，时间轴驱动同一组确定性帧。页面作为现有 `IndustryToolsPage` 的专用工具分支接入，沿用 SAGEMRO 现有 tokens 和中英文 SEO。访客无需登录即可模拟；保存/分享在本期不落库，工程师复核使用新的公开 Worker 端点写入现有 `leads` 表。匿名漏斗事件复用现有 `funnel_events` 表和净化机制，不新增模型 API、Three.js、DXF/PDF 或 D1 migration。

**Tech Stack:** React 19, Vite, Tailwind utility classes, SVG, existing SAGEMRO CSS variables, Cloudflare Worker, D1, Node `node:test`.

## Global Constraints

- 结果必须标注“规划估算/需工程确认”，不能表述为生产级 CAD/CAM、碰撞检查或最终下料数据。
- 2D 轮廓与长度/角度/圆角的计算必须由纯函数产生；渲染组件不得自行复制计算公式。
- C-Lite 不调用多模态模型；未来 AI 解释必须经 Worker 代理并在后续阶段单独评审。
- 使用 `frontend/src/styles/tokens.css`、`frontend/src/index.css` 的 SAGEMRO 色板：琥珀色主色，白/浅灰表面，深炭色工作区；绿色仅表示通过，红色表示风险，避免竞品绿色主视觉。
- 不修改 `wrangler.toml`、Pages 项目名或部署 workflow；不把 API secret 写入代码。
- 不新增 D1 表；公开复核线索复用现有 `leads` 字段，并把详细仿真上下文限制在净化后的 `message`/`ai_summary` 文本中。

---

## Task 1: 建立可复用的折弯目录与确定性计算引擎

**Files:**

- Create `frontend/src/data/bendSimulatorCatalog.js`
- Create `frontend/src/utils/bendSimulationEngine.js`
- Modify `frontend/src/data/industryTools.js`
- Create `frontend/tests/bend-simulation-engine.test.mjs`
- Modify `frontend/tests/industry-tools-calculations.test.mjs` only where existing press-brake expectations must be preserved

- [ ] **Step 1: Write failing engine tests.** Cover metric and imperial normalization, one-segment and multi-segment profiles, bend order, material/thickness/radius effects, V-opening/tool matching, required tonnage and machine margin, short-edge and overload warnings, and monotonic animation frames. Use `node:test`/`assert/strict` and assert exact output keys plus representative numeric tolerances.

- [ ] **Step 2: Define the public engine interface.** Export:

  ```js
  normalizeBendSimulationInput(input) -> NormalizedBendInput
  calculateBendSimulation(input) -> BendSimulationResult
  estimateAirBendTonnage({ thicknessMm, bendLengthMm, vDieMm, materialFactor, safetyFactor }) -> { requiredTons, withSafetyTons }
  ```

  `NormalizedBendInput` contains `unitSystem`, `material`, `thicknessMm`, `sheetWidthMm`, `machine`, ordered `segments`, `upperTool`, and `lowerTool`. Each segment is `{ lengthMm, angleDeg, insideRadiusMm, order }`.

- [ ] **Step 3: Implement normalization and guards.** Convert inches to millimeters when `unitSystem === 'imperial'`, clamp/round display values only at the presentation boundary, reject non-positive thickness/length/width, normalize bend angles to `0..180`, and sort segments by `order`. Use generic material factors and generic V-die/tool records from `bendSimulatorCatalog.js`; do not add brand-specific claims.

- [ ] **Step 4: Implement the planning formulas.** Reuse the current air-bending basis from `industryTools.js` (`575 * t² * length / V`, material factor, safety factor) through the exported helper; calculate per-bend allowance/flat length using K-factor and inside radius; derive 2D flat/form points; create a deterministic frame sequence with one frame per bend plus start/end frames; compute recommended upper/lower tools, V match, margin, and warnings (`short_edge`, `tool_mismatch`, `machine_overload`, `tight_radius`, `review_required`).

- [ ] **Step 5: Refactor the existing tonnage calculator to use the shared helper without changing its visible output.** Keep its current localized labels, rows, and planning disclaimer intact.

- [ ] **Step 6: Run focused tests and confirm failure-to-pass transition.** Command: `npm test -- --test-name-pattern="bend|press brake"` from `frontend/`. Expected final output: all matching tests pass with zero failures.

## Task 2: Register the tool and preserve the existing tools hub/SEO contract

**Files:**

- Modify `frontend/src/data/industryTools.js`
- Modify `frontend/src/components/Tools/IndustryToolsPage.jsx`
- Modify `frontend/tests/industry-tools-calculations.test.mjs`
- Modify `frontend/tests/brand-assets-contract.test.mjs` only if the existing tool-card contract asserts the exact list

- [ ] **Step 1: Add the `bend-simulator` catalog entry.** Add slug `/tools/bend-simulator`, English and Chinese labels/descriptions, SEO title/description, FAQs, and the lead action. Add its icon mapping in `IndustryToolsPage.jsx` while retaining all existing tool IDs and ordering unless the test requires the new card at the end.

- [ ] **Step 2: Add a dedicated-page branch.** In `IndustryToolsPage`, when `selectedTool.id === 'bend-simulator'`, render `BendSimulatorPage` instead of the generic calculator detail; keep generic `ToolDetail` behavior unchanged for all other slugs.

- [ ] **Step 3: Add route/SEO tests.** Assert `/tools/bend-simulator` resolves to the new tool, `/tools` still renders the hub, and localized metadata uses `https://sagemro.com/tools/bend-simulator` or `https://sagemro.cn/tools/bend-simulator` according to host. Update any exact-count assertion from 9 to 10 tools.

- [ ] **Step 4: Run the focused frontend contract tests.** Command: `npm test -- --test-name-pattern="industry tools|brand assets"` from `frontend/`. Expected final output: all matching tests pass.

## Task 3: Build the interactive profile editor and timeline controls

**Files:**

- Create `frontend/src/components/Tools/BendProfileEditor.jsx`
- Create `frontend/src/components/Tools/BendSimulationTimeline.jsx`
- Create `frontend/tests/bend-simulator-editor.test.mjs`

- [ ] **Step 1: Write component tests for controlled state.** Verify adding/removing/reordering segments, editing length/angle/radius, unit labels, material/thickness/width/machine fields, invalid values, and mobile-safe vertical layout markers. Verify editor emits the normalized shape expected by `calculateBendSimulation` rather than display-only strings.

- [ ] **Step 2: Implement `BendProfileEditor`.** Props: `{ value, catalog, locale, onChange, onRequestReview }`. Render global inputs followed by a multi-segment list with keyboard-accessible add/remove/reorder controls. Show inline warnings from the latest result without embedding calculation logic.

- [ ] **Step 3: Implement `BendSimulationTimeline`.** Props: `{ frames, activeFrame, playing, onFrameChange, onTogglePlay, onStep }`. Provide play/pause, previous/next, a range slider, bend labels, and a clear “规划动画” label. Keep animation state deterministic and pause when inputs change.

- [ ] **Step 4: Run component tests.** Command: `npm test -- --test-name-pattern="bend simulator editor"` from `frontend/`. Expected final output: all matching tests pass.

## Task 4: Render synchronized 2D and lightweight 3D views

**Files:**

- Create `frontend/src/components/Tools/BendSimulationViewport.jsx`
- Create `frontend/src/utils/bendSimulationRenderer.js`
- Create `frontend/tests/bend-simulation-viewport.test.mjs`

- [ ] **Step 1: Write renderer tests.** Given one engine result and two frame indexes, assert the 2D SVG path points change with the active frame, the pseudo-3D projection uses the same frame geometry, tool labels remain synchronized, and an empty/invalid result renders an explanatory empty state.

- [ ] **Step 2: Implement pure renderer helpers.** Export `buildFlatPath`, `buildFormedPath`, `buildToolGeometry`, and `buildPseudo3DProjection`; accept engine output only. Use SVG path/polyline primitives and a small extrusion offset for pseudo-3D—do not add a 3D library in C-Lite.

- [ ] **Step 3: Implement `BendSimulationViewport`.** Props: `{ result, activeFrame, viewMode, onViewModeChange, locale }`. Provide 2D/3D toggle, fit/reset control, machine/tool labels, material sheet, and accessible text describing the active bend. Keep neutral steel/blue tool colors and SAGEMRO amber interaction states.

- [ ] **Step 4: Run viewport tests.** Command: `npm test -- --test-name-pattern="bend simulation viewport"` from `frontend/`. Expected final output: all matching tests pass.

## Task 5: Assemble the page, results, disclaimers, and lead CTA

**Files:**

- Create `frontend/src/components/Tools/BendResultPanel.jsx`
- Create `frontend/src/components/Tools/BendSimulatorPage.jsx`
- Create `frontend/tests/bend-simulator-page.test.mjs`
- Modify `frontend/src/services/api.js`

- [ ] **Step 1: Write page-level tests.** Verify the three-column desktop structure and mobile order (editor → viewport/timeline → result), live recalculation after input changes, 2D/3D/timeline synchronization, result fields (upper die, V-die, tonnage, margin, warnings), planning disclaimer, and guest-visible engineer-review CTA.

- [ ] **Step 2: Implement `BendResultPanel`.** Props: `{ result, locale, onRequestReview }`. Present recommendation first, then tool match, tonnage/margin, bend allowance/flat length, warnings, and an explicit “规划估算，生产前需工程复核” note. Use green/amber/red status semantics from existing tokens.

- [ ] **Step 3: Implement `BendSimulatorPage`.** Own the normalized input, engine result, active frame, play state, view mode, and review modal state. Track `bend_simulator_started`, `bend_simulator_segment_adjusted`, and `bend_simulator_completed` through `trackFunnelEvent` with only allowlisted non-PII properties. Render the responsive shell and pass controlled props to the four child components.

- [ ] **Step 4: Add public API helpers.** In `api.js`, add the three event names to `FUNNEL_EVENT_NAMES` and export `submitBendSimulationReview({ contact, simulation })`, posting to `/api/leads/bend-simulation` with `authHeaders()` only when available. Do not send uploaded files, freeform drawings, or secrets.

- [ ] **Step 5: Run page tests.** Command: `npm test -- --test-name-pattern="bend simulator page"` from `frontend/`. Expected final output: all matching tests pass.

## Task 6: Add sanitized funnel events and a public engineer-review lead endpoint

**Files:**

- Modify `worker/src/index.js`
- Create `worker/tests/bend-simulation-lead.test.mjs`
- Modify `frontend/src/services/api.js` tests if a service test harness exists; otherwise cover the payload contract in the page test

- [ ] **Step 1: Write failing Worker tests.** Cover accepted `POST /api/leads/bend-simulation` with name plus email/phone, rejected missing contact, rejected oversized/invalid segment context, no authentication requirement, `source='bend_simulator'`, `source_type='bend_simulation_review'`, and insertion into the existing `leads` schema. Also cover the three new funnel event names and property sanitization.

- [ ] **Step 2: Implement `handleSubmitBendSimulationReview`.** Parse and validate contact fields, accept only a bounded allowlist of structured fields (`unit_system`, material key, thickness, sheet width, machine capacity/work length, segment count, bend angles, selected tool IDs, result status), redact/omit PII from simulation properties, and serialize a concise review summary into existing `message` and `ai_summary` columns. Set `recommended_next_step` to an engineer follow-up instruction. Return `201` with the created lead ID.

- [ ] **Step 3: Register the route before the auth guard.** Add `POST /api/leads/bend-simulation` beside the existing public `/api/leads` route. Extend `FUNNEL_EVENTS` and `FUNNEL_PROPERTY_ALLOWLIST` only with the new simulator names/keys; preserve rejection of unknown events.

- [ ] **Step 4: Run Worker tests.** Command: `npm run test:unit` from `worker/`. Expected final output: all unit tests, including analytics and bend lead tests, pass with zero failures.

## Task 7: Verify complete integration, accessibility, and production-safe boundaries

**Files:**

- Modify only the files above if verification exposes a defect
- Create `docs/superpowers/specs/2026-08-02-bend-simulator-c-lite-design.md` only if the approved spec is missing (it is already present and must not be duplicated)

- [ ] **Step 1: Run frontend lint, tests, and build.** Commands from `frontend/`: `npm run lint`, `npm test`, `npm run build`. Expected final output: each command exits 0; `dist/` is produced without warnings that block deployment.

- [ ] **Step 2: Run backend and admin verification.** Commands from repo root: `npm --prefix worker run test:unit`, `npm --prefix admin test`, `npm --prefix admin run build`. Expected final output: each command exits 0.

- [ ] **Step 3: Manually verify the route contract.** Start the frontend dev server, open `/tools` and `/tools/bend-simulator` on both host locales, resize to mobile width, run a two-bend example, play/step the timeline, trigger a risk warning, and submit a test review lead against a local/mock API. Confirm no model API request is made by the browser and no PII enters funnel properties.

- [ ] **Step 4: Review diff and document the handoff.** Confirm no changes to deployment configuration, no new secrets, no D1 migration, and all production-bound claims remain planning-only. Commit with a focused message such as `feat(tools): add C-Lite bend simulator` after tests pass.

## Execution Notes

Implement in the task order above. Each task is intentionally small enough for a separate commit or review checkpoint. After this plan is approved, use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`; do not mix implementation with plan review.
