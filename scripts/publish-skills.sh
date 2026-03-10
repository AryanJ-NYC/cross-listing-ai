#!/usr/bin/env bash
set -euo pipefail

main() {
  local script_dir repo_root
  local -a required_files

  script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
  repo_root=$(cd "$script_dir/.." && pwd)
  required_files=(
    "README.md"
    "SKILL.md"
    "LICENSE"
    "agents/openai.yaml"
  )

  require_files "$repo_root" "${required_files[@]}"
  require_clean_git "$repo_root"
  require_command "npx"

  (
    cd "$repo_root"
    npx skills check
  )

  cat <<'EOF'
skills.sh does not have a separate publish command for this repo.
Share/install target: AryanJ-NYC/cross-listing-ai
Install command: npx skills add AryanJ-NYC/cross-listing-ai

Push to GitHub separately when you want the remote repository state to reflect this release.
EOF
}

require_files() {
  local repo_root=$1
  shift

  local relative_path
  for relative_path in "$@"; do
    if [[ ! -f "$repo_root/$relative_path" ]]; then
      echo "Missing required file: $relative_path" >&2
      exit 1
    fi
  done
}

require_clean_git() {
  local repo_root=$1

  if [[ -n "$(git -C "$repo_root" status --short)" ]]; then
    echo "This publish flow requires a clean git working tree." >&2
    exit 1
  fi
}

require_command() {
  local command_name=$1

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

main "$@"
