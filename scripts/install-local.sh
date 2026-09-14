#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_SOURCE_DIR="$ROOT_DIR"
VAULT_DIR="$HOME/Library/Application Support/个人工作台/vault"
BUILT_APP="$ROOT_DIR/src-tauri/target/release/bundle/macos/个人工作台.app"
TARGET_APP="/Applications/个人工作台.app"
CONFIG_DIR="$HOME/Library/Application Support/个人工作台"

pnpm --dir "$APP_SOURCE_DIR" install --frozen-lockfile
pnpm --dir "$APP_SOURCE_DIR" build:tauri

test -d "$BUILT_APP"
test -d "$VAULT_DIR"

pkill -x pgt-workbench >/dev/null 2>&1 || true
pkill -f "dist-server/server/index.js" >/dev/null 2>&1 || true
if [[ -e "$TARGET_APP" ]]; then
  rm -rf "$TARGET_APP"
fi
/usr/bin/ditto "$BUILT_APP" "$TARGET_APP"

mkdir -p "$CONFIG_DIR"
printf '%s\n' "$VAULT_DIR" > "$CONFIG_DIR/vault-path.txt"

codesign --force --deep --sign - "$TARGET_APP"
codesign --verify --deep --strict "$TARGET_APP"
echo "已安装：$TARGET_APP"
echo "Vault：$VAULT_DIR"
