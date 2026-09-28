# CI and dependency automation

Updated 2026-09-28 for the Energy Orbit / Event horizon integration.

## Commands

Run repository work through `mise`. `deps` restores the frozen pnpm lockfile and
checks direct imports; it never upgrades packages automatically. `lint` runs the
existing JavaScript syntax checks, not a full TypeScript or ESLint audit.
`build:gpu` resolves WGSL modules once per bundle build. `build` assembles the
runtime-only release directory. `test` requires generated GPU bundles because
the offline-cache tests check actual assets. `ci` coordinates these dependencies;
shared prerequisites run once within a mise invocation.

Manual `deps:outdated` and `deps:audit` report updates/advisories without changing
versions. Audit includes dev dependencies because vgpu is bundled into the browser.
The existing Renovate configuration remains the update policy; installation/access
of the Renovate app has not been verified in this pass.

## Shared workflow source and security

Baseline: `spencer-life/github-workflows/ROUTING.md`, `DEPLOYMENT-TRIGGERS.md`,
`ci-mise.yml`, `security-baseline.yml`, and `web-e2e.yml`. Existing baseline revision:
`742d149b1e75ef50184861f984fcfe82dfe9d833`. Checkout, mise, Gitleaks, actionlint and
zizmor pins match the catalog. The cache pin matches its cache template; this app
does not use Metro. Public Undertone keeps local adaptations because the shared
catalog is private. No changes to the catalog or official skills are needed.

Setup/cache steps remain inline: the catalog-pinned actionlint 1.7.12 does not yet
recognize GitHub's new `$/` self-repository actions, while current zizmor prefers
that syntax. Inline pinned provider actions satisfy both without disabling audits.

## Caches and triggers

Mise caches locked tools. The actual `pnpm store path` is exported by a mise task
and cached with OS/architecture/lockfile keys. GPU CI also caches the portable
software-renderer download. No node_modules, test verdicts or screenshots are
reused as evidence. Browser installation remains explicit; Linux system libraries
are not restored from a browser cache. Artifact retention is 14 days.

All five checks run on PRs to main and manual dispatch. Core and security also
retain main-push checks because direct-push restrictions were not verified.
Superseded PR runs are cancelled. No second feature-branch push trigger or second
deployment workflow is installed. Slow GPU initialization is tested with a bounded
readiness check, not an arbitrary screenshot delay. Current GPU integration tests
cover both scenes, actual shader compilation, still mode, viewport resize and teardown.

## Deployment boundary

Vercel's native Git integration owns `energy-orbit-lab` previews. The existing
Netlify main configuration remains untouched; GitHub Actions never runs a provider
CLI deployment or deploy hook. CI passing is distinct from a Vercel build succeeding
and from inspecting a rendered scene. Do not merge the temporary validation PR to
main as a side effect of preview work.

## Historical evidence

The original Netlify production setup and rollback baseline are documented in
README.md and the earlier deployment records. Those historical descriptions are
not proof that an Energy Orbit branch preview has been visually approved.
