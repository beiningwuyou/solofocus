# 测试

当前 Vitest 测试与对应 TypeScript 模块放在一起，文件名为 `src/**/*.test.ts`，便于同步维护。运行统一入口：

```bash
./scripts/test.sh
```

未来加入跨模块集成测试或桌面端端到端测试时，将测试放入本目录。
