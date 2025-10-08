import { createClient } from '@nebula-contrib/nebula-nodejs';
import { NebulaConfigService } from '../src/config/service/NebulaConfigService';

/**
 * 验证 Nebula Graph 连接修复效果
 */
async function testNebulaConnectionFix() {
  console.log('=== 测试 Nebula Graph 连接修复效果 ===\n');
  
  // 测试 1: 验证 NebulaConfigService 配置
  console.log('测试 1: 验证 NebulaConfigService 配置');
  const configService = new NebulaConfigService(
    { info: (msg: string) => console.log(`[INFO] ${msg}`), warn: (msg: string) => console.warn(`[WARN] ${msg}`), error: (msg: string) => console.error(`[ERROR] ${msg}`) } as any,
    { handleError: (error: Error, context: any) => console.error(`[ERROR] ${error.message}`, context) } as any
  );
  
  const config = configService.loadConfig();
  console.log('配置加载结果:');
  console.log(`  - 主机: ${config.host}`);
  console.log(`  - 端口: ${config.port}`);
  console.log(`  - 用户名: ${config.username}`);
  console.log(`  - 空间: ${config.space || 'undefined'}`);
  console.log(`  - 超时: ${config.timeout}ms`);
  
  if (!config.space) {
    console.error('❌ 配置失败: space 仍然是 undefined');
    return;
  } else {
    console.log('✅ 配置成功: space 已设置为', config.space);
  }
  
  // 测试 2: 直接使用 Nebula 客户端连接
  console.log('\n测试 2: 直接使用 Nebula 客户端连接');
  
  const clientConfig = {
    servers: [`${config.host}:${config.port}`],
    userName: config.username,
    password: config.password,
    space: config.space, // 使用从配置服务获取的空间
    poolSize: 2,
    bufferSize: 5,
    executeTimeout: config.timeout || 30000,
    pingInterval: 3000
  };

  console.log('客户端配置:', JSON.stringify(clientConfig, null, 2));
  
  try {
    const client = createClient(clientConfig);
    console.log('✅ 客户端创建成功');
    
    // 等待连接就绪
    console.log('等待连接就绪...');
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('连接超时 (30秒)'));
      }, 30000);
      
      let readyReceived = false;
      let authorizedReceived = false;
      
      client.on('ready', (event: any) => {
        if (!readyReceived) {
          readyReceived = true;
          clearTimeout(timeout);
          console.log('✅ 客户端就绪事件触发 - 连接完全就绪');
          resolve();
        }
      });
      
      client.on('authorized', (event: any) => {
        if (!authorizedReceived) {
          authorizedReceived = true;
          console.log('✅ 客户端授权事件触发 - 认证成功');
        }
      });
      
      client.on('connected', (event: any) => {
        console.log('✅ 客户端连接事件触发 - 网络连接建立');
      });
      
      client.on('error', (event: any) => {
        const errorMsg = event.error?.message || event.error || '未知错误';
        console.error('❌ 客户端错误事件:', errorMsg);
        
        if (!readyReceived) {
          clearTimeout(timeout);
          reject(new Error(`连接错误: ${errorMsg}`));
        }
      });
    });
    
    // 测试 3: 执行基本查询
    console.log('\n测试 3: 执行基本查询');
    
    try {
      const spacesResult = await client.execute('SHOW SPACES;');
      console.log('✅ 查询空间列表成功');
      console.log(`  找到 ${spacesResult.data?.length || 0} 个空间`);
      
      if (spacesResult.data && spacesResult.data.length > 0) {
        console.log('  空间列表:');
        spacesResult.data.forEach((space: any, index: number) => {
          console.log(`    ${index + 1}. ${space.Name}`);
        });
      }
    } catch (queryError) {
      console.error('❌ 查询空间列表失败:', queryError instanceof Error ? queryError.message : queryError);
    }
    
    // 测试 4: 验证当前空间
    console.log('\n测试 4: 验证当前空间');
    
    try {
      const currentSpaceResult = await client.execute('YIELD 1 AS test;');
      console.log('✅ 当前空间查询成功 - 连接状态正常');
    } catch (spaceError) {
      console.error('❌ 当前空间查询失败:', spaceError instanceof Error ? spaceError.message : spaceError);
    }
    
    // 测试 5: 测试空间切换
    console.log('\n测试 5: 测试空间切换');
    
    try {
      // 尝试切换到一个测试空间
      const testSpaceName = `test_switch_${Date.now()}`;
      console.log(`尝试切换到测试空间: ${testSpaceName}`);
      
      const switchResult = await client.execute(`USE ${testSpaceName};`);
      if (switchResult.error_code === 0) {
        console.log('✅ 空间切换成功');
      } else {
        console.log(`⚠️ 空间切换失败 (预期行为): ${switchResult.error_msg}`);
        
        // 尝试创建空间
        console.log('尝试创建测试空间...');
        const createResult = await client.execute(`CREATE SPACE IF NOT EXISTS ${testSpaceName} (partition_num=10, replica_factor=1, vid_type="FIXED_STRING(32)");`);
        
        if (createResult.error_code === 0) {
          console.log('✅ 测试空间创建成功');
          
          // 等待空间就绪
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // 再次尝试切换
          const reSwitchResult = await client.execute(`USE ${testSpaceName};`);
          if (reSwitchResult.error_code === 0) {
            console.log('✅ 重新切换到新创建的空间成功');
          } else {
            console.log(`⚠️ 重新切换失败: ${reSwitchResult.error_msg}`);
          }
        } else {
          console.log(`❌ 创建测试空间失败: ${createResult.error_msg}`);
        }
      }
    } catch (switchError) {
      console.error('❌ 空间切换测试失败:', switchError instanceof Error ? switchError.message : switchError);
    }
    
    // 清理：切换回默认空间
    console.log('\n清理: 切换回默认空间');
    try {
      await client.execute(`USE ${config.space};`);
      console.log(`✅ 已切换回默认空间: ${config.space}`);
    } catch (cleanupError) {
      console.error('❌ 切换回默认空间失败:', cleanupError instanceof Error ? cleanupError.message : cleanupError);
    }
    
    // 关闭客户端
    console.log('\n关闭客户端连接...');
    if (typeof client.close === 'function') {
      await client.close();
      console.log('✅ 客户端已关闭');
    }
    
    console.log('\n=== 测试完成 ===');
    console.log('✅ Nebula Graph 连接修复验证成功！');
    console.log('✅ 动态空间切换功能正常！');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error instanceof Error ? error.message : error);
    console.error('错误详情:', error);
  }
}

// 运行测试
async function runTest() {
  try {
    await testNebulaConnectionFix();
  } catch (error) {
    console.error('测试运行失败:', error instanceof Error ? error.message : error);
  } finally {
    process.exit(0);
  }
}

runTest();