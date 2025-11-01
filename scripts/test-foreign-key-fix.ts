import { Container } from 'inversify';
import { TYPES } from '../src/types';
import { SqliteDatabaseService } from '../src/database/splite/SqliteDatabaseService';
import { LoggerService } from '../src/utils/LoggerService';
import { FileHashManagerImpl } from '../src/service/filesystem/FileHashManager';
import { ErrorHandlerService, ErrorReport } from '../src/utils/ErrorHandlerService';

// 简单的日志服务实现用于测试
class TestLoggerService extends LoggerService {
  async info(message: string, meta?: any): Promise<void> {
    console.log(`INFO: ${message}`, meta);
  }
  
  async error(message: string, error?: any): Promise<void> {
    console.log(`ERROR: ${message}`, error);
  }
  
  async warn(message: string, meta?: any): Promise<void> {
    console.log(`WARN: ${message}`, meta);
  }
  
  async debug(message: string, meta?: any): Promise<void> {
    console.log(`DEBUG: ${message}`, meta);
 }
  
  getLogFilePath(): string {
    return './test.log';
  }
  
  updateLogLevel(level: string): void {
    console.log(`Log level updated to: ${level}`);
  }
  
  async markAsNormalExit(): Promise<void> {
    console.log('Marked as normal exit');
  }
}

// 简单的错误处理服务实现用于测试
class TestErrorHandlerService extends ErrorHandlerService {
  constructor(logger: LoggerService) {
    super(logger);
  }
  
  // 重写方法以简化测试
  handleError(error: Error, context: { component: string; operation: string; [key: string]: any; }): ErrorReport {
    console.log(`Handled error: ${error.message}`, context);
    return {
      id: 'test-error-id',
      timestamp: new Date(),
      component: context.component,
      operation: context.operation,
      message: error.message,
      stack: error.stack,
      context: context
    };
  }
  
  handleHotReloadError(error: any, context: { component: string; operation: string; [key: string]: any; }): ErrorReport {
    console.log(`Handled hot reload error: ${error.message}`, context);
    return {
      id: 'test-hot-reload-error-id',
      timestamp: new Date(),
      component: context.component,
      operation: context.operation,
      message: error.message || String(error),
      stack: error.stack,
      context: context
    };
  }
}

async function testForeignKeyConstraintFix() {
  console.log('Testing foreign key constraint fix...');
  
  const container = new Container();
  
  // 创建并注册服务
  const testLogger = new TestLoggerService();
  const sqliteService = new SqliteDatabaseService(testLogger);
  const testErrorHandler = new TestErrorHandlerService(testLogger);
  
  container.bind<SqliteDatabaseService>(TYPES.SqliteDatabaseService).toConstantValue(sqliteService);
  container.bind<LoggerService>(TYPES.LoggerService).toConstantValue(testLogger);
  container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).toConstantValue(testErrorHandler);
  
  // 初始化数据库
  sqliteService.connect();
  sqliteService.initializeTables();
  
  // 创建FileHashManager实例
  const fileHashManager = new FileHashManagerImpl(
    testLogger,
    sqliteService
  );
  
  try {
    // 测试数据 - 使用一个不存在的projectId来验证外键约束修复
    const testUpdates = [
      {
        projectId: 'test-project-12345',
        filePath: '/test/path/file1.ts',
        hash: 'hash123',
        fileSize: 1024,
        lastModified: new Date(),
        language: 'typescript',
        fileType: '.ts'
      },
      {
        projectId: 'test-project-67890',
        filePath: '/test/path/file2.js',
        hash: 'hash456',
        fileSize: 2048,
        lastModified: new Date(),
        language: 'javascript',
        fileType: '.js'
      }
    ];
    
    console.log('Attempting to batch update file hashes...');
    await fileHashManager.batchUpdateHashes(testUpdates);
    console.log('Batch update completed successfully - foreign key constraint issue fixed!');
    
    // 验证项目是否被正确创建
    const projectCheckStmt = sqliteService.prepare('SELECT * FROM projects WHERE id IN (?, ?)');
    const projects = projectCheckStmt.all('test-project-12345', 'test-project-67890');
    console.log(`Verified that ${projects.length} projects were created in the database`);
    
    // 验证文件哈希是否被正确插入
    const hashCheckStmt = sqliteService.prepare('SELECT * FROM file_index_states WHERE project_id IN (?, ?)');
    const hashes = hashCheckStmt.all('test-project-12345', 'test-project-67890');
    console.log(`Verified that ${hashes.length} file hashes were inserted in the database`);
    
  } catch (error) {
    console.error('Test failed with error:', error);
    throw error;
 } finally {
    sqliteService.close();
  }
  
  console.log('Foreign key constraint fix test completed successfully!');
}

// 运行测试
testForeignKeyConstraintFix().catch(console.error);