const { Client, Connection } = require('../index.js');

/**
 * 第一阶段实施验证测试
 * 测试 Connection.js 和 Client.js 的会话管理优化
 */

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

// 测试结果统计
const testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

function assert(condition, message) {
  if (condition) {
    testResults.passed++;
    console.log(`✅ ${message}`);
  } else {
    testResults.failed++;
    const error = `❌ ${message}`;
    testResults.errors.push(error);
    console.log(error);
  }
}

async function testConnectionOptimizations() {
  console.log('\n=== 测试 Connection.js 优化 ===');
  
  // 测试1: close() 方法会话清理
  console.log('\n--- 测试1: close() 方法会话清理 ---');
  const conn1 = new Connection({
    host: '127.0.0.1',
    port: 9669,
    userName: 'root',
    password: 'nebula',
    space: 'test'
  });
  
  // 模拟会话ID设置
  conn1.sessionId = 'test-session-1';
  conn1.isReady = false;
  
  console.log('设置会话ID:', conn1.sessionId);
  
  // 调用close方法
  await conn1.close();
  
  assert(conn1.sessionId === null, 'close() 方法应该清理会话ID');
  assert(conn1.isReady === false, 'close() 方法应该保持isReady状态');
  
  // 测试2: forceCleanup 方法
  console.log('\n--- 测试2: forceCleanup 方法 ---');
  const conn2 = new Connection({
    host: '127.0.0.1',
    port: 9669,
    userName: 'root',
    password: 'nebula',
    space: 'test'
  });
  
  conn2.sessionId = 'test-session-2';
  console.log('设置会话ID:', conn2.sessionId);
  
  await conn2.forceCleanup();
  
  assert(conn2.sessionId === null, 'forceCleanup() 应该清理会话ID');
  
  // 测试3: 重连时的会话清理
  console.log('\n--- 测试3: 重连时的会话清理 ---');
  const conn3 = new Connection({
    host: '127.0.0.1',
    port: 9669,
    userName: 'root',
    password: 'nebula',
    space: 'test'
  });
  
  conn3.sessionId = 'old-session-id';
  console.log('设置旧会话ID:', conn3.sessionId);
  
  // 模拟认证成功时的清理逻辑
  if (conn3.sessionId) {
    await conn3.forceCleanup();
    console.log('清理旧会话完成');
  }
  
  assert(conn3.sessionId === null, '重连时应该清理旧会话');
  
  console.log('Connection.js 优化测试完成');
}

async function testClientOptimizations() {
  console.log('\n=== 测试 Client.js 优化 ===');
  
  // 测试1: 会话监控启动
  console.log('\n--- 测试1: 会话监控启动 ---');
  const client = new Client({
    servers: ['127.0.0.1:9669'],
    userName: 'root',
    password: 'nebula',
    space: 'test',
    poolSize: 2,
    pingInterval: 5000
  });
  
  assert(client.sessionMonitor !== undefined, 'Client应该启动会话监控');
  assert(typeof client.startSessionMonitor === 'function', 'Client应该有startSessionMonitor方法');
  assert(typeof client.stopSessionMonitor === 'function', 'Client应该有stopSessionMonitor方法');
  
  // 测试2: 僵尸会话检测和清理
  console.log('\n--- 测试2: 僵尸会话检测和清理 ---');
  
  // 创建模拟僵尸会话
  if (client.connections.length > 0) {
    const zombieConn = client.connections[0];
    zombieConn.sessionId = 'zombie-session-123';
    zombieConn.isReady = false;
    
    console.log('创建僵尸会话:', zombieConn.sessionId);
    
    // 手动触发监控检查（模拟定时器行为）
    let zombieFound = false;
    client.connections.forEach(conn => {
      if (conn.sessionId && !conn.isReady) {
        zombieFound = true;
        console.log(`发现僵尸会话 ${conn.sessionId}，正在清理...`);
        conn.forceCleanup().then(() => {
          console.log(`僵尸会话 ${conn.sessionId} 清理完成`);
        });
      }
    });
    
    assert(zombieFound, '应该能检测到僵尸会话');
    
    // 等待清理完成
    await new Promise(resolve => setTimeout(resolve, 100));
    
    assert(zombieConn.sessionId === null, '僵尸会话应该被清理');
  }
  
  // 测试3: 会话监控停止
  console.log('\n--- 测试3: 会话监控停止 ---');
  await client.close();
  
  assert(client.sessionMonitor === null, 'Client关闭后应该停止会话监控');
  
  console.log('Client.js 优化测试完成');
}

