#!/usr/bin/env node

// 设置更好的终端兼容性
process.env.FORCE_COLOR = '1';
process.env.TERM = 'xterm-256color';

const prompts = require('prompts');
const chalk = require('chalk');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');
const ConfigLoader = require('../lib/config-loader');
const EnvExporter = require('../lib/env-exporter');

class AISwitchCLI {
  constructor() {
    this.configLoader = new ConfigLoader();
    this.envExporter = new EnvExporter();
    this.config = null;
  }

  /**
   * 降级的选择方法 - 使用 readline
   */
  async fallbackSelect(message, choices, initialIndex = 0) {
    return new Promise((resolve, reject) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      console.log(chalk.cyan(`\n${message}`));
      choices.forEach((choice, index) => {
        const marker = index === initialIndex ? '➤' : ' ';
        const disabled = choice.disabled ? ' (不可用)' : '';
        console.log(`${marker} ${index + 1}. ${choice.title}${disabled}`);
      });

      rl.question(chalk.cyan('\n请输入选项数字: '), (answer) => {
        const index = parseInt(answer) - 1;
        if (index >= 0 && index < choices.length && !choices[index].disabled) {
          resolve({ value: choices[index].value });
        } else {
          reject(new Error('无效的选择'));
        }
        rl.close();
      });
    });
  }

  /**
   * 启动 CLI
   */
  async run() {
    try {
      console.log(chalk.cyan.bold('\n🤖 AI 模型切换工具'));
      console.log(chalk.gray('━'.repeat(50)));

      // 加载配置
      await this.loadConfig();

      // 显示当前配置
      this.displayCurrentConfig();

      // 开始交互式选择
      await this.startInteractiveSelection();

    } catch (error) {
      console.error(chalk.red.bold('\n❌ 错误:'), error.message);
      process.exit(1);
    }
  }

  /**
   * 加载配置文件
   */
  async loadConfig() {
    try {
      this.config = await this.configLoader.loadConfig();
      this.configLoader.validateConfig(this.config);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 显示当前配置
   */
  displayCurrentConfig() {
    const current = this.configLoader.getCurrentConfig(this.config);

    console.log(chalk.yellow.bold('\n📋 当前配置:'));
    console.log(chalk.white(`  供应商: ${current.provider.name || '未知'} (${chalk.gray(current.provider.id || '未知')})`));
    console.log(chalk.white(`  模型:   ${current.model || '未知'}`));
    console.log(chalk.white(`  API Key: ${current.apiKey.name || '未知'} (${chalk.gray(current.apiKey.key || '未知')})`));
    console.log(chalk.white(`  Base URL: ${current.provider.baseUrl || '未知'}`));
    
    // 显示模型广场链接
    if (current.provider.modelHubUrl) {
      console.log(chalk.white(`  模型广场: ${current.provider.modelHubUrl}`));
    }

    console.log(chalk.gray('\n' + '━'.repeat(50)));
  }

  /**
   * 开始交互式选择
   */
  async startInteractiveSelection() {
    console.log(chalk.yellow.bold('\n🔄 切换配置:'));

    const choices = [
      { title: '🏢 选择供应商', value: 'provider', disabled: false },
      { title: '🤖 选择模型', value: 'model', disabled: false },
      { title: '🔑 选择密钥', value: 'apiKey', disabled: false },
      { title: '──────────────', disabled: true },
      { title: '✅ 写入配置', value: 'write_and_source', disabled: false },
      { title: '📖 查看配置', value: 'read_global', disabled: false },
      { title: '❌ 退出', value: 'exit', disabled: false }
    ].filter(choice => choice && choice.title && choice.value);

    let response;
    try {
      response = await prompts({
        type: 'select',
        name: 'action',
        message: '请选择操作:',
        choices
      });
    } catch (error) {
      console.error(chalk.red('❌ prompts 库出错，使用降级界面:'), error.message);
      try {
        response = await this.fallbackSelect('请选择操作:', choices);
        response = { action: response.value };
      } catch (fallbackError) {
        console.error(chalk.red('❌ 降级界面也失败了:'), fallbackError.message);
        process.exit(1);
      }
    }

    if (!response.action) {
      console.log(chalk.green('\n👋 再见！'));
      process.exit(0);
    }

    switch (response.action) {
      case 'provider':
        await this.selectProvider();
        break;
      case 'model':
        await this.selectModel();
        break;
      case 'apiKey':
        await this.selectApiKey();
        break;
      case 'write_and_source':
        await this.writeToGlobalZshrcAndSource();
        break;
      case 'read_global':
        await this.readFromGlobalZshrc();
        break;
      case 'exit':
        console.log(chalk.green('\n👋 再见！'));
        process.exit(0);
        break;
    }
  }

  /**
   * 选择供应商
   */
  async selectProvider() {
    const providers = Object.entries(this.config.providers);

    // 过滤有效的供应商
    const validProviders = providers.filter(([id, provider]) =>
      id && provider && provider.name
    );

    const choices = validProviders.map(([id, provider]) => ({
      title: `${String(provider.name || '未知供应商')} (${String(id)})`,
      value: String(id)
    }));

    let response;
    try {
      response = await prompts({
        type: 'select',
        name: 'providerId',
        message: '选择供应商:',
        choices,
        initial: validProviders.findIndex(([id]) => id === this.config.current.provider)
      });
    } catch (error) {
      console.error(chalk.red('❌ 选择供应商出错:'), error.message);
      await this.startInteractiveSelection();
      return;
    }

    if (!response.providerId) {
      await this.startInteractiveSelection();
      return;
    }

    const providerId = response.providerId;

    if (providerId !== this.config.current.provider) {
      // 切换供应商时，重置模型和 API Key
      const provider = this.config.providers[providerId];
      this.config.current.provider = providerId;

      // 安全设置第一个可用模型
      if (provider.models && provider.models.length > 0) {
        this.config.current.model = provider.models[0];
      } else {
        this.config.current.model = '未知模型';
      }

      // 安全设置第一个 API Key
      if (provider.apiKeys && provider.apiKeys.length > 0) {
        this.config.current.apiKeyIndex = 0;
      } else {
        this.config.current.apiKeyIndex = 0;
      }

      await this.saveConfig();
      console.log(chalk.green(`✓ 已切换到供应商: ${provider.name}`));
    }

    // 继续选择流程
    await this.continueFlow();
  }

  /**
   * 选择模型
   */
  async selectModel() {
    const providerId = this.config.current.provider;
    const provider = this.config.providers[providerId];

    // 检查供应商是否存在
    if (!provider) {
      console.log(chalk.red('❌ 当前供应商不存在，请先选择供应商'));
      await this.startInteractiveSelection();
      return;
    }

    // 检查是否有可用的模型
    if (!provider.models || provider.models.length === 0) {
      console.log(chalk.red('❌ 当前供应商没有可用模型，请先配置模型列表'));
      await this.startInteractiveSelection();
      return;
    }

    // 检查当前配置的模型是否在供应商的模型列表中
    if (this.config.current.model && !provider.models.includes(this.config.current.model)) {
      console.log(chalk.yellow(`⚠️  当前配置的模型 "${this.config.current.model}" 不在供应商 "${provider.name}" 的模型列表中`));
      console.log(chalk.yellow('将为您重置到第一个可用模型'));
      this.config.current.model = provider.models[0];
      await this.saveConfig();
    }

    // 过滤有效的模型名称
    const validModels = provider.models.filter(model =>
      model && typeof model === 'string' && model.trim() !== ''
    );

    if (validModels.length === 0) {
      console.log(chalk.red('❌ 当前供应商没有有效的模型配置'));
      await this.startInteractiveSelection();
      return;
    }

    const choices = validModels.map(model => ({
      title: String(model),
      value: String(model)
    }));

    let response;
    try {
      response = await prompts({
        type: 'select',
        name: 'model',
        message: '选择模型:',
        choices,
        initial: validModels.findIndex(model => model === this.config.current.model)
      });
    } catch (error) {
      console.error(chalk.red('❌ 选择模型出错:'), error.message);
      await this.startInteractiveSelection();
      return;
    }

    if (!response.model) {
      await this.startInteractiveSelection();
      return;
    }

    const model = response.model;

    if (model !== this.config.current.model) {
      this.config.current.model = model;
      await this.saveConfig();
      console.log(chalk.green(`✓ 已切换到模型: ${model}`));
    }

    await this.continueFlow();
  }

  /**
   * 选择密钥
   */
  async selectApiKey() {
    const providerId = this.config.current.provider;
    const provider = this.config.providers[providerId];

    // 检查供应商是否存在
    if (!provider) {
      console.log(chalk.red('❌ 当前供应商不存在，请先选择供应商'));
      await this.startInteractiveSelection();
      return;
    }

    // 检查是否有可用的 API Key
    if (!provider.apiKeys || provider.apiKeys.length === 0) {
      console.log(chalk.red('❌ 当前供应商没有可用 API Key，请先配置 API Key'));
      await this.startInteractiveSelection();
      return;
    }

    // 检查当前配置的 API Key 索引是否有效
    if (this.config.current.apiKeyIndex >= provider.apiKeys.length) {
      console.log(chalk.yellow(`⚠️  当前配置的 API Key 索引超出范围，将为您重置到第一个可用 API Key`));
      this.config.current.apiKeyIndex = 0;
      await this.saveConfig();
    }

    // 过滤有效的 API Key
    const validApiKeys = provider.apiKeys.filter((apiKey) =>
      apiKey && apiKey.name && apiKey.key
    );

    if (validApiKeys.length === 0) {
      console.log(chalk.red('❌ 当前供应商没有有效的 API Key 配置'));
      await this.startInteractiveSelection();
      return;
    }

    const choices = validApiKeys.map((apiKey) => ({
      title: `${String(apiKey.name || '未知')} (${this.configLoader.maskApiKey(String(apiKey.key || 'sk-xxxx'))})`,
      value: provider.apiKeys.indexOf(apiKey)
    }));

    let response;
    try {
      response = await prompts({
        type: 'select',
        name: 'apiKeyIndex',
        message: '选择密钥:',
        choices,
        initial: this.config.current.apiKeyIndex
      });
    } catch (error) {
      console.error(chalk.red('❌ 选择密钥 出错:'), error.message);
      await this.startInteractiveSelection();
      return;
    }

    if (response.apiKeyIndex === undefined) {
      await this.startInteractiveSelection();
      return;
    }

    const apiKeyIndex = response.apiKeyIndex;

    if (apiKeyIndex !== this.config.current.apiKeyIndex) {
      this.config.current.apiKeyIndex = apiKeyIndex;
      await this.saveConfig();
      console.log(chalk.green(`✓ 已切换到 API Key: ${provider.apiKeys[apiKeyIndex].name}`));
    }

    await this.continueFlow();
  }

  /**
   * 继续选择流程
   */
  async continueFlow() {
    console.log(chalk.gray('\n---'));
    this.displayCurrentConfig();

    let response;
    try {
      response = await prompts({
        type: 'confirm',
        name: 'continueSelection',
        message: '是否继续修改配置?',
        initial: false
      });
    } catch (error) {
      console.error(chalk.red('❌ 确认对话框出错:'), error.message);
      await this.startInteractiveSelection();
      return;
    }

    if (response.continueSelection) {
      await this.startInteractiveSelection();
    } else {
      await this.writeToGlobalZshrcAndSource();
    }
  }

  /**
   * 写入 ~/.zshrc 并自动 source 生效
   */
  async writeToGlobalZshrcAndSource() {
    console.log(chalk.yellow.bold('\n✅ 写入配置...'));

    try {
      // 在写入配置前进行完整验证
      this.configLoader.validateConfigFull(this.config);

      const provider = this.config.providers[this.config.current.provider];
      const apiKey = provider.apiKeys[this.config.current.apiKeyIndex];

      // 使用 baseUrl
      const baseUrl = provider.baseUrl;

      const envVars = {
        'ANTHROPIC_BASE_URL': baseUrl,
        'ANTHROPIC_AUTH_TOKEN': apiKey.key,
        'ANTHROPIC_MODEL': this.config.current.model
      };

      // 确认写入
      const confirmResponse = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: `确认将配置写入 ~/.zshrc?`,
        initial: true
      });

      if (!confirmResponse.confirm) {
        console.log(chalk.yellow('❌ 操作已取消'));
        await this.startInteractiveSelection();
        return;
      }

      // 写入 ~/.zshrc
      const result = await this.envExporter.writeToGlobalZshrc(envVars);

      if (result.success) {
        console.log(chalk.green(`✅ ${result.message}`));

        console.log('\n📋 已写入的环境变量:');
        Object.entries(envVars).forEach(([key, value]) => {
          if (key.includes('TOKEN')) {
            console.log(`  ${key}: ${value.substring(0, 10)}...${value.substring(value.length - 4)}`);
          } else {
            console.log(`  ${key}: ${value}`);
          }
        });

        // 简化的环境变量生效提示
        const sourceCommand = 'source ~/.zshrc';
        console.log(chalk.green('\n✅ 配置已写入 ~/.zshrc'));
        console.log(chalk.yellow(`\n📋 使环境变量立即生效：${sourceCommand}\n`));
        
        // 自动复制到剪切板
        console.log(chalk.cyan('📋 正在复制命令到剪切板...'));
        try {
          await this.copyToClipboard(sourceCommand);
          console.log(chalk.green('✅ 命令已复制到剪切板！直接粘贴执行即可。\n'));
        } catch (error) {
          console.log(chalk.yellow('⚠️  复制到剪切板失败，请手动复制命令\n'));
        }

        console.log(chalk.gray('\n💡 注意:'));
        console.log(chalk.gray('   - 环境变量已写入 ~/.zshrc，新开终端会自动加载'));
        console.log(chalk.gray('   - 当前终端需要执行 source ~/.zshrc 命令生效'));

      } else {
        console.log(chalk.red(result.message));
      }


    } catch (error) {
      console.error(chalk.red(`❌ 写入配置失败: ${error.message}`));
    }
  }

  /**
   * 读取 ~/.zshrc 配置
   */
  async readFromGlobalZshrc() {
    console.log(chalk.yellow.bold('\n📖 查看配置...'));

    try {
      const result = await this.envExporter.readFromGlobalZshrc();

      if (result.success) {
        console.log(chalk.green('✅ 找到 AI 模型配置'));
        console.log(chalk.gray(`📁 配置文件: ~/.zshrc`));

        console.log('\n📋 当前环境变量:');
        Object.entries(result.envVars).forEach(([key, value]) => {
          if (key.includes('TOKEN')) {
            console.log(`  ${key}: ${value.substring(0, 10)}...${value.substring(value.length - 4)}`);
          } else {
            console.log(`  ${key}: ${value}`);
          }
        });

        console.log('\n🔧 配置详情:');
        console.log(result.configSection);

        console.log('\n💡 如果需要重新加载配置，请执行:');
        console.log('   source ~/.zshrc');

      } else {
        console.log(chalk.yellow(result.message));
        console.log(chalk.gray('\n💡 提示: 可以选择 "✅ 写入配置" 来创建配置'));
      }
    } catch (error) {
      console.error(chalk.red(`❌ 读取配置失败: ${error.message}`));
    }

    // 继续流程
    await this.continueFlow();
  }

  /**
   * 复制内容到剪切板
   */
  async copyToClipboard(text) {
    return new Promise((resolve, reject) => {
      // 尝试使用 pbcopy (macOS)
      const pbcopy = spawn('pbcopy');
      pbcopy.stdin.write(text);
      pbcopy.stdin.end();
      
      pbcopy.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          // 如果 pbcopy 失败，尝试其他方法
          reject(new Error('pbcopy failed'));
        }
      });
      
      pbcopy.on('error', () => {
        reject(new Error('pbcopy not available'));
      });
    });
  }

  /**
   * 保存配置
   */
  async saveConfig() {
    try {
      await this.configLoader.saveConfig(this.config);
    } catch (error) {
      throw new Error(`保存配置失败: ${error.message}`);
    }
  }
}

// 处理命令行参数
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🤖 AI 模型切换工具

用法:
  ccsw [选项]

选项:
  -h, --help     显示帮助信息
  -v, --version  显示版本信息

示例:
  ccsw        # 启动交互式配置

配置文件位置:
  - ~/.claude/ccsw-providers.json

更多信息请访问: https://github.com/your-repo/claude-code-switch
  `);
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  const packageJson = require('../package.json');
  console.log(`v${packageJson.version}`);
  process.exit(0);
}

// 启动 CLI
const cli = new AISwitchCLI();
cli.run().catch(error => {
  console.error(chalk.red.bold('\n❌ 启动失败:'), error.message);
  process.exit(1);
});
