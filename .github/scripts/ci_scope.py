"""Select relevant app checks from the complete PR merge diff, falling back to all checks."""
import os
from pathlib import PurePosixPath
import subprocess

ALL = frozenset({"ci", "e2e", "visual", "vgpu"})


def classify(paths):
    selected = set()
    for path in paths:
        p = PurePosixPath(path)
        if path.startswith("docs/") or p.suffix.lower() == ".md":
            continue
        if path in {".gitignore", "renovate.json", "skills-lock.json", ".gitleaks.toml"}:
            continue
        if path.startswith(".github/ISSUE_TEMPLATE/"):
            continue
        if path == ".github/workflows/security-baseline.yml":
            continue  # Security is independently enforced on every PR.
        if path.startswith(".github/"):
            selected.update(ALL)  # Validate changes to the gates and workflow structure.
        elif path.startswith(("gpu/", "vendor/")) or path in {
            "scripts/vgpu-ci.sh", "scripts/render-orbit.mjs", "tests/orbit-surface-probe.mjs"
        }:
            selected.update({"ci", "vgpu"})
        elif path == "scripts/e2e-ci.sh":
            selected.add("e2e")
        elif path == "scripts/visual-review.sh":
            selected.add("visual")
        elif path.startswith("labs/") or p.name.endswith(".test.js"):
            selected.add("ci")
        elif path.startswith("tests/") or path.startswith("assets/music/") or path in {
            "audio.js", "audio-worklet.js", "music-library.js", "tracks.js", "webmcp.js", "sw.js"
        }:
            selected.update({"ci", "e2e"})
        else:
            # UI, toolchain/build/deploy configuration and unknown files are conservative.
            selected.update(ALL)
    return selected


def pr_paths(cwd=None):
    parents = subprocess.check_output(
        ["git", "show", "-s", "--format=%P", "HEAD"], cwd=cwd, text=True
    ).split()
    if len(parents) != 2:
        raise ValueError("Expected the pull_request merge checkout with both parents")
    raw = subprocess.check_output(
        ["git", "diff", "--name-only", "--no-renames", "-z", "HEAD^1", "HEAD"], cwd=cwd
    )
    return [os.fsdecode(name) for name in raw.split(b"\0") if name]


def scope(event, cwd=None):
    if event != "pull_request":
        return ALL, "Manual or unrecognized event: run the complete suite"
    try:
        return classify(pr_paths(cwd)), "Classified the complete PR merge diff"
    except (OSError, ValueError, subprocess.CalledProcessError):
        return ALL, "Merge diff unavailable: run the complete suite"


if __name__ == "__main__":
    selected, reason = scope(os.environ.get("GITHUB_EVENT_NAME", ""))
    lines = [f"{name}={'true' if name in selected else 'false'}" for name in sorted(ALL)]
    print(reason)
    print("\n".join(lines))
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        output.write("\n".join(lines) + "\n")
