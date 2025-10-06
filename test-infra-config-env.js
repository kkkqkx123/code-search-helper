// 测试 InfrastructureConfigService 环境变量加载功能
require('dotenv').config();

// 模拟 InfrastructureConfigService 的环境变量处理逻辑
function testInfrastructureConfigEnvLoading() {
  console.log('=== 测试 InfrastructureConfigService 环境变量加载 ===\n');

  // 1. 检查 .env 文件中的 INFRA_ 前缀变量是否被正确加载
  console.log('1. 检查 INFRA_ 前缀环境变量:');

  const infraEnvVars = [
    'INFRA_COMMON_ENABLE_CACHE',
    'INFRA_COMMON_ENABLE_MONITORING',
    'INFRA_COMMON_LOG_LEVEL',
    'INFRA_QDRANT_CACHE_DEFAULT_TTL',
    'INFRA_QDRANT_CONNECTION_MAX_CONNECTIONS',
    'INFRA_NEBULA_CONNECTION_MAX_CONNECTIONS',
    'INFRA_TRANSACTION_TIMEOUT'
  ];

  let loadedCount = 0;
  infraEnvVars.forEach(varName => {
    const value = process.env[varName];
    if (value !== undefined) {
      console.log(`  ✓ ${varName} = ${value}`);
      loadedCount++;
    } else {
      console.log(`  ✗ ${varName} = 未定义`);
    }
  });

  console.log(`\n加载的环境变量数量: ${loadedCount}/${infraEnvVars.length}\n`);

  // 2. 模拟 InfrastructureConfigService 的默认配置逻辑
  console.log('2. 模拟 InfrastructureConfigService 配置加载:');

  // 模拟从环境变量加载配置的逻辑
  const config = {
    common: {
      enableCache: process.env.INFRA_COMMON_ENABLE_CACHE === 'true',
      enableMonitoring: process.env.INFRA_COMMON_ENABLE_MONITORING === 'true',
      enableBatching: process.env.INFRA_COMMON_ENABLE_BATCHING === 'true',
      logLevel: process.env.INFRA_COMMON_LOG_LEVEL || 'info',
      enableHealthChecks: process.env.INFRA_COMMON_ENABLE_HEALTH_CHECKS === 'true',
      healthCheckInterval: parseInt(process.env.INFRA_COMMON_HEALTH_CHECK_INTERVAL || '30000'),
      gracefulShutdownTimeout: parseInt(process.env.INFRA_COMMON_GRACEFUL_SHUTDOWN_TIMEOUT || '10000')
    },
    qdrant: {
      cache: {
        defaultTTL: parseInt(process.env.INFRA_QDRANT_CACHE_DEFAULT_TTL || '300000'),
        maxEntries: parseInt(process.env.INFRA_QDRANT_CACHE_MAX_ENTRIES || '10000'),
        cleanupInterval: parseInt(process.env.INFRA_QDRANT_CACHE_CLEANUP_INTERVAL || '60000'),
        enableStats: process.env.INFRA_QDRANT_CACHE_ENABLE_STATS === 'true'
      },
      connection: {
        maxConnections: parseInt(process.env.INFRA_QDRANT_CONNECTION_MAX_CONNECTIONS || '10'),
        minConnections: parseInt(process.env.INFRA_QDRANT_CONNECTION_MIN_CONNECTIONS || '2'),
        connectionTimeout: parseInt(process.env.INFRA_QDRANT_CONNECTION_CONNECTION_TIMEOUT || '30000')
      }
    },
    nebula: {
      cache: {
        defaultTTL: parseInt(process.env.INFRA_NEBULA_CACHE_DEFAULT_TTL || '300000'),
        maxEntries: parseInt(process.env.INFRA_NEBULA_CACHE_MAX_ENTRIES || '10000')
      },
      connection: {
        maxConnections: parseInt(process.env.INFRA_NEBULA_CONNECTION_MAX_CONNECTIONS || '10'),
        minConnections: parseInt(process.env.INFRA_NEBULA_CONNECTION_MIN_CONNECTIONS || '2')
      }
    },
    transaction: {
      timeout: parseInt(process.env.INFRA_TRANSACTION_TIMEOUT || '30000'),
      retryAttempts: parseInt(process.env.INFRA_TRANSACTION_RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.INFRA_TRANSACTION_RETRY_DELAY || '1000')
    }
  };

  console.log('  配置加载结果:');
  console.log(`    Common - Cache: ${config.common.enableCache}, Monitoring: ${config.common.enableMonitoring}, LogLevel: ${config.common.logLevel}`);
  console.log(`    Qdrant - MaxConnections: ${config.qdrant.connection.maxConnections}, CacheTTL: ${config.qdrant.cache.defaultTTL}`);
  console.log(`    Nebula - MaxConnections: ${config.nebula.connection.maxConnections}, CacheTTL: ${config.nebula.cache.defaultTTL}`);
  console.log(`    Transaction - Timeout: ${config.transaction.timeout}, RetryAttempts: ${config.transaction.retryAttempts}`);

  console.log('\n3. 检查实际 InfrastructureConfigService 中的环境变量使用:');

  // 分析 InfrastructureConfigService.ts 中是否有环境变量加载
  const fs = require('fs');
  const path = require('path');

  const infraConfigPath = path.join(__dirname, 'src/infrastructure/config/InfrastructureConfigService.ts');

  if (fs.existsSync(infraConfigPath)) {
    const content = fs.readFileSync(infraConfigPath, 'utf8');

    // 检查是否有 process.env 的使用
    const hasProcessEnv = content.includes('process.env');
    const hasDotEnv = content.includes('dotenv');
    const hasEnvLoading = content.includes('INFRA_');

    console.log(`  ✓ 文件存在: ${infraConfigPath}`);
    console.log(`  ${hasProcessEnv ? '✓' : '✗'} 包含 process.env 使用`);
    console.log(`  ${hasDotEnv ? '✓' : '✗'} 包含 dotenv 导入`);
    console.log(`  ${hasEnvLoading ? '✓' : '✗'} 包含 INFRA_ 前缀环境变量`);

    if (!hasProcessEnv) {
      console.log('\n  ⚠️  发现问题: InfrastructureConfigService 没有直接从环境变量加载配置');
      console.log('  当前实现:');
      console.log('    - 使用硬编码的默认配置');
      console.log('    - 通过 ConfigService 间接获取部分配置');
      console.log('    - 没有直接读取 INFRA_ 前缀的环境变量');
    }
  } else {
    console.log(`  ✗ 文件不存在: ${infraConfigPath}`);
  }

  console.log('\n4. 检查主 ConfigService 的环境变量集成:');

  const configServicePath = path.join(__dirname, 'src/config/ConfigService.ts');
  if (fs.existsSync(configServicePath)) {
    const content = fs.readFileSync(configServicePath, 'utf8');
    const hasDotEnv = content.includes('dotenv');

    console.log(`  ✓ ConfigService 文件存在`);
    console.log(`  ${hasDotEnv ? '✓' : '✗'} ConfigService 加载 dotenv`);

    if (hasDotEnv) {
      console.log('  ✓ ConfigService 会加载 .env 文件中的所有环境变量');
      console.log('  ✓ INFRA_ 前缀的环境变量应该已经被加载到 process.env 中');
    }
  }

  console.log('\n=== 测试完成 ===');
}

// 运行测试
testInfrastructureConfigEnvLoading();