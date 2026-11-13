"""Inspect Git publication candidates and nested release archives without logging secrets."""
from io import BytesIO
from pathlib import Path, PurePosixPath
import getpass
import os
import re
import subprocess
import sys
import zipfile

def git(*args):
    return subprocess.run(["git", *args], capture_output=True, check=False)

root = git("rev-parse", "--show-toplevel")
if root.returncode:
    sys.exit("Run this check in the Git checkout.")
os.chdir(os.fsdecode(root.stdout.strip()))
paths = git("ls-files", "-co", "--exclude-standard", "-z")
paths.check_returncode()
findings = set()
archives = 0
count = 0
# Exact local identifiers are read at run time and never printed.
private = {str(Path.home()).encode(), ("/Users/" + getpass.getuser()).encode()}
for field in ("user.name", "user.email"):
    value = git("config", "--get", field).stdout.strip()
    if len(value) >= 5 and b"users.noreply.github.com" not in value:
        private.add(value)

patterns = {
    "private key": rb"-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----",
    "access credential": rb"(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|(?:AKIA|ASIA)[A-Z0-9]{16}|AIza[A-Za-z0-9_-]{35}|sk-(?:proj-)?[A-Za-z0-9_-]{24,}|xox[baprs]-[\w-]{12,})",
    "credential in URL": rb"(?:https?|postgres(?:ql)?|redis|mongodb(?:\+srv)?)://[^\s/@:]+:[^\s/@]+@",
    "assigned secret": rb'''(?i)(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|_authToken)\s*[:=]\s*["'][^\s"',}\x00]{8,}["']''',
}
patterns = {label: re.compile(pattern) for label, pattern in patterns.items()}
forbidden = {".ds_store", ".git", ".ssh", ".aws", ".npmrc", ".netrc", ".git-credentials",
             "__macosx", "id_rsa", "id_ed25519", "node_modules"}

def inspect(path, data, label, depth=0):
    global archives
    parts = PurePosixPath(path).parts
    leaf = parts[-1].lower()
    if (any(p.lower() in forbidden or p.startswith("._") for p in parts)
            or leaf == ".env" or leaf.startswith(".env.") and leaf != ".env.example"
            or leaf.endswith((".key", ".pem", ".p12", ".pfx", ".mobileprovision"))):
        findings.add((label, "local metadata or credential file"))
    if depth < 3 and zipfile.is_zipfile(BytesIO(data)):
        archives += 1
        with zipfile.ZipFile(BytesIO(data)) as archive:
            for entry in archive.infolist():
                if not entry.is_dir():
                    inspect(entry.filename, archive.read(entry), label + "!" + entry.filename, depth + 1)
        return
    lowered = data.lower()
    for value in private:
        if value.lower() in lowered or value.decode(errors="replace").lower().encode("utf-16-le") in lowered:
            findings.add((label, "local identity or home directory"))
            break
    for reason, pattern in patterns.items():
        if pattern.search(data):
            findings.add((label, reason))

for entry in paths.stdout.split(b"\0"):
    if entry:
        p = Path(os.fsdecode(entry))
        if p.is_symlink():
            findings.add((str(p), "review symbolic link"))
        elif p.is_file():
            count += 1
            inspect(p.as_posix(), p.read_bytes(), p.as_posix())

for filename, reason in sorted(findings):
    print(f"{filename}: {reason}")
print(f"Checked {count} Git publication candidates and {archives} archives. Findings: {len(findings)}.")
author = git("var", "GIT_AUTHOR_IDENT").stdout
if author and b"@users.noreply.github.com>" not in author:
    print("Git author email is not a GitHub noreply address. Review it before committing.")
sys.exit(bool(findings))
