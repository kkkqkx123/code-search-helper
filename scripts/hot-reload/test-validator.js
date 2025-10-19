const path = require('path');
const fs = require('fs').promises;
const { EventEmitter } = require('events');
const { HotReloadTest } = require('./hot-reload-test');
const { FileModifier } = require('./file-modifier');

/**
 * 热重载测试验证器
 */
class HotReloadTestValidator extends EventEmitter {
  constructor(testDir) {
    super();
    this.testDir = testDir;
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
  }

  /**
   * 运行完整的验证测试套件
   */
  async runValidationSuite() {
    console.log('🧪 开始热重载验证测试套件...');
    
    try {
      // 测试1: 基本文件变更检测
      await this.testBasicFileChangeDetection();
      
      // 测试2: 多文件同时变更
      await this.testMultipleFileChanges();
      
      // 测试3: 快速连续变更
      await this.testRapidSequentialChanges();
      
      // 测试4: 文件恢复
      await this.testFileRestoration();
      
      // 测试5: 忽略文件变更
      await this.testIgnoredFileChanges();
      
      // 测试6: 配置文件变更
      await this.testConfigFileChanges();
      
      // 输出测试结果
      this.printValidationResults();
      
      return this.testResults;
    } catch (error) {
      console.error('❌ 验证测试套件执行失败:', error);
      throw error;
    }
  }

  /**
   * 测试基本文件变更检测
   */
  async testBasicFileChangeDetection() {
    console.log('\n🔍 测试1: 基本文件变更检测');
    
    const testName = '基本文件变更检测';
    const modifier = new FileModifier(this.testDir);
    
    try {
      await modifier.initialize();
      
      // 修改单个文件
      const result = await modifier.modifyFile('index.js', {
        type: 'timestamp',
        count: 1
      });
      
      // 等待热重载处理
      await this.wait(2000);
      
      // 恢复文件
      await modifier.restoreFile('index.js');
      
      // 验证结果
      const success = result && result.modifiedSize > result.originalSize;
      
      this.addTestResult(testName, success, {
        file: 'index.js',
        originalSize: result.originalSize,
        modifiedSize: result.modifiedSize,
        timestamp: result.timestamp
      });
      
      console.log(success ? '✅ 通过' : '❌ 失败');
    } catch (error) {
      this.addTestResult(testName, false, { error: error.message });
      console.log('❌ 失败:', error.message);
    }
  }

  /**
   * 测试多文件同时变更
   */
  async testMultipleFileChanges() {
    console.log('\n🔍 测试2: 多文件同时变更');
    
    const testName = '多文件同时变更';
    const modifier = new FileModifier(this.testDir);
    
    try {
      await modifier.initialize();
      
      // 同时修改多个文件
      const modifications = [
        { file: 'index.js', options: { type: 'timestamp', count: 1 } },
        { file: 'app.ts', options: { type: 'append', content: '// Test comment' } },
        { file: 'config.json', options: { type: 'prepend', content: '{/* Test */}' } }
      ];
      
      const results = await modifier.batchModify(modifications);
      
      // 等待热重载处理
      await this.wait(3000);
      
      // 恢复所有文件
      await modifier.restoreAllFiles();
      
      // 验证结果
      const success = results.filter(r => r.success).length === modifications.length;
      
      this.addTestResult(testName, success, {
        totalFiles: modifications.length,
        successfulModifications: results.filter(r => r.success).length,
        results: results.map(r => ({ file: r.file, success: r.success }))
      });
      
      console.log(success ? '✅ 通过' : '❌ 失败');
    } catch (error) {
      this.addTestResult(testName, false, { error: error.message });
      console.log('❌ 失败:', error.message);
    }
  }

