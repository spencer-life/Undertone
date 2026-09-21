# CI and dependency automation

Undertone uses the repository CI contract `mise run ci`. The task installs the
frozen pnpm lockfile, checks JavaScript syntax, runs the Node test suite, builds
the production site. The WebGPU shader checks remain an explicit follow-up via
`pnpm check:orbit` when a runner has a usable portable adapter; they are kept out
of the generic CI contract so missing headless GPU support cannot turn into a
silent skip or an environment-dependent required check.

The two baseline workflows are local adaptations of
`spencer-life/github-workflows` at commit
`742d149b1e75ef50184861f984fcfe82dfe9d833`. They retain the shared baseline's
full SHA pins for checkout, mise-action, Gitleaks, actionlint, and zizmor. The
shared repository is private, so a public Undertone workflow cannot call its
reusable workflows directly.

Core CI and the security baseline run for pull requests targeting `main`, direct
pushes to `main` (including the initial publication), and manual dispatches.
Pull request runs use cancellable concurrency. Netlify's existing native Git
integration remains the deployment authority; GitHub Actions does not add a
second deploy hook or CLI deployment path.

`renovate.json` contains the public Renovate preset rules adapted from the same
source revision. The Mend Renovate GitHub App must still be installed with
access to `spencer-life/Undertone`; configuration alone does not enable it.
Renovate repository access was not verified during this setup and remains a
manual prerequisite.
