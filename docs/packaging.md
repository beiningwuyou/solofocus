# macOS 打包

桌面壳配置位于 `src-tauri/`。统一命令：

```bash
./scripts/build.sh
./scripts/install-local.sh
```

当前个人安装版使用 ad-hoc 签名并安装到 `/Applications/个人工作台.app`。准备对外分发时，需要改用 Developer ID 签名、公证和独立设备安装验证。
