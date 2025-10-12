import { Logger } from '../../src/utils/logger.ts';

async function testLogger() {
  console.log('Testing logger functionality...');

  // 测试正常退出
  console.log('\n1. Testing normal exit (log file should be deleted)');
  const logger1 = new Logger('test-normal');
  await logger1.info('This is a test log for normal exit');
  await logger1.info('Application is shutting down normally');

  // 等待一下确保日志写入
  await new Promise(resolve => setTimeout(resolve, 100));

  // 模拟正常退出
  process.exit(0);
}

// 如果直接运行这个脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  testLogger().catch(console.error);
}