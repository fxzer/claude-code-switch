# 🚀 ccs - AI 模型切换 CLI 工具

一个用于快速切换不同 AI 供应商和模型的命令行工具，支持直接写入 `~/.zshrc` 并自动复制生效命令到剪切板。

## ✨ 特性

- 🎯 **一键切换**：支持多个 AI 供应商（SiliconFlow、BigModel、DashScope、ModelScope、DeepSeek、MoonShot、MinMax）
- 🤖 **多模型支持**：每个供应商支持多个模型选择
- 🔑 **多 API Key**：支持配置多个 API Key 并快速切换
- 🔍 **验证密钥**：一键验证所有 API Key 的有效性，快速识别无效密钥
- 🏪 **模型广场**：显示各供应商模型广场链接，方便挑选新模型
- ⚡️ **快速生效**：写入配置后自动复制 `source ~/.zshrc` 到剪切板
- 🎨 **友好界面**：交互式命令行界面，操作简单直观

## 🚀 快速开始

### 1. 安装

```bash
# 克隆或下载项目
cd claude-code-switch

# 安装依赖
npm install

# 全局安装命令
npm link
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
  ✅ 写入配置并生效
  📖 查看 ~/.zshrc 配置
  🔍 验证密钥
  ❌ 退出
```

### 5. 配置生效流程
1. **选择配置**：选择供应商、模型、API Key
2. **写入配置**：选择 "✅ 写入配置并生效"
3. **自动复制**：命令自动复制 `source ~/.zshrc` 到剪切板
4. **粘贴执行**：在终端中 `Cmd+V` 粘贴执行
5. **开始使用**：运行 `claude`

## 🔧 ~/.zshrc 配置格式

配置会写入到 `~/.zshrc`，格式如下：

```bash
# AI 模型配置 - 由 ccs 命令自动生成
# ==== ccs start ====
export ANTHROPIC_BASE_URL="https://open.bigmodel.cn/api/anthropic"
export ANTHROPIC_AUTH_TOKEN="your-api-key"
export ANTHROPIC_MODEL="glm-4.6"
# 配置时间: 2025/10/20 18:30:45
# ==== ccs end ====
```

## 🏢 支持的供应商

### SiliconFlow
- **Base URL**: `https://api.siliconflow.cn/`
- **模型广场**: https://cloud.siliconflow.cn/me/models
- **热门模型**: GLM-4.6、GLM-4.5、Kimi-K2-Instruct 等
- **获取 API Key**: https://siliconflow.cn

### 智谱 BigModel
- **Base URL**: `https://open.bigmodel.cn/api/anthropic`
- **模型广场**: https://bigmodel.cn/console/modelcenter/square
- **热门模型**: glm-4.6、glm-4.5-air、glm-4.5-flash 等
- **获取 API Key**: https://open.bigmodel.cn

### 阿里云 DashScope
- **Base URL**: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- **模型广场**: https://bailian.console.aliyun.com/?tab=model#/model-market/all
- **热门模型**: qwen3-coder-plus、qwen3-coder-flash 等
- **获取 API Key**: https://dashscope.aliyuncs.com

### ModelScope
- **Base URL**: `https://api-inference.modelscope.cn`
- **模型广场**: https://modelscope.cn/models
- **热门模型**: GLM-4.6、DeepSeek-V3.2-Exp 等
- **获取 API Key**: https://modelscope.cn

### DeepSeek
- **Base URL**: `https://api.deepseek.com/anthropic`
- **模型广场**: https://platform.deepseek.com/
- **热门模型**: deepseek-chat、deepseek-reasoner 等
- **获取 API Key**: https://platform.deepseek.com/

### MoonShot（月之暗面）
- **Base URL**: `https://api.moonshot.ai/anthropic`
- **模型广场**: https://platform.moonshot.cn/docs/introduction#模型列表
- **热门模型**: kimi-k2-0905-preview、kimi-k2-turbo-preview 等
- **获取 API Key**: https://platform.moonshot.cn

### MinMax（海螺AI）
- **Base URL**: `https://api.minimax.io/anthropic`
- **模型广场**: https://minimaxi.com/
- **热门模型**: MiniMax-M2 等
- **获取 API Key**: https://minimaxi.com/

## 🎯 使用流程

### 基本使用
```bash
# 1. 启动 CLI
ccs

# 2. 选择配置（交互式）
# - 选择供应商
# - 选择模型  
# - 选择密钥

# 3. 写入配置
# 选择 "✅ 写入配置并生效"

# 4. 粘贴执行 source 命令（已复制到剪切板）
source ~/.zshrc

# 5. 开始使用 Claude Code
claude
```

### 快速切换
```bash
ccs  # 选择新配置
# 粘贴执行 source ~/.zshrc
claude  # 直接使用
```

### 验证 API Key
```bash
ccs
# 选择 "🔍 验证密钥"
```

验证过程示例：
```
🔑 验证所有API密钥...
────────────────────────────────────────────────────────────

📦 SiliconFlow (siliconflow)
  ✅ 账号 1 密钥 (sk-xxx...)
  ⏭️ 账号 2 密钥 (sk-yyy...) - 示例密钥

📦 BigModel (bigmodel)
  🚫 账号 3 密钥 (无密钥) - 空密钥

📊 验证结果统计【总计: 3】:
  ✅ 有效: 1
  ❌ 无效: 0
  ⏭️ 跳过: 1 (示例密钥)
  🚫 空密钥: 1
```

**状态说明**：
- ✅ **有效** - API Key 可用，可以正常使用
- ❌ **无效** - API Key 无效，认证失败或网络错误
- ⏭️ **跳过** - 示例密钥，自动跳过不验证
- 🚫 **空密钥** - 未配置密钥，需要填写真实密钥

### 查看当前配置
```bash
ccs
# 选择 "📖 查看 ~/.zshrc 配置"
```

## 📁 配置文件位置

- **配置文件**: `~/.claude/ccs-providers.json`
- **配置模板**: `ccs.template.json`

## 💡 高级技巧

### 1. 配置多个 API Key
在 `ccs-providers.json` 中为每个供应商配置多个 API Key，方便快速切换：

```json
{
  "providers": {
    "siliconflow": {
      "apiKeys": [
        {"name": "免费账号", "key": "sk-free-xxx"},
        {"name": "付费账号", "key": "sk-paid-xxx"}
      ]
    }
  }
}
```

### 2. 多环境配置
可以在 `~/.claude/` 目录下创建不同环境的配置文件：

```bash
# 创建不同环境配置
cp ~/.claude/ccs-providers.json ~/.claude/config-work.json
cp ~/.claude/ccs-providers.json ~/.claude/config-personal.json

# 切换配置（手动）
ln -sf ~/.claude/config-work.json ~/.claude/ccs-providers.json
```

### 3. 模型广场使用
- 配置界面会显示当前供应商的模型广场链接
- 点击链接可直接访问官网挑选新模型
- 找到新模型后，编辑配置文件添加到 models 列表

## 🛠️ 命令选项

```bash
ccs              # 启动交互式配置
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
│   └── env-exporter.js     # 环境变量导出器
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

## 🔒 安全提示

- API Key 请妥善保管，不要提交到版本控制系统
- 建议为不同环境使用不同的 API Key
- 定期检查和更新 API Key

## 🎉 完成！

现在你可以：
- 使用 `ccs` 快速切换 AI 供应商和模型
- 🔍 **一键验证所有 API Key**，快速识别无效密钥
- 查看模型广场链接，方便挑选新模型
- 配置写入后自动复制生效命令到剪切板
- 享受高效的 AI 模型切换体验！

🚀 Happy Coding with Claude!
