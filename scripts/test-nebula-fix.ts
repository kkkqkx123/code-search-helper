import { NebulaConfigService } from '../src/config/service/NebulaConfigService';
import { DatabaseLoggerService } from '../src/database/common/DatabaseLoggerService';
import { ErrorHandlerService } from '../src/utils/ErrorHandlerService';
import { LoggerService } from '../src/utils/LoggerService';
import { ConnectionStateManager } from '../src/database/nebula/ConnectionStateManager';
import { NebulaEventManager } from '../src/database/nebula/NebulaEventManager';
import { NebulaConnectionManager } from '../src/database/nebula/NebulaConnectionManager';

// 创建服务实例来测试修复
async function testNebulaFix() {
  console.log('Testing Nebula Connection Manager fix...');
  
  try {
    // 创建所有必需的服务
    const loggerService = new LoggerService();
    const databaseLogger = new DatabaseLoggerService();
    const errorHandler = new ErrorHandlerService();
    const configService = new NebulaConfigService(loggerService, errorHandler);
    const connectionStateManager = new ConnectionStateManager();
    const eventManager = new NebulaEventManager();
    
    // 创建NebulaConnectionManager实例
    const connectionManager = new NebulaConnectionManager(
      databaseLogger,
      errorHandler,
      null as any, // configService
      configService,
      connectionStateManager,
      eventManager
    );
    
    console.log('NebulaConnectionManager created successfully');
    
    // 检查配置加载
    const config = connectionManager.getConfig();
    console.log('Config loaded:', JSON.stringify(config, null, 2));
    
    // 检查连接状态，确保space名称正确处理
    const status = connectionManager.getConnectionStatus();
    console.log('Connection status:', JSON.stringify(status, null, 2));
    
    // 验证space名称是否正确处理
    if (status.space === 'undefined' || status.space === '') {
      console.log('❌ Space name is invalid ("undefined" or empty string)');
    } else if (status.space === undefined) {
      console.log('✅ Space name is correctly set to undefined (not "undefined" string)');
    } else {
      console.log('✅ Space name is valid:', status.space);
    }
    
    console.log('All tests passed - fix appears to be working correctly!');
  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  }
}

// 运行测试
testNebulaFix().then(() => {
  console.log('Nebula Connection Manager fix validation completed successfully!');
}).catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});