# 🚀 ccs - AI 模型切换 CLI 工具

一个用于快速切换不同 AI 供应商和模型的命令行工具，支持 **Bash**、**Zsh**、**Fish** 等多种 Shell，自动识别当前环境并写入对应的配置文件。

## ✨ 特性

- 🎯 **一键切换**：支持多个 AI 供应商（SiliconFlow、BigModel、DashScope、ModelScope、DeepSeek、MoonShot、MinMax）(可编辑配置文件添加额外供应商)
- 🤖 **多模型支持**：每个供应商支持多个模型选择
- 🐚 **多 Shell 支持**：自动识别 Bash、Zsh、Fish，适配不同的环境变量语法
- 🛠️ **自定义路径**：支持自定义配置文件路径（如 `~/.config/fish/conf.d/secrets.fish`）
- 🔑 **多 API Key**：支持配置多个 API Key 并快速切换
- 🔍 **验证密钥**：一键验证所有 API Key 的有效性，快速识别无效密钥
- 🏪 **模型广场**：显示各供应商模型广场链接，方便挑选新模型
- ⚡️ **快速生效**：写入配置后自动复制 `source <file>` 到剪切板
- 🎨 **友好界面**：交互式命令行界面，操作简单直观

## 🚀 快速开始

### 1. 安装

```bash
npm install -g @fxzer/claude-code-switch
```

### 2. 配置

首次运行会自动创建配置文件模板：

```bash
ccs
```

然后编辑 `~/.claude/ccs-providers.json` 文件，添加你的真实 API Keys：

```json
{
  "providers": {
    "siliconflow": {
      "name": "SiliconFlow",
      "baseUrl": "https://api.siliconflow.cn/",
      "modelHubUrl": "https://cloud.siliconflow.cn/me/models",
      "models": [
        "zai-org/GLM-4.6",
        "zai-org/GLM-4.5",
        "moonshotai/Kimi-K2-Instruct-0905"
      ],
      "apiKeys": [
        {
          "name": "账号 1 密钥",
          "key": "sk-xxx"
        },
        {
          "name": "账号 2 密钥",
          "key": "sk-yyy"
        }
      ]
    }
  },
  "current": {
    "provider": "siliconflow",
    "model": "zai-org/GLM-4.6",
    "apiKeyIndex": 0
  }
}
```

### 3. 使用

```bash
# 启动 CLI
ccs
```

### 4. 交互式选择

```
🤖 AI 模型切换工具
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 当前配置:
  供应商: 智谱 BigModel (bigmodel)
  模型:   glm-4.6
  API Key: 智谱测试账号 (c939cb...8.xx)
  Base URL: https://open.bigmodel.cn/api/anthropic
  🏪 模型广场: https://bigmodel.cn/console/modelcenter/square

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔄 切换配置:
? 请选择操作:
❯ 🏢 选择供应商
  🤖 选择模型
  🔑 选择 API Key
  ──────────────
  ✅ 写入配置
  📖 查看配置
  🔍 验证密钥
  ❌ 退出
```

### 5. 配置生效流程

1. **选择配置**：选择供应商、模型、API Key
2. **写入配置**：选择 "✅ 写入配置"
3. **确认路径**：
   - CLI 会自动识别当前 Shell（如 Fish）并提供默认路径（如 `~/.config/fish/conf.d/ccs_env.fish`）
   - 你可以直接回车确认，或输入自定义路径
4. **自动复制**：命令自动复制生效命令（如 `source ~/.config/fish/conf.d/ccs_env.fish`）到剪切板
5. **粘贴执行**：在终端中 `Cmd+V` 粘贴执行，或新开终端自动生效
6. **开始使用**：运行 `claude`

## 🔧 配置文件格式

ccs 会根据检测到的 Shell 自动调整语法。

### Bash / Zsh

```bash
# AI 模型配置 - 由 ccs 命令自动生成
# ==== ccs start ====
export ANTHROPIC_BASE_URL="https://open.bigmodel.cn/api/anthropic"
export ANTHROPIC_AUTH_TOKEN="your-api-key"
export ANTHROPIC_MODEL="glm-4.6"
# 配置时间: 2025/10/20 18:30:45
# ==== ccs end ====
```

### Fish

```fish
# AI 模型配置 - 由 ccs 命令自动生成
# ==== ccs start ====
set -gx ANTHROPIC_BASE_URL "https://open.bigmodel.cn/api/anthropic"
set -gx ANTHROPIC_AUTH_TOKEN "your-api-key"
set -gx ANTHROPIC_MODEL "glm-4.6"
# 配置时间: 2025/10/20 18:30:45
# ==== ccs end ====
```

## 🛠️ 命令选项

```bash
ccs               # 启动交互式配置
ccs --help        # 显示帮助信息
ccs --version     # 显示版本信息
```

## 🛠️ 开发

### 项目结构

```
claude-code-switch/
├── bin/
│   └── switch.js           # CLI 入口
├── lib/
│   ├── config-loader.js    # 配置加载器
│   └── env-exporter.js     # 环境变量导出器 (支持 Bash/Zsh/Fish)
├── ccs.template.json    # 配置模板
├── package.json
└── README.md
```

### 本地开发

```bash
# 安装依赖
npm install

# 本地测试
node bin/switch.js

# 全局安装
npm link
```
