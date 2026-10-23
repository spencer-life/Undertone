import pathlib
import os
import subprocess
import sys
import tempfile
import unittest

from ci_scope import ALL, classify, scope


class ScopeTests(unittest.TestCase):
    def test_docs_and_review_evidence_do_not_start_app_runners(self):
        self.assertEqual(classify(["README.md", "docs/ci.md", "docs/review/screenshot.png"]), set())

    def test_shader_changes_keep_core_and_real_gpu_validation(self):
        for path in ["gpu/orbit.wgsl", "gpu/orbit.js", "vendor/energy-orbit.js", "tests/orbit-surface-probe.mjs"]:
            with self.subTest(path=path):
                self.assertEqual(classify([path]), {"ci", "vgpu"})

    def test_ui_and_toolchain_changes_get_full_coverage(self):
        for path in ["index.html", "layout.css", "app.js", "visuals.js", "orbit-bridge.js", "assets/brand/logo.png", "pnpm-lock.yaml", "mise.toml", "scripts/build-site.mjs"]:
            with self.subTest(path=path):
                self.assertEqual(classify([path]), ALL)

    def test_audio_and_unit_only_changes_avoid_unrelated_visual_work(self):
        self.assertEqual(classify(["audio.js", "assets/music/new.flac"]), {"ci", "e2e"})
        self.assertEqual(classify(["tests/dock-layout.test.js"]), {"ci"})

    def test_individual_harness_changes_only_run_their_coverage(self):
        self.assertEqual(classify(["scripts/e2e-ci.sh"]), {"e2e"})
        self.assertEqual(classify(["scripts/visual-review.sh"]), {"visual"})
        self.assertEqual(classify(["scripts/vgpu-ci.sh"]), {"ci", "vgpu"})

    def test_gate_workflow_and_unknown_changes_fail_safe(self):
        for path in [".github/scripts/ci_scope.py", ".github/workflows/ci-mise.yml", "unexpected/runtime.data"]:
            self.assertEqual(classify([path]), ALL)
        self.assertEqual(classify([".github/workflows/security-baseline.yml"]), set())
        self.assertEqual(scope("workflow_dispatch")[0], ALL)
        self.assertEqual(scope("unknown")[0], ALL)

    def test_merge_diff_is_cumulative_and_preserves_deleted_runtime_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            def git(*args):
                return subprocess.check_output(["git", *args], cwd=root, stderr=subprocess.DEVNULL)
            git("init", "-q", "-b", "main")
            git("config", "user.email", "ci-scope@example.invalid")
            git("config", "user.name", "CI scope test")
            (root / "app.js").write_text("base")
            git("add", "."); git("commit", "-qm", "base")
            git("checkout", "-qb", "feature")
            (root / "app.js").rename(root / "README.md")
            git("add", "-A"); git("commit", "-qm", "move runtime to docs")
            (root / "notes.md").write_text("latest commit is only docs")
            git("add", "."); git("commit", "-qm", "notes")
            git("checkout", "-q", "main")
            (root / "base-notes.md").write_text("base changes")
            git("add", "."); git("commit", "-qm", "base notes")
            git("merge", "--no-ff", "-qm", "PR merge", "feature")
            self.assertEqual(scope("pull_request", root)[0], ALL)
            git("checkout", "-q", "feature")
            self.assertEqual(scope("pull_request", root)[0], ALL, "head-only checkout must not skip from its docs-only last commit")

    def test_docs_only_merge_skips_app_checks_even_when_base_runtime_changed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            def git(*args):
                return subprocess.check_output(["git", *args], cwd=root, stderr=subprocess.DEVNULL)
            git("init", "-q", "-b", "main")
            git("config", "user.email", "ci-scope@example.invalid")
            git("config", "user.name", "CI scope test")
            (root / "app.js").write_text("base")
            git("add", "."); git("commit", "-qm", "base")
            git("checkout", "-qb", "docs")
            (root / "README.md").write_text("documentation only")
            git("add", "."); git("commit", "-qm", "docs")
            git("checkout", "-q", "main")
            (root / "app.js").write_text("unrelated base runtime change")
            git("add", "."); git("commit", "-qm", "base runtime")
            git("merge", "--no-ff", "-qm", "PR merge", "docs")
            output = root / "job-outputs"
            script = pathlib.Path(__file__).with_name("ci_scope.py").resolve()
            subprocess.check_output([sys.executable, str(script)], cwd=root, env={
                **os.environ, "GITHUB_EVENT_NAME": "pull_request", "GITHUB_OUTPUT": str(output)
            })
            self.assertEqual(output.read_text().splitlines(), [
                "ci=false", "e2e=false", "vgpu=false", "visual=false"
            ])


if __name__ == "__main__":
    unittest.main()
