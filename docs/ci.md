# CI and dependency automation

Updated 2026-10-23 for scoped validation and the Energy Orbit / Event horizon integration.

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
software-renderer download; Visual Review caches its pinned browser binary. No node_modules, test verdicts or screenshots are
reused as evidence. Browser installation remains explicit; Linux system libraries
are not restored from a browser cache. Artifact retention is 14 days.

App validation now uses one workflow with a small `changes` job and conditional
`ci`, `e2e`, `visual`, and `vgpu` jobs. Security Baseline remains independent and
runs on every PR. Both workflows run only on PRs to main or manual dispatch;
there is no duplicate feature-branch push trigger or deployment workflow.
Superseded runs are cancelled together. Existing check job names are retained;
job-level conditions report irrelevant jobs as skipped rather than leaving a
path-filtered required workflow pending.

| PR changes | App checks |
| --- | --- |
| Documentation and archived review evidence only | None; scope tests and Security still run |
| Shader source, GPU runtime, generated GPU bundles | Core and GPU |
| Audio code, local music, service worker or WebMCP | Core and browser E2E |
| Node unit tests only / lab source only | Core |
| One browser harness | Its affected check; GPU harness also retains Core |
| UI, shared visual clock/bridges, toolchain/build/deploy config | All four |
| Check-selection/workflow structure or unknown files | All four |
| Manual dispatch or unavailable merge diff | All four |

The classifier reads the **complete PR merge diff** against its first parent,
including deleted/renamed paths. A docs-only follow-up commit on a PR that still
changes app code therefore retains full relevant coverage. It does not borrow a
passing result from an older commit or silently rely on the last push's paths.
Seven Python regression tests cover selection, cumulative diffs, runtime-to-docs
renames, manual events and missing merge history. A failed selector makes Core
fail; it cannot yield an all-green skipped suite.

Visual Review builds through the shared mise prerequisite once and captures 30
scene/theme/motion samples. The six duplicated responsive captures were removed;
E2E owns the 13-viewport screenshots and asserted geometry/a11y matrix. The pinned
Playwright 1.55.0 browser is cached by OS/architecture/version. Generated evidence
is always fresh, and uploaded E2E/GPU artifacts exclude installed QA harness
packages. No test verdict or screenshot cache is used.

GPU CI installs only absent Vulkan/Mesa/display packages, first using the runner's
existing package indexes. Network/setup calls and scene readiness are bounded and
name the failing stage. Software-adapter screenshots use Eco mode and a paused
scene clock, restoring motion between captures; Node pixel checks and real
hardware browser recordings supply separate motion evidence. Both scenes,
stillness, viewport resize and resource teardown remain required.

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
