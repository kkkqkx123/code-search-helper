import { createClient } from '@nebula-contrib/nebula-nodejs';

// 测试增强版的空间创建功能
async function testEnhancedSpaceCreation() {
  console.log('=== 测试增强版 Nebula Graph 空间创建功能 ===\n');

  // 创建客户端连接
  console.log('1. 创建客户端连接...');
  const config = {
    servers: ['127.0.0.1:9669'],
    userName: 'root',
    password: 'nebula',
    space: 'test_space', // 默认空间
    poolSize: 10,
    bufferSize: 10,
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
        if (!connected) {
          connected = true;
          resolve();
        }
      });
      
      client.on('error', (error: any) => {
        console.log('❌ 连接错误:', error?.message || error);
        if (!connected) {
          connected = true;
          reject(error);
        }
      });
      
      // 设置超时
      setTimeout(() => {
        if (!connected) {
          console.log('⚠️ 连接超时，尝试继续执行...');
          resolve();
        }
      }, 10000);
    });

    // 测试空间创建和切换
    const testSpaceName = `testspace_${Date.now()}`;
    console.log(`\n2. 测试创建和切换到新空间: ${testSpaceName}`);
    
    try {
      // 尝试切换到不存在的空间
      console.log(`尝试切换到不存在的空间: ${testSpaceName}`);
      const useResult = await client.execute(`USE \`${testSpaceName}\`;`);
      
      if (useResult && (useResult.code === 0 || (typeof useResult.error_code !== 'undefined' && useResult.error_code === 0))) {
        console.log('✅ 空间切换成功');
      } else {
        throw new Error('Space switching failed');
      }
    } catch (error: any) {
      console.log('❌ 空间切换失败:', error?.message || error);
      
      // 自动创建空间
      console.log('\n3. 自动创建空间...');
      try {
        const createSpaceQuery = `CREATE SPACE IF NOT EXISTS \`${testSpaceName}\` (partition_num=10, replica_factor=1, vid_type=FIXED_STRING(32))`;
        
        console.log(`执行创建空间查询: ${createSpaceQuery}`);
        const createResult = await client.execute(createSpaceQuery);
        
        if (createResult && (typeof createResult.error_code !== 'undefined' && createResult.error_code !== 0)) {
          const createErrorMsg = createResult?.error_msg || createResult?.error || 'Unknown error';
          throw new Error(`Failed to create space: ${createErrorMsg}`);
        }
        
        console.log('✅ 空间创建成功');
        
        // 等待更长时间让空间创建完成并同步到所有节点
        console.log('\n4. 等待空间创建完成并同步到所有节点（10秒）...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // 再次尝试切换到空间
        console.log('\n5. 再次尝试切换到新创建的空间...');
        const reUseResult = await client.execute(`USE \`${testSpaceName}\`;`);
        
        if (reUseResult && (reUseResult.code === 0 || (typeof reUseResult.error_code !== 'undefined' && reUseResult.error_code === 0))) {
          console.log('✅ 成功切换到新创建的空间');
        } else {
          const reUseErrorMsg = reUseResult?.error || reUseResult?.error_msg || 'Unknown error';
          throw new Error(`Failed to switch to newly created space: ${reUseErrorMsg}`);
        }
        
        // 在新空间中创建标签和数据
        console.log('\n6. 在新空间中创建标签和数据...');
        
        // 创建标签
        const createTagQuery = `CREATE TAG IF NOT EXISTS file (name STRING, file_path STRING, content STRING)`;
        const tagResult = await client.execute(createTagQuery);
        
        if (tagResult && (typeof tagResult.error_code !== 'undefined' && tagResult.error_code !== 0)) {
          const tagErrorMsg = tagResult?.error_msg || tagResult?.error || 'Unknown error';
          throw new Error(`Failed to create tag: ${tagErrorMsg}`);
        }
        console.log('✅ 创建测试标签成功');
        
        // 等待标签创建完成
        console.log('等待标签创建完成并同步...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // 插入测试数据
        const insertQuery = `INSERT VERTEX file (name, file_path, content) VALUES "test1":("test.ts", "/path/to/test.ts", "console.log(\\"Hello World\\");")`;
        const insertResult = await client.execute(insertQuery);
        
        if (insertResult && (typeof insertResult.error_code !== 'undefined' && insertResult.error_code !== 0)) {
          const insertErrorMsg = insertResult?.error_msg || insertResult?.error || 'Unknown error';
          throw new Error(`Failed to insert data: ${insertErrorMsg}`);
        }
        console.log('✅ 插入测试数据成功');
        
        // 查询测试数据
        const queryResult = await client.execute('MATCH (v:file) RETURN v.name AS name, v.file_path AS file_path LIMIT 10;');
        console.log('✅ 查询测试数据成功，返回', queryResult?.data?.length || 0, '条记录');
        
        // 验证空间列表
        console.log('\n7. 验证空间列表...');
        const spacesResult = await client.execute('SHOW SPACES;');
        
        // 正确解析空间列表结果
        let spaceCount = 0;
        let foundSpace = false;
        
        if (spacesResult?.data?.Name && Array.isArray(spacesResult.data.Name)) {
          spaceCount = spacesResult.data.Name.length;
          foundSpace = spacesResult.data.Name.includes(testSpaceName);
        }
        
        console.log('✅ 查询空间列表成功，共有', spaceCount, '个空间');
        console.log('空间列表:', spacesResult?.data?.Name || []);
        
        if (foundSpace) {
          console.log(`✅ 新创建的空间 "${testSpaceName}" 已在空间列表中`);
        } else {
          console.log(`❌ 新创建的空间 "${testSpaceName}" 未在空间列表中`);
        }
        
      } catch (createError: any) {
        console.log('❌ 自动创建空间失败:', createError?.message || createError);
      }
    }

    // 关闭客户端
    if (typeof client.close === 'function') {
      await client.close();
      console.log('\n✅ 客户端已关闭');
    }
    
    console.log('\n=== 测试完成 ===');
    
  } catch (error: any) {
    console.error('\n❌ 测试失败:', error?.message || error);
  } finally {
    // 退出程序
    process.exit(0);
  }
}

testEnhancedSpaceCreation();