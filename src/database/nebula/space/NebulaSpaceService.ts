import { injectable, inject } from 'inversify';
import { INebulaConnectionManager } from '../NebulaConnectionManager';
import { TYPES } from '../../../types';
import { DatabaseLoggerService } from '../../common/DatabaseLoggerService';
import { DatabaseEventType } from '../../common/DatabaseEventTypes';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { NebulaConfigService } from '../../../config/service/NebulaConfigService';
import { NebulaConfig } from '../NebulaTypes';

export interface INebulaSpaceService {
  // 空间管理
  createSpace(spaceName: string, options?: { partitionNum?: number; replicaFactor?: number; vidType?: string }): Promise<boolean>;
  dropSpace(spaceName: string): Promise<boolean>;
  listSpaces(): Promise<any[]>;
  useSpace(spaceName: string): Promise<boolean>;
  checkSpaceExists(spaceName: string): Promise<boolean>;
  
  // 空间切换管理
  getConnectionForSpace(space: string): Promise<any>;
  executeQueryInSpace(space: string, query: string, parameters?: Record<string, any>): Promise<any>;
  
  // 空间状态跟踪
  getCurrentSpace(): string | undefined;
  validateSpace(spaceName: string): Promise<boolean>;
}

@injectable()
export class NebulaSpaceService implements INebulaSpaceService {
  private connectionManager: INebulaConnectionManager;
  private databaseLogger: DatabaseLoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: NebulaConfigService;