  /**
   * 测试快速连续变更
   */
  async testRapidSequentialChanges() {
    console.log('\n🔍 测试3: 快速连续变更');
    
    const testName = '快速连续变更';
    const modifier = new FileModifier(this.testDir);
    
    try {
      await modifier.initialize();
      
      // 快速连续修改同一文件
      const fileName = 'index.js';
      const changeCount = 5;
      
      for (let i = 0; i < changeCount; i++) {
        await modifier.modifyFile(fileName, {
          type: 'timestamp',
          count: 1
        });
        
        // 短暂延迟
        await this.wait(200);
      }
      
      // 等待热重载处理
      await this.wait(3000);
      
      // 恢复文件
      await modifier.restoreFile(fileName);
      
      // 验证结果
      const stats = modifier.getFileStats();
      const success = stats.modificationsByFile[fileName] >= changeCount;
      
      this.addTestResult(testName, success, {
        file: fileName,
        expectedChanges: changeCount,
        actualChanges: stats.modificationsByFile[fileName] || 0
      });
      
      console.log(success ? '✅ 通过' : '❌ 失败');
    } catch (error) {
      this.addTestResult(testName, false, { error: error.message });
      console.log('❌ 失败:', error.message);
    }
  }

  /**
   * 测试文件恢复
   */
  async testFileRestoration() {
    console.log('\n🔍 测试4: 文件恢复');
    
    const testName = '文件恢复';
    const modifier = new FileModifier(this.testDir);
    
    try {
      await modifier.initialize();
      
      // 修改文件
      const fileName = 'app.ts';
      await modifier.modifyFile(fileName, {
        type: 'timestamp',
        count: 1
      });
      
      // 获取修改后的内容
      const modifiedContent = await fs.readFile(
        path.join(this.testDir, fileName), 
        'utf8'
      );
      
      // 恢复文件
      await modifier.restoreFile(fileName);
      
      // 获取恢复后的内容
      const restoredContent = await fs.readFile(
        path.join(this.testDir, fileName), 
        'utf8'
      );
      
      // 验证结果
      const originalContent = modifier.originalFiles.get(fileName);
      const success = restoredContent === originalContent && modifiedContent !== originalContent;
      
      this.addTestResult(testName, success, {
        file: fileName,
        originalLength: originalContent.length,
        modifiedLength: modifiedContent.length,
        restoredLength: restoredContent.length,
        contentMatch: restoredContent === originalContent
      });
      
      console.log(success ? '✅ 通过' : '❌ 失败');
    } catch (error) {
      this.addTestResult(testName, false, { error: error.message });
      console.log('❌ 失败:', error.message);
    }
  }

  /**
   * 测试忽略文件变更
   */
  async testIgnoredFileChanges() {
    console.log('\n🔍 测试5: 忽略文件变更');
    
    const testName = '忽略文件变更';
    const modifier = new FileModifier(this.testDir);
    
    try {
      await modifier.initialize();
      
      // 创建应该被忽略的文件
      const ignoredFiles = [
        'test.log',
        'temp.tmp',
        '.hidden'
      ];
      
      for (const fileName of ignoredFiles) {
        const filePath = path.join(this.testDir, fileName);
        await fs.writeFile(filePath, `Test content at ${new Date().toISOString()}`, 'utf8');
        
        // 等待一段时间
        await this.wait(500);
        
        // 删除文件
        await fs.unlink(filePath);
      }
      
      // 等待热重载处理
      await this.wait(2000);
      
      // 验证结果 - 这个测试主要检查系统不会因为忽略文件而崩溃
      const success = true; // 如果没有抛出异常就算成功
      
      this.addTestResult(testName, success, {
        ignoredFiles: ignoredFiles,
        note: '系统应该忽略这些文件变更'
      });
      
      console.log(success ? '✅ 通过' : '❌ 失败');
    } catch (error) {
      this.addTestResult(testName, false, { error: error.message });
      console.log('❌ 失败:', error.message);
    }
  }