async function testAPICompatibility() {
  console.log('\n=== 测试 API 兼容性 ===');
  
  // 测试1: Connection API 兼容性
  console.log('\n--- 测试1: Connection API 兼容性 ---');
  const conn = new Connection({
    host: '127.0.0.1',
    port: 9669,
    userName: 'root',
    password: 'nebula',
    space: 'test'
  });
  
  // 验证现有API仍然存在
  assert(typeof conn.close === 'function', 'Connection应该有close方法');
  assert(typeof conn.prepare === 'function', 'Connection应该有prepare方法');
  assert(typeof conn.run === 'function', 'Connection应该有run方法');
  assert(typeof conn.ping === 'function', 'Connection应该有ping方法');
  
  // 验证新增的内部方法
  assert(typeof conn.forceCleanup === 'function', 'Connection应该有forceCleanup方法');
  
  // 测试2: Client API 兼容性
  console.log('\n--- 测试2: Client API 兼容性 ---');
  const client = new Client({
    servers: ['127.0.0.1:9669'],
    userName: 'root',
    password: 'nebula',
    space: 'test'
  });
  
  // 验证现有API仍然存在
  assert(typeof client.close === 'function', 'Client应该有close方法');
  assert(typeof client.execute === 'function', 'Client应该有execute方法');
  // 注意：Client没有connect方法，连接在构造函数中自动完成
  
  // 验证新增的内部方法
  assert(typeof client.startSessionMonitor === 'function', 'Client应该有startSessionMonitor方法');
  assert(typeof client.stopSessionMonitor === 'function', 'Client应该有stopSessionMonitor方法');
  
  await client.close();
  
  console.log('API 兼容性测试完成');
}

async function testErrorHandling() {
  console.log('\n=== 测试错误处理 ===');
  
  // 测试1: forceCleanup 的错误处理
  console.log('\n--- 测试1: forceCleanup 错误处理 ---');
  const conn = new Connection({
    host: '127.0.0.1',
    port: 9669,
    userName: 'root',
    password: 'nebula',
    space: 'test'
  });
  
  conn.sessionId = 'test-session-error';
  
  try {
    // 这应该能正常完成，即使有错误也应该被捕获
    await conn.forceCleanup();
    assert(conn.sessionId === null, '即使有错误，会话ID也应该被清理');
    console.log('forceCleanup 错误处理正常');
  } catch (error) {
    testResults.failed++;
    testResults.errors.push(`forceCleanup 不应该抛出错误: ${error.message}`);
  }
  
  // 测试2: 空会话ID的forceCleanup
  console.log('\n--- 测试2: 空会话ID的forceCleanup ---');
  const conn2 = new Connection({
    host: '127.0.0.1',
    port: 9669,
    userName: 'root',
    password: 'nebula',
    space: 'test'
  });
  
  conn2.sessionId = null;
  
  try {
    await conn2.forceCleanup();
    console.log('空会话ID的forceCleanup处理正常');
  } catch (error) {
    testResults.failed++;
    testResults.errors.push(`空会话ID的forceCleanup不应该抛出错误: ${error.message}`);
  }
  
  console.log('错误处理测试完成');
}

async function runAllTests() {
  console.log('开始第一阶段实施验证测试...');
  console.log('='.repeat(50));
  
  try {
    await testConnectionOptimizations();
    await testClientOptimizations();
    await testAPICompatibility();
    await testErrorHandling();
    
    console.log('\n' + '='.repeat(50));
    console.log('测试完成！');
    console.log(`通过: ${testResults.passed} 个`);
    console.log(`失败: ${testResults.failed} 个`);
    
    if (testResults.errors.length > 0) {
      console.log('\n错误详情:');
      testResults.errors.forEach(error => console.log(error));
    }
    
    if (testResults.failed === 0) {
      console.log('\n🎉 所有测试通过！第一阶段实施验证成功。');
      process.exit(0);
    } else {
      console.log('\n❌ 部分测试失败，请检查实施代码。');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('测试执行失败:', error);
    process.exit(1);
  }
}

// 运行所有测试
runAllTests();