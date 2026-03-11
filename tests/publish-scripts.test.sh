#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
TEST_TMP_ROOT=$(mktemp -d)
TESTS_RUN=0
REAL_NODE=$(command -v node)

cleanup() {
  rm -rf "$TEST_TMP_ROOT"
}

trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  TESTS_RUN=$((TESTS_RUN + 1))
  echo "ok $TESTS_RUN - $*"
}

assert_contains() {
  local haystack=$1
  local needle=$2
  local message=$3

  if [[ "$haystack" != *"$needle"* ]]; then
    fail "$message
expected to find: $needle
actual output:
$haystack"
  fi
}

assert_not_exists() {
  local path=$1
  local message=$2

  if [[ -e "$path" ]]; then
    fail "$message
unexpected path exists: $path"
  fi
}

copy_script() {
  local repo_dir=$1
  local script_name=$2

  cp "$REPO_ROOT/scripts/$script_name" "$repo_dir/scripts/$script_name"
  chmod +x "$repo_dir/scripts/$script_name"
}

copy_repo_file() {
  local repo_dir=$1
  local relative_path=$2

  mkdir -p "$repo_dir/$(dirname "$relative_path")"
  cp "$REPO_ROOT/$relative_path" "$repo_dir/$relative_path"
}

commit_fixture_changes() {
  local repo_dir=$1
  local message=${2:-"Update fixture"}

  (
    cd "$repo_dir"
    git add -A
    git commit -qm "$message"
  )
}

create_fixture_repo() {
  local repo_dir=$1

  mkdir -p "$repo_dir/scripts" "$repo_dir/agents" "$repo_dir/references/marketplaces"

  cp "$REPO_ROOT/SKILL.md" "$repo_dir/SKILL.md"
  cp "$REPO_ROOT/README.md" "$repo_dir/README.md"
  cp "$REPO_ROOT/LICENSE" "$repo_dir/LICENSE"
  cp "$REPO_ROOT/agents/openai.yaml" "$repo_dir/agents/openai.yaml"
  cp -R "$REPO_ROOT/references/." "$repo_dir/references/"

  (
    cd "$repo_dir"
    git init -q -b main
    git config user.name "Test User"
    git config user.email "test@example.com"
    git add .
    git commit -qm "Initial fixture"
  )
}

attach_origin_remote() {
  local repo_dir=$1
  local remote_dir="$TEST_TMP_ROOT/$(basename "$repo_dir")-origin.git"

  git init -q --bare "$remote_dir"
  (
    cd "$repo_dir"
    git remote add origin "$remote_dir"
    git push -q -u origin main
  )
}

write_fake_clawhub() {
  local bin_dir=$1
  mkdir -p "$bin_dir"

  cat > "$bin_dir/clawhub" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'clawhub %s\n' "$*" >> "${FAKE_COMMAND_LOG:?}"
if [[ "${FAKE_CLAWHUB_EXIT_CODE:-0}" != "0" ]]; then
  exit "${FAKE_CLAWHUB_EXIT_CODE}"
fi
EOF
  chmod +x "$bin_dir/clawhub"
}

write_fake_node() {
  local bin_dir=$1
  mkdir -p "$bin_dir"

  cat > "$bin_dir/node" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf 'node %s\n' "\$*" >> "\${FAKE_COMMAND_LOG:?}"
if [[ -n "\${1:-}" && -f "\$1" ]]; then
  "$REAL_NODE" --check "\$1" >/dev/null
fi
if [[ "\${FAKE_NODE_EXIT_CODE:-0}" != "0" ]]; then
  exit "\${FAKE_NODE_EXIT_CODE}"
fi
EOF
  chmod +x "$bin_dir/node"
}

