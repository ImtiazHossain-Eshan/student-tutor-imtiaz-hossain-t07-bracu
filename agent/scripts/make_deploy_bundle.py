"""Assemble the folder you deploy to Render from a PRIVATE repository.

    python scripts/make_deploy_bundle.py ../../cse110-tutor-deploy

Copies the agent's code, the built index (index/), the ST routine (data/st/), the Dockerfile and
render.yaml. It never copies .env, the raw course files (data/course/), caches or eval results.
The index holds BRAC University course material, so the target must only ever be pushed to a
private repository.
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INCLUDE = ["src", "index", "data/st", "pyproject.toml", "README.md", "Dockerfile", ".dockerignore", "render.yaml"]
SKIP = shutil.ignore_patterns("__pycache__", "*.pyc", ".env", ".env.*", ".lock", "*.egg-info")  # .lock: held by a running server
GITIGNORE = """# deploy bundle: keep secrets out even here
.env
.env.*
__pycache__/
"""


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    target = Path(sys.argv[1]).resolve()
    if ROOT in target.parents or target == ROOT:
        sys.exit("Choose a folder outside the agent (and outside the public ST repository).")
    if not (ROOT / "index" / "manifest.json").exists():
        sys.exit("No built index. Run tutor-ingest first.")
    target.mkdir(parents=True, exist_ok=True)
    for item in INCLUDE:
        src, dst = ROOT / item, target / item
        if src.is_dir():
            shutil.copytree(src, dst, ignore=SKIP, dirs_exist_ok=True)
        else:
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
    (target / ".gitignore").write_text(GITIGNORE, encoding="utf-8")
    leaked = [p for p in target.rglob("*") if p.name == ".env" or "data/course" in p.as_posix()]
    if leaked:
        sys.exit(f"Refusing: secrets or course files ended up in the bundle: {leaked}")
    size = sum(p.stat().st_size for p in target.rglob("*") if p.is_file()) / 1e6
    print(f"Deploy bundle ready at {target} ({size:.1f} MB). Push it to a PRIVATE GitHub repository only.")


if __name__ == "__main__":
    main()