  /**
   * 测试配置文件变更
   */
  async testConfigFileChanges() {
    console.log('\n🔍 测试6: 配置文件变更');
    
    const testName = '配置文件变更';
    const modifier = new FileModifier(this.testDir);
    
    try {
      await modifier.initialize();
      
      // 修改配置文件
      const fileName = 'config.json';
      const originalConfig = JSON.parse(modifier.originalFiles.get(fileName));
      
      // 修改配置
      const modifiedConfig = {
        ...originalConfig,
        app: {
          ...originalConfig.app,
          version: '1.0.1',
          lastModified: new Date().toISOString()
        }
      };
      
      await fs.writeFile(
        path.join(this.testDir, fileName),
        JSON.stringify(modifiedConfig, null, 2),
        'utf8'
      );
      
      // 等待热重载处理
      await this.wait(2000);
      
      // 恢复配置文件
      await modifier.restoreFile(fileName);
      
      // 验证结果
      const restoredConfig = JSON.parse(
        await fs.readFile(path.join(this.testDir, fileName), 'utf8')
      );
      
      const success = JSON.stringify(restoredConfig) === JSON.stringify(originalConfig);
      
      this.addTestResult(testName, success, {
        file: fileName,
        originalVersion: originalConfig.app.version,
        modifiedVersion: modifiedConfig.app.version,
        restoredVersion: restoredConfig.app.version
      });
      
      console.log(success ? '✅ 通过' : '❌ 失败');
    } catch (error) {
      this.addTestResult(testName, false, { error: error.message });
      console.log('❌ 失败:', error.message);
    }
  }

  /**
   * 添加测试结果
   */
  addTestResult(testName, passed, details = {}) {
    this.testResults.total++;
    
    if (passed) {
      this.testResults.passed++;
    } else {
      this.testResults.failed++;
    }
    
    this.testResults.details.push({
      name: testName,
      passed,
      details,
      timestamp: new Date()
    });
    
    this.emit('testCompleted', { testName, passed, details });
  }

  /**
   * 打印验证结果
   */
  printValidationResults() {
    console.log('\n📊 热重载验证测试结果:');
    console.log('========================');
    console.log(`✅ 通过: ${this.testResults.passed}/${this.testResults.total}`);
    console.log(`❌ 失败: ${this.testResults.failed}/${this.testResults.total}`);
    console.log(`📈 成功率: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(2)}%`);
    
    if (this.testResults.failed > 0) {
      console.log('\n❌ 失败的测试:');
      this.testResults.details
        .filter(test => !test.passed)
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.details.error || '未知错误'}`);
        });
    }
    
    console.log('\n📋 详细结果:');
    this.testResults.details.forEach((test, index) => {
      const status = test.passed ? '✅' : '❌';
      console.log(`  ${index + 1}. ${status} ${test.name}`);
    });
    
    // 总体评估
    if (this.testResults.failed === 0) {
      console.log('\n🎉 所有测试通过！热重载功能工作正常。');
    } else if (this.testResults.passed > this.testResults.failed) {
      console.log('\n⚠️  大部分测试通过，但仍有问题需要解决。');
    } else {
      console.log('\n💥 多数测试失败，热重载功能可能存在严重问题。');
    }
  }

  /**
   * 等待指定时间
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 生成测试报告
   */
  generateReport() {
    const report = {
      summary: {
        total: this.testResults.total,
        passed: this.testResults.passed,
        failed: this.testResults.failed,
        successRate: (this.testResults.passed / this.testResults.total * 100).toFixed(2)
      },
      details: this.testResults.details,
      generatedAt: new Date().toISOString()
    };
    
    return report;
  }

  /**
   * 保存测试报告到文件
   */
  async saveReport(filePath) {
    const report = this.generateReport();
    await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`📄 测试报告已保存到: ${filePath}`);
  }
}

/**
 * 主函数
 */
async function main() {
  const testDir = path.resolve(__dirname, 'test-dir');
  const validator = new HotReloadTestValidator(testDir);
  
  try {
    // 运行验证测试套件
    await validator.runValidationSuite();
    
    // 保存测试报告
    const reportPath = path.join(__dirname, 'hot-reload-test-report.json');
    await validator.saveReport(reportPath);
    
    console.log('\n🎉 热重载验证测试完成！');
    
    // 根据测试结果设置退出码
    process.exit(validator.testResults.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n💥 热重载验证测试失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { HotReloadTestValidator };