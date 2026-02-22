# 开发指南

本文档介绍如何在本地开发和调试 Pi。

## 克隆与设置

```bash
# 克隆仓库
git clone https://github.com/anthropics/pi.git
cd pi

# 安装依赖
npm install

# 构建项目
npm run build

# 链接到全局
npm link
```

## 自定义

Pi 支持通过环境变量或配置进行品牌和路径自定义：

| 自定义项 | 环境变量 | 说明 |
|----------|----------|------|
| 名称 | `PI_NAME` | 自定义应用名称 |
| 配置目录 | `PI_CONFIG_DIR` | 自定义配置文件目录 |
| 可执行文件名 | `PI_BIN` | 自定义命令行工具名称 |

```bash
# 示例：使用自定义名称运行
PI_NAME="my-agent" pi
```

## 代码实践

开发时请遵循以下实践：

- 使用 TypeScript 严格模式
- 遵循现有的代码风格和命名约定
- 为新功能编写测试
- 在提交前运行 lint 和类型检查
- 保持向后兼容性

```bash
# 代码检查
npm run lint

# 类型检查
npm run typecheck

# 格式化
npm run format
```

## 调试

在 Pi 会话中使用 `/debug` 命令可以切换调试模式：

```
/debug
```

调试模式会输出以下信息：
- API 请求和响应详情
- 工具调用的完整参数
- Token 使用统计
- 延迟指标
- 内部状态变化

也可以通过环境变量启用调试：

```bash
DEBUG=pi:* pi
```

### 日志级别

| 级别 | 说明 |
|------|------|
| `pi:api` | API 请求和响应 |
| `pi:tools` | 工具执行详情 |
| `pi:session` | 会话管理 |
| `pi:*` | 所有调试信息 |

## 测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- --filter "tool"

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监听模式
npm run test:watch
```

### 测试结构

```
tests/
├── unit/           # 单元测试
├── integration/    # 集成测试
└── fixtures/       # 测试固件
```

## 架构

Pi 采用模块化的包架构：

| 包 | 说明 |
|----|------|
| `core` | 核心运行时和会话管理 |
| `cli` | 命令行界面和 TUI |
| `tools` | 内置工具实现 |
| `providers` | LLM Provider 适配器 |
| `extensions` | 扩展加载和管理 |
| `skills` | 技能加载和管理 |
| `shared` | 共享类型和工具函数 |

### 目录结构

```
packages/
├── core/           # 核心功能
│   ├── src/
│   │   ├── session/    # 会话管理
│   │   ├── messages/   # 消息处理
│   │   └── tools/      # 工具系统
│   └── tests/
├── cli/            # 命令行界面
│   ├── src/
│   │   ├── tui/        # 终端 UI 组件
│   │   ├── commands/   # CLI 命令
│   │   └── input/      # 输入处理
│   └── tests/
└── providers/      # Provider 适配器
    ├── src/
    │   ├── anthropic/
    │   ├── openai/
    │   └── google/
    └── tests/
```

### 关键入口点

| 文件 | 说明 |
|------|------|
| `packages/cli/src/index.ts` | CLI 入口 |
| `packages/core/src/session.ts` | 会话核心 |
| `packages/core/src/tools/registry.ts` | 工具注册表 |
| `packages/providers/src/index.ts` | Provider 注册 |
