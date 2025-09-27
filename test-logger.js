import { Logger } from './src/utils/logger.js';

async function testLogger() {
  console.log('开始测试日志功能...');
  
  const logger = new Logger('test-logger');
  
  // 等待一下让初始化完成
  await new Promise(resolve => setTimeout(resolve, 100));
  
  try {
    await logger.info('这是一条信息日志');
    await logger.warn('这是一条警告日志');
    await logger.error('这是一条错误日志');
    await logger.debug('这是一条调试日志');
    
    console.log('日志文件路径:', logger.getLogFilePath());
    
    // 检查日志文件是否存在
    const fs = await import('fs/promises');
    try {
      await fs.access(logger.getLogFilePath());
      console.log('✅ 日志文件创建成功');
      
      // 读取并显示日志内容
      const content = await fs.readFile(logger.getLogFilePath(), 'utf8');
      console.log('日志文件内容:');
      console.log(content);
    } catch (error) {
      console.log('❌ 日志文件创建失败:', error.message);
    }
  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }
  
  // 等待一下让日志写入完成
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('测试完成');
}

testLogger().catch(console.error);