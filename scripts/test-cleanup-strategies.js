/**
 * 清理策略测试脚本
 * 用于验证新实现的清理策略功能
 */

/**
 * 格式化字节数为可读格式
 */
function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)}${units[unitIndex]}`;
}

/**
 * 测试清理策略
 */
async function testCleanupStrategies() {
  console.log('🧪 开始测试清理策略...\n');

  try {
    // 使用编译后的JavaScript文件
    const { CleanupManager } = require('../dist/service/parser/universal/cleanup/CleanupManager');
    const { TreeSitterCacheCleanupStrategy } = require('../dist/service/parser/universal/cleanup/strategies/TreeSitterCacheCleanupStrategy');
    const { LRUCacheCleanupStrategy } = require('../dist/service/parser/universal/cleanup/strategies/LRUCacheCleanupStrategy');
    const { GarbageCollectionStrategy } = require('../dist/service/parser/universal/cleanup/strategies/GarbageCollectionStrategy');
    
    // 创建清理管理器
    const cleanupManager = new CleanupManager();
    cleanupManager.initialize();
    
    // 注册清理策略
    cleanupManager.registerStrategy(new TreeSitterCacheCleanupStrategy());
    cleanupManager.registerStrategy(new LRUCacheCleanupStrategy());
    cleanupManager.registerStrategy(new GarbageCollectionStrategy());
    
    console.log('✅ 清理管理器初始化完成');
    console.log(`📋 已注册策略数量: ${cleanupManager.getRegisteredStrategies().length}`);
    
    // 测试清理策略
    const cleanupContext = {
      triggerReason: 'test_cleanup',
      memoryUsage: {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external
      },
      timestamp: new Date()
    };
    
    console.log('\n🔄 执行清理操作...');
    const result = await cleanupManager.performCleanup(cleanupContext);
    
    if (result.success) {
      console.log(`✅ 清理成功！`);
      console.log(`💾 释放内存: ${formatBytes(result.memoryFreed)}`);
      console.log(`🗑️  清理的缓存: ${result.cleanedCaches.join(', ')}`);
      console.log(`⏱️  耗时: ${result.duration}ms`);
    } else {
      console.log(`❌ 清理失败: ${result.error?.message}`);
    }
    
    // 测试估算功能
    console.log('\n📊 估算清理影响...');
    const estimatedImpact = cleanupManager.estimateCleanupImpact(cleanupContext);
    console.log(`💡 预估可释放内存: ${formatBytes(estimatedImpact)}`);
    
    console.log('\n🎉 清理策略测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
  }
}

// 运行测试
if (require.main === module) {
  testCleanupStrategies().then(() => {
    console.log('\n🏁 测试脚本执行完成');
  }).catch(error => {
    console.error('测试脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = { testCleanupStrategies };