# Engineer Homepage 20-Second Video Design

## Goal

Add a concise visual overview to the engineer-facing homepage so a local service team or independent engineer can understand the SAGEMRO cooperation model in about 20 seconds.

The video supplements the confirmed homepage copy. It does not replace or remove the hero copy, three-party workflow, benefits, service process, shared supply-chain, marketing, training, cooperation, application, safety, or FAQ content.

The deliverable includes both localized editions:

- Chinese video for `engineer.sagemro.cn`.
- English video for the international engineer page.

Both editions use the same approved animation structure and timing, with separately typeset text and separate exported media assets. Neither edition displays mixed-language captions.

## Source Of Truth

The Chinese wording and business model are derived from `.Codex/memory/工程师端首页文案确认表.md`.

The video summarizes these confirmed ideas:

- Customer and equipment-service needs enter one service workflow.
- AI conducts preliminary communication, fills information gaps, identifies risk boundaries, and prepares a structured work order.
- SAGEMRO operations coordinates regional and engineering resources.
- Engineers retain final technical judgment, quoting, risk assessment, and remote or field execution.
- Service outcomes return as structured records that improve the service knowledge base.
- Partners gradually share broader capabilities in supply chain, marketing, and engineer training.

## Chosen Direction

Use a deterministic programmatic brand animation instead of generated cinematic footage, an AI avatar, or a talking-head presentation.

This direction is preferred because the subject is a service workflow rather than a physical product demonstration. It keeps the industrial details, timing, wording, safety boundaries, and bilingual reuse under direct control without introducing a paid video-generation dependency.

## Page Placement

Place the video in a new unframed overview section after the complete hero and its primary call to action, before the detailed explanatory sections.

The section contains:

- A compact label such as `20 秒了解协作模式` outside the video.
- The video as the dominant visual element.
- No paragraph that repeats the animation text.
- Existing confirmed sections immediately below, unchanged in meaning and completeness.

The video must not become the hero background and must not push the application action out of the initial page experience.

## Storyboard

| Time | Visual action | Chinese text | English text |
| --- | --- | --- | --- |
| 0.0-3.3s | Equipment alarms, images, messages, and service needs enter from several directions and converge into the SAGEMRO workflow. | `客户需求进入系统` | `Service requests enter the workflow` |
| 3.3-6.7s | AI groups equipment details, symptoms, site conditions, risk signals, and history into a structured work order. | `AI 咨询接待 · 任务整理` | `AI intake · Structured work orders` |
| 6.7-10.0s | The work order passes through operations, which matches region, urgency, equipment type, and available service resources. | `运营协调 · 匹配资源` | `Operations coordination · Resource matching` |
| 10.0-13.3s | An engineer reviews the structured case, confirms materials, service mode, risk, and quote, then resolves the problem remotely or on site. | `工程师确认 · 解决问题` | `Engineer confirmation · Problem resolution` |
| 13.3-16.7s | Service data, material use, communication, and outcome flow back into structured knowledge. | `服务数据沉淀 · AI 持续学习` | `Service data captured · Continuous AI learning` |
| 16.7-20.0s | The knowledge flywheel becomes the center of a service network connected to four shared capabilities. | `知识技能 · 供应链 · 品牌获客 · 工程师培训` | `Knowledge · Supply chain · Shared marketing · Engineer training` |

Final lockup:

```text
AI 知识飞轮 + 工程师技能实践
让技术服务持续进化
```

English lockup:

```text
AI knowledge flywheel + engineer expertise
A service network that improves with every job
```

## Visual Language

- Use the existing SAGEMRO dark charcoal, warm amber, white, and restrained neutral palette.
- Use a clear left-to-right service flow for the first five scenes, then transition into a circular flywheel for the final scene.
- Use simple industrial symbols for equipment, alarm, message, work order, operations, engineer, service report, parts, marketing, and training.
- Keep symbols geometric and functional. Do not use a presenter, stock footage, decorative blobs, or an abstract technology montage.
- Keep the SAGEMRO brand mark visible but secondary during the flow, then make it part of the final lockup.
- Use short localized labels only. Full explanatory copy remains on the page below.
- Use purposeful motion: incoming requests, grouping, routing, confirmation, execution, return flow, and flywheel rotation. Avoid continuous decorative motion.

## Safety And Claim Boundaries

