#!/usr/bin/env python3
"""
Push tous les fichiers du repo vers GitHub via l'API.
Usage: python push_to_github.py VOTRE_TOKEN_GITHUB
"""
import sys, os, base64, json
from urllib.request import urlopen, Request
from urllib.error import HTTPError

if len(sys.argv) < 2:
    print("Usage: python push_to_github.py VOTRE_TOKEN_GITHUB")
    print()
    print("Pour créer un token GitHub:")
    print("1. github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)")
    print("2. Generate new token → cocher 'repo' → Generate")
    sys.exit(1)

TOKEN = sys.argv[1]
REPO  = "GARO21225/rzi-camp"
HEADERS = {
    "Authorization": f"token {TOKEN}",
    "Content-Type": "application/json",
    "Accept": "application/vnd.github.v3+json"
}

def api(method, path, data=None):
    url = f"https://api.github.com{path}"
    body = json.dumps(data).encode() if data else None
    req = Request(url, data=body, headers=HEADERS, method=method)
    try:
        with urlopen(req) as r:
            return json.loads(r.read())
    except HTTPError as e:
        err = json.loads(e.read())
        if e.code == 422:  # Already exists
            return err
        print(f"  HTTP {e.code}: {err.get('message','?')}")
        return None

def get_sha(path):
    result = api("GET", f"/repos/{REPO}/contents/{path}")
    if result and "sha" in result:
        return result["sha"]
    return None

def push_file(local_path, repo_path):
    with open(local_path, "rb") as f:
        content = base64.b64encode(f.read()).decode()
    sha = get_sha(repo_path)
    data = {
        "message": f"fix: update {os.path.basename(repo_path)}",
        "content": content,
    }
    if sha:
        data["sha"] = sha
    result = api("PUT", f"/repos/{REPO}/contents/{repo_path}", data)
    if result and "content" in result:
        print(f"  ✓ {repo_path}")
        return True
    else:
        print(f"  ✗ {repo_path}: {result}")
        return False

# Fichiers à pusher (chemin local → chemin GitHub)
BASE = os.path.dirname(os.path.abspath(__file__))

FILES = []
for root, dirs, files in os.walk(BASE):
    # Ignorer node_modules, .git, dist, __pycache__
    dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', 'dist', '__pycache__', '.pnpm-store', '--store-dir']]
    for fname in files:
        if fname in ['push_to_github.py']:
            continue
        if fname.endswith(('.pyc', '.pyo')):
            continue
        local = os.path.join(root, fname)
        rel   = os.path.relpath(local, BASE).replace('\\', '/')
        FILES.append((local, rel))

print(f"Push de {len(FILES)} fichiers vers github.com/{REPO}")
print()

ok = 0
fail = 0
for i, (local, repo_path) in enumerate(sorted(FILES)):
    print(f"[{i+1}/{len(FILES)}] {repo_path}", end=" ")
    sys.stdout.flush()
    if push_file(local, repo_path):
        ok += 1
    else:
        fail += 1

print()
print(f"✅ {ok} fichiers pushés, ❌ {fail} erreurs")
print("Render va redéployer automatiquement.")
