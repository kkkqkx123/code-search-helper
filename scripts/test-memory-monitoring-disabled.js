// 模拟环境变量
process.env.MEMORY_MONITORING_ENABLED = 'false';

console.log('测试内存监控禁用功能...\n');

// 测试环境变量直接访问
console.log('环境变量检查:');
console.log('- MEMORY_MONITORING_ENABLED:', process.env.MEMORY_MONITORING_ENABLED);
console.log('- 解析为布尔值:', process.env.MEMORY_MONITORING_ENABLED !== 'false');

// 测试配置解析逻辑
function testConfigParsing() {
  const rawConfig = {
    enabled: process.env.MEMORY_MONITORING_ENABLED !== 'false',
    warningThreshold: parseFloat(process.env.MEMORY_WARNING_THRESHOLD || '0.90'),
    criticalThreshold: parseFloat(process.env.MEMORY_CRITICAL_THRESHOLD || '0.94'),
    emergencyThreshold: parseFloat(process.env.MEMORY_EMERGENCY_THRESHOLD || '0.98'),
    checkInterval: parseInt(process.env.MEMORY_CHECK_INTERVAL || '30000'),
    cleanupCooldown: parseInt(process.env.MEMORY_CLEANUP_COOLDOWN || '30000'),
    maxHistorySize: parseInt(process.env.MEMORY_HISTORY_SIZE || '100'),
  };

  console.log('\n配置解析结果:');
  console.log('- 监控启用状态:', rawConfig.enabled);
  console.log('- 警告阈值:', rawConfig.warningThreshold);
  console.log('- 严重阈值:', rawConfig.criticalThreshold);
  console.log('- 紧急阈值:', rawConfig.emergencyThreshold);

  if (rawConfig.enabled === false) {
    console.log('\n✅ 成功：内存监控已被禁用');
  } else {
    console.log('\n❌ 失败：内存监控未被正确禁用');
  }
}

testConfigParsing();

console.log('\n测试完成！');