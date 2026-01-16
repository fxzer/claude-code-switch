const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class EnvExporter {
  constructor() {
    this.shellType = this.detectShell();
    this.defaultPaths = {
      zsh: path.join(os.homedir(), '.zshrc'),
      bash: path.join(os.homedir(), '.bashrc'),
      fish: path.join(os.homedir(), '.config/fish/conf.d/ccs_env.fish'),
    };
  }

  /**
   * 检测当前 Shell 类型
   */
  detectShell() {
    const shellPath = process.env.SHELL;
    if (!shellPath) return 'zsh'; // 默认回退到 zsh

    if (shellPath.includes('fish')) return 'fish';
    if (shellPath.includes('bash')) return 'bash';
    return 'zsh';
  }

  /**
   * 获取默认配置文件路径
   * @param {string} shell - shell 类型 (zsh, bash, fish)
   */
  getDefaultConfigPath(shell = this.shellType) {
    return this.defaultPaths[shell] || this.defaultPaths.zsh;
  }

  /**
   * 格式化环境变量
   */
  formatEnvVars(envVars, shell, timeFormat) {
    const sectionStart =
      shell === 'fish' ? '# ==== ccs start ====' : '# ==== ccs start ====';
    const sectionEnd =
      shell === 'fish' ? '# ==== ccs end ====' : '# ==== ccs end ====';

    let content = `${sectionStart}\n`;
    content += '# AI 模型配置 - 由 ccs 命令自动生成\n';

    for (const [key, value] of Object.entries(envVars)) {
      // 转义特殊字符
      const escapedValue = value.replace(/"/g, '\\"').replace(/\$/g, '\\$');

      if (shell === 'fish') {
        content += `set -gx ${key} "${escapedValue}"\n`;
      } else {
        content += `export ${key}="${escapedValue}"\n`;
      }
    }

    content += `# 配置时间: ${new Date().toLocaleString(timeFormat)}\n`;
    content += `${sectionEnd}\n`;

    return { content, sectionStart, sectionEnd };
  }

  /**
   * 写入配置文件
   */
  async writeEnvConfig(
    envVars,
    configPath,
    shell = this.shellType,
    timeFormat = 'zh-CN'
  ) {
    try {
      // 确保目录存在
      await fs.ensureDir(path.dirname(configPath));

      const { content, sectionStart, sectionEnd } = this.formatEnvVars(
        envVars,
        shell,
        timeFormat
      );

      // 检查文件是否存在
      let existingContent = '';
      if (await fs.pathExists(configPath)) {
        existingContent = await fs.readFile(configPath, 'utf8');
      }

      // 移除旧的配置（如果存在）
      const startRegex = new RegExp(
        sectionStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'g'
      );
      const endRegex = new RegExp(
        sectionEnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'g'
      );

      const startIndex = existingContent.search(startRegex);
      const endIndex = existingContent.search(endRegex);

      if (startIndex !== -1 && endIndex !== -1) {
        // 移除旧的配置段
        existingContent =
          existingContent.substring(0, startIndex) +
          existingContent.substring(endIndex + sectionEnd.length + 1);
      }

      // 添加新的配置
      const newContent = existingContent.trim() + '\n\n' + content;

      // 写入文件
      await fs.writeFile(configPath, newContent, 'utf8');

      return {
        success: true,
        path: configPath,
        message: `✅ 环境变量已写入 ${configPath}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `❌ 写入 ${configPath} 失败: ${error.message}`,
      };
    }
  }

  /**
   * 读取配置文件
   */
  async readEnvConfig(configPath, shell = this.shellType) {
    try {
      if (!(await fs.pathExists(configPath))) {
        return { success: false, message: `${configPath} 文件不存在` };
      }

      const content = await fs.readFile(configPath, 'utf8');
      const sectionStart = '# ==== ccs start ====';
      const sectionEnd = '# ==== ccs end ====';

      const startIndex = content.indexOf(sectionStart);
      const endIndex = content.indexOf(sectionEnd);

      if (startIndex === -1 || endIndex === -1) {
        return { success: false, message: '未找到 AI 模型配置段' };
      }

      const configSection = content.substring(
        startIndex,
        endIndex + sectionEnd.length
      );
      const envVars = {};

      if (!configSection || typeof configSection !== 'string') {
        return { success: false, message: '配置段内容无效' };
      }

      const lines = configSection.split('\n');
      if (!Array.isArray(lines)) {
        return { success: false, message: '配置行解析失败' };
      }

      lines.forEach(line => {
        let match;
        if (shell === 'fish') {
          // set -gx KEY "VALUE"
          match = line.match(/^set\s+-gx\s+(\w+)\s+"(.*)"$/);
        } else {
          // export KEY="VALUE"
          match = line.match(/^export\s+(\w+)\s*=\s*"(.*)"$/);
        }

        if (match) {
          let value = match[2];
          // 反向转义: 将 \" 还原为 ", \$ 还原为 $
          value = value.replace(/\\"/g, '"').replace(/\\\$/g, '$');
          envVars[match[1]] = value;
        }
      });

      return {
        success: true,
        envVars,
        configSection,
        message: '✅ 成功读取配置',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `❌ 读取配置失败: ${error.message}`,
      };
    }
  }
}

module.exports = EnvExporter;
