#!/usr/bin/env python3
"""Refresh tools/stars.json with GitHub star counts for every tool that has a "github" field.
Standard library only. Uses GITHUB_TOKEN if set (otherwise the public 60-requests/hour limit).
  python3 tools/update_stars.py && python3 tools/build.py
"""
import json, os, urllib.request
from datetime import date
from pathlib import Path
root = Path(__file__).resolve().parent
tools = json.loads((root / "tools.json").read_text())
path = root / "stars.json"
old = json.loads(path.read_text()) if path.exists() else {"repos": {}}
out = {"note": "GitHub stargazers_count from api.github.com/repos/<owner>/<repo>", "repos": dict(old.get("repos", {}))}
hdr = {"Accept": "application/vnd.github+json", "User-Agent": "otb-tools-directory"}
if os.environ.get("GITHUB_TOKEN"): hdr["Authorization"] = "Bearer " + os.environ["GITHUB_TOKEN"]
for t in tools:
    repo = t.get("github")
    if not repo: continue
    try:
        d = json.load(urllib.request.urlopen(urllib.request.Request(f"https://api.github.com/repos/{repo}", headers=hdr), timeout=20))
        out["repos"][repo] = {"stars": int(d["stargazers_count"]), "fetched": date.today().isoformat()}
        print(repo, d["stargazers_count"])
    except Exception as ex:
        print(repo, "kept previous value:", ex)
path.write_text(json.dumps(out, indent=1) + "\n")
