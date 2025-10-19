const path = require('path');
const fs = require('fs').promises;
const { EventEmitter } = require('events');
const { HotReloadTest } = require('./hot-reload-test');
const { FileModifier } = require('./file-modifier');
const { HotReloadTestValidator } = require('./test-validator');

/**
 * 热重载测试运行器
 */
class HotReloadTestRunner extends EventEmitter {
  constructor() {
    super();
    this.testDir = path.resolve(__dirname, 'test-dir');
    this.results = {
      startTime: null,
      endTime: null,
      duration: 0,
      tests: [],
      overallSuccess: false
    };
  }

  /**
   * 运行完整的热重载测试套件
   */
  async runFullTestSuite() {
    console.log('🚀 开始运行完整的热重载测试套件...');
    console.log('=====================================');
    
    this.results.startTime = new Date();
    
    try {
      // 检查测试环境
      await this.checkTestEnvironment();
      
      // 运行基础热重载测试
      await this.runBasicHotReloadTest();
      
      // 运行文件修改测试
      await this.runFileModificationTest();
      
      // 运行验证测试套件
      await this.runValidationTestSuite();
      
      // 运行性能测试
      await this.runPerformanceTest();
      
      this.results.endTime = new Date();
      this.results.duration = this.results.endTime - this.results.startTime;
      
      // 计算总体成功率
      const successfulTests = this.results.tests.filter(t => t.success).length;
      this.results.overallSuccess = successfulTests === this.results.tests.length;
      
      // 生成并显示最终报告
      this.generateFinalReport();
      
      // 保存测试报告
      await this.saveTestReport();
      
      return this.results;
    } catch (error) {
      console.error('❌ 测试套件执行失败:', error);
      this.results.endTime = new Date();
      this.results.duration = this.results.endTime - this.results.startTime;
      this.results.error = error.message;
      
      // 即使出错也尝试保存报告
      await this.saveTestReport();
      
      throw error;
    }
  }

  /**
   * 检查测试环境
   */
  async checkTestEnvironment() {
    console.log('\n🔍 检查测试环境...');
    
    const testName = '环境检查';
    const startTime = Date.now();
    
    try {
      // 检查测试目录是否存在
      try {
        await fs.access(this.testDir);
        console.log('✅ 测试目录存在');
      } catch (error) {
        throw new Error(`测试目录不存在: ${this.testDir}`);
      }
      
      // 检查必要的测试文件
      const requiredFiles = ['index.js', 'app.ts', 'config.json', '.gitignore'];
      const missingFiles = [];
      
      for (const file of requiredFiles) {
        try {
          await fs.access(path.join(this.testDir, file));
        } catch (error) {
          missingFiles.push(file);
        }
      }
      
      if (missingFiles.length > 0) {
        throw new Error(`缺少必要的测试文件: ${missingFiles.join(', ')}`);
      }
      
      console.log('✅ 所有必要的测试文件都存在');
      
      // 检查Node.js版本
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      if (majorVersion < 14) {
        throw new Error(`Node.js版本过低 (${nodeVersion})，需要14.0或更高版本`);
      }
      
      console.log(`✅ Node.js版本兼容 (${nodeVersion})`);
      
      this.addTestResult(testName, true, {
        duration: Date.now() - startTime,
        nodeVersion,
        testFiles: requiredFiles.length
      });
      
      console.log('✅ 环境检查通过');
    } catch (error) {
      this.addTestResult(testName, false, {
        duration: Date.now() - startTime,
        error: error.message
      });
      
      console.log('❌ 环境检查失败:', error.message);
      throw error;
    }
  }

  /**
   * 运行基础热重载测试
   */
  async runBasicHotReloadTest() {
    console.log('\n🔥 运行基础热重载测试...');
    
    const testName = '基础热重载测试';
    const startTime = Date.now();
    
    try {
      const hotReloadTest = new HotReloadTest(this.testDir);
      const result = await hotReloadTest.startTest();
      
      const success = result.fileChanges.length > 0 && result.errors.length === 0;
      
      this.addTestResult(testName, success, {
        duration: Date.now() - startTime,
        fileChanges: result.fileChanges.length,
        errors: result.errors.length,
        testDuration: result.endTime - result.startTime
      });
      
      console.log(success ? '✅ 基础热重载测试通过' : '❌ 基础热重载测试失败');
    } catch (error) {
      this.addTestResult(testName, false, {
        duration: Date.now() - startTime,
        error: error.message
      });
      
      console.log('❌ 基础热重载测试失败:', error.message);
    }
  }

  /**
   * 运行文件修改测试
   */
  async runFileModificationTest() {
    console.log('\n📝 运行文件修改测试...');
    
    const testName = '文件修改测试';
    const startTime = Date.now();
    
    try {
      const modifier = new FileModifier(this.testDir);
      await modifier.initialize();
      
      // 执行随机修改
      await modifier.performRandomModifications(5);
      
      // 等待处理
      await this.wait(2000);
      
      // 恢复所有文件
      await modifier.restoreAllFiles();
      
      const stats = modifier.getFileStats();
      const success = stats.modifications > 0;
      
      this.addTestResult(testName, success, {
        duration: Date.now() - startTime,
        totalModifications: stats.modifications,
        filesModified: Object.keys(stats.modificationsByFile).length
      });
      
      console.log(success ? '✅ 文件修改测试通过' : '❌ 文件修改测试失败');
    } catch (error) {
      this.addTestResult(testName, false, {
        duration: Date.now() - startTime,
        error: error.message
      });
      
      console.log('❌ 文件修改测试失败:', error.message);
    }
  }

