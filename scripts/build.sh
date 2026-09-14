#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
# tsc 不会删除已废弃的输出文件；先清空服务端构建目录，保证 dist-server 只反映当前源码。
rm -rf "$ROOT_DIR/dist-server"
pnpm build:tauri
