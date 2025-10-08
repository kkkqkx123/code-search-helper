const { Client } = require('../index');
const Connection = require('../nebula/Connection');

// 测试配置
const testConfig = {
  servers: ['127.0.0.1:9669'],
  userName: 'root',
  password: 'nebula',
  space: 'test_space',
  poolSize: 2,
  timeout: 5000
};

// 测试结果统计
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function addTestResult(testName, passed, message = '') {
  testResults.tests.push({ testName, passed, message });
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${testName}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${testName}: ${message}`);
  }
}

// 测试僵尸会话识别
async function testZombieSessionDetection() {
  console.log('\n=== 测试僵尸会话识别 ===');
  
  try {
    // 创建模拟的僵尸会话
    const mockConnection = new Connection({
      host: '127.0.0.1',
      port: 9669,
      userName: 'root',
      password: 'nebula',
      space: 'test_space'
    });
    
    // 模拟僵尸会话状态
    mockConnection.sessionId = 'zombie-session-123';
    mockConnection.isReady = false;
    mockConnection.lastActivityTime = Date.now() - 70000; // 70秒前
    
    // 创建客户端实例
    const client = new Client(testConfig);
    
    // 测试僵尸会话识别
    const isZombie = client.identifyZombieSession(mockConnection);
    addTestResult('应该正确识别僵尸会话', isZombie, '僵尸会话识别失败');
    
    // 测试正常会话不被识别为僵尸
    mockConnection.isReady = true;
    const isNotZombie = !client.identifyZombieSession(mockConnection);
    addTestResult('正常会话不应被识别为僵尸', isNotZombie, '正常会话被错误识别为僵尸');
    
    // 测试无sessionId的连接
    mockConnection.sessionId = null;
    mockConnection.isReady = false;
    const noSessionNotZombie = !client.identifyZombieSession(mockConnection);
    addTestResult('无sessionId的连接不应被识别为僵尸', noSessionNotZombie, '无sessionId连接被错误识别');
    
  } catch (error) {
    addTestResult('僵尸会话识别测试', false, error.message);
  }
}

// 测试分层清理策略
async function testCleanupLevelDetermination() {
  console.log('\n=== 测试分层清理策略 ===');
  
  try {
    const client = new Client(testConfig);
    const mockConnection = new Connection({
      host: '127.0.0.1',
      port: 9669,
      userName: 'root',
      password: 'nebula',
      space: 'test_space'
    });
    
    // 测试轻度清理（60-90秒）
    mockConnection.lastActivityTime = Date.now() - 75000; // 75秒前
    const lightLevel = client.determineCleanupLevel(mockConnection);
    addTestResult('应该返回轻度清理级别', lightLevel === 'LIGHT', `实际级别: ${lightLevel}`);
    
    // 测试中度清理（90-120秒）
    mockConnection.lastActivityTime = Date.now() - 105000; // 105秒前
    const mediumLevel = client.determineCleanupLevel(mockConnection);
    addTestResult('应该返回中度清理级别', mediumLevel === 'MEDIUM', `实际级别: ${mediumLevel}`);
    
    // 测试深度清理（>120秒）
    mockConnection.lastActivityTime = Date.now() - 130000; // 130秒前
    const deepLevel = client.determineCleanupLevel(mockConnection);
    addTestResult('应该返回深度清理级别', deepLevel === 'DEEP', `实际级别: ${deepLevel}`);
    
  } catch (error) {
    addTestResult('分层清理策略测试', false, error.message);
  }
}

// 测试清理执行
async function testCleanupExecution() {
  console.log('\n=== 测试清理执行 ===');
  
  try {
    const client = new Client(testConfig);
    const mockConnection = new Connection({
      host: '127.0.0.1',
      port: 9669,
      userName: 'root',
      password: 'nebula',
      space: 'test_space'
    });
    
    mockConnection.sessionId = 'test-session-456';
    mockConnection.isReady = true;
    mockConnection.isBusy = false;
    
    // 测试轻度清理
    const lightResult = await client.performCleanup(mockConnection, 'LIGHT');
    addTestResult('轻度清理应该成功', lightResult.success && lightResult.level === 'LIGHT');
    addTestResult('轻度清理后连接应该标记为未就绪', !mockConnection.isReady);
    addTestResult('轻度清理后连接应该标记为忙绿', mockConnection.isBusy);
    
    // 测试中度清理
    const mediumResult = await client.performCleanup(mockConnection, 'MEDIUM');
    addTestResult('中度清理应该成功', mediumResult.success && mediumResult.level === 'MEDIUM');
    
    // 测试无效清理级别
    const invalidResult = await client.performCleanup(mockConnection, 'INVALID');
    addTestResult('无效清理级别应该失败', !invalidResult.success);
    
  } catch (error) {
    addTestResult('清理执行测试', false, error.message);
  }
}

// 测试统计信息收集
async function testStatisticsCollection() {
  console.log('\n=== 测试统计信息收集 ===');
  
  try {
    const client = new Client(testConfig);
    
    // 检查统计信息属性是否存在
    addTestResult('客户端应该有sessionStats属性', client.sessionStats !== undefined);
    
    if (client.sessionStats) {
      addTestResult('统计信息应该包含总连接数', typeof client.sessionStats.totalConnections === 'number');
      addTestResult('统计信息应该包含活跃会话数', typeof client.sessionStats.activeSessions === 'number');
      addTestResult('统计信息应该包含僵尸会话数', typeof client.sessionStats.zombieSessions === 'number');
      addTestResult('统计信息应该包含已清理会话数', typeof client.sessionStats.cleanedSessions === 'number');
      addTestResult('统计信息应该包含最后清理时间', typeof client.sessionStats.lastCleanupTime === 'string');
    }
    
  } catch (error) {
    addTestResult('统计信息收集测试', false, error.message);
  }
}

// 测试Connection.js新方法
async function testConnectionNewMethods() {
  console.log('\n=== 测试Connection.js新方法 ===');
  
  try {
    const connection = new Connection({
      host: '127.0.0.1',
      port: 9669,
      userName: 'root',
      password: 'nebula',
      space: 'test_space'
    });
    
    // 测试markAsZombie方法
    connection.markAsZombie();
    addTestResult('markAsZombie方法应该设置isZombieSession为true', connection.isZombieSession === true);
    addTestResult('markAsZombie方法应该设置zombieDetectedAt', connection.zombieDetectedAt !== null);
    
    // 测试checkZombieSession方法
    const isZombie = connection.checkZombieSession();
    addTestResult('checkZombieSession方法应该返回true', isZombie === true);
    
    // 测试updateActivityTime方法
    const oldTime = connection.lastActivityTime || 0;
    connection.updateActivityTime();
    const newTime = connection.lastActivityTime;
    addTestResult('updateActivityTime方法应该更新lastActivityTime', newTime >= oldTime && newTime > 0);
    
    // 测试getConnectionInfo方法增强
    const info = connection.getConnectionInfo();
    addTestResult('getConnectionInfo应该包含sessionId', info.hasOwnProperty('sessionId'));
    addTestResult('getConnectionInfo应该包含isZombieSession', info.hasOwnProperty('isZombieSession'));
    addTestResult('getConnectionInfo应该包含lastActivityTime', info.hasOwnProperty('lastActivityTime'));
    
  } catch (error) {
    addTestResult('Connection.js新方法测试', false, error.message);
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('🚀 开始会话生命周期监控优化测试...\n');
  
  try {
    await testZombieSessionDetection();
    await testCleanupLevelDetermination();
    await testCleanupExecution();
    await testStatisticsCollection();
    await testConnectionNewMethods();
    
    // 打印测试总结
    console.log('\n=== 测试总结 ===');
    console.log(`✅ 通过: ${testResults.passed} 个`);
    console.log(`❌ 失败: ${testResults.failed} 个`);
    console.log(`📊 总计: ${testResults.passed + testResults.failed} 个`);
    
    if (testResults.failed === 0) {
      console.log('\n🎉 所有测试通过！会话生命周期监控优化成功。');
      process.exit(0);
    } else {
      console.log('\n⚠️  部分测试失败，请检查实现。');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 测试执行失败:', error.message);
    process.exit(1);
  }
}

// 进程退出处理
process.on('SIGINT', () => {
  console.log('\n🛑 测试被中断');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('\n💥 未捕获异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('\n💥 未处理Promise拒绝:', reason);
  process.exit(1);
});

// 运行测试
runAllTests().catch(error => {
  console.error('测试运行失败:', error);
  process.exit(1);
});