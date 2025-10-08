import { createClient } from '@nebula-contrib/nebula-nodejs';
import { NebulaConnectionManager } from '../src/database/nebula/NebulaConnectionManager';
import { NebulaConfigService } from '../src/config/service/NebulaConfigService';
import { LoggerService } from '../src/utils/LoggerService';
import { ErrorHandlerService } from '../src/utils/ErrorHandlerService';
import { DatabaseLoggerService } from '../src/database/common/DatabaseLoggerService';
import { ConnectionStateManager } from '../src/database/nebula/ConnectionStateManager';
import { NebulaEventManager } from '../src/database/nebula/NebulaEventManager';
import { Container } from 'inversify';
import { TYPES } from '../src/types';

/**
 * 测试 Nebula Graph 连接和空间切换功能
 */
async function testNebulaSpaceSwitching() {
  console.log('开始测试 Nebula Graph 连接和空间切换功能...');
  
  // 设置依赖注入容器
  const container = new Container();
  
  // 注册基本服务
  container.bind(TYPES.LoggerService).to(LoggerService).inSingletonScope();
  container.bind(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
  container.bind(TYPES.DatabaseLoggerService).to(DatabaseLoggerService).inSingletonScope();
  container.bind(TYPES.NebulaConfigService).to(NebulaConfigService).inSingletonScope();
  container.bind(TYPES.ConnectionStateManager).to(ConnectionStateManager).inSingletonScope();
  container.bind(TYPES.NebulaEventManager).to(NebulaEventManager).inSingletonScope();
  container.bind(TYPES.NebulaConnectionManager).to(NebulaConnectionManager).inSingletonScope();
  
  try {
    // 获取 NebulaConnectionManager 实例
    const connectionManager = container.get<NebulaConnectionManager>(TYPES.NebulaConnectionManager);
    
    // 测试 1: 基本连接
    console.log('\n=== 测试 1: 基本连接 ===');
    const connected = await connectionManager.connect();
    console.log(`连接结果: ${connected ? '成功' : '失败'}`);
    
    if (!connected) {
      const status = connectionManager.getConnectionStatus();
      console.error('连接失败:', status.error);
      return;
    }
    
    // 测试 2: 默认空间查询
    console.log('\n=== 测试 2: 默认空间查询 ===');
    try {
      const result = await connectionManager.executeQuery('SHOW SPACES;');
      console.log('默认空间查询成功:', result.data?.length || 0, '个空间');
    } catch (error) {
      console.error('默认空间查询失败:', error instanceof Error ? error.message : error);
    }
    
    // 测试 3: 动态空间切换
    console.log('\n=== 测试 3: 动态空间切换 ===');
    const testProjectId = 'test_project_001';
    
    try {
      // 获取项目特定的空间连接
      const projectConnection = await connectionManager.getConnectionForSpace(`project_${testProjectId}`);
      console.log('获取项目空间连接成功');
      
      // 在项目空间中执行查询
      const projectResult = await connectionManager.executeQuery('SHOW TAGS;');
      console.log('项目空间查询成功:', projectResult.data?.length || 0, '个标签');
    } catch (error) {
      console.error('项目空间操作失败:', error instanceof Error ? error.message : error);
      
      // 如果空间不存在，尝试创建
      if (error instanceof Error && error.message.includes('Space not exist')) {
        console.log('尝试创建项目空间...');
        try {
          await connectionManager.executeQuery(`CREATE SPACE IF NOT EXISTS project_${testProjectId} (partition_num=10, replica_factor=1, vid_type="FIXED_STRING(32)");`);
          console.log('项目空间创建成功');
          
          // 等待空间就绪
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // 再次尝试切换空间
          const projectConnection = await connectionManager.getConnectionForSpace(`project_${testProjectId}`);
          console.log('重新获取项目空间连接成功');
          
          // 在项目空间中创建测试标签
          await connectionManager.executeQuery('CREATE TAG IF NOT EXISTS file(name string, file_path string, content string);');
          console.log('创建测试标签成功');
        } catch (createError) {
          console.error('创建项目空间失败:', createError instanceof Error ? createError.message : createError);
        }
      }
    }
    
    // 测试 4: 切换回默认空间
    console.log('\n=== 测试 4: 切换回默认空间 ===');
    try {
      await connectionManager.getConnectionForSpace('test_space');
      const defaultResult = await connectionManager.executeQuery('SHOW TAGS;');
      console.log('切换回默认空间成功:', defaultResult.data?.length || 0, '个标签');
    } catch (error) {
      console.error('切换回默认空间失败:', error instanceof Error ? error.message : error);
    }
    
    // 测试 5: 多项目空间切换
    console.log('\n=== 测试 5: 多项目空间切换 ===');
    const projectIds = ['project_a', 'project_b', 'project_c'];
    
    for (const projectId of projectIds) {
      try {
        const spaceName = `project_${projectId}`;
        console.log(`切换到空间: ${spaceName}`);
        
        await connectionManager.getConnectionForSpace(spaceName);
        
        // 尝试创建空间（如果不存在）
        await connectionManager.executeQuery(`CREATE SPACE IF NOT EXISTS ${spaceName} (partition_num=10, replica_factor=1, vid_type="FIXED_STRING(32)");`);
        
        // 等待空间就绪
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 验证空间切换
        const result = await connectionManager.executeQuery(`USE ${spaceName}; YIELD 1 AS test;`);
        console.log(`空间 ${spaceName} 切换成功`);
      } catch (error) {
        console.error(`空间 ${projectId} 操作失败:`, error instanceof Error ? error.message : error);
      }
    }
    
    console.log('\n=== 测试完成 ===');
    
    // 断开连接
    await connectionManager.disconnect();
    console.log('连接已断开');
    
  } catch (error) {
    console.error('测试过程中发生错误:', error instanceof Error ? error.message : error);
  }
}

/**
 * 直接测试 Nebula 客户端连接
 */
async function testDirectNebulaConnection() {
  console.log('\n=== 直接测试 Nebula 客户端连接 ===');
  
  const config = {
    servers: ['127.0.0.1:9669'],
    userName: 'root',
    password: 'nebula',
    space: 'test_space', // 使用默认空间
    poolSize: 2,
    bufferSize: 5,
    executeTimeout: 30000,
    pingInterval: 3000
  };

  console.log('创建客户端配置:', JSON.stringify(config, null, 2));

  try {
    const client = createClient(config);
    console.log('客户端创建成功');
    
    // 等待连接就绪
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('连接超时'));
      }, 30000);
      
      let readyReceived = false;
      
      client.on('ready', (event: any) => {
        if (!readyReceived) {
          readyReceived = true;
          clearTimeout(timeout);
          console.log('客户端就绪事件触发');
          resolve();
        }
      });
      
      client.on('error', (event: any) => {
        console.error('客户端错误:', event.error?.message || event.error);
        if (!readyReceived) {
          clearTimeout(timeout);
          reject(new Error(event.error?.message || '连接错误'));
        }
      });
      
      client.on('authorized', (event: any) => {
        console.log('客户端授权事件触发');
      });
    });
    
    // 执行测试查询
    console.log('执行测试查询...');
    const result = await client.execute('SHOW SPACES;');
    console.log('查询成功，找到空间数量:', result.data?.length || 0);
    
    // 关闭客户端
    if (typeof client.close === 'function') {
      await client.close();
      console.log('客户端已关闭');
    }
    
  } catch (error) {
    console.error('直接连接测试失败:', error instanceof Error ? error.message : error);
  }
}

// 运行测试
async function runTests() {
  try {
    await testDirectNebulaConnection();
    await testNebulaSpaceSwitching();
  } catch (error) {
    console.error('测试运行失败:', error instanceof Error ? error.message : error);
  } finally {
    process.exit(0);
  }
}

runTests();