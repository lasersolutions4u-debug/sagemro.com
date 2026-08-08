# Prerender First-Paint Design

## Problem

Public pages contain a crawlable `seo-static-shell` before React starts. The shell has no presentation contract, so browsers briefly paint browser-default text while the JavaScript entry and its dependencies load. Both public domains share this renderer, which is why the flash occurs on `sagemro.com` and `sagemro.cn`.

## Options Considered

1. **Brand the crawlable shell with small critical CSS — selected.** Keep the existing semantic text and links, but render them as an intentional SAGEMRO loading surface whose dimensions, colors, logo, and content cards approximate the real first screen. This removes the broken-looking paint without hiding content from crawlers.
2. Hide the shell until React starts. This is smaller, but produces a blank page and makes crawlable text visually hidden.
3. Server-render the complete React home page. This gives the closest match, but adds a rendering architecture and maintenance cost that is disproportionate to this issue.

## Design

`publicPageRenderer.mjs` will emit one inline `<style data-seo-shell-critical>` block alongside the existing static shell. The shell remains semantic and localized. It will show the approved robot logo, SAGEMRO label, localized headline and introduction, and compact resource cards on a neutral background. CSS is namespaced to `.seo-static-shell` and uses only system fonts, so it cannot alter the hydrated application.

The existing startup contract remains unchanged: `main.jsx` removes the prerendered children immediately before React renders. No timers, loading state, new dependencies, API calls, or page-copy changes are introduced.

## Success Criteria

- Generated English and Chinese public documents contain the critical shell style before the shell markup.
- The shell uses the approved `/sagemro-logo.png` asset and has an intentional full-viewport layout at desktop and mobile widths.
- Crawlable headings, paragraphs, resources, FAQs, and links remain in the HTML.
- No `display: none`, `visibility: hidden`, zero opacity, or delayed JavaScript removal is used.
- Existing SEO, frontend, admin, Worker, build, and E2E checks continue to pass.
- Cold loads of `sagemro.com` and `sagemro.cn` no longer show browser-default unstyled text.

## Scope

Only the public prerender renderer and its tests change. The React homepage, metadata, structured data, nginx, Cloudflare configuration, and admin application are out of scope.