  constructor(
    @inject(TYPES.NebulaConnectionManager) connectionManager: INebulaConnectionManager,
    @inject(TYPES.DatabaseLoggerService) databaseLogger: DatabaseLoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.NebulaConfigService) configService: NebulaConfigService
  ) {
    this.connectionManager = connectionManager;
    this.databaseLogger = databaseLogger;
    this.errorHandler = errorHandler;
    this.configService = configService;
  }

  async createSpace(spaceName: string, options?: { partitionNum?: number; replicaFactor?: number; vidType?: string }): Promise<boolean> {
    if (!this.connectionManager.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      // 验证空间名称的有效性
      if (!spaceName || spaceName === 'undefined' || spaceName === '') {
        throw new Error(`Cannot create space with invalid name: ${spaceName}`);
      }

      // 使用 DatabaseLoggerService 记录空间创建信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.SPACE_CREATED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Creating space',
          spaceName,
          options
        }
      }).catch(error => {
        console.error('Failed to log space creation info:', error);
      });

      // 构建CREATE SPACE查询
      const partitionNum = options?.partitionNum || 10;
      const replicaFactor = options?.replicaFactor || 1;
      const vidType = options?.vidType || `fixed_string(${this.configService.loadConfig().vidTypeLength || 128})`;
      
      const nGQL = `CREATE SPACE IF NOT EXISTS \`${spaceName}\`(partition_num=${partitionNum}, replica_factor=${replicaFactor}, vid_type=${vidType});`;
      
      const result = await this.connectionManager.executeQuery(nGQL);

      if (result.error) {
        throw new Error(`Failed to create space ${spaceName}: ${result.error}`);
      }

      // 等待空间创建完成（Nebula Graph需要时间创建）
      await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒

      // 使用 DatabaseLoggerService 记录空间创建成功信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.SPACE_CREATED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Space created successfully',
          spaceName
        }
      }).catch(error => {
        console.error('Failed to log space creation success:', error);
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to create space: ${errorMessage}`),
        {
          component: 'NebulaSpaceService',
          operation: 'createSpace',
          spaceName,
          options
        }
      );

      return false;
    }
  }

  async dropSpace(spaceName: string): Promise<boolean> {
    if (!this.connectionManager.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      // 验证空间名称的有效性
      if (!spaceName || spaceName === 'undefined' || spaceName === '') {
        throw new Error(`Cannot drop space with invalid name: ${spaceName}`);
      }

      // 使用 DatabaseLoggerService 记录空间删除信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.SPACE_DELETED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Dropping space',
          spaceName
        }
      }).catch(error => {
        console.error('Failed to log space deletion info:', error);
      });

      const nGQL = `DROP SPACE IF EXISTS \`${spaceName}\``;
      const result = await this.connectionManager.executeQuery(nGQL);

      if (result.error) {
        throw new Error(`Failed to drop space ${spaceName}: ${result.error}`);
      }

      // 使用 DatabaseLoggerService 记录空间删除成功信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.SPACE_DELETED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Space dropped successfully',
          spaceName
        }
      }).catch(error => {
        console.error('Failed to log space deletion success:', error);
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to drop space: ${errorMessage}`),
        {
          component: 'NebulaSpaceService',
          operation: 'dropSpace',
          spaceName
        }
      );

      return false;
    }
  }

  async listSpaces(): Promise<any[]> {
    if (!this.connectionManager.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      // 使用 DatabaseLoggerService 记录空间列表查询信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.DATA_QUERIED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Listing spaces'
        }
      }).catch(error => {
        console.error('Failed to log space listing info:', error);
      });

      const result = await this.connectionManager.executeQuery('SHOW SPACES');

      if (result.error) {
        throw new Error(`Failed to list spaces: ${result.error}`);
      }

      // 使用 DatabaseLoggerService 记录空间列表查询成功信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.DATA_QUERIED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Spaces listed successfully',
          count: result?.data?.length || 0
        }
      }).catch(error => {
        console.error('Failed to log space listing success:', error);
      });

      return result?.data || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to list spaces: ${errorMessage}`),
        {
          component: 'NebulaSpaceService',
          operation: 'listSpaces'
        }
      );

      throw error;
    }
  }

  async useSpace(spaceName: string): Promise<boolean> {
    if (!this.connectionManager.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      // 验证空间名称的有效性
      if (!spaceName || spaceName === 'undefined' || spaceName === '') {
        throw new Error(`Cannot use invalid space: ${spaceName}`);
      }

      // 使用 DatabaseLoggerService 记录使用空间信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.SPACE_SELECTED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Using space',
          spaceName
        }
      }).catch(error => {
        console.error('Failed to log space usage info:', error);
      });

      const nGQL = `USE \`${spaceName}\``;
      const result = await this.connectionManager.executeQuery(nGQL);

      if (result.error) {
        throw new Error(`Failed to use space ${spaceName}: ${result.error}`);
      }

      // 使用 DatabaseLoggerService 记录使用空间成功信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.SPACE_SELECTED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Space used successfully',
          spaceName
        }
      }).catch(error => {
        console.error('Failed to log space usage success:', error);
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to use space: ${errorMessage}`),
        {
          component: 'NebulaSpaceService',
          operation: 'useSpace',
          spaceName
        }
      );

      return false;
    }
  }

  async checkSpaceExists(spaceName: string): Promise<boolean> {
    if (!this.connectionManager.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      // 验证空间名称的有效性
      if (!spaceName || spaceName === 'undefined' || spaceName === '') {
        return false;
      }

      // 使用 DatabaseLoggerService 记录空间检查信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.DATA_QUERIED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Checking if space exists',
          spaceName
        }
      }).catch(error => {
        console.error('Failed to log space check info:', error);
      });

      const result = await this.connectionManager.executeQuery('SHOW SPACES');
      const spaces = result?.data || [];
      
      // 在Nebula中，space名称可能以不同字段返回，检查多个可能的字段名
      const exists = spaces.some((space: any) => 
        space.Name === spaceName || 
        space.name === spaceName || 
        Object.values(space)[0] === spaceName
      );

      // 使用 DatabaseLoggerService 记录空间检查结果信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.DATA_QUERIED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Space check completed',
          spaceName,
          exists
        }
      }).catch(error => {
        console.error('Failed to log space check result:', error);
      });

      return exists;
    } catch (error) {
      // 使用 DatabaseLoggerService 记录空间检查失败信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.ERROR_OCCURRED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Failed to check if space exists',
          error: error instanceof Error ? error.message : String(error),
          spaceName
        }
      }).catch(error => {
        console.error('Failed to log space check failure:', error);
      });

      return false;
    }
  }

  async getConnectionForSpace(space: string) {
    if (!this.connectionManager.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      // 验证空间名称的有效性
      if (!space || space === 'undefined' || space === '') {
        throw new Error(`Cannot get connection for invalid space: ${space}`);
      }

      // 使用 DatabaseLoggerService 记录获取空间连接信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.CONNECTION_OPENED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Getting connection for space',
          space
        }
      }).catch(error => {
        console.error('Failed to log space connection info:', error);
      });

      // 使用连接管理器的 getConnectionForSpace 方法
      const connection = await (this.connectionManager as any).getConnectionForSpace(space);

      // 使用 DatabaseLoggerService 记录获取空间连接成功信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.CONNECTION_OPENED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Connection for space obtained successfully',
          space
        }
      }).catch(error => {
        console.error('Failed to log space connection success:', error);
      });

      return connection;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to get connection for space: ${errorMessage}`),
        {
          component: 'NebulaSpaceService',
          operation: 'getConnectionForSpace',
          space
        }
      );

      throw error;
    }
  }

  async executeQueryInSpace(space: string, query: string, parameters?: Record<string, any>): Promise<any> {
    if (!this.connectionManager.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      // 验证空间名称的有效性
      if (!space || space === 'undefined' || space === '') {
        throw new Error(`Cannot execute query in invalid space: ${space}`);
      }

      // 使用 DatabaseLoggerService 记录在空间中执行查询信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.QUERY_EXECUTED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Executing query in space',
          space,
          query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
          hasParameters: !!parameters
        }
      }).catch(error => {
        console.error('Failed to log space query execution info:', error);
      });

      // 使用连接管理器的 executeQueryInSpace 方法
      const result = await (this.connectionManager as any).executeQueryInSpace(space, query, parameters);

      // 使用 DatabaseLoggerService 记录在空间中执行查询成功信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.QUERY_EXECUTED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Query executed in space successfully',
          space,
          hasResult: !!result,
          hasError: !!result?.error
        }
      }).catch(error => {
        console.error('Failed to log space query execution success:', error);
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to execute query in space: ${errorMessage}`),
        {
          component: 'NebulaSpaceService',
          operation: 'executeQueryInSpace',
          space,
          query,
          parameters
        }
      );

      throw error;
    }
  }

  getCurrentSpace(): string | undefined {
    try {
      // 使用 DatabaseLoggerService 记录获取当前空间信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.DATA_QUERIED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Getting current space'
        }
      }).catch(error => {
        console.error('Failed to log current space info:', error);
      });

      // 从连接管理器获取当前空间信息
      const connectionStatus = this.connectionManager.getConnectionStatus();
      return connectionStatus?.space;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to get current space: ${errorMessage}`),
        {
          component: 'NebulaSpaceService',
          operation: 'getCurrentSpace'
        }
      );

      return undefined;
    }
  }

  async validateSpace(spaceName: string): Promise<boolean> {
    if (!this.connectionManager.isConnected()) {
      throw new Error('Not connected to Nebula Graph');
    }

    try {
      // 使用 DatabaseLoggerService 记录空间验证信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.DATA_QUERIED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Validating space',
          spaceName
        }
      }).catch(error => {
        console.error('Failed to log space validation info:', error);
      });

      // 检查空间是否存在
      const exists = await this.checkSpaceExists(spaceName);
      
      if (!exists) {
        return false;
      }

      // 尝试使用这个空间并运行一个简单的查询
      const currentSpace = this.getCurrentSpace();
      const result = await this.connectionManager.executeQuery(`USE \`${spaceName}\``);
      
      if (result.error) {
        return false;
      }
      
      // 执行一个简单的查询验证空间是否可访问
      const validationResult = await this.connectionManager.executeQuery('SHOW TAGS');
      
      // 恢复到之前的空间（如果有的话）
      if (currentSpace) {
        await this.connectionManager.executeQuery(`USE \`${currentSpace}\``);
      }
      
      const isValid = !validationResult.error;
      
      // 使用 DatabaseLoggerService 记录空间验证结果信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.DATA_QUERIED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Space validation completed',
          spaceName,
          isValid
        }
      }).catch(error => {
        console.error('Failed to log space validation result:', error);
      });

      return isValid;
    } catch (error) {
      // 使用 DatabaseLoggerService 记录空间验证失败信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.ERROR_OCCURRED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Space validation failed',
          error: error instanceof Error ? error.message : String(error),
          spaceName
        }
      }).catch(error => {
        console.error('Failed to log space validation failure:', error);
      });

      return false;
    }
  }
}