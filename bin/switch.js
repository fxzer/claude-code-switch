#!/usr/bin/env node

// 设置更好的终端兼容性
process.env.FORCE_COLOR = '1';
process.env.TERM = 'xterm-256color';

const prompts = require('prompts');
const chalk = require('chalk');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs-extra');
const ConfigLoader = require('../lib/config-loader');
const EnvExporter = require('../lib/env-exporter');

/**
 * 展开路径中的 ~
 */
function expandHome(filepath) {
  if (filepath[0] === '~') {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

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
        output: process.stdout,
      });

      console.log(chalk.cyan(`\n${message}`));
      choices.forEach((choice, index) => {
        const marker = index === initialIndex ? '➤' : ' ';
        const disabled = choice.disabled ? ' (不可用)' : '';
        console.log(`${marker} ${index + 1}. ${choice.title}${disabled}`);
      });

      rl.question(chalk.cyan('\n请输入选项数字: '), answer => {
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
   * @param {boolean} compact - 是否使用紧凑格式（用于写入后的摘要）
   */
  displayCurrentConfig(compact = false) {
    const current = this.configLoader.getCurrentConfig(this.config);

    if (compact) {
      // 紧凑格式：单行显示
      console.log(
        chalk.cyan(`  ${current.provider.name || '未知'} | `) +
          chalk.white(`${current.model || '未知'} | `) +
          chalk.gray(`${current.apiKey.name || '未知'}`),
      );
    } else {
      // 完整格式：多行显示
      console.log(chalk.yellow.bold('\n📋 当前配置:'));
      console.log(
        chalk.white(
          `  供应商: ${current.provider.name || '未知'} (${chalk.gray(
            current.provider.id || '未知',
          )})`,
        ),
      );
      console.log(chalk.white(`  模型:   ${current.model || '未知'}`));
      console.log(
        chalk.white(
          `  API Key: ${current.apiKey.name || '未知'} (${chalk.gray(
            current.apiKey.key || '未知',
          )})`,
        ),
      );
      console.log(
        chalk.white(`  Base URL: ${current.provider.baseUrl || '未知'}`),
      );

      // 显示模型广场链接
      if (current.provider.modelHubUrl) {
        console.log(chalk.white(`  模型广场: ${current.provider.modelHubUrl}`));
      }

      console.log(chalk.gray('\n' + '━'.repeat(50)));
    }
  }

  /**
   * 开始交互式选择
   */
  async startInteractiveSelection() {
    console.log(chalk.yellow.bold('\n🔄 切换配置:'));

    // 获取UI配置
    const uiSettings = this.configLoader.getUISettings();

    const choices = [
      {
        title: uiSettings.ui.menuOptions.selectProvider,
        value: 'provider',
        disabled: false,
      },
      {
        title: uiSettings.ui.menuOptions.selectModel,
        value: 'model',
        disabled: false,
      },
      {
        title: uiSettings.ui.menuOptions.selectApiKey,
        value: 'apiKey',
        disabled: false,
      },
      { title: '──────────────', disabled: true },
      { title: '✅ 写入配置', value: 'write_and_source', disabled: false },
      { title: '📖 查看配置', value: 'read_config', disabled: false },
      { title: '🔑 验证密钥', value: 'validate_keys', disabled: false },
      { title: '❌ 退出', value: 'exit', disabled: false },
    ].filter(choice => choice && choice.title && choice.value);

    let response;
    try {
      response = await prompts({
        type: 'select',
        name: 'action',
        message: '请选择操作:',
        choices,
      });
    } catch (error) {
      console.error(
        chalk.red('❌ prompts 库出错，使用降级界面:'),
        error.message,
      );
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
        await this.writeEnvConfigAndSource();
        break;
      case 'read_config':
        await this.readFromEnvConfig();
        break;
      case 'validate_keys':
        await this.validateAllApiKeys();
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
    const validProviders = providers.filter(
      ([id, provider]) => id && provider && provider.name,
    );

    const choices = validProviders.map(([id, provider]) => ({
      title: `${String(provider.name || '未知供应商')} (${String(id)})`,
      value: String(id),
    }));

    // 获取UI配置
    const uiSettings = this.configLoader.getUISettings();

    let response;
    try {
      response = await prompts({
        type: 'select',
        name: 'providerId',
        message: uiSettings.ui.prompts.selectProvider,
        choices,
        initial: validProviders.findIndex(
          ([id]) => id === this.config.current.provider,
        ),
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

      // 供应商变更后，自动进入快速配置流程
      await this.quickConfigFlow('model');
    } else {
      // 如果供应商没有变更，提供下一步选项（聚焦到"选择模型"）
      await this.promptNextStep('provider');
    }
  }

  /**
   * 选择模型
   */
  async selectModel() {
    await this.selectModelInternal(false);
  }

  /**
   * 选择模型（供应商变更后自动调用）
   */
  async selectModelAfterProviderChange() {
    await this.selectModelInternal(true);
  }

  /**
   * 内部模型选择逻辑
   * @param {boolean} autoFlow - 是否是自动流程（供应商切换后）
   */
  async selectModelInternal(autoFlow = false) {
    const providerId = this.config.current.provider;
    const provider = this.config.providers[providerId];

    // 验证供应商
    const validation = this.validateProvider(providerId, '模型');
    if (!validation.isValid) {
      await this.startInteractiveSelection();
      return;
    }

    // 检查当前配置的模型是否在供应商的模型列表中
    if (
      this.config.current.model &&
      !provider.models.includes(this.config.current.model)
    ) {
      console.log(
        chalk.yellow(
          `⚠️  当前配置的模型 "${this.config.current.model}" 不在供应商 "${provider.name}" 的模型列表中`,
        ),
      );
      console.log(chalk.yellow('将为您重置到第一个可用模型'));
      this.config.current.model = provider.models[0];
      await this.saveConfig();
    }

    // 过滤有效的模型名称
    const validModels = this.filterValidItems(provider.models);

    if (validModels.length === 0) {
      console.log(chalk.red('❌ 当前供应商没有有效的模型配置'));
      await this.startInteractiveSelection();
      return;
    }

    const choices = validModels.map(model => ({
      title: String(model),
      value: String(model),
    }));

    // 获取UI配置
    const uiSettings = this.configLoader.getUISettings();
    const response = await this.promptUser(
      uiSettings.ui.prompts.selectModel,
      choices,
      validModels.findIndex(model => model === this.config.current.model),
    );
    if (!response) {
      await this.startInteractiveSelection();
      return;
    }

    const model = response;
    if (model !== this.config.current.model) {
      this.config.current.model = model;
      await this.saveConfig();
      console.log(chalk.green(`✓ 已切换到模型: ${model}`));
    }

    // 根据是否是自动流程决定后续操作
    if (autoFlow) {
      // 自动流程：继续选择 API Key
      await this.quickConfigFlow('apiKey');
    } else {
      // 手动流程：提供下一步选项（聚焦到"选择 API Key"）
      await this.promptNextStep('model');
    }
  }

  /**
   * 选择密钥
   */
  async selectApiKey() {
    await this.selectApiKeyInternal(false);
  }

  /**
   * 模型变更后选择 API Key（自动调用）
   */
  async selectApiKeyAfterModelChange() {
    await this.selectApiKeyInternal(true);
  }

  /**
   * 内部 API Key 选择逻辑
   * @param {boolean} autoFlow - 是否是自动流程
   */
  async selectApiKeyInternal(autoFlow = false) {
    const providerId = this.config.current.provider;
    const provider = this.config.providers[providerId];

    // 验证供应商
    const validation = this.validateProvider(providerId, 'API Key');
    if (!validation.isValid) {
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
      console.log(
        chalk.yellow(
          `⚠️  当前配置的 API Key 索引超出范围，将为您重置到第一个可用 API Key`,
        ),
      );
      this.config.current.apiKeyIndex = 0;
      await this.saveConfig();
    }

    // 过滤有效的 API Key
    const validApiKeys = this.filterValidApiKeys(provider.apiKeys);

    if (validApiKeys.length === 0) {
      console.log(chalk.red('❌ 当前供应商没有有效的 API Key 配置'));
      await this.startInteractiveSelection();
      return;
    }

    const choices = validApiKeys.map(apiKey => ({
      title: `${String(apiKey.name || '未知')} (${this.configLoader.maskApiKey(
        String(apiKey.key || 'sk-xxxx'),
      )})`,
      value: provider.apiKeys.indexOf(apiKey),
    }));

    // 获取UI配置
    const uiSettings = this.configLoader.getUISettings();
    const response = await this.promptUser(
      uiSettings.ui.prompts.selectApiKey,
      choices,
      this.config.current.apiKeyIndex,
      'apiKeyIndex',
    );
    if (response === null || response === undefined) {
      await this.startInteractiveSelection();
      return;
    }

    const apiKeyIndex = response;
    if (apiKeyIndex !== this.config.current.apiKeyIndex) {
      this.config.current.apiKeyIndex = apiKeyIndex;
      await this.saveConfig();
      console.log(
        chalk.green(
          `✓ 已切换到 API Key: ${provider.apiKeys[apiKeyIndex].name}`,
        ),
      );
    }

    // API Key 选择完成后，直接进入写入配置流程
    await this.writeEnvConfigAndSource();
  }

  /**
   * 快速配置流程（供应商 → 模型 → 密钥 → 写入配置）
   * @param {string} nextStep - 下一步骤 ('model' 或 'apiKey')
   */
  async quickConfigFlow(nextStep) {
    switch (nextStep) {
      case 'model':
        await this.selectModelInternal(true);
        break;
      case 'apiKey':
        await this.selectApiKeyInternal(true);
        break;
    }
  }

  /**
   * 在用户完成某个配置步骤后，提供下一步选项
   * @param {string} lastStep - 当前完成的步骤 ('provider', 'model', 'apiKey')
   */
  async promptNextStep(lastStep) {
    console.log(chalk.gray('\n---'));
    this.displayCurrentConfig();

    // 根据当前步骤构建可用选项
    const nextOptions = [];

    // 可以继续修改供应商
    nextOptions.push({
      title: '🔄 切换供应商',
      value: 'provider',
      description: '选择其他供应商',
    });

    // 可以继续修改模型
    nextOptions.push({
      title: '🤖 切换模型',
      value: 'model',
      description: '选择其他模型',
    });

    // 可以继续修改 API Key
    nextOptions.push({
      title: '🔑 切换 API Key',
      value: 'apiKey',
      description: '选择其他 API Key',
    });

    // 分隔线
    nextOptions.push({ title: '──────────────', disabled: true });

    // 写入配置（推荐选项）
    nextOptions.push({
      title: '✅ 写入配置',
      value: 'write',
      description: '保存配置到环境变量文件',
    });

    // 返回主菜单
    nextOptions.push({
      title: '🏠 返回主菜单',
      value: 'menu',
      description: '返回主菜单选择其他操作',
    });

    // 退出
    nextOptions.push({
      title: '❌ 退出',
      value: 'exit',
      description: '退出程序',
    });

    console.log(chalk.yellow.bold('\n📋 下一步操作:'));

    const choices = nextOptions.map(option => ({
      title: option.title,
      value: option.value,
      disabled: option.disabled,
    }));

    // 根据上一步骤设置初始焦点
    // 选项顺序: 0=供应商, 1=模型, 2=密钥, 3=分隔线, 4=写入, 5=主菜单, 6=退出
    let initialIndex = 0;
    if (lastStep === 'provider') {
      initialIndex = 1; // 聚焦到"切换模型"
    } else if (lastStep === 'model') {
      initialIndex = 2; // 聚焦到"切换 API Key"
    } else if (lastStep === 'apiKey') {
      initialIndex = 4; // 聚焦到"写入配置"
    }

    let response;
    try {
      response = await prompts({
        type: 'select',
        name: 'nextAction',
        message: '请选择下一步操作:',
        choices,
        initial: initialIndex,
      });
    } catch (error) {
      console.error(chalk.red('❌ 选择操作出错:'), error.message);
      await this.startInteractiveSelection();
      return;
    }

    if (!response.nextAction) {
      console.log(chalk.yellow('\n⚠️  操作已取消'));
      await this.startInteractiveSelection();
      return;
    }

    switch (response.nextAction) {
      case 'provider':
        await this.selectProvider();
        break;
      case 'model':
        await this.selectModel();
        break;
      case 'apiKey':
        await this.selectApiKey();
        break;
      case 'write':
        await this.writeEnvConfigAndSource();
        break;
      case 'menu':
        await this.startInteractiveSelection();
        break;
      case 'exit':
        console.log(chalk.green('\n👋 再见！'));
        process.exit(0);
        break;
    }
  }

  /**
   * 继续选择流程（保留用于兼容性）
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
        initial: false,
      });
    } catch (error) {
      console.error(chalk.red('❌ 确认对话框出错:'), error.message);
      await this.startInteractiveSelection();
      return;
    }

    if (response.continueSelection) {
      await this.startInteractiveSelection();
    } else {
      await this.writeEnvConfigAndSource();
    }
  }

  /**
   * 自动选择流程完成后继续
   */
  async continueFlowAfterAutoSelection() {
    console.log(chalk.gray('\n---'));
    this.displayCurrentConfig();

    let response;
    try {
      response = await prompts({
        type: 'confirm',
        name: 'continueSelection',
        message: '配置已完成，是否继续修改配置?',
        initial: false,
      });
    } catch (error) {
      console.error(chalk.red('❌ 确认对话框出错:'), error.message);
      await this.startInteractiveSelection();
      return;
    }

    if (response.continueSelection) {
      await this.startInteractiveSelection();
    } else {
      await this.writeEnvConfigAndSource();
    }
  }

  /**
   * 写入配置并提示生效
   */
  async writeEnvConfigAndSource() {
    try {
      // 在写入配置前进行完整验证
      this.configLoader.validateConfigFull(this.config);

      const provider = this.config.providers[this.config.current.provider];
      const apiKey = provider.apiKeys[this.config.current.apiKeyIndex];

      // 使用 baseUrl
      const baseUrl = provider.baseUrl;

      const envVars = {
        ANTHROPIC_BASE_URL: baseUrl,
        ANTHROPIC_AUTH_TOKEN: apiKey.key,
        ANTHROPIC_MODEL: this.config.current.model,
      };

      // 检测 Shell 和默认路径
      const shellType = this.envExporter.detectShell();
      const defaultPath = this.envExporter.getDefaultConfigPath(shellType);

      // 询问用户配置文件路径（使用上次路径或默认路径作为初始值）
      const pathResponse = await prompts({
        type: 'text',
        name: 'configPath',
        message: `配置文件路径 (${shellType}):`,
        initial: this.config.lastConfigPath || defaultPath,
      });

      if (!pathResponse.configPath) {
        console.log(chalk.yellow('\n⚠️  操作已取消'));
        return;
      }

      const configPath = expandHome(pathResponse.configPath);

      // 确认写入
      const confirmResponse = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: `确认将配置写入 ${configPath}?`,
        initial: true,
      });

      if (!confirmResponse.confirm) {
        console.log(chalk.yellow('\n⚠️  操作已取消'));
        return;
      }

      // 写入配置
      const result = await this.envExporter.writeEnvConfig(
        envVars,
        configPath,
        shellType,
        'zh-CN',
      );

      if (result.success) {
        // 保存最后使用的配置路径
        if (this.config.lastConfigPath !== configPath) {
          this.config.lastConfigPath = configPath;
          await this.saveConfig();
        }

        // 显示配置摘要和写入结果
        console.log(chalk.gray('\n' + '━'.repeat(50)));
        console.log(chalk.green.bold('✅ 配置已写入'));
        console.log(chalk.gray(`文件: ${configPath}`));

        console.log(chalk.yellow('\n📋 配置摘要:'));
        this.displayCurrentConfig(true);

        // 生效命令和剪切板
        const sourceCommand = `source ${configPath}`;
        console.log(chalk.cyan(`\n💡 使环境变量生效：`));
        console.log(chalk.gray(`   ${sourceCommand}`));

        try {
          await this.copyToClipboard(sourceCommand);
          console.log(chalk.green(`   (已复制到剪切板)`));
        } catch (error) {
          // 静默失败，不影响主流程
        }

        console.log('');
      } else {
        console.log(chalk.red(result.message));
      }
    } catch (error) {
      console.error(chalk.red(`❌ 写入配置失败: ${error.message}`));
    }
  }

  /**
   * 显示环境变量配置（非交互式）
   */
  async displayEnvConfig(configPath) {
    const shellType = this.envExporter.detectShell();

    // 根据文件内容识别 shell 格式
    let detectShellType = shellType;
    try {
      if (await fs.pathExists(configPath)) {
        const content = await fs.readFile(configPath, 'utf8');
        if (content.includes('set -gx')) {
          detectShellType = 'fish';
        } else if (content.includes('export ')) {
          detectShellType = 'bash';
        }
      }
    } catch (e) {
      // 忽略读取错误
    }

    const result = await this.envExporter.readEnvConfig(configPath, detectShellType);

    if (result.success) {
      console.log(chalk.white(`  文件格式: ${detectShellType}`));
      console.log(chalk.yellow('\n🔧 配置内容:'));
      console.log(result.configSection);
      console.log('');
    } else {
      console.log(chalk.yellow(result.message));
      console.log(chalk.gray('\n💡 提示: 可以选择 "✅ 写入配置" 来创建配置'));
    }
  }

  /**
   * 读取配置
   */
  async readFromEnvConfig() {
    console.log(chalk.yellow.bold('\n📖 查看配置...'));

    try {
      // 检测 Shell 和默认路径
      const shellType = this.envExporter.detectShell();
      const defaultPath =
        this.config.lastConfigPath ||
        this.envExporter.getDefaultConfigPath(shellType);

      // 询问用户配置文件路径
      const pathResponse = await prompts({
        type: 'text',
        name: 'configPath',
        message: `配置文件路径 (${shellType}):`,
        initial: defaultPath,
      });

      if (!pathResponse.configPath) {
        console.log(chalk.yellow('❌ 操作已取消'));
        await this.continueFlow();
        return;
      }

      const configPath = expandHome(pathResponse.configPath);

      // 保存最后使用的配置路径
      if (this.config.lastConfigPath !== configPath) {
        this.config.lastConfigPath = configPath;
        await this.saveConfig();
      }

      // 复用显示方法
      console.log(chalk.gray('\n' + '━'.repeat(50)));
      console.log(chalk.yellow.bold('📖 配置文件'));
      console.log(chalk.gray(`路径: ${configPath}`));

      await this.displayEnvConfig(configPath);

      console.log(chalk.cyan(`💡 重新加载: source ${configPath}`));
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

      pbcopy.on('close', code => {
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

  /**
   * 验证供应商是否存在
   * @param {string} providerId - 供应商ID
   * @param {string} context - 验证上下文（用于错误信息）
   * @returns {object} - 验证结果 { isValid: boolean, provider?: object, error?: string }
   */
  validateProvider(providerId, context = '配置') {
    const provider = this.config.providers[providerId];

    if (!provider) {
      console.log(chalk.red(`❌ 当前供应商不存在，请先选择${context}`));
      return { isValid: false };
    }

    return { isValid: true, provider };
  }

  /**
   * 过滤有效的项目列表（用于模型名称等）
   * @param {Array} items - 项目列表
   * @returns {Array} - 过滤后的有效项目列表
   */
  filterValidItems(items) {
    if (!Array.isArray(items)) {
      return [];
    }

    return items.filter(
      item => item && typeof item === 'string' && item.trim() !== '',
    );
  }

  /**
   * 过滤有效的 API Key 列表
   * @param {Array} apiKeys - API Key 列表
   * @returns {Array} - 过滤后的有效 API Key 列表
   */
  filterValidApiKeys(apiKeys) {
    if (!Array.isArray(apiKeys)) {
      return [];
    }

    return apiKeys.filter(apiKey => apiKey && apiKey.name && apiKey.key);
  }

  /**
   * 通用的用户选择提示
   * @param {string} message - 提示信息
   * @param {Array} choices - 选择项列表
   * @param {number} initialIndex - 初始选择索引
   * @param {string} responseKey - 响应键名（默认为 'value'）
   * @returns {Promise} - 用户选择的值
   */
  async promptUser(message, choices, initialIndex = 0, responseKey = 'value') {
    try {
      const response = await prompts({
        type: 'select',
        name: responseKey,
        message,
        choices,
        initial: initialIndex,
      });

      // 修复：使用严格的 undefined/null 检查，而不是 falsy 检查
      // 因为当值为 0 时，!0 是 true，会导致错误地返回 null
      if (
        response[responseKey] === undefined ||
        response[responseKey] === null
      ) {
        return null;
      }

      return response[responseKey];
    } catch (error) {
      console.error(chalk.red(`❌ 选择操作出错:`), error.message);
      return null;
    }
  }

  /**
   * 验证所有API Key
   */
  async validateAllApiKeys() {
    console.log(chalk.yellow.bold('\n🔑 验证所有API密钥...\n'));
    console.log(chalk.gray('━'.repeat(60)));

    const providers = Object.entries(this.config.providers);
    const results = [];

    for (const [providerId, provider] of providers) {
      if (!provider || !provider.apiKeys || provider.apiKeys.length === 0) {
        continue;
      }

      const providerName = provider.name || providerId;
      console.log(`\n📦 ${providerName} (${providerId})`);

      for (const apiKey of provider.apiKeys) {
        const apiKeyName = apiKey.name || '未命名';
        const apiKeyValue = apiKey.key;

        // 检查空密钥
        if (!apiKeyValue || apiKeyValue.trim() === '') {
          results.push({
            provider: providerName,
            apiKeyName: apiKeyName,
            status: '⭕️',
            error: '空密钥',
          });
          console.log(`   ⭕️ ${chalk.gray(apiKeyName)} (无密钥) - 空密钥`);
          continue;
        }

        // 跳过默认/示例密钥
        if (apiKeyValue === 'API_KEY' || apiKeyValue.length < 15) {
          results.push({
            provider: providerName,
            apiKeyName: apiKeyName,
            status: '⏭️',
            error: '示例密钥',
          });
          console.log(
            `   ⏭️  ${chalk.yellow(apiKeyName)} (${this.configLoader.maskApiKey(
              apiKeyValue,
            )}) - 示例密钥`,
          );
          continue;
        }

        // 验证API Key
        const isValid = await this.validateSingleApiKey(provider, apiKeyValue);
        const logMsg = `${apiKeyName} (${this.configLoader.maskApiKey(
          apiKeyValue,
        )})`;
        if (isValid) {
          results.push({
            provider: providerName,
            apiKeyName: apiKeyName,
            status: '✅',
            error: null,
          });
          console.log(`   ✅ ${chalk.green(logMsg)} `);
        } else {
          results.push({
            provider: providerName,
            apiKeyName: apiKeyName,
            status: '❌',
            error: '验证失败',
          });
          console.log(`   ❌ ${chalk.red(logMsg)}`);
        }
      }
    }

    // 显示总结
    console.log(chalk.gray('\n' + '━'.repeat(60)));
    console.log(
      chalk.yellow.bold(`\n📊 验证结果统计【总计: ${results.length}】:`),
    );

    const validCount = results.filter(r => r.status === '✅').length;
    const invalidCount = results.filter(r => r.status === '❌').length;
    const skippedCount = results.filter(r => r.status === '⏭️').length;
    const emptyCount = results.filter(r => r.status === '⭕️').length;

    console.log(chalk.green(`✅ 有效: ${validCount}`));
    console.log(chalk.red(`❌ 无效: ${invalidCount}`));
    console.log(chalk.yellow(`⏭️  跳过: ${skippedCount} (示例密钥)`));
    console.log(chalk.gray(`⭕️ 空密钥: ${emptyCount}`));

    await this.continueFlow();
  }

  /**
   * 验证单个API Key
   * @param {object} provider - 供应商配置
   * @param {string} apiKey - API Key
   * @returns {Promise<boolean>} - 是否有效
   */
  async validateSingleApiKey(provider, apiKey) {
    try {
      // 获取第一个可用模型
      const models = provider.models;
      if (!models || models.length === 0) {
        return false;
      }

      const model = models[0];
      const baseUrl = provider.baseUrl;

      // 构建请求
      const https = require('https');
      const url = new URL(baseUrl + 'messages');

      const postData = JSON.stringify({
        model: model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });

      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          Authorization: `Bearer ${apiKey}`,
          'anthropic-version': '2023-06-01',
        },
        timeout: 10000, // 10秒超时
      };

      return new Promise(resolve => {
        const req = https.request(options, res => {
          // 只要不是401/403认证错误，就认为密钥有效
          // 其他错误可能是模型不支持等，但密钥本身是有效的
          if (res.statusCode === 200 || res.statusCode === 400) {
            resolve(true);
          } else if (res.statusCode === 401 || res.statusCode === 403) {
            resolve(false);
          } else {
            // 其他状态码也认为密钥有效（可能是模型不支持等）
            resolve(true);
          }
        });

        req.on('error', () => {
          resolve(false);
        });

        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });

        req.write(postData);
        req.end();
      });
    } catch (error) {
      return false;
    }
  }
}

// 处理命令行参数
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🤖 AI 模型切换工具

用法:
  ccs [选项]

选项:
  -h, --help     显示帮助信息
  -s, --show     显示当前配置
  -v, --version  显示版本信息

示例:
  ccs            # 启动交互式配置
  ccs -s         # 快速查看当前配置

配置文件位置:
   ~/.claude/ccs-providers.json

更多信息请访问: https://github.com/fxzer/claude-code-switch
  `);
  process.exit(0);
}

if (args.includes('--show') || args.includes('-s')) {
  // 快速显示当前配置，复用现有方法
  (async () => {
    const cli = new AISwitchCLI();
    try {
      await cli.loadConfig();
      cli.displayCurrentConfig();

      // 显示环境变量配置
      const shellType = cli.envExporter.detectShell();
      const configPath =
        cli.config.lastConfigPath ||
        cli.envExporter.getDefaultConfigPath(shellType);

      console.log(chalk.yellow.bold('\n🔧 环境变量配置:'));
      console.log(chalk.white(`  配置文件: ${configPath}`));

      await cli.displayEnvConfig(configPath);
    } catch (error) {
      console.error(chalk.red.bold('\n❌ 错误:'), error.message);
      process.exit(1);
    }
    process.exit(0);
  })();
  return;
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
