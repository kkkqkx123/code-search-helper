import { createClient } from '@nebula-contrib/nebula-nodejs';

// Nebula 连接配置
const NEBULA_CONFIG = {
  servers: ['127.0.0.1:9669'],
  userName: 'root',
  password: 'nebula',
  space: 'test_space', // 使用已知的test_space空间
  poolSize: 1,
  bufferSize: 10,
  executeTimeout: 30000,
  pingInterval: 3000
};

// 测试空间模式（需要删除的空间）
const TEST_SPACE_PATTERNS = [
  /^direct_test_/,        // 以 direct_test_ 开头的空间（直接测试创建）
  /^test_auto_create_/,  // 以 test_auto_create_ 开头的空间（自动创建测试）
  /^test_project_/,      // 以 test_project_ 开头的空间（项目测试）
  /^testspace\d+$/,      // 以 testspace 开头后跟数字的空间（testspace1759887377）
  /^testspace_\d+$/,     // 以 testspace_ 开头后跟数字的空间（testspace_1759888499934）
];

// 需要保留的空间（即使匹配模式也要保留）
const PROTECTED_SPACES = [
  'test_space',       // 主要的测试空间，需要保留
  'nebula',           // 默认空间
  'codebase',         // 主代码库空间
];

/**
 * 检查空间是否应该被删除
 */
function shouldDeleteSpace(spaceName: string): boolean {
  // 如果空间在保护列表中，不删除
  if (PROTECTED_SPACES.includes(spaceName)) {
    return false;
  }
  
  // 检查是否匹配任何测试模式
  return TEST_SPACE_PATTERNS.some(pattern => pattern.test(spaceName));
}

/**
 * 连接到 Nebula 数据库
 */
async function connectToNebula() {
  console.log('正在连接到 Nebula 数据库...');
  
  const client = createClient(NEBULA_CONFIG);
  
  // 等待连接建立
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('连接超时（30秒）'));
    }, 30000);

    const onReady = () => {
      console.log('✓ 客户端连接就绪');
      clearTimeout(timeout);
      client.removeListener('ready', onReady);
      client.removeListener('error', onError);
      resolve();
    };

    const onError = (error: any) => {
      console.error('✗ 连接错误:', error?.message || error);
      clearTimeout(timeout);
      client.removeListener('ready', onReady);
      client.removeListener('error', onError);
      reject(error);
    };

    client.on('ready', onReady);
    client.on('error', onError);
  });
  
  // 已经在test_space空间中，无需切换
  console.log('✓ 已连接到 test_space 空间');

  return client;
}

/**
 * 列出所有空间
 */
async function listAllSpaces(client: any): Promise<string[]> {
  console.log('正在列出所有空间...');
  
  try {
    const result = await client.execute('SHOW SPACES;');
    
    if (!result || !result.data) {
      console.log('没有找到任何空间');
      return [];
    }
    
    // 提取空间名称 - 处理实际的查询结果格式
    const spaces = result.data.Name || [];
    
    console.log(`找到 ${spaces.length} 个空间:`);
    spaces.forEach((space: string, index: number) => {
      console.log(`  ${index + 1}. ${space}`);
    });
    
    return spaces;
  } catch (error) {
    console.error('列出空间时出错:', error);
    throw error;
  }
}

/**
 * 删除指定的空间
 */
async function deleteSpace(client: any, spaceName: string): Promise<boolean> {
  try {
    console.log(`正在删除空间: ${spaceName}`);
    
    // 使用 DROP SPACE IF EXISTS 命令
    const result = await client.execute(`DROP SPACE IF EXISTS \`${spaceName}\`;`);
    
    if (result && result.error) {
      console.error(`删除空间 ${spaceName} 失败:`, result.error);
      return false;
    }
    
    console.log(`✓ 成功删除空间: ${spaceName}`);
    return true;
  } catch (error) {
    console.error(`删除空间 ${spaceName} 时出错:`, error);
    return false;
  }
}

/**
 * 清理测试空间
 */
async function cleanupTestSpaces() {
  let client: any = null;
  
  try {
    // 连接到数据库
    client = await connectToNebula();
    
    // 列出所有空间
    const spaces = await listAllSpaces(client);
    
    if (spaces.length === 0) {
      console.log('没有找到需要清理的空间');
      return;
    }
    
    // 识别需要删除的测试空间
    const spacesToDelete = spaces.filter(shouldDeleteSpace);
    
    if (spacesToDelete.length === 0) {
      console.log('没有找到需要删除的测试空间');
      return;
    }
    
    console.log(`\n找到 ${spacesToDelete.length} 个需要删除的测试空间:`);
    spacesToDelete.forEach((space, index) => {
      console.log(`  ${index + 1}. ${space}`);
    });
    
    // 确认删除操作
    console.log('\n⚠️  即将删除以上测试空间，此操作不可撤销！');
    console.log('保护的空间（不会被删除）:');
    PROTECTED_SPACES.forEach(space => {
      console.log(`  - ${space}`);
    });
    
    // 在实际环境中，可以添加用户确认步骤
    // 这里为了自动化，直接执行删除
    
    console.log('\n开始删除测试空间...');
    
    let successCount = 0;
    let failureCount = 0;
    
    // 逐个删除空间
    for (const spaceName of spacesToDelete) {
      const success = await deleteSpace(client, spaceName);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
      
      // 添加短暂延迟，避免对数据库造成过大压力
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n清理完成！');
    console.log(`✓ 成功删除: ${successCount} 个空间`);
    if (failureCount > 0) {
      console.log(`✗ 删除失败: ${failureCount} 个空间`);
    }
    
  } catch (error) {
    console.error('清理过程中发生错误:', error);
  } finally {
    // 关闭连接
    if (client && typeof client.close === 'function') {
      try {
        await client.close();
        console.log('✓ 数据库连接已关闭');
      } catch (error) {
        console.error('关闭连接时出错:', error);
      }
    }
  }
}

// 主函数
async function main() {
  console.log('=== Nebula 测试空间清理工具 ===\n');
  
  console.log('配置信息:');
  console.log(`  服务器: ${NEBULA_CONFIG.servers.join(', ')}`);
  console.log(`  用户名: ${NEBULA_CONFIG.userName}`);
  console.log(`  默认空间: ${NEBULA_CONFIG.space}`);
  
  console.log('\n测试空间模式:');
  TEST_SPACE_PATTERNS.forEach(pattern => {
    console.log(`  - ${pattern}`);
  });
  
  console.log('\n保护的空间:');
  PROTECTED_SPACES.forEach(space => {
    console.log(`  - ${space}`);
  });
  
  console.log('\n开始清理...\n');
  
  await cleanupTestSpaces();
  
  console.log('\n=== 清理完成 ===');
}

// 执行主函数
main().catch(error => {
  console.error('程序执行失败:', error);
  process.exit(1);
});