# 发布检查清单

## 本地 App

- [ ] `./scripts/test.sh` 通过。
- [ ] `./scripts/build.sh` 从可重建依赖生成 `.app` 和 DMG。
- [ ] `./scripts/install-local.sh` 更新真实安装入口。
- [ ] App 签名验证通过。
- [ ] `/api/bootstrap` 返回成功，日志显示正确 Vault。
- [ ] 安装版不依赖源码相对路径。

## 正式交付

- [ ] 源码迁入独立 Git 仓库并标记版本。
- [ ] 全新克隆后恢复依赖、测试和构建成功。
- [ ] 不含用户 Vault、密钥、缓存和本机绝对路径。
- [ ] 使用 Developer ID 签名并通过 Apple 公证。
- [ ] 生成 DMG 或 PKG，提供安装、升级、备份和卸载说明。
- [ ] 在另一用户账户或另一台兼容 Mac 上完成安装验证。
