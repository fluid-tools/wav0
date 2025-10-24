Push current worktree branch to remote (auto-set upstream); optionally make a commit, then print safe follow-ups.

```bash
#!/usr/bin/env bash
set -euo pipefail

# Usage: wtree-push [commit message] [--allow-empty] [--no-verify]
# Env:   GIT_REMOTE=origin (override default remote)

msg=""
allow_empty=false
no_verify=false

for arg in "$@"; do
  case "$arg" in
    --allow-empty) allow_empty=true ;;
    --no-verify)   no_verify=true ;;
    *)             if [ -z "$msg" ]; then msg="$arg"; fi ;;
  esac
done

# Ensure we are in a git work tree
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not inside a git work tree" >&2
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$branch" = "HEAD" ]; then
  echo "Detached HEAD is not supported for this command" >&2
  exit 1
fi

# Pick remote: GIT_REMOTE > origin > first remote
remote="${GIT_REMOTE:-origin}"
if ! git remote get-url "$remote" >/dev/null 2>&1; then
  remote="$(git remote | head -n1 || true)"
fi
if [ -z "$remote" ]; then
  echo "No git remotes configured" >&2
  exit 1
fi

# Stage and commit
if ! git diff --quiet || ! git diff --cached --quiet; then
  git add -A
fi

if git diff --cached --quiet; then
  if [ -n "$msg" ] && $allow_empty; then
    git commit --allow-empty -m "$msg"
  fi
else
  if [ -n "$msg" ]; then
    git commit -m "$msg"
  else
    git commit -m "chore(${branch}): sync worktree"
  fi
fi

# Determine if upstream exists
has_upstream=true
if ! git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
  has_upstream=false
fi

nv_flag=()
$no_verify && nv_flag+=("--no-verify")

if [ "$has_upstream" = false ]; then
  # First push: set upstream to the matching remote branch using HEAD
  git push -u "$remote" HEAD ${nv_flag[@]:-}
else
  git push "$remote" ${nv_flag[@]:-}
fi

upstream_ref="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || echo "$remote/$branch")"
echo "Pushed: $branch -> $upstream_ref"

echo "Next: in another clone/work dir, fast-forward merge fetched branch:"
echo "  git fetch $remote $branch && git merge --ff-only $remote/$branch"

echo "Note: the same branch cannot be checked out in two worktrees simultaneously."
```