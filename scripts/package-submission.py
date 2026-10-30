#!/usr/bin/env python3
"""Create source and static submission archives from a checked Git checkout."""
import hashlib
import json
import pathlib
import subprocess
import zipfile
from datetime import datetime, timezone

root = pathlib.Path(__file__).resolve().parents[1]
subprocess.run(["node", "scripts/check-secrets.mjs"], cwd=root, check=True)
if subprocess.check_output(["git", "status", "--porcelain"], cwd=root).strip():
    raise SystemExit("Commit the final source before creating release archives.")
output = root / "release"
output.mkdir(exist_ok=True)
source = subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode().split("\0")
source = [name for name in source if name]
for name in source:
    parts = pathlib.PurePosixPath(name).parts
    if any(part in {".git", ".runtime", ".vercel", "node_modules", "dist", "release", "verification-evidence"} for part in parts):
        raise SystemExit("Private/generated path in source list: " + name)
    if pathlib.PurePosixPath(name).name.startswith(".env") and name != ".env.example":
        raise SystemExit("Private environment file in source list.")
if not (root / "dist/index.html").exists():
    raise SystemExit("Run npm run build first.")

archives = []
for filename, entries in [
    ("neverland-duel-source.zip", [(root / name, "neverland-duel/" + name) for name in source]),
    ("neverland-duel-web.zip", [(file, file.relative_to(root / "dist").as_posix()) for file in (root / "dist").rglob("*") if file.is_file()]),
]:
    target = output / filename
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for file, name in sorted(entries):
            archive.write(file, name)
    with zipfile.ZipFile(target) as archive:
        if archive.testzip() is not None:
            raise SystemExit("Archive integrity check failed.")
    archives.append({"file": filename, "bytes": target.stat().st_size, "files": len(entries), "sha256": hashlib.sha256(target.read_bytes()).hexdigest()})

manifest = {
    "createdAt": datetime.now(timezone.utc).isoformat(),
    "sourceCommit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root).decode().strip(),
    "game": "https://hook-practice-ten.vercel.app/",
    "video": "https://hook-practice-ten.vercel.app/submission/explainer.html",
    "archives": archives,
}
(output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
(output / "SHA256SUMS.txt").write_text("".join(item["sha256"] + "  " + item["file"] + "\n" for item in archives))
(output / "README.txt").write_text("""Neverland Duel — submission package

Play: https://hook-practice-ten.vercel.app/
Video: https://hook-practice-ten.vercel.app/submission/explainer.html

neverland-duel-source.zip: complete source, including the Vercel API function.
Unzip, enter neverland-duel/, run npm ci and npm run dev.
Follow docs/vercel.md to deploy with server-only AI credentials.

neverland-duel-web.zip: complete static build, with index.html at its root.
Serve the extracted directory over HTTP(S). All game modes work without AI;
Ask Coach uses local guidance on a static-only host.

The source README, submission/QA.md, and submission/SUBMISSION.md explain
the reviewer walkthrough, checks, scope, and rights notes. The video is
silent by design, with captions and a transcript. No credentials are included.

manifest.json identifies the source commit and archive hashes.
On macOS: shasum -a 256 -c SHA256SUMS.txt
On Linux: sha256sum -c SHA256SUMS.txt
""")
print(json.dumps(manifest, indent=2))
