const path = require('path');
const fs = require('fs').promises;
const { EventEmitter } = require('events');

/**
 * 文件修改器类
 */
class FileModifier extends EventEmitter {
  constructor(testDir) {
    super();
    this.testDir = testDir;
    this.originalFiles = new Map(); // 存储原始文件内容
    this.modificationHistory = [];
  }

  /**
   * 初始化，备份所有原始文件
   */
  async initialize() {
    console.log('📁 初始化文件修改器...');
    
    const files = await this.getAllTestFiles();
    
    for (const file of files) {
      const filePath = path.join(this.testDir, file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        this.originalFiles.set(file, content);
        console.log(`✅ 备份文件: ${file}`);
      } catch (error) {
        console.warn(`⚠️  无法备份文件 ${file}:`, error.message);
      }
    }
    
    console.log(`📋 已备份 ${this.originalFiles.size} 个文件`);
  }

  /**
   * 获取所有测试文件
   */
  async getAllTestFiles() {
    try {
      const entries = await fs.readdir(this.testDir, { withFileTypes: true });
      return entries
        .filter(entry => entry.isFile())
        .map(entry => entry.name)
        .filter(name => 
          !name.startsWith('.') && 
          !name.endsWith('.log') &&
          !name.endsWith('.tmp')
        );
    } catch (error) {
      console.error('❌ 读取测试目录失败:', error);
      return [];
    }
  }

  /**
   * 修改指定文件
   */
  async modifyFile(fileName, options = {}) {
    const {
      type = 'timestamp', // 'timestamp', 'content', 'append', 'prepend'
      content = null,
      count = 1
    } = options;

    const filePath = path.join(this.testDir, fileName);
    
    try {
      const originalContent = this.originalFiles.get(fileName);
      if (!originalContent) {
        throw new Error(`文件 ${fileName} 没有备份，无法修改`);
      }

      let modifiedContent;
      
      switch (type) {
        case 'timestamp':
          modifiedContent = this.addTimestampComment(originalContent, count);
          break;
        case 'content':
          modifiedContent = content || originalContent;
          break;
        case 'append':
          modifiedContent = originalContent + '\n' + (content || `// Appended at ${new Date().toISOString()}`);
          break;
        case 'prepend':
          modifiedContent = (content || `// Prepended at ${new Date().toISOString()}`) + '\n' + originalContent;
          break;
        default:
          throw new Error(`未知的修改类型: ${type}`);
      }

      await fs.writeFile(filePath, modifiedContent, 'utf8');
      
      const modification = {
        file: fileName,
        type,
        timestamp: new Date(),
        originalSize: originalContent.length,
        modifiedSize: modifiedContent.length,
        count
      };
      
      this.modificationHistory.push(modification);
      
      console.log(`✏️ 修改文件: ${fileName} (${type})`);
      this.emit('fileModified', modification);
      
      return modification;
    } catch (error) {
      console.error(`❌ 修改文件失败 ${fileName}:`, error);
      this.emit('error', { file: fileName, error: error.message });
      throw error;
    }
  }

  /**
   * 添加时间戳注释
   */
  addTimestampComment(content, count = 1) {
    const timestamp = new Date().toISOString();
    const comment = this.getCommentForFile(content);
    let modifiedContent = content;
    
    for (let i = 0; i < count; i++) {
      const ts = new Date(timestamp);
      ts.setMilliseconds(ts.getMilliseconds() + i);
      modifiedContent = `${comment} Modified ${i + 1} at ${ts.toISOString()}\n${modifiedContent}`;
    }
    
    return modifiedContent;
  }

  /**
   * 根据文件类型获取注释符号
   */
  getCommentForFile(content) {
    if (content.includes('//')) return '//';
    if (content.includes('#')) return '#';
    if (content.includes('<!--')) return '<!--';
    return '//';
  }

  /**
   * 恢复文件到原始状态
   */
  async restoreFile(fileName) {
    const filePath = path.join(this.testDir, fileName);
    const originalContent = this.originalFiles.get(fileName);
    
    if (!originalContent) {
      throw new Error(`文件 ${fileName} 没有备份，无法恢复`);
    }

    try {
      await fs.writeFile(filePath, originalContent, 'utf8');
      
      const restoration = {
        file: fileName,
        timestamp: new Date(),
        restoredSize: originalContent.length
      };
      
      this.modificationHistory.push({
        ...restoration,
        type: 'restore'
      });
      
      console.log(`🔄 恢复文件: ${fileName}`);
      this.emit('fileRestored', restoration);
      
      return restoration;
    } catch (error) {
      console.error(`❌ 恢复文件失败 ${fileName}:`, error);
      this.emit('error', { file: fileName, error: error.message });
      throw error;
    }
  }

