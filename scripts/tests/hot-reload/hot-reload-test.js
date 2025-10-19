const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const { EventEmitter } = require('events');

/**
 * 热重载测试类
 */
class HotReloadTest extends EventEmitter {
  constructor(testDir) {
    super();
    this.testDir = testDir;
    this.process = null;
    this.isRunning = false;
    this.changeDetected = false;
    this.testResults = {
      fileChanges: [],
      errors: [],
      startTime: null,
      endTime: null
    };
  }

  /**
   * 启动热重载测试
   */
  async startTest() {
    try {
      console.log('🚀 启动热重载测试...');
      this.testResults.startTime = new Date();
      
      // 启动主应用进程
      await this.startMainProcess();
      
      // 等待进程稳定
      await this.wait(2000);
      
      // 开始文件变更测试
      await this.performFileChangeTests();
      
      // 等待热重载处理
      await this.wait(3000);
      
      // 停止进程
      await this.stopMainProcess();
      
      this.testResults.endTime = new Date();
      
      // 输出测试结果
      this.printTestResults();
      
      return this.testResults;
    } catch (error) {
      console.error('❌ 测试过程中发生错误:', error);
      this.testResults.errors.push(error.message);
      throw error;
    }
  }

  /**
   * 启动主应用进程
   */
  async startMainProcess() {
    return new Promise((resolve, reject) => {
      console.log('📦 启动主应用进程...');
      
      // 启动主应用
      this.process = spawn('npm', ['run', 'dev'], {
        cwd: path.resolve(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { 
          ...process.env, 
          NODE_ENV: 'development',
          HOT_RELOAD_TEST: 'true'
        }
      });

      this.process.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('📤 主进程输出:', output.trim());
        
        // 检测热重载相关输出
        if (output.includes('hot reload') || output.includes('Hot Reload')) {
          this.changeDetected = true;
          this.testResults.fileChanges.push({
            type: 'hot_reload_detected',
            timestamp: new Date(),
            output: output.trim()
          });
          this.emit('hotReloadDetected', output);
        }
      });

      this.process.stderr.on('data', (data) => {
        const output = data.toString();
        console.error('❌ 主进程错误:', output.trim());
        this.testResults.errors.push(output.trim());
      });

      this.process.on('close', (code) => {
        console.log(`🔄 主进程退出，代码: ${code}`);
        this.isRunning = false;
      });

      this.process.on('error', (error) => {
        console.error('❌ 主进程启动错误:', error);
        reject(error);
      });

      // 等待进程启动
      setTimeout(() => {
        this.isRunning = true;
        console.log('✅ 主进程启动成功');
        resolve();
      }, 3000);
    });
  }

  /**
   * 停止主应用进程
   */
  async stopMainProcess() {
    if (this.process && this.isRunning) {
      console.log('🛑 停止主应用进程...');
      
      return new Promise((resolve) => {
        this.process.on('close', () => {
          console.log('✅ 主进程已停止');
          resolve();
        });
        
        this.process.kill('SIGTERM');
        
        // 强制终止超时
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);
      });
    }
  }

  /**
   * 执行文件变更测试
   */
  async performFileChangeTests() {
    console.log('🔧 开始文件变更测试...');
    
    const testFiles = [
      'index.js',
      'app.ts',
      'config.json'
    ];

    for (const file of testFiles) {
      await this.modifyFile(file);
      await this.wait(1000); // 等待文件系统处理
    }
  }

  /**
   * 修改文件内容
   */
  async modifyFile(fileName) {
    try {
      const filePath = path.join(this.testDir, fileName);
      const originalContent = await fs.readFile(filePath, 'utf8');
      
      // 添加时间戳注释来触发变更
      const timestamp = new Date().toISOString();
      const modifiedContent = `// Modified at ${timestamp}\n${originalContent}`;
      
      await fs.writeFile(filePath, modifiedContent, 'utf8');
      
      console.log(`✏️ 修改文件: ${fileName}`);
      
      this.testResults.fileChanges.push({
        type: 'file_modified',
        file: fileName,
        timestamp: new Date(),
        size: modifiedContent.length
      });
      
      // 等待一段时间后恢复原内容
      await this.wait(2000);
      await fs.writeFile(filePath, originalContent, 'utf8');
      
      console.log(`🔄 恢复文件: ${fileName}`);
      
      this.testResults.fileChanges.push({
        type: 'file_restored',
        file: fileName,
        timestamp: new Date(),
        size: originalContent.length
      });
    } catch (error) {
      console.error(`❌ 修改文件失败 ${fileName}:`, error);
      this.testResults.errors.push(`修改文件失败 ${fileName}: ${error.message}`);
    }
  }

  /**
   * 等待指定时间
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 打印测试结果
   */
  printTestResults() {
    console.log('\n📊 热重载测试结果:');
    console.log('==================');
    
    const duration = this.testResults.endTime - this.testResults.startTime;
    console.log(`⏱️  测试时长: ${duration}ms`);
    
    console.log(`📁 文件变更次数: ${this.testResults.fileChanges.length}`);
    console.log(`❌ 错误次数: ${this.testResults.errors.length}`);
    
    if (this.testResults.fileChanges.length > 0) {
      console.log('\n📋 文件变更详情:');
      this.testResults.fileChanges.forEach((change, index) => {
        console.log(`  ${index + 1}. ${change.type}: ${change.file || 'N/A'} - ${change.timestamp.toISOString()}`);
      });
    }
    
    if (this.testResults.errors.length > 0) {
      console.log('\n❌ 错误详情:');
      this.testResults.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    // 判断测试是否成功
    const hasHotReloadEvents = this.testResults.fileChanges.some(
      change => change.type === 'hot_reload_detected'
    );
    
    if (hasHotReloadEvents) {
      console.log('\n✅ 热重载功能正常工作！');
    } else {
      console.log('\n⚠️  未检测到热重载事件，可能存在问题');
    }
  }
}

/**
 * 主函数
 */
async function main() {
  const testDir = path.resolve(__dirname, 'test-dir');
  
  // 检查测试目录是否存在
  try {
    await fs.access(testDir);
  } catch (error) {
    console.error(`❌ 测试目录不存在: ${testDir}`);
    process.exit(1);
  }
  
  const test = new HotReloadTest(testDir);
  
  try {
    await test.startTest();
    console.log('\n🎉 热重载测试完成！');
  } catch (error) {
    console.error('\n💥 热重载测试失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { HotReloadTest };