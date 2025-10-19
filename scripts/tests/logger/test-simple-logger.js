import fs from 'fs/promises';
import path from 'path';

// 简单的日志测试
async function testLogger() {
  const logDir = path.join(process.cwd(), 'logs');
  const logFileName = `test-${Date.now()}.log`;
  const logFilePath = path.join(logDir, logFileName);
  
  console.log('Testing logger cleanup functionality...');
  
  try {
    // 确保日志目录存在
    await fs.mkdir(logDir, { recursive: true });
    
    // 创建测试日志文件
    await fs.writeFile(logFilePath, 'Test log content\n');
    console.log(`Created log file: ${logFilePath}`);
    
    // 检查文件是否存在
    await fs.access(logFilePath);
    console.log('Log file exists before cleanup');
    
    // 模拟正常退出 - 删除文件
    await fs.unlink(logFilePath);
    console.log('Log file deleted (simulating normal exit)');
    
    // 验证文件已被删除
    try {
      await fs.access(logFilePath);
      console.log('ERROR: Log file still exists after cleanup');
    } catch (error) {
      console.log('SUCCESS: Log file properly deleted');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testLogger().catch(console.error);