  /**
   * 恢复所有文件
   */
  async restoreAllFiles() {
    console.log('🔄 恢复所有文件...');
    
    const files = Array.from(this.originalFiles.keys());
    const results = [];
    
    for (const file of files) {
      try {
        const result = await this.restoreFile(file);
        results.push({ success: true, file, result });
      } catch (error) {
        results.push({ success: false, file, error: error.message });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    console.log(`✅ 成功恢复 ${successful}/${files.length} 个文件`);
    
    return results;
  }

  /**
   * 执行批量修改
   */
  async batchModify(modifications) {
    console.log(`🔧 执行批量修改 (${modifications.length} 个文件)...`);
    
    const results = [];
    
    for (const mod of modifications) {
      try {
        const result = await this.modifyFile(mod.file, mod.options);
        results.push({ success: true, ...mod, result });
        
        // 在修改之间添加小延迟
        await this.wait(100);
      } catch (error) {
        results.push({ success: false, ...mod, error: error.message });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    console.log(`✅ 成功修改 ${successful}/${modifications.length} 个文件`);
    
    return results;
  }

  /**
   * 执行随机修改测试
   */
  async performRandomModifications(count = 5) {
    console.log(`🎲 执行随机修改测试 (${count} 次)...`);
    
    const files = Array.from(this.originalFiles.keys());
    const modificationTypes = ['timestamp', 'append', 'prepend'];
    
    const modifications = [];
    
    for (let i = 0; i < count; i++) {
      const randomFile = files[Math.floor(Math.random() * files.length)];
      const randomType = modificationTypes[Math.floor(Math.random() * modificationTypes.length)];
      const randomCount = Math.floor(Math.random() * 3) + 1;
      
      modifications.push({
        file: randomFile,
        options: {
          type: randomType,
          count: randomCount
        }
      });
    }
    
    return await this.batchModify(modifications);
  }

  /**
   * 等待指定时间
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取修改历史
   */
  getModificationHistory() {
    return [...this.modificationHistory];
  }

  /**
   * 清理修改历史
   */
  clearHistory() {
    this.modificationHistory = [];
    console.log('🧹 清理修改历史');
  }

  /**
   * 获取文件统计信息
   */
  getFileStats() {
    const stats = {
      totalFiles: this.originalFiles.size,
      modifications: this.modificationHistory.length,
      modificationsByFile: {},
      modificationsByType: {}
    };
    
    for (const mod of this.modificationHistory) {
      // 按文件统计
      if (!stats.modificationsByFile[mod.file]) {
        stats.modificationsByFile[mod.file] = 0;
      }
      stats.modificationsByFile[mod.file]++;
      
      // 按类型统计
      if (!stats.modificationsByType[mod.type]) {
        stats.modificationsByType[mod.type] = 0;
      }
      stats.modificationsByType[mod.type]++;
    }
    
    return stats;
  }

  /**
   * 打印统计信息
   */
  printStats() {
    const stats = this.getFileStats();
    
    console.log('\n📊 文件修改统计:');
    console.log('==================');
    console.log(`📁 总文件数: ${stats.totalFiles}`);
    console.log(`🔧 总修改次数: ${stats.modifications}`);
    
    console.log('\n📋 按文件统计:');
    for (const [file, count] of Object.entries(stats.modificationsByFile)) {
      console.log(`  ${file}: ${count} 次`);
    }
    
    console.log('\n📋 按类型统计:');
    for (const [type, count] of Object.entries(stats.modificationsByType)) {
      console.log(`  ${type}: ${count} 次`);
    }
  }
}

/**
 * 主函数 - 演示用法
 */
async function main() {
  const testDir = path.resolve(__dirname, 'test-dir');
  const modifier = new FileModifier(testDir);
  
  try {
    // 初始化
    await modifier.initialize();
    
    // 执行随机修改
    await modifier.performRandomModifications(3);
    
    // 等待一段时间
    await modifier.wait(2000);
    
    // 恢复所有文件
    await modifier.restoreAllFiles();
    
    // 打印统计信息
    modifier.printStats();
    
    console.log('\n🎉 文件修改测试完成！');
  } catch (error) {
    console.error('\n💥 文件修改测试失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { FileModifier };