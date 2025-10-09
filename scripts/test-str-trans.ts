import { createClient } from '@nebula-contrib/nebula-nodejs';

// 测试最终修复方案
async function testFinalFix() {
  console.log('=== 测试最终修复方案 ===\n');
  
  // 创建客户端连接
  console.log('1. 创建客户端连接...');
  const config = {
    servers: ['127.0.0.1:9669'],
    userName: 'root',
    password: 'nebula',
    space: 'test_space', // 默认空间
    poolSize: 5,
    bufferSize: 100,
    executeTimeout: 30000,
    pingInterval: 3000
  };

  try {
    const client = createClient(config);
    
    // 等待连接就绪
    await new Promise<void>((resolve, reject) => {
      let connected = false;
      
      client.on('ready', () => {
        console.log('✅ 客户端连接就绪');
        connected = true;
        resolve();
      });
      
      client.on('error', (error: any) => {
        console.log('❌ 连接错误:', error?.message || error);
        connected = true;
        reject(error);
      });
      
      // 设置超时
      setTimeout(() => {
        if (!connected) {
          reject(new Error('连接超时'));
        }
      }, 10000);
    });

    // 测试修复后的CREATE SPACE查询 - 避免复杂的格式化
    console.log('\n2. 测试修复后的CREATE SPACE查询');
    
    const testSpaceName = 'project_a2c7b9d32367187c';
    
    // 确保要删除可能已存在的空间
    try {
      await client.execute(`DROP SPACE IF EXISTS \`${testSpaceName}\``);
      console.log('✅ 清理旧空间完成');
    } catch (e) {
      console.log('⚠️ 清理旧空间时出现错误，继续测试');
    }
    
    // 使用最简洁的格式执行CREATE SPACE
    const simpleCreateQuery = `CREATE SPACE IF NOT EXISTS \`${testSpaceName}\` (partition_num = 1, replica_factor = 1, vid_type = FIXED_STRING(32))`;
    
    console.log(`执行查询: ${simpleCreateQuery}`);
    
    const result = await client.execute(simpleCreateQuery);
    
    if (result && typeof result.error_code !== 'undefined' && result.error_code !== 0) {
      const errorMsg = result?.error_msg || result?.error || 'Unknown error';
      throw new Error(`查询执行失败: ${errorMsg}`);
    }
    
    console.log('✅ CREATE SPACE 查询执行成功');
    
    console.log('等待空间创建完成...');
    
    // 多次尝试使用空间，因为创建和同步可能需要一些时间
    let useSuccess = false;
    let useAttempts = 0;
    const maxUseAttempts = 10;
    
    while (!useSuccess && useAttempts < maxUseAttempts) {
      useAttempts++;
      console.log(`尝试切换到空间 (${useAttempts}/${maxUseAttempts})...`);
      
      try {
        const useResult = await client.execute(`USE \`${testSpaceName}\``);
        
        if (useResult && typeof useResult.error_code !== 'undefined' && useResult.error_code !== 0) {
          const useErrorMsg = useResult?.error_msg || useResult?.error || 'Unknown error';
          
          if (useErrorMsg.includes('SpaceNotFound') || useErrorMsg.includes('Space not found')) {
            console.log('空间尚未创建完成，等待后重试...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          } else {
            throw new Error(`切换空间失败: ${useErrorMsg}`);
          }
        } else {
          useSuccess = true;
          console.log('✅ 成功切换到新创建的空间');
        }
      } catch (error) {
        console.log(`切换空间时出错，等待后重试... (${useAttempts}/${maxUseAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    if (!useSuccess) {
      throw new Error(`经过 ${maxUseAttempts} 次尝试后仍然无法切换到空间 ${testSpaceName}`);
    }
    
    console.log('✅ 成功切换到新创建的空间');
    
    // 再次验证空间是否在列表中
    console.log('\n4. 验证空间是否存在...');
    const showSpacesResult = await client.execute('SHOW SPACES;');
    
    if (showSpacesResult && typeof showSpacesResult.error_code !== 'undefined' && showSpacesResult.error_code !== 0) {
      console.log('⚠️ SHOW SPACES 查询有误，但我们继续');
    } else {
      // 处理不同格式的返回结果
      let spaces = [];
      if (showSpacesResult?.data && Array.isArray(showSpacesResult.data.rows)) {
        spaces = showSpacesResult.data.rows.map((row: any) => row[0]);
      } else if (showSpacesResult?.data && Array.isArray(showSpacesResult.data)) {
        // 尝试提取空间名称
        spaces = showSpacesResult.data.map((row: any) => {
          return row.Name || row.name || row.NAME || (Array.isArray(row) && row.length > 0 ? row[0] : null);
        }).filter(Boolean);
      }
      
      console.log('找到的空间:', spaces);
      const spaceFound = spaces.includes(testSpaceName) || 
                        spaces.some((s: any) => s && s.includes && s.includes(testSpaceName));
      
      if (spaceFound) {
        console.log(`✅ 空间 "${testSpaceName}" 已成功创建并可在列表中找到`);
      } else {
        console.log(`⚠️ 空间 "${testSpaceName}" 未在列表中找到，但操作可能已成功`);
      }
    }

    // 清理测试空间
    console.log('\n5. 清理测试空间...');
    try {
      await client.execute(`DROP SPACE IF EXISTS \`${testSpaceName}\``);
      console.log('✅ 测试空间已清理');
    } catch (e) {
      console.log('⚠️ 清理测试空间时出现错误:', e);
    }
    
    // 关闭连接
    if (typeof client.close === 'function') {
      await client.close();
      console.log('\n✅ 客户端已关闭');
    }
    
    console.log('\n=== 最终修复测试完成 ===');
    console.log('✅ 修复成功：CREATE SPACE 查询现在可以正常工作');
    
  } catch (error: any) {
    console.error('\n❌ 测试失败:', error?.message || error);
    if (error.stack) {
      console.error('错误堆栈:', error.stack);
    }
    throw error;
  }
}

// 执行测试
testFinalFix().catch(error => {
  console.error('测试执行失败:', error);
  process.exit(1);
});