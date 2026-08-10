# Private Route Noindex and D1 Migration Gate Design

## Goal

Prevent search engines from indexing SAGEMRO private workflow URLs without removing the public engineer recruitment entry, and prevent a Worker release when a required shared migration is missing from either production D1 database.

## Confirmed scope

- Keep the unauthenticated engineer recruitment homepage crawlable.
- Mark private route families such as `/work-orders/*`, `/activate`, `/activate/*`, and `/engineer/*` as `noindex, nofollow, noarchive, nosnippet, noimageindex`.
- Preserve the existing full noindex policy for both Admin sites.
- Add the currently omitted shared migrations `041_quote_execution_baseline`, `044_service_standard_progress`, and `045_service_guidance_cache` to the CN production migration gate.
- Make pull requests targeting both `main` and `china-edition` run `Test & Build Verify`, matching the new protection rule on both branches.
- Do not change application authorization, expose work-order data, introduce a new migration framework, or make the engineer recruitment homepage private.

## Approach

### International production

Cloudflare Pages will return an `X-Robots-Tag` header for the private route families through `frontend/public/_headers`. The existing React route metadata remains a second layer after hydration. Public root, service, tool, insight, and engineer recruitment pages keep their current index policy.

The public `robots.txt` must allow search crawlers to request these private URLs so they can observe the noindex response. Robots exclusion is not an access-control mechanism; authentication remains the security boundary. API and Admin path exclusions remain.

### China production

The existing version-controlled nginx performance/header map in `aliyun-cn-deploy.yml` will add the same `X-Robots-Tag` value when a SAGEMRO frontend or engineer host serves a private route. The existing host-wide Admin rule remains unchanged. The deploy health checks will assert that a private work-order URL has the header and the engineer recruitment root does not.

The China frontend `robots.txt` follows the same crawl-to-noindex policy. This change is made on `china-edition` as a focused port because that branch owns the current ECS/nginx deployment logic.

### Migration and branch gates

`deploy.yml` keeps its current explicit CN shared-migration allowlist and adds the three omitted versions. This is intentionally smaller and safer than inferring CN compatibility for every migration. Contract tests pin the complete required list.

The workflow pull-request trigger includes both protected production branches. Deploy jobs remain push-only, so adding the China PR test trigger cannot deploy production code.

## Verification

- Contract tests fail before implementation for missing private-route headers, missing CN nginx rules, missing migrations, and the absent China PR trigger.
- Frontend, E2E workflow-contract, Worker, and Admin test/build gates pass after the change.
- A main PR and a China PR each receive `Test & Build Verify` without deploying from the PR.
- After approved production deployments, `curl -I` confirms:
  - COM/CN `/work-orders/SEO-PRIVATE-CHECK` returns the full `X-Robots-Tag` value.
  - COM/CN engineer recruitment root does not return a noindex header.
  - COM/CN Admin root continues returning the full noindex header.
- Worker deployment refuses to continue if any required CN migration is absent.

## Rollback

- Revert the focused commits or PRs.
- China ECS activation retains its existing nginx configuration backup and rollback path.
- No database content or schema is changed by this work; the migration gate is read-only.
