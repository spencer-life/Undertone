# CI and dependency automation

Updated 2026-10-23 for scoped validation and the Energy Orbit / Event horizon integration.

## Commands

Run repository work through `mise`. `deps` restores the frozen pnpm lockfile and
checks direct imports; it never upgrades packages automatically. `lint` runs the
existing JavaScript syntax checks, not a full TypeScript or ESLint audit.
`build:gpu` resolves WGSL modules once per bundle build. `build` assembles the
runtime-only release directory. Standalone `pnpm test` builds the GPU bundles before `test:unit`, so a fresh
checkout has every precache asset. Mise `test` shares the `build:gpu` prerequisite
and calls `test:unit` directly to avoid a duplicate build. `ci` coordinates these dependencies;
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
software-renderer download; Visual Review caches its pinned browser binary.
E2E/GPU share an OS/architecture/version-keyed npm download cache for the pinned
agent-browser package (`~/.npm/_cacache`, excluding npm configuration and logs).
The QA harness is freshly installed with `--prefer-offline`; installed package
trees, test verdicts and screenshots are never restored as evidence. No node_modules, test verdicts or screenshots are
reused as evidence. Browser installation remains explicit; Linux system libraries
are not restored from a browser cache. Artifact retention is 14 days. Cache misses are expected on first use; GitHub’s
normal branch/PR cache-access rules still apply. After merge, a manual full run on
main can warm default-branch caches without adding automatic push runs.

App validation now uses one workflow with a small `changes` job and conditional
`ci`, `e2e`, and `visual` jobs; `vgpu` is retained for manual dispatch only. Security Baseline remains independent and
runs on every PR. Both workflows run only on PRs to main or manual dispatch;
there is no duplicate feature-branch push trigger or deployment workflow.
Superseded runs are cancelled together. Existing check job names are retained;
job-level conditions report irrelevant jobs as skipped rather than leaving a
path-filtered required workflow pending.

| PR changes | App checks |
| --- | --- |
| Documentation and archived review evidence only | None; scope tests and Security still run |
| Shader source, GPU runtime, generated GPU bundles | Core; GPU available manually |
| Audio code, local music, service worker or WebMCP | Core and browser E2E |
| Node unit tests only / lab source only | Core |
| One browser harness | Its affected check; GPU harness also retains Core |
| UI, shared visual clock/bridges, toolchain/build/deploy config | Core, E2E, Visual |
| Check-selection/workflow structure or unknown files | Core, E2E, Visual |
| Manual dispatch | All four, including GPU |
| Unavailable merge diff | Core, E2E, Visual |

The classifier reads the **complete PR merge diff** against its first parent,
including deleted/renamed paths. A docs-only follow-up commit on a PR that still
changes app code therefore retains full relevant coverage. It does not borrow a
passing result from an older commit or silently rely on the last push's paths.
Eight Python regression tests cover selection, cumulative diffs, runtime-to-docs
renames, manual events and missing merge history. A failed selector makes Core
fail; it cannot yield an all-green skipped suite.

Visual Review builds through the shared mise prerequisite once and captures 30
scene/theme/motion samples. The six duplicated responsive captures were removed;
E2E owns the 13-viewport screenshots and asserted geometry/a11y matrix. The pinned
Playwright 1.55.0 browser is cached by OS/architecture/version. Generated evidence
is always fresh, and uploaded E2E/GPU artifacts exclude installed QA harness
packages. No test verdict or screenshot cache is used.

The owner requested removing the unreliable hosted GPU check from automatic PR
runs. The `vgpu` job is now **manual-only** (`workflow_dispatch`); PRs explicitly
report it as skipped. Main has no required-check protection or rulesets configured,
and none were changed. Core, Security, E2E and Visual remain automatic when relevant.

The manual GPU script retains all shader/device/browser/lifecycle assertions and
the missing-only Vulkan/Mesa/display setup. During closeout, two attempts timed out
installing Mesa and refreshing apt indexes; omitting Mesa then failed the actual
Chrome `requestAdapter` preflight. These failures are recorded, not reported as
render successes. Earlier passing software CI and installed NVIDIA Chrome evidence
remain separate. Physical-device/listening/contrast limits still apply.

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