- The engineer scene explicitly says `最终确认`; the animation must not imply that AI produces a final diagnosis or authorizes field action.
- Do not show unsafe work on energized electrical, laser, hydraulic, pneumatic, or moving equipment.
- Do not claim guaranteed orders, guaranteed cost savings, universal brand authorization, nationwide local stock, or statutory industry certification.
- Present supply chain, marketing, and training as shared capabilities being built, not guaranteed benefits for every partner.
- The existing page safety notice remains the authoritative detailed disclaimer.

## Playback And Accessibility

- Duration: exactly 20 seconds.
- Playback: muted, inline, autoplay, and loop.
- User controls are not shown for the decorative overview video.
- Provide an informative poster image that represents the full workflow when video playback is unavailable.
- Under `prefers-reduced-motion: reduce`, do not autoplay. Show the poster instead.
- Preserve the poster when the browser blocks autoplay or a video source fails.
- The visual narrative must remain understandable without audio; no voiceover or music is required.
- All essential meaning remains available in the surrounding HTML copy, so the video is not the only source of information.

## Responsive Behavior

- Master composition: 16:9, designed at 1920x1080 and exported at a web-appropriate resolution.
- Desktop: display the full composition without cropping.
- Mobile: preserve the entire frame with `object-fit: contain`; do not crop text or workflow stages.
- Keep all on-screen text inside a central safe area so it remains readable when the video is displayed at approximately 350 CSS pixels wide.
- Use larger labels and fewer simultaneous elements on mobile-size verification. No viewport-based font scaling is used in the page UI.

## Production Pipeline

1. Build a standalone browser animation preview using deterministic HTML/CSS/JavaScript and the approved storyboard.
2. Review the preview timing, visual hierarchy, and exact screen text before export.
3. Render image frames from the approved preview and encode them locally with FFmpeg.
4. Export:
   - `frontend/public/media/engineer-service-flywheel-cn.webm`
   - `frontend/public/media/engineer-service-flywheel-cn.mp4`
   - `frontend/public/media/engineer-service-flywheel-cn-poster.webp`
   - `frontend/public/media/engineer-service-flywheel-en.webm`
   - `frontend/public/media/engineer-service-flywheel-en.mp4`
   - `frontend/public/media/engineer-service-flywheel-en-poster.webp`
5. Add a small React video section to the engineer recruiting page. Select the matching localized media by site locale, with WebM first, MP4 fallback, poster, muted inline looping playback, and reduced-motion handling.

The production source for the animation should be kept in a focused project directory so later wording or English localization can be rendered again without manually editing video frames.

## Performance Budget

- Prefer a 24 fps export unless motion testing shows a visible quality problem.
- Keep combined runtime loading to one selected video source; browsers do not download both source formats for playback.
- Target the primary video asset at 3 MB or less and treat 5 MB as the hard ceiling.
- Keep the poster below 250 KB where practical.
- Use metadata preload so the new media does not compete heavily with the hero and application controls during initial page load.

## Component Boundary

Use one focused page component for playback and fallback behavior. It receives localized section labels and media paths but does not contain the animation production code.

The animation source and export tooling remain separate from the production React runtime. No video-generation or rendering dependency is shipped to site visitors.

## Failure Handling

- If autoplay is blocked, retain the poster and allow the browser to start playback when possible without displaying an error message.
- If the WebM source is unsupported, fall back to MP4.
- If both video sources fail, retain the poster and the surrounding confirmed page content.
- A failed decorative video must not block the application form, engineer login, page navigation, or detailed content.

## Verification

- Confirm the animation duration is 20 seconds and loops without a visible blank frame.
- Confirm every approved Chinese and English on-screen phrase appears for sufficient reading time and no extra marketing claim is introduced.
- Confirm WebM, MP4, and poster assets load successfully from the production build.
- Confirm the Chinese site loads only Chinese media and the international site loads only English media.
- Confirm desktop and 390px mobile screenshots show the entire video without cropped text, overlap, or layout shift.
- Confirm reduced-motion mode shows the poster without autoplay.
- Confirm the existing confirmed page sections remain present after the video is added.
- Run frontend tests, lint, and build before deployment.

## Success Criteria

The new visual enables a viewer to understand this sequence without reading a paragraph:

`客户需求 -> AI 整理 -> 运营协调 -> 工程师确认执行 -> 服务知识回流 -> 共享规模化能力`

At the same time, the complete confirmed copy remains available on the page for serious partner discussions and due diligence.
