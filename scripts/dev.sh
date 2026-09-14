#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export WORKBENCH_VAULT_PATH="${WORKBENCH_VAULT_PATH:-$HOME/Library/Application Support/个人工作台/vault}"
cd "$ROOT_DIR"
pnpm dev