write_fake_npx() {
  local bin_dir=$1
  mkdir -p "$bin_dir"

  cat > "$bin_dir/npx" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'npx %s\n' "$*" >> "${FAKE_COMMAND_LOG:?}"
if [[ "$#" -ne 2 || "$1" != "skills" || "$2" != "check" ]]; then
  echo "unexpected npx invocation: $*" >&2
  exit 99
fi
if [[ "${FAKE_NPX_EXIT_CODE:-0}" != "0" ]]; then
  exit "${FAKE_NPX_EXIT_CODE}"
fi
EOF
  chmod +x "$bin_dir/npx"
}

run_and_capture() {
  local output_file=$1
  shift

  set +e
  "$@" >"$output_file" 2>&1
  local status=$?
  set -e

  return "$status"
}

test_publish_clawhub_requires_version() {
  local repo_dir="$TEST_TMP_ROOT/clawhub-version"
  create_fixture_repo "$repo_dir"
  copy_script "$repo_dir" "publish-clawhub.sh"

  local output_file="$TEST_TMP_ROOT/clawhub-version.out"
  if run_and_capture "$output_file" "$repo_dir/scripts/publish-clawhub.sh"; then
    fail "publish-clawhub.sh should fail when version is omitted"
  fi

  local output
  output=$(cat "$output_file")
  assert_contains "$output" "Usage:" "publish-clawhub.sh should print usage when version is omitted"
  pass "publish-clawhub.sh requires a version"
}

test_publish_clawhub_rejects_dirty_repo() {
  local repo_dir="$TEST_TMP_ROOT/clawhub-dirty"
  create_fixture_repo "$repo_dir"
  copy_script "$repo_dir" "publish-clawhub.sh"
  echo "dirty" >> "$repo_dir/README.md"

  local output_file="$TEST_TMP_ROOT/clawhub-dirty.out"
  if run_and_capture "$output_file" "$repo_dir/scripts/publish-clawhub.sh" "1.2.3"; then
    fail "publish-clawhub.sh should fail on a dirty repo"
  fi

  local output
  output=$(cat "$output_file")
  assert_contains "$output" "clean git working tree" "publish-clawhub.sh should reject dirty repos"
  pass "publish-clawhub.sh rejects dirty repos"
}

test_publish_clawhub_requires_files() {
  local repo_dir="$TEST_TMP_ROOT/clawhub-files"
  create_fixture_repo "$repo_dir"
  copy_script "$repo_dir" "publish-clawhub.sh"
  rm "$repo_dir/agents/openai.yaml"

  (
    cd "$repo_dir"
    git add -A
    git commit -qm "Remove required file"
  )

  local output_file="$TEST_TMP_ROOT/clawhub-files.out"
  if run_and_capture "$output_file" "$repo_dir/scripts/publish-clawhub.sh" "1.2.3"; then
    fail "publish-clawhub.sh should fail when required files are missing"
  fi

  local output
  output=$(cat "$output_file")
  assert_contains "$output" "agents/openai.yaml" "publish-clawhub.sh should identify missing required files"
  pass "publish-clawhub.sh validates required files"
}

test_publish_clawhub_requires_marketplace_refs() {
  local repo_dir="$TEST_TMP_ROOT/clawhub-marketplace"
  create_fixture_repo "$repo_dir"
  copy_script "$repo_dir" "publish-clawhub.sh"
  rm "$repo_dir/references/marketplaces/ebay.md"

  (
    cd "$repo_dir"
    git add -A
    git commit -qm "Remove marketplace brief"
  )

  local output_file="$TEST_TMP_ROOT/clawhub-marketplace.out"
  if run_and_capture "$output_file" "$repo_dir/scripts/publish-clawhub.sh" "1.2.3"; then
    fail "publish-clawhub.sh should fail when a marketplace brief is missing"
  fi

  local output
  output=$(cat "$output_file")
  assert_contains "$output" "references/marketplaces/ebay.md" "publish-clawhub.sh should validate marketplace briefs"
  pass "publish-clawhub.sh validates marketplace briefs"
}