  /**
   * 运行验证测试套件
   */
  async runValidationTestSuite() {
    console.log('\n🧪 运行验证测试套件...');
    
    const testName = '验证测试套件';
    const startTime = Date.now();
    
    try {
      const validator = new HotReloadTestValidator(this.testDir);
      const result = await validator.runValidationSuite();
      
      const success = result.failed === 0;
      
      this.addTestResult(testName, success, {
        duration: Date.now() - startTime,
        totalTests: result.total,
        passedTests: result.passed,
        failedTests: result.failed,
        successRate: ((result.passed / result.total) * 100).toFixed(2)
      });
      
      console.log(success ? '✅ 验证测试套件通过' : '❌ 验证测试套件失败');
    } catch (error) {
      this.addTestResult(testName, false, {
        duration: Date.now() - startTime,
        error: error.message
      });
      
      console.log('❌ 验证测试套件失败:', error.message);
    }
  }

  /**
   * 运行性能测试
   */
  async runPerformanceTest() {
    console.log('\n⚡ 运行性能测试...');
    
    const testName = '性能测试';
    const startTime = Date.now();
    
    try {
      const modifier = new FileModifier(this.testDir);
      await modifier.initialize();
      
      // 测试大量文件变更的性能
      const fileCount = 10;
      const changesPerFile = 5;
      
      const performanceStartTime = Date.now();
      
      for (let i = 0; i < fileCount; i++) {
        const fileName = `index.js`; // 使用同一个文件测试性能
        
        for (let j = 0; j < changesPerFile; j++) {
          await modifier.modifyFile(fileName, {
            type: 'timestamp',
            count: 1
          });
          
          // 短暂延迟
          await this.wait(50);
        }
      }
      
      const performanceDuration = Date.now() - performanceStartTime;
      
      // 恢复文件
      await modifier.restoreFile('index.js');
      
      // 性能基准：每个变更应该在500ms内完成
      const expectedMaxDuration = fileCount * changesPerFile * 500;
      const success = performanceDuration < expectedMaxDuration;
      
      this.addTestResult(testName, success, {
        duration: Date.now() - startTime,
        totalChanges: fileCount * changesPerFile,
        performanceDuration,
        averageTimePerChange: performanceDuration / (fileCount * changesPerFile),
        expectedMaxDuration
      });
      
      console.log(success ? '✅ 性能测试通过' : '❌ 性能测试失败');
      console.log(`📊 性能数据: ${performanceDuration}ms 总时长, ${(performanceDuration / (fileCount * changesPerFile)).toFixed(2)}ms 平均每次变更`);
    } catch (error) {
      this.addTestResult(testName, false, {
        duration: Date.now() - startTime,
        error: error.message
      });
      
      console.log('❌ 性能测试失败:', error.message);
    }
  }

  /**
   * 添加测试结果
   */
  addTestResult(testName, success, details = {}) {
    this.results.tests.push({
      name: testName,
      success,
      details,
      timestamp: new Date()
    });
    
    this.emit('testCompleted', { testName, success, details });
  }

  /**
   * 生成最终报告
   */
  generateFinalReport() {
    console.log('\n📊 热重载测试最终报告');
    console.log('======================');
    
    const totalTests = this.results.tests.length;
    const successfulTests = this.results.tests.filter(t => t.success).length;
    const failedTests = totalTests - successfulTests;
    const successRate = ((successfulTests / totalTests) * 100).toFixed(2);
    
    console.log(`⏱️  总测试时长: ${this.results.duration}ms`);
    console.log(`📋 总测试数: ${totalTests}`);
    console.log(`✅ 成功: ${successfulTests}`);
    console.log(`❌ 失败: ${failedTests}`);
    console.log(`📈 成功率: ${successRate}%`);
    
    console.log('\n📋 测试详情:');
    this.results.tests.forEach((test, index) => {
      const status = test.success ? '✅' : '❌';
      const duration = test.details.duration || 'N/A';
      console.log(`  ${index + 1}. ${status} ${test.name} (${duration}ms)`);
      
      if (!test.success && test.details.error) {
        console.log(`     错误: ${test.details.error}`);
      }
    });
    
    // 总体评估
    if (this.results.overallSuccess) {
      console.log('\n🎉 所有测试通过！热重载功能工作正常。');
    } else if (successfulTests > failedTests) {
      console.log('\n⚠️  大部分测试通过，但仍有问题需要解决。');
    } else {
      console.log('\n💥 多数测试失败，热重载功能可能存在严重问题。');
    }
  }

  /**
   * 保存测试报告
   */
  async saveTestReport() {
    const reportPath = path.join(__dirname, 'hot-reload-test-report.json');
    
    try {
      const report = {
        ...this.results,
        generatedAt: new Date().toISOString(),
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        }
      };
      
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
      console.log(`\n📄 测试报告已保存到: ${reportPath}`);
    } catch (error) {
      console.error('❌ 保存测试报告失败:', error);
    }
  }

  /**
   * 等待指定时间
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 主函数
 */
async function main() {
  const runner = new HotReloadTestRunner();
  
  try {
    await runner.runFullTestSuite();
    
    // 根据测试结果设置退出码
    process.exit(runner.results.overallSuccess ? 0 : 1);
  } catch (error) {
    console.error('\n💥 热重载测试套件执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { HotReloadTestRunner };