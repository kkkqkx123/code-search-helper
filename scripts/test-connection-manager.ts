import { Container } from 'inversify';
import { TYPES } from '../src/types';
import { NebulaConnectionManager } from '../src/database/nebula/NebulaConnectionManager';
import { DatabaseLoggerService } from '../src/database/common/DatabaseLoggerService';
import { ErrorHandlerService } from '../src/utils/ErrorHandlerService';
import { ConfigService } from '../src/config/ConfigService';
import { NebulaConfigService } from '../src/config/service/NebulaConfigService';
import { ConnectionStateManager } from '../src/database/nebula/ConnectionStateManager';
import { NebulaEventManager } from '../src/database/nebula/NebulaEventManager';
import { LoggerService } from '../src/utils/LoggerService';

async function testConnectionManager() {
  console.log('Testing NebulaConnectionManager...');
  
  // 创建依赖注入容器并注册服务
  const container = new Container();
  
  // 注册必要的服务
  container.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
  container.bind<ConfigService>(TYPES.ConfigService).to(ConfigService).inSingletonScope();
  container.bind<DatabaseLoggerService>(TYPES.DatabaseLoggerService).to(DatabaseLoggerService).inSingletonScope();
  container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
  container.bind<NebulaConfigService>(TYPES.NebulaConfigService).to(NebulaConfigService).inSingletonScope();
  container.bind<ConnectionStateManager>(TYPES.ConnectionStateManager).to(ConnectionStateManager).inSingletonScope();
  container.bind<NebulaEventManager>(TYPES.NebulaEventManager).to(NebulaEventManager).inSingletonScope();
  container.bind<NebulaConnectionManager>(TYPES.NebulaConnectionManager).to(NebulaConnectionManager).inSingletonScope();
  
  try {
    // 获取连接管理器实例
    const connectionManager = container.get<NebulaConnectionManager>(TYPES.NebulaConnectionManager);
    
    console.log('Attempting to connect to Nebula Graph...');
    const connected = await connectionManager.connect();
    
    if (connected) {
      console.log('Successfully connected to Nebula Graph!');
      
      // 执行一个简单的查询测试
      try {
        const result = await connectionManager.executeQuery('SHOW TAGS;');
        console.log('SHOW TAGS result:', result);
      } catch (error) {
        console.error('Error executing query:', error);
      }
      
      // 断开连接
      await connectionManager.disconnect();
      console.log('Disconnected from Nebula Graph');
    } else {
      console.log('Failed to connect to Nebula Graph');
    }
  } catch (error) {
    console.error('Error during connection test:', error);
  } finally {
    // 退出程序
    process.exit(0);
  }
}

testConnectionManager();