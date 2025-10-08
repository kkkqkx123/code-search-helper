import { createClient } from '@nebula-contrib/nebula-nodejs';

/**
 * 简单测试 Nebula Graph 动态空间创建功能
 */
async function testSpaceAutoCreation() {
  console.log('=== 测试 Nebula Graph 动态空间创建功能 ===\n');
  
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

  let client: any = null;
  
  try {
    console.log('1. 创建客户端连接...');
    client = createClient(config);
    
    // 等待连接就绪
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('连接超时'));
      }, 30000);
      
      client.on('ready', () => {
        clearTimeout(timeout);
        console.log('✅ 客户端连接就绪');
        resolve();
      });
      
      client.on('error', (event: any) => {
        clearTimeout(timeout);
        reject(new Error(event.error?.message || '连接错误'));
      });
    });
    
    // 测试 2: 尝试切换到不存在的空间
    console.log('\n2. 测试切换到不存在的空间...');
    const testSpaceName = `testspace${Math.floor(Date.now() / 1000)}`;
    console.log(`尝试切换到不存在的空间: ${testSpaceName}`);
    
    try {
      const switchResult = await client.execute(`USE ${testSpaceName};`);
      
      if (switchResult.error_code === 0) {
        console.log('✅ 空间切换成功（空间已存在）');
      } else {
        console.log(`⚠️ 空间切换失败: ${switchResult.error_msg}`);
        
        // 如果空间不存在，尝试创建
        if (switchResult.error_msg?.includes('SpaceNotFound') ||
            switchResult.error_msg?.includes('Space not found') ||
            switchResult.error_msg?.includes('Space does not exist')) {
          
          console.log('3. 尝试自动创建空间...');
          
          const createResult = await client.execute(
            `CREATE SPACE IF NOT EXISTS ${testSpaceName} (partition_num=10, replica_factor=1, vid_type=FIXED_STRING(32))`
          );
          
          if (createResult.error_code === 0) {
            console.log('✅ 空间创建成功');
            
            // 等待空间就绪
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // 再次尝试切换
            console.log('4. 再次尝试切换到新创建的空间...');
            const reSwitchResult = await client.execute(`USE ${testSpaceName};`);
            
            if (reSwitchResult.error_code === 0) {
              console.log('✅ 成功切换到新创建的空间');
            } else {
              console.log(`❌ 切换到新空间失败: ${reSwitchResult.error_msg}`);
            }
          } else {
            console.log(`❌ 空间创建失败: ${createResult.error_msg}`);
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ 空间操作失败:', errorMessage);
      
      // 检查是否是空间不存在的错误
      if (errorMessage.includes('SpaceNotFound') ||
          errorMessage.includes('Space not found') ||
          errorMessage.includes('Space does not exist')) {
        
        console.log('3. 尝试自动创建空间（在catch块中）...');
        
        try {
          const createResult = await client.execute(
            `CREATE SPACE IF NOT EXISTS ${testSpaceName} (partition_num=10, replica_factor=1, vid_type=FIXED_STRING(32))`
          );
          
          if (createResult.error_code === 0) {
            console.log('✅ 空间创建成功');
            
            // 等待空间就绪
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // 再次尝试切换
            console.log('4. 再次尝试切换到新创建的空间...');
            const reSwitchResult = await client.execute(`USE ${testSpaceName};`);
            
            if (reSwitchResult.error_code === 0) {
              console.log('✅ 成功切换到新创建的空间');
            } else {
              console.log(`❌ 切换到新空间失败: ${reSwitchResult.error_msg}`);
            }
          } else {
            console.log(`❌ 空间创建失败: ${createResult.error_msg}`);
          }
        } catch (createError) {
          console.error('❌ 自动创建空间失败:', createError instanceof Error ? createError.message : createError);
        }
      }
    }
    
    // 测试 5: 在新空间中创建标签和数据
    console.log('\n5. 在新空间中创建标签和数据...');
    try {
      // 创建测试标签
      const tagResult = await client.execute('CREATE TAG IF NOT EXISTS auto_test(name string, value int);');
      
      if (tagResult.error_code === 0) {
        console.log('✅ 创建测试标签成功');
        
        // 插入测试数据
        const insertResult = await client.execute('INSERT VERTEX auto_test(name, value) VALUES "test1":("auto_created", 123);');
        
        if (insertResult.error_code === 0) {
          console.log('✅ 插入测试数据成功');
          
          // 查询测试数据
          const queryResult = await client.execute('MATCH (v:auto_test) RETURN v.name, v.value;');
          
          if (queryResult.error_code === 0) {
            console.log(`✅ 查询测试数据成功，返回 ${queryResult.data?.length || 0} 条记录`);
            
            if (queryResult.data && queryResult.data.length > 0) {
              console.log('  查询结果:', queryResult.data);
            }
          } else {
            console.log(`❌ 查询测试数据失败: ${queryResult.error_msg}`);
          }
        } else {
          console.log(`❌ 插入测试数据失败: ${insertResult.error_msg}`);
        }
      } else {
        console.log(`❌ 创建测试标签失败: ${tagResult.error_msg}`);
      }
    } catch (error) {
      console.error('❌ 标签/数据操作失败:', error instanceof Error ? error.message : error);
    }
    
    // 测试 6: 验证空间列表
    console.log('\n6. 验证空间列表...');
    try {
      // 切换回默认空间查看所有空间
      await client.execute('USE test_space;');
      const spacesResult = await client.execute('SHOW SPACES;');
      
      if (spacesResult.error_code === 0) {
        console.log(`✅ 查询空间列表成功，共有 ${spacesResult.data?.length || 0} 个空间`);
        
        if (spacesResult.data && spacesResult.data.length > 0) {
          console.log('  空间列表:');
          spacesResult.data.forEach((space: any, index: number) => {
            console.log(`    ${index + 1}. ${space.Name}`);
          });
          
          // 检查我们创建的空间
          const exists = spacesResult.data?.some((space: any) => space.Name === testSpaceName) || false;
          console.log(`  测试空间 "${testSpaceName}" ${exists ? '✅ 存在' : '❌ 不存在'}`);
        }
      } else {
        console.log(`❌ 查询空间列表失败: ${spacesResult.error_msg}`);
      }
    } catch (error) {
      console.error('❌ 查询空间列表失败:', error instanceof Error ? error.message : error);
    }
    
    console.log('\n=== 测试完成 ===');
    console.log('✅ Nebula Graph 动态空间创建功能测试完成！');
    
  } catch (error) {
    console.error('测试过程中发生错误:', error instanceof Error ? error.message : error);
  } finally {
    // 关闭客户端
    if (client && typeof client.close === 'function') {
      try {
        await client.close();
        console.log('\n✅ 客户端已关闭');
      } catch (error) {
        console.error('关闭客户端失败:', error instanceof Error ? error.message : error);
      }
    }
  }
}

// 运行测试
async function runTest() {
  try {
    await testSpaceAutoCreation();
  } catch (error) {
    console.error('测试运行失败:', error instanceof Error ? error.message : error);
  } finally {
    process.exit(0);
  }
}

runTest();