test_publish_clawhub_falls_back_for_license_terms_error() {
  local repo_dir="$TEST_TMP_ROOT/clawhub-license-terms"
  local bin_dir="$TEST_TMP_ROOT/clawhub-license-terms-bin"
  local log_file="$TEST_TMP_ROOT/clawhub-license-terms.log"
  create_fixture_repo "$repo_dir"
  copy_script "$repo_dir" "publish-clawhub.sh"
  copy_repo_file "$repo_dir" "scripts/publish-clawhub-api.mjs"
  commit_fixture_changes "$repo_dir" "Add publish-clawhub files"
  mkdir -p "$bin_dir"

  cat > "$bin_dir/clawhub" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'clawhub %s\n' "$*" >> "${FAKE_COMMAND_LOG:?}"
echo "✖ Publish payload: acceptLicenseTerms: invalid value" >&2
exit 1
EOF
  chmod +x "$bin_dir/clawhub"
  write_fake_node "$bin_dir"

  local output_file="$TEST_TMP_ROOT/clawhub-license-terms.out"
  if ! PATH="$bin_dir:$PATH" FAKE_COMMAND_LOG="$log_file" run_and_capture "$output_file" "$repo_dir/scripts/publish-clawhub.sh" "1.2.3"; then
    fail "publish-clawhub.sh should fall back to the API publisher when the CLI rejects license terms"
  fi

  local log_output
  log_output=$(cat "$log_file")
  assert_contains "$log_output" "clawhub publish" "publish-clawhub.sh should try the CLI publish first"
  assert_contains "$log_output" "node " "publish-clawhub.sh should invoke the Node fallback publisher"
  assert_contains "$log_output" "publish-clawhub-api.mjs" "publish-clawhub.sh should invoke the fallback helper file"
  pass "publish-clawhub.sh falls back when the CLI rejects license terms"
}

test_publish_clawhub_api_uses_latest_tag_by_default() {
  local repo_dir="$TEST_TMP_ROOT/clawhub-api"
  local server_file="$TEST_TMP_ROOT/clawhub-api-server.mjs"
  local request_file="$TEST_TMP_ROOT/clawhub-api-request.txt"
  local port_file="$TEST_TMP_ROOT/clawhub-api-port.txt"
  local config_file="$TEST_TMP_ROOT/clawhub-api-config.json"
  create_fixture_repo "$repo_dir"
  copy_repo_file "$repo_dir" "scripts/publish-clawhub-api.mjs"

  cat > "$server_file" <<'EOF'
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';

const requestFile = process.argv[2];
const portFile = process.argv[3];

const server = createServer((req, res) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    writeFileSync(requestFile, Buffer.concat(chunks));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, versionId: 'ver_test' }));
    server.close(() => process.exit(0));
  });
});

server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  writeFileSync(portFile, String(address.port));
});
EOF

  "$REAL_NODE" "$server_file" "$request_file" "$port_file" &
  local server_pid=$!
  local port=""

  for _ in $(seq 1 50); do
    if [[ -f "$port_file" ]]; then
      port=$(cat "$port_file")
      break
    fi
    sleep 0.1
  done

  if [[ -z "$port" ]]; then
    kill "$server_pid" 2>/dev/null || true
    fail "test registry did not start"
  fi

  cat > "$config_file" <<EOF
{
  "registry": "http://127.0.0.1:$port",
  "token": "test-token"
}
EOF

  local output_file="$TEST_TMP_ROOT/clawhub-api.out"
  if ! CLAWHUB_CONFIG_PATH="$config_file" "$REAL_NODE" "$repo_dir/scripts/publish-clawhub-api.mjs" "$repo_dir" "1.2.3" "" "" >"$output_file" 2>&1; then
    kill "$server_pid" 2>/dev/null || true
    fail "publish-clawhub-api.mjs should succeed against the test registry"
  fi

  wait "$server_pid"

  local output
  output=$(cat "$output_file")
  assert_contains "$output" "OK. Published cross-listing-ai@1.2.3" "publish-clawhub-api.mjs should report success"

  local request_body
  request_body=$(cat "$request_file")
  assert_contains "$request_body" '"acceptLicenseTerms":true' "publish-clawhub-api.mjs should accept the license terms"
  assert_contains "$request_body" '"tags":["latest"]' "publish-clawhub-api.mjs should default to the latest tag"
  pass "publish-clawhub-api.mjs defaults the fallback publish tag to latest"
}

