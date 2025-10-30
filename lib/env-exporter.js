const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class EnvExporter {
  constructor() {
    this.globalZshrcPath = path.join(os.homedir(), '.zshrc');
  }

  

  /**
   * 写入 ~/.zshrc 文件
   */
  async writeToGlobalZshrc(envVars, timeFormat = 'zh-CN') {
    try {
      const sectionStart = '# ==== ccs start ====';
      const sectionEnd = '# ==== ccs end ====';

      // 生成配置内容
      let configContent = `${sectionStart}\n`;
      configContent += '# AI 模型配置 - 由 ccs 命令自动生成\n';

      for (const [key, value] of Object.entries(envVars)) {
        // 转义特殊字符
        const escapedValue = value.replace(/"/g, '\\"').replace(/\$/g, '\\$');
        configContent += `export ${key}="${escapedValue}"\n`;
      }

      // 使用配置化的时间格式
      configContent += `# 配置时间: ${new Date().toLocaleString(timeFormat)}\n`;
      configContent += `${sectionEnd}\n`;

      // 检查 ~/.zshrc 是否存在
      let existingContent = '';
      if (await fs.pathExists(this.globalZshrcPath)) {
        existingContent = await fs.readFile(this.globalZshrcPath, 'utf8');
      }

      // 移除旧的配置（如果存在）
      const startRegex = new RegExp(sectionStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const endRegex = new RegExp(sectionEnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');

      const startIndex = existingContent.search(startRegex);
      const endIndex = existingContent.search(endRegex);

      if (startIndex !== -1 && endIndex !== -1) {
        // 移除旧的配置段
        existingContent = existingContent.substring(0, startIndex) +
                         existingContent.substring(endIndex + sectionEnd.length + 1);
      }

      // 添加新的配置
      const newContent = existingContent.trim() + '\n\n' + configContent;

      // 写入文件
      await fs.writeFile(this.globalZshrcPath, newContent, 'utf8');

      return {
        success: true,
        path: this.globalZshrcPath,
        message: `✅ 环境变量已写入 ~/.zshrc`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `❌ 写入 ~/.zshrc 失败: ${error.message}`
      };
    }
  }

  /**
   * 从 ~/.zshrc 读取当前配置
   */
  async readFromGlobalZshrc() {
    try {
      if (!await fs.pathExists(this.globalZshrcPath)) {
        return { success: false, message: '~/.zshrc 文件不存在' };
      }

      const content = await fs.readFile(this.globalZshrcPath, 'utf8');
      const sectionStart = '# ==== ccs start ====';
      const sectionEnd = '# ==== ccs end ====';

      const startIndex = content.indexOf(sectionStart);
      const endIndex = content.indexOf(sectionEnd);

      if (startIndex === -1 || endIndex === -1) {
        return { success: false, message: '未找到 AI 模型配置段' };
      }

      const configSection = content.substring(startIndex, endIndex + sectionEnd.length);
      const envVars = {};

      // 安全检查：确保 configSection 不为空或 undefined
      if (!configSection || typeof configSection !== 'string') {
        return { success: false, message: '配置段内容无效' };
      }

      // 解析环境变量
      const lines = configSection.split('\n');

      // 安全检查：确保 lines 是数组
      if (!Array.isArray(lines)) {
        return { success: false, message: '配置行解析失败' };
      }

      lines.forEach(line => {
        const match = line.match(/^export\s+(\w+)\s*=\s*"(.*)"$/);
        if (match) {
          envVars[match[1]] = match[2];
        }
      });

      return {
        success: true,
        envVars,
        configSection,
        message: '✅ 成功读取配置'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `❌ 读取配置失败: ${error.message}`
      };
    }
  }
}

module.exports = EnvExporter;
