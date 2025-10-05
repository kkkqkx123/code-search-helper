const { Client, Connection } = require('./index.js');

// 确保进程在测试完成后退出
process.on('SIGINT', () => {
  console.log('收到SIGINT信号，正在退出...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
  process.exit(1);
});

// 测试会话管理优化
async function testSessionManagement() {
  console.log('开始测试会话管理优化...');
  
  // 测试1: 会话清理机制
  console.log('\n=== 测试1: 会话清理机制 ===');
  const connection = new Connection({
    host: '127.0.0.1',
    port: 9669,
    userName: 'root',
    password: 'nebula',
    space: 'test'
  });
  
  // 模拟会话ID
  connection.sessionId = 'test-session-id';
  connection.isReady = false;
  
  console.log('模拟会话ID设置完成，开始关闭连接...');
  await connection.close();
  console.log('连接关闭完成，会话ID应该被清理');
  console.log(`当前会话ID: ${connection.sessionId}`);
  
  // 测试2: forceCleanup 方法
  console.log('\n=== 测试2: forceCleanup 方法 ===');
  connection.sessionId = 'test-session-id-2';
  console.log('设置新会话ID，调用forceCleanup...');
  await connection.forceCleanup();
  console.log(`forceCleanup后会话ID: ${connection.sessionId}`);
  
  // 测试3: 客户端会话监控
  console.log('\n=== 测试3: 客户端会话监控 ===');
  const client = new Client({
    servers: ['127.0.0.1:9669'],
    userName: 'root',
    password: 'nebula',
    space: 'test',
    poolSize: 2,
    pingInterval: 5000
  });
  
  // 模拟僵尸会话
  if (client.connections.length > 0) {
    client.connections[0].sessionId = 'zombie-session';
    client.connections[0].isReady = false;
    console.log('模拟僵尸会话创建完成');
    
    // 等待监控器检测
    console.log('等待35秒让会话监控器检测...');
    await new Promise(resolve => setTimeout(resolve, 35000));
    console.log('监控检测完成');
  }
  
  // 清理
  await client.close();
  console.log('\n=== 测试完成 ===');
  
  // 强制退出进程，避免卡住
  setTimeout(() => {
    console.log('强制退出进程...');
    process.exit(0);
  }, 1000);
}

// 运行测试
testSessionManagement().catch((error) => {
  console.error('测试失败:', error);
  process.exit(1);
});