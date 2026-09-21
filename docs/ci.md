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

## Initial publication and hosting

Published source to public `spencer-life/Undertone` on `main`. Core CI run
[35643981346](https://github.com/spencer-life/Undertone/actions/runs/35643981346)
passed with 58 tests and the production build. The first push's Gitleaks action
attempted an invalid parent range for the root commit; a manual full-history
[security run](https://github.com/spencer-life/Undertone/actions/runs/35644120890)
then scanned all 14 commits and passed, along with actionlint and zizmor.
Normal subsequent pushes have a valid preceding commit.

Netlify site `024413a7-613e-4a9c-9240-02ef9be77984` now watches `main` using a
read-only GitHub deploy key and the provider's native repository webhook.
Branch deployment allowlist is `main`; no Actions deploy command or build hook
is installed. Netlify independently runs check/test/build before publishing.
GitHub status checks are not a Netlify deployment gate, and no branch protection
or unattended dependency merging was enabled by this setup.

First Git production deploy: `6ab1838bd59c46103a0b6129`, from `2a609d1`.
Live site: https://subtle-begonia-b38551.netlify.app/
Rollback baseline: `6ab1192844f2652114e323b5` (previous manual production deploy).
The core live scripts and service worker matched `dist/` byte-for-byte; all four
music files returned FLAC headers with HTTP 206 range responses. Developer tests,
package metadata and Git internals are excluded from the publish directory.
