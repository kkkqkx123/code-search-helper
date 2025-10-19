import { createClient } from '@nebula-contrib/nebula-nodejs';
import { NebulaConnectionManager } from '../../../src/database/nebula/NebulaConnectionManager';
import { NebulaConfigService } from '../../../src/config/service/NebulaConfigService';
import { LoggerService } from '../../../src/utils/LoggerService';
import { ErrorHandlerService } from '../../../src/utils/ErrorHandlerService';
import { DatabaseLoggerService } from '../../../src/database/common/DatabaseLoggerService';
import { ConnectionStateManager } from '../../../src/database/nebula/ConnectionStateManager';
import { NebulaEventManager } from '../../../src/database/nebula/NebulaEventManager';
import { Container } from 'inversify';
import { TYPES } from '../../../src/types';

/**
 * 测试 Nebula Graph 动态空间创建功能
 */
async function testDynamicSpaceCreation() {
  console.log('=== 测试 Nebula Graph 动态空间创建功能 ===\n');

  // 设置依赖注入容器
  const container = new Container();

  // 注册基本服务
  container.bind(TYPES.ConfigService).toConstantValue({
    get: (key: string) => process.env[key],
    getNumber: (key: string) => parseInt(process.env[key] || '0'),
    getBoolean: (key: string) => process.env[key] === 'true',
    getString: (key: string) => process.env[key] || '',
    getJson: (key: string) => {
      const value = process.env[key];
      return value ? JSON.parse(value) : undefined;
    },
    has: (key: string) => process.env[key] !== undefined,
    getAll: () => ({ ...process.env }),
    set: (key: string, value: any) => { process.env[key] = String(value); },
    loadConfig: () => ({ ...process.env }),
    loadConfigSync: () => ({ ...process.env }),
    validateConfig: () => true,
    watch: () => ({ close: () => { } }),
    watchSync: () => ({ close: () => { } })
  });

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
    console.log('测试 1: 基本连接');
    const connected = await connectionManager.connect();
    console.log(`连接结果: ${connected ? '成功' : '失败'}`);

    if (!connected) {
      const status = connectionManager.getConnectionStatus();
      console.error('连接失败:', status.error);
      return;
    }

    // 测试 2: 切换到不存在的空间（应该自动创建）
    console.log('\n测试 2: 切换到不存在的空间（应该自动创建）');
    const newSpaceName = `test_auto_create_${Date.now()}`;
    console.log(`尝试切换到不存在的空间: ${newSpaceName}`);

    try {
      const connection = await connectionManager.getConnectionForSpace(newSpaceName);
      console.log('✅ 成功获取空间连接（空间应该已自动创建）');

      // 验证空间确实存在并可用
      const result = await connectionManager.executeQuery('SHOW TAGS;');
      console.log(`✅ 在新空间中执行查询成功，返回 ${result.data?.length || 0} 个标签`);

    } catch (error) {
      console.error('❌ 切换到新空间失败:', error instanceof Error ? error.message : error);
    }

    // 测试 3: 切换到另一个不存在的空间
    console.log('\n测试 3: 切换到另一个不存在的空间');
    const anotherSpaceName = `test_project_${Date.now()}`;
    console.log(`尝试切换到另一个不存在的空间: ${anotherSpaceName}`);

    try {
      const connection = await connectionManager.getConnectionForSpace(anotherSpaceName);
      console.log('✅ 成功获取第二个空间连接（空间应该已自动创建）');

      // 在新空间中创建测试标签
      await connectionManager.executeQuery('CREATE TAG IF NOT EXISTS test_auto(name string, value int);');
      console.log('✅ 在新空间中创建测试标签成功');

      // 插入测试数据
      await connectionManager.executeQuery('INSERT VERTEX test_auto(name, value) VALUES "test1":("auto_created", 100);');
      console.log('✅ 在新空间中插入测试数据成功');

      // 查询测试数据
      const queryResult = await connectionManager.executeQuery('MATCH (v:test_auto) RETURN v.name, v.value;');
      console.log(`✅ 查询测试数据成功，返回 ${queryResult.data?.length || 0} 条记录`);

    } catch (error) {
      console.error('❌ 切换到第二个空间失败:', error instanceof Error ? error.message : error);
    }

    // 测试 4: 切换回已存在的空间（应该直接切换，不需要创建）
    console.log('\n测试 4: 切换回已存在的空间');
    try {
      const connection = await connectionManager.getConnectionForSpace(newSpaceName);
      console.log('✅ 成功切换回已存在的空间');

      const result = await connectionManager.executeQuery('SHOW TAGS;');
      console.log(`✅ 在已存在空间中执行查询成功，返回 ${result.data?.length || 0} 个标签`);

    } catch (error) {
      console.error('❌ 切换回已存在空间失败:', error instanceof Error ? error.message : error);
    }

    // 测试 5: 验证所有创建的空间都存在
    console.log('\n测试 5: 验证所有创建的空间都存在');
    try {
      // 切换到默认空间来查看所有空间
      await connectionManager.getConnectionForSpace('test_space');
      const spacesResult = await connectionManager.executeQuery('SHOW SPACES;');
      console.log(`✅ 当前数据库中共有 ${spacesResult.data?.length || 0} 个空间`);

      if (spacesResult.data && spacesResult.data.length > 0) {
        console.log('空间列表:');
        spacesResult.data.forEach((space: any, index: number) => {
          console.log(`  ${index + 1}. ${space.Name}`);
        });

        // 检查我们创建的空间是否存在
        const createdSpaces = [newSpaceName, anotherSpaceName];
        createdSpaces.forEach(spaceName => {
          const exists = spacesResult.data?.some((space: any) => space.Name === spaceName) || false;
          console.log(`  空间 "${spaceName}" ${exists ? '✅ 存在' : '❌ 不存在'}`);
        });
      }
    } catch (error) {
      console.error('❌ 查看空间列表失败:', error instanceof Error ? error.message : error);
    }

    // 测试 6: 测试项目空间命名模式
    console.log('\n测试 6: 测试项目空间命名模式');
    const projectIds = ['project_alpha', 'project_beta', 'project_gamma'];

    for (const projectId of projectIds) {
      const projectSpaceName = `project_${projectId}`;
      console.log(`处理项目空间: ${projectSpaceName}`);

      try {
        const connection = await connectionManager.getConnectionForSpace(projectSpaceName);
        console.log(`✅ 项目空间 ${projectSpaceName} 就绪`);

        // 创建项目特定的标签
        await connectionManager.executeQuery(`CREATE TAG IF NOT EXISTS ${projectId}_file(name string);`);
        console.log(`✅ 创建项目特定标签 ${projectId}_file 成功`);

      } catch (error) {
        console.error(`❌ 处理项目空间 ${projectSpaceName} 失败:`, error instanceof Error ? error.message : error);
      }
    }

    console.log('\n=== 测试完成 ===');
    console.log('✅ Nebula Graph 动态空间创建功能测试完成！');

    // 断开连接
    await connectionManager.disconnect();
    console.log('连接已断开');

  } catch (error) {
    console.error('测试过程中发生错误:', error instanceof Error ? error.message : error);
  }
}

/**
 * 直接测试 Nebula 客户端的空间创建功能
 */
async function testDirectSpaceCreation() {
  console.log('\n=== 直接测试 Nebula 客户端空间创建功能 ===\n');

  const config = {
    servers: ['127.0.0.1:9669'],
    userName: 'root',
    password: 'nebula',
    space: 'test_space',
    poolSize: 2,
    bufferSize: 5,
    executeTimeout: 30000,
    pingInterval: 3000
  };

  try {
    const client = createClient(config);

    // 等待连接就绪
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('连接超时'));
      }, 30000);

      client.on('ready', () => {
        clearTimeout(timeout);
        resolve();
      });

      client.on('error', (event: any) => {
        clearTimeout(timeout);
        reject(new Error(event.error?.message || '连接错误'));
      });
    });

    console.log('✅ 客户端连接成功');

    // 测试直接创建空间
    const testSpaceName = `direct_test_${Date.now()}`;
    console.log(`尝试直接创建空间: ${testSpaceName}`);

    try {
      // 创建空间
      const createSpaceQuery = `CREATE SPACE IF NOT EXISTS \`${testSpaceName}\` (partition_num = 10, replica_factor = 1, vid_type = FIXED_STRING(32))`;
      console.log(`执行创建空间查询: ${createSpaceQuery}`);
      const createResult = await client.execute(createSpaceQuery);

      if (createResult.error_code === 0) {
        console.log('✅ 空间创建成功');

        // 等待空间就绪
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 切换到新创建的空间
        const switchResult = await client.execute(`USE \`${testSpaceName}\`;`);

        if (switchResult.error_code === 0) {
          console.log('✅ 成功切换到新创建的空间');

          // 在新空间中创建标签
          const tagResult = await client.execute('CREATE TAG IF NOT EXISTS direct_test(name string);');

          if (tagResult.error_code === 0) {
            console.log('✅ 在新空间中创建标签成功');
          } else {
            console.log('❌ 在新空间中创建标签失败:', tagResult.error_msg);
          }
        } else {
          console.log('❌ 切换到新空间失败:', switchResult.error_msg);
        }
      } else {
        console.log('❌ 空间创建失败:', createResult.error_msg);
      }
    } catch (error) {
      console.error('❌ 空间创建操作失败:', error instanceof Error ? error.message : error);
    }

    // 关闭客户端
    if (typeof client.close === 'function') {
      await client.close();
      console.log('✅ 客户端已关闭');
    }

  } catch (error) {
    console.error('直接测试失败:', error instanceof Error ? error.message : error);
  }
}

// 运行测试
async function runTests() {
  try {
    await testDirectSpaceCreation();
    await testDynamicSpaceCreation();
  } catch (error) {
    console.error('测试运行失败:', error instanceof Error ? error.message : error);
  } finally {
    process.exit(0);
  }
}

runTests();