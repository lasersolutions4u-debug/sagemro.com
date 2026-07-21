# Engineer Homepage Hero Refresh Design

## Goal

Improve the engineer recruiting page's first-screen hierarchy by applying the approved A direction, "Industrial Editorial." Remove the standalone AI safety notice, turn the cooperation summary into a dark information band, and rebalance the hero so the main proposition leads while the three-step service model remains clear but secondary.

## Scope

- Modify the bilingual hero layout in `frontend/src/components/Engineer/EngineerRecruitingPage.jsx`.
- Remove the complete standalone safety notice section in both locales.
- Remove the now-unused safety copy fields and `ShieldCheck` import.
- Restyle the existing cooperation summary as a dark information band.
- Update contract tests that currently require the safety notice or old hero structure.
- Keep all existing routes, actions, application modal behavior, overview video, detailed sections, and localized content outside these areas unchanged.

## Visual Direction

The page should feel like a professional industrial service publication rather than a floating SaaS card. The approved direction uses restrained geometry, clear typographic hierarchy, and one strong dark information band.

### Color Tokens

- `Industrial black`: `#17110c` for the page header backdrop and cooperation band.
- `Warm black`: `#21160c` for the primary action and strong text.
- `Paper white`: `#ffffff` for the hero surface.
- `Canvas white`: `#fbfaf7` for the page background.
- `Signal amber`: `#f59e0b` for labels, dividers, and the primary accent.
- `Muted service text`: `#76695d` on light surfaces and translucent white on dark surfaces.

No decorative gradient, blurred color spot, curved background cutout, or oversized pill is introduced in the refreshed first screen.

## Hero Layout

### Desktop

Use one white editorial panel with an 8 px radius, a quiet border, and restrained shadow. Inside it, use a two-column grid:

- Left column: approximately 70% of the usable width. It contains the network label, headline, supporting paragraph, and the two existing actions.
- Right column: approximately 30% of the usable width. It contains the three existing `heroFlow` items as one compact vertical information rail.

The left column owns the visual hierarchy. The headline uses a smaller, controlled fixed desktop size than the current hero and a maximum readable width. Letter spacing remains zero. The paragraph remains visually subordinate and does not stretch across the full panel.

The right rail uses one vertical divider and three stacked rows. Each row retains the role, sequence number, title, and summary, but removes the individual card border, white card background, shadow, and connector arrow. Amber role labels and a narrow amber edge encode the workflow without competing with the headline.

### Mobile And Tablet

Below the desktop breakpoint, stack the narrative and workflow rail. The workflow rail moves below the actions, changes from a left divider to a top divider, and keeps three compact rows. Buttons remain full-width on small screens and their text does not wrap. No content may overflow horizontally at 390 px.

## Cooperation Information Band

Remove the standalone safety notice immediately above the cooperation summary. The cooperation summary becomes a single `#17110c` band placed where the existing summary currently appears.

The band contains:

- A small amber section heading using the existing localized `audienceTitle`.
- Three equal desktop columns using the existing `audienceItems`.
- Amber item labels, translucent white values, and subtle vertical dividers.

On mobile, the three items stack vertically and use horizontal dividers. The band should read as operational information, not as three floating cards.

## Content And Behavior

- Do not change the existing bilingual hero headline, supporting copy, flow copy, cooperation data, button labels, links, or click handlers.
- The safety notice and its human-review clarification are removed completely from this page as requested.
- Existing safety language elsewhere in the application, legal content, AI chat, and service workflows is out of scope and remains unchanged.
- The overview animation stays directly after the hero.
- The benefits section and all detailed expandable content retain their current order and behavior.

## Code Structure

Keep the work inside the existing `EngineerRecruitingPage` component. This is a presentation-only change and does not justify a new abstraction. Remove only imports and localized fields made unused by deleting the safety section.

## Verification

Add or update contract coverage to verify:

- The standalone safety section and `copy.safetyTitle` rendering are absent.
- The unused `safetyLabel`, `safetyTitle`, and `safetyText` fields are absent from the recruiting page.
- The hero uses the approved two-column editorial grid and compact workflow rail markers.
- The cooperation summary uses the dark-band classes and responsive three-column layout.
- Existing localized audience content and hero actions remain present.

Run frontend lint, all frontend tests, and the production build. Use Playwright against the production build for Chinese and English pages at desktop and 390 px mobile widths. Confirm no overlap, clipped text, horizontal overflow, or wrapped button labels, and visually inspect the hero and cooperation band before deployment.

## Deployment

Apply the shared component and common contract changes to both `china-edition` and `main`. Keep the China-only language contract on `china-edition`. After branch-specific verification, push both branches, wait for the Cloudflare workflows, manually trigger the China Aliyun ECS workflow, and verify both engineer production hosts.