test_publish_skills_checks_repo_and_prints_target() {
  local repo_dir="$TEST_TMP_ROOT/publish-skills"
  local bin_dir="$TEST_TMP_ROOT/publish-skills-bin"
  local log_file="$TEST_TMP_ROOT/publish-skills.log"
  create_fixture_repo "$repo_dir"
  copy_script "$repo_dir" "publish-skills.sh"
  commit_fixture_changes "$repo_dir" "Add publish-skills script"
  attach_origin_remote "$repo_dir"
  write_fake_npx "$bin_dir"

  local output_file="$TEST_TMP_ROOT/publish-skills.out"
  if ! PATH="$bin_dir:$PATH" FAKE_COMMAND_LOG="$log_file" run_and_capture "$output_file" "$repo_dir/scripts/publish-skills.sh"; then
    fail "publish-skills.sh should succeed in a clean fixture repo"
  fi

  local output
  output=$(cat "$output_file")
  assert_contains "$output" "origin/main" "publish-skills.sh should confirm the default-branch target"
  assert_contains "$output" "AryanJ-NYC/cross-listing-ai" "publish-skills.sh should print the canonical repo target"
  assert_contains "$output" "npx skills add AryanJ-NYC/cross-listing-ai" "publish-skills.sh should print the install command"

  local log_output
  log_output=$(cat "$log_file")
  assert_contains "$log_output" "npx skills check" "publish-skills.sh should run npx skills check"
  pass "publish-skills.sh validates via skills check and prints the install target"
}

test_publish_all_short_circuits_on_clawhub_failure() {
  local repo_dir="$TEST_TMP_ROOT/publish-all"
  local bin_dir="$TEST_TMP_ROOT/publish-all-bin"
  local log_file="$TEST_TMP_ROOT/publish-all.log"
  create_fixture_repo "$repo_dir"
  copy_script "$repo_dir" "publish-clawhub.sh"
  copy_script "$repo_dir" "publish-skills.sh"
  copy_script "$repo_dir" "publish-all.sh"
  commit_fixture_changes "$repo_dir" "Add publish scripts"
  write_fake_clawhub "$bin_dir"
  write_fake_npx "$bin_dir"

  local output_file="$TEST_TMP_ROOT/publish-all.out"
  if PATH="$bin_dir:$PATH" FAKE_COMMAND_LOG="$log_file" FAKE_CLAWHUB_EXIT_CODE=12 run_and_capture "$output_file" "$repo_dir/scripts/publish-all.sh" "1.2.3"; then
    fail "publish-all.sh should fail when publish-clawhub.sh fails"
  fi

  local log_output
  log_output=$(cat "$log_file")
  assert_contains "$log_output" "clawhub publish" "publish-all.sh should invoke clawhub through publish-clawhub.sh"
  if [[ "$log_output" == *"npx skills check"* ]]; then
    fail "publish-all.sh should not run skills.sh validation after ClawHub publish fails"
  fi
  pass "publish-all.sh short-circuits when publish-clawhub.sh fails"
}

main() {
  test_publish_clawhub_requires_version
  test_publish_clawhub_rejects_dirty_repo
  test_publish_clawhub_requires_files
  test_publish_clawhub_requires_marketplace_refs
  test_publish_clawhub_falls_back_for_license_terms_error
  test_publish_clawhub_api_uses_latest_tag_by_default
  test_publish_skills_checks_repo_and_prints_target
  test_publish_all_short_circuits_on_clawhub_failure
  echo "1..$TESTS_RUN"
}

main "$@"
