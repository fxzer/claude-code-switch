const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

// 内部UI常量配置（不对用户暴露）
const UI_SETTINGS = {
  menuOptions: {
    selectProvider: '🏢 选择供应商',
    selectModel: '🤖 选择模型',
    selectApiKey: '🔑 选择密钥'
  },
  prompts: {
    selectProvider: '选择供应商:',
    selectModel: '选择模型:',
    selectApiKey: '选择密钥:'
  }
};

// 默认模型广场URL（向后兼容）
const DEFAULT_MODEL_HUB_URLS = {
  'siliconflow': 'https://cloud.siliconflow.cn/me/models',
  'bigmodel': 'https://bigmodel.cn/console/modelcenter/square',
  'modelscope': 'https://modelscope.cn/models',
  'deepseek': 'https://platform.deepseek.com/',
  'dashscope': 'https://bailian.console.aliyun.com/?tab=model#/model-market/all'
};

class ConfigLoader {
  constructor() {
    this.configPath = path.join(os.homedir(), '.claude', 'ccs-providers.json');
  }

  /**
   * 加载配置文件
   */
  async loadConfig() {
    try {
      if (await fs.pathExists(this.configPath)) {
        const config = await fs.readJson(this.configPath);
        console.log(`✓ 已加载配置文件: ${this.configPath}`);
        return config;
      } else {
        // 配置文件不存在，尝试从模板创建
        const created = await this.createFromTemplate();
        if (created) {
          const config = await fs.readJson(this.configPath);
          console.log(`✓ 已从模板创建并加载配置文件: ${this.configPath}`);
          return config;
        } else {
          throw new Error(`无法创建配置文件: ${this.configPath}`);
        }
      }
    } catch (error) {
      throw new Error(`配置文件读取失败: ${error.message}

配置文件位置: ${this.configPath}

请手动创建配置文件或检查模板文件是否存在。`);
    }
  }

  /**
   * 从模板创建配置文件
   */
  async createFromTemplate() {
    try {
      // 获取模板文件路径
      const templatePath = path.join(__dirname, '..', 'ccs.template.json');

      // 检查模板文件是否存在
      if (!(await fs.pathExists(templatePath))) {
        console.error(chalk.yellow(`⚠️  模板文件不存在: ${templatePath}`));
        return false;
      }

      // 确保配置目录存在
      await fs.ensureDir(path.dirname(this.configPath));

      // 复制模板文件到配置路径
      const templateContent = await fs.readJson(templatePath);
      await fs.writeJson(this.configPath, templateContent, { spaces: 2 });

      console.log(chalk.green(`✅ 已从模板创建配置文件: ${this.configPath}`));
      console.log(chalk.cyan(`📝 模板文件: ${templatePath}`));
      console.log(chalk.yellow('\n💡 接下来请按以下步骤配置:'));
      console.log(chalk.white(`   1. 编辑配置文件: ${this.configPath}`));
      console.log(chalk.white('   2. 替换 API Key 中的 sk-xxx, sk-yyy 等为真实密钥'));
      console.log(chalk.white('   3. 根据需要修改模型列表'));
      console.log(chalk.cyan('\n📖 编辑命令示例:'));
      console.log(chalk.gray('   # 使用 VS Code 编辑'));
      console.log(chalk.gray(`   code ${this.configPath}`));
      console.log(chalk.gray('   # 或使用 vim 编辑'));
      console.log(chalk.gray(`   vim ${this.configPath}`));

      return true;
    } catch (error) {
      console.error(chalk.red(`❌ 从模板创建配置文件失败: ${error.message}`));
      return false;
    }
  }

  /**
   * 保存配置文件
   */
  async saveConfig(config) {
    try {
      // 确保目录存在
      await fs.ensureDir(path.dirname(this.configPath));

      // 保存配置
      await fs.writeJson(this.configPath, config, { spaces: 2 });
      console.log(`✓ 配置已保存到: ${this.configPath}`);
      return this.configPath;
    } catch (error) {
      throw new Error(`保存配置失败: ${error.message}`);
    }
  }

  /**
   * 验证配置文件格式（启动时的基本验证）
   */
  validateConfig(config) {
    if (!config.providers || typeof config.providers !== 'object') {
      throw new Error('配置文件必须包含 providers 对象');
    }

    if (!config.current || typeof config.current !== 'object') {
      throw new Error('配置文件必须包含 current 对象');
    }

    // 验证当前配置的供应商是否存在
    const currentProvider = config.current.provider;
    if (!config.providers[currentProvider]) {
      throw new Error(`当前供应商 "${currentProvider}" 在 providers 中不存在`);
    }

    return true;
  }

  /**
   * 完整验证配置（包括模型和API Key）
   */
  validateConfigFull(config) {
    // 先进行基本验证
    this.validateConfig(config);

    const currentProvider = config.current.provider;
    const provider = config.providers[currentProvider];

    // 验证当前模型是否存在
    if (!provider.models || !provider.models.includes(config.current.model)) {
      throw new Error(`当前模型 "${config.current.model}" 在供应商 "${currentProvider}" 中不存在`);
    }

    // 验证API Key索引
    if (!provider.apiKeys || provider.apiKeys.length === 0) {
      throw new Error(`供应商 "${currentProvider}" 必须至少有一个 API Key`);
    }

    if (config.current.apiKeyIndex >= provider.apiKeys.length) {
      throw new Error(`API Key 索引超出范围`);
    }

    return true;
  }

  /**
   * 获取当前配置信息（安全处理不完整配置）
   */
  getCurrentConfig(config) {
    const provider = config.providers[config.current.provider];

    // 安全获取API Key信息
    let apiKeyInfo = { name: '未知', key: 'sk-xxxx' };
    if (provider && provider.apiKeys && provider.apiKeys.length > 0 &&
        config.current.apiKeyIndex < provider.apiKeys.length) {
      const currentApiKey = provider.apiKeys[config.current.apiKeyIndex];
      apiKeyInfo = {
        name: currentApiKey.name || '未知',
        key: this.maskApiKey(currentApiKey.key || 'sk-xxxx')
      };
    }

    return {
      provider: {
        id: config.current.provider,
        name: provider ? (provider.name || '未知供应商') : '未知供应商',
        baseUrl: provider ? (provider.baseUrl || '未知') : '未知',
        modelHubUrl: provider ? (provider.modelHubUrl || this.getDefaultModelHubUrl(config.current.provider)) : null
      },
      model: config.current.model || '未知模型',
      apiKey: apiKeyInfo
    };
  }

  /**
   * 获取默认模型广场网址
   */
  getDefaultModelHubUrl(providerId) {
    // 使用内部常量
    return DEFAULT_MODEL_HUB_URLS[providerId] || null;
  }

  /**
   * 获取UI设置（内部常量配置）
   */
  getUISettings() {
    // 直接返回内部常量，UI文本对用户不可见
    return {
      ui: {
        menuOptions: {
          ...UI_SETTINGS.menuOptions
        },
        prompts: {
          ...UI_SETTINGS.prompts
        }
      }
    };
  }

  /**
   * 遮蔽API Key显示
   */
  maskApiKey(apiKey) {
    if (!apiKey || apiKey.length < 8) return apiKey;
    return apiKey.substring(0, 6) + '...' + apiKey.substring(apiKey.length - 4);
  }
}

module.exports = ConfigLoader;
