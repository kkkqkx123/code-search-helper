# SQLite集成实现设计文档

## 🏗️ 详细类设计

### 1. SQLite基础设施实现类

#### 1.1 SqliteInfrastructure 类设计

```typescript
// src/infrastructure/implementations/SqliteInfrastructure.ts
import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { DatabaseType } from '../types';
import { IDatabaseInfrastructure } from '../InfrastructureManager';
import { ICacheService } from '../caching/types';
import { IPerformanceMonitor } from '../monitoring/types';
import { IBatchOptimizer } from '../batching/types';
import { IHealthChecker } from '../monitoring/types';
import { DatabaseConnectionPool } from '../connection/DatabaseConnectionPool';
import { SqliteDatabaseService } from '../../database/sqlite/SqliteDatabaseService';

@injectable()
export class SqliteInfrastructure implements IDatabaseInfrastructure {
  readonly databaseType = DatabaseType.SQLITE;
  
  private logger: LoggerService;
  private cacheService: ICacheService;
  private performanceMonitor: IPerformanceMonitor;
  private batchOptimizer: IBatchOptimizer;
  private healthChecker: IHealthChecker;
  private connectionManager: DatabaseConnectionPool;
  private sqliteService: SqliteDatabaseService;
  private initialized = false;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.CacheService) cacheService: ICacheService,
    @inject(TYPES.PerformanceMonitor) performanceMonitor: IPerformanceMonitor,
    @inject(TYPES.BatchOptimizer) batchOptimizer: IBatchOptimizer,
    @inject(TYPES.HealthChecker) healthChecker: IHealthChecker,
    @inject(TYPES.DatabaseConnectionPool) connectionManager: DatabaseConnectionPool,
    @inject(TYPES.SqliteDatabaseService) sqliteService: SqliteDatabaseService
  ) {
    this.logger = logger;
    this.cacheService = cacheService;
    this.performanceMonitor = performanceMonitor;
    this.batchOptimizer = batchOptimizer;
    this.healthChecker = healthChecker;
    this.connectionManager = connectionManager;
    this.sqliteService = sqliteService;
    
    this.logger.info('Sqlite infrastructure created');
  }

  getCacheService(): ICacheService {
    this.ensureInitialized();
    return this.cacheService;
  }

  getPerformanceMonitor(): IPerformanceMonitor {
    this.ensureInitialized();
    return this.performanceMonitor;
  }

  getBatchOptimizer(): IBatchOptimizer {
    this.ensureInitialized();
    return this.batchOptimizer;
  }

  getHealthChecker(): IHealthChecker {
    this.ensureInitialized();
    return this.healthChecker;
  }

  getConnectionManager(): DatabaseConnectionPool {
    this.ensureInitialized();
    return this.connectionManager;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('Sqlite infrastructure already initialized');
      return;
    }

    this.logger.info('Initializing Sqlite infrastructure');

    try {
      // 初始化SQLite数据库服务
      await this.sqliteService.initialize();
      
      // 启动性能监控
      this.performanceMonitor.startPeriodicMonitoring(30000);
      
      // 验证连接池
      const testConnection = await this.connectionManager.getConnection(this.databaseType);
      await this.connectionManager.releaseConnection(testConnection);
      
      // 执行健康检查
      await this.healthChecker.checkHealth();
      
      this.initialized = true;
      this.logger.info('Sqlite infrastructure initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Sqlite infrastructure', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      this.logger.warn('Sqlite infrastructure not initialized, nothing to shutdown');
      return;
    }

    this.logger.info('Shutting down Sqlite infrastructure');

    try {
      // 停止性能监控
      this.performanceMonitor.stopPeriodicMonitoring();
      
      // 清理缓存
      this.cacheService.clearAllCache();
      
      // 重置性能指标
      this.performanceMonitor.resetMetrics();
      
      // 关闭SQLite数据库连接
      await this.sqliteService.close();
      
      this.initialized = false;
      this.logger.info('Sqlite infrastructure shutdown completed');
    } catch (error) {
      this.logger.error('Error during Sqlite infrastructure shutdown', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Sqlite infrastructure is not initialized. Call initialize() first.');
    }
  }

  // SQLite特定的辅助方法
  async executeSqlQuery(query: string, params?: any[]): Promise<any> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    let success = false;
    
    try {
      const result = await this.sqliteService.executeQuery(query, params);
      success = true;
      return result;
    } finally {
      const duration = Date.now() - startTime;
      await this.recordSqlOperation('query', query, duration, success);
    }
  }

  async backupDatabase(backupPath: string): Promise<void> {
    this.ensureInitialized();
    await this.sqliteService.backup(backupPath);
  }

  async getDatabaseStats(): Promise<DatabaseStats> {
    this.ensureInitialized();
    return this.sqliteService.getStats();
  }

  async recordSqlOperation(
    operation: string,
    query: string,
    duration: number,
    success: boolean
  ): Promise<void> {
    await (this.performanceMonitor as any).recordSqlOperation?.(
      operation,
      query,
      duration,
      success
    );
    
    this.logger.debug('Recorded SQL operation', {
      operation,
      query: query.substring(0, 100), // 只记录前100个字符
      duration,
      success
    });
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export interface DatabaseStats {
  projects: number;
  fileStates: number;
  projectStatus: number;
  changeHistory: number;
  databaseSize: number;
  tableSizes: Record<string, number>;
}
```

### 2. SQLite数据库服务适配器

#### 2.1 SqliteConnectionManager 类设计

```typescript
// src/database/sqlite/SqliteConnectionManager.ts
import { injectable } from 'inversify';
import { IConnectionManager } from '../common/IDatabaseService';
import { EventListener } from '../../types';
import { SqliteDatabaseService } from './SqliteDatabaseService';

@injectable()
export class SqliteConnectionManager implements IConnectionManager {
  private sqliteService: SqliteDatabaseService;
  private eventListeners: Map<string, EventListener[]> = new Map();
  private connected = false;

  constructor(sqliteService: SqliteDatabaseService) {
    this.sqliteService = sqliteService;
  }

  async connect(): Promise<boolean> {
    try {
      this.sqliteService.connect();
      this.connected = true;
      this.emitEvent('connected', { timestamp: new Date() });
      return true;
    } catch (error) {
      this.emitEvent('error', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.sqliteService.close();
      this.connected = false;
      this.emitEvent('disconnected', { timestamp: new Date() });
    } catch (error) {
      this.emitEvent('error', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.connected && this.sqliteService.isConnected();
  }

  getConfig(): any {
    return {
      databasePath: this.sqliteService.getDatabasePath(),
      connected: this.isConnected()
    };
  }

  updateConfig(config: any): void {
    // SQLite配置更新逻辑
    if (config.databasePath) {
      // 重新初始化数据库连接
      this.reinitialize(config.databasePath);
    }
  }

  getConnectionStatus(): any {
    return {
      connected: this.isConnected(),
      databasePath: this.sqliteService.getDatabasePath(),
      stats: this.sqliteService.getStats()
    };
  }

  addEventListener(eventType: string, listener: EventListener): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  removeEventListener(eventType: string, listener: EventListener): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emitEvent(eventType: string, data: any): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }

  private reinitialize(databasePath: string): void {
    // 重新初始化数据库连接
    this.disconnect().then(() => {
      // 创建新的SqliteDatabaseService实例
      // 在实际实现中，可能需要通过DI容器重新注入
    });
  }
}
```

#### 2.2 SqliteProjectManager 类设计

```typescript
// src/database/sqlite/SqliteProjectManager.ts
import { injectable } from 'inversify';
import { IProjectManager } from '../common/IDatabaseService';
import { EventListener } from '../../types';
import { SqliteDatabaseService } from './SqliteDatabaseService';

export interface Project {
  id: string;
  path: string;
  name?: string;
  description?: string;
  collection_name?: string;
  space_name?: string;
  created_at: Date;
  updated_at: Date;
  last_indexed_at?: Date;
  status: 'active' | 'inactive' | 'indexing' | 'error';
  settings?: any;
  metadata?: any;
}

export interface FileIndexState {
  id?: number;
  project_id: string;
  file_path: string;
  relative_path: string;
  content_hash: string;
  file_size?: number;
  last_modified: Date;
  last_indexed?: Date;
  indexing_version: number;
  chunk_count?: number;
  vector_count?: number;
  language?: string;
  file_type?: string;
  status: 'pending' | 'indexed' | 'failed';
  error_message?: string;
  metadata?: any;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectStatus {
  project_id: string;
  vector_status: any;
  graph_status: any;
  indexing_progress: number;
  total_files: number;
  indexed_files: number;
  failed_files: number;
  last_updated: Date;
}

@injectable()
export class SqliteProjectManager implements IProjectManager {
  private sqliteService: SqliteDatabaseService;
  private eventListeners: Map<string, EventListener[]> = new Map();

  constructor(sqliteService: SqliteDatabaseService) {
    this.sqliteService = sqliteService;
  }

  async createProjectSpace(projectPath: string, config?: any): Promise<boolean> {
    try {
      const project: Project = {
        id: this.generateProjectId(projectPath),
        path: projectPath,
        name: config?.name || this.extractProjectName(projectPath),
        description: config?.description,
        collection_name: config?.collectionName,
        space_name: config?.spaceName,
        created_at: new Date(),
        updated_at: new Date(),
        status: 'active',
        settings: config?.settings,
        metadata: config?.metadata
      };

      const stmt = this.sqliteService.prepare(`
        INSERT INTO projects (id, path, name, description, collection_name, space_name, created_at, updated_at, status, settings, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        project.id,
        project.path,
        project.name,
        project.description,
        project.collection_name,
        project.space_name,
        project.created_at.toISOString(),
        project.updated_at.toISOString(),
        project.status,
        JSON.stringify(project.settings || {}),
        JSON.stringify(project.metadata || {})
      );

      this.emitEvent('space_created', { projectPath, projectId: project.id });
      return true;
    } catch (error) {
      this.emitEvent('error', error);
      return false;
    }
  }

  async deleteProjectSpace(projectPath: string): Promise<boolean> {
    try {
      const project = await this.getProjectByPath(projectPath);
      if (!project) {
        return false;
      }

      const stmt = this.sqliteService.prepare('DELETE FROM projects WHERE id = ?');
      stmt.run(project.id);

      this.emitEvent('space_deleted', { projectPath, projectId: project.id });
      return true;
    } catch (error) {
      this.emitEvent('error', error);
      return false;
    }
  }

  async getProjectSpaceInfo(projectPath: string): Promise<any> {
    const project = await this.getProjectByPath(projectPath);
    if (!project) {
      return null;
    }

    const statusStmt = this.sqliteService.prepare('SELECT * FROM project_status WHERE project_id = ?');
    const status = statusStmt.get(project.id) as ProjectStatus | undefined;

    const fileStatesStmt = this.sqliteService.prepare('SELECT COUNT(*) as count FROM file_index_states WHERE project_id = ? AND status = ?');
    const indexedFiles = fileStatesStmt.get(project.id, 'indexed') as { count: number };
    const pendingFiles = fileStatesStmt.get(project.id, 'pending') as { count: number };
    const failedFiles = fileStatesStmt.get(project.id, 'failed') as { count: number };

    return {
      project,
      status: status || {
        project_id: project.id,
        vector_status: {},
        graph_status: {},
        indexing_progress: 0,
        total_files: 0,
        indexed_files: 0,
        failed_files: 0,
        last_updated: new Date()
      },
      fileStats: {
        indexed: indexedFiles.count,
        pending: pendingFiles.count,
        failed: failedFiles.count,
        total: indexedFiles.count + pendingFiles.count + failedFiles.count
      }
    };
  }

  async clearProjectSpace(projectPath: string): Promise<boolean> {
    try {
      const project = await this.getProjectByPath(projectPath);
      if (!project) {
        return false;
      }

      // 删除项目相关的所有数据
      const deleteFileStates = this.sqliteService.prepare('DELETE FROM file_index_states WHERE project_id = ?');
      const deleteProjectStatus = this.sqliteService.prepare('DELETE FROM project_status WHERE project_id = ?');
      const deleteChangeHistory = this.sqliteService.prepare('DELETE FROM file_change_history WHERE project_id = ?');

      this.sqliteService.transaction(() => {
        deleteFileStates.run(project.id);
        deleteProjectStatus.run(project.id);
        deleteChangeHistory.run(project.id);
      })();

      this.emitEvent('space_cleared', { projectPath, projectId: project.id });
      return true;
    } catch (error) {
      this.emitEvent('error', error);
      return false;
    }
  }

  async listProjectSpaces(): Promise<any[]> {
    const stmt = this.sqliteService.prepare('SELECT * FROM projects ORDER BY created_at DESC');
    const projects = stmt.all() as Project[];
    
    return projects.map(project => ({
      id: project.id,
      path: project.path,
      name: project.name,
      status: project.status,
      created_at: project.created_at,
      last_indexed_at: project.last_indexed_at
    }));
  }

  async insertProjectData(projectPath: string, data: any): Promise<boolean> {
    // 实现项目数据插入逻辑
    this.emitEvent('data_inserted', { projectPath, data });
    return true;
  }

  async updateProjectData(projectPath: string, id: string, data: any): Promise<boolean> {
    // 实现项目数据更新逻辑
    this.emitEvent('data_updated', { projectPath, id, data });
    return true;
  }

  async deleteProjectData(projectPath: string, id: string): Promise<boolean> {
    // 实现项目数据删除逻辑
    this.emitEvent('data_deleted', { projectPath, id });
    return true;
  }

  async searchProjectData(projectPath: string, query: any): Promise<any[]> {
    // 实现项目数据搜索逻辑
    return [];
  }

  async getProjectDataById(projectPath: string, id: string): Promise<any> {
    // 实现根据ID获取项目数据逻辑
    return null;
  }

  addEventListener(eventType: string, listener: EventListener): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  removeEventListener(eventType: string, listener: EventListener): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // SQLite特定的项目管理方法
  async getProjectById(projectId: string): Promise<Project | null> {
    const stmt = this.sqliteService.prepare('SELECT * FROM projects WHERE id = ?');
    const result = stmt.get(projectId) as Project | undefined;
    return result || null;
  }

  async updateProjectStatus(projectId: string, status: ProjectStatus): Promise<boolean> {
    try {
      const stmt = this.sqliteService.prepare(`
        INSERT OR REPLACE INTO project_status 
        (project_id, vector_status, graph_status, indexing_progress, total_files, indexed_files, failed_files, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        status.project_id,
        JSON.stringify(status.vector_status),
        JSON.stringify(status.graph_status),
        status.indexing_progress,
        status.total_files,
        status.indexed_files,
        status.failed_files,
        status.last_updated.toISOString()
      );

      return true;
    } catch (error) {
      this.emitEvent('error', error);
      return false;
    }
  }

  async getFileIndexStates(projectId: string): Promise<FileIndexState[]> {
    const stmt = this.sqliteService.prepare('SELECT * FROM file_index_states WHERE project_id = ? ORDER BY file_path');
    return stmt.all() as FileIndexState[];
  }

  private async getProjectByPath(projectPath: string): Promise<Project | null> {
    const stmt = this.sqliteService.prepare('SELECT * FROM projects WHERE path = ?');
    const result = stmt.get(projectPath) as Project | undefined;
    return result || null;
  }

  private generateProjectId(projectPath: string): string {
    // 使用路径的哈希值作为项目ID
    return Buffer.from(projectPath).toString('base64').replace(/[^a-zA-Z0-9]/g, '_');
  }

  private extractProjectName(projectPath: string): string {
    return projectPath.split(/[/\\]/).pop() || 'unknown';
  }

  private emitEvent(eventType: string, data: any): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }
}
```

### 3. 类型定义扩展

#### 3.1 扩展基础设施配置类型

```typescript
// src/infrastructure/config/types.ts
export interface InfrastructureConfig {
  common: CommonConfig;
  qdrant: DatabaseInfrastructureConfig;
  nebula: DatabaseInfrastructureConfig & { graph: GraphSpecificConfig };
  sqlite: DatabaseInfrastructureConfig & { 
    database: SqliteSpecificConfig 
  };
  vector?: DatabaseInfrastructureConfig & { vector?: VectorSpecificConfig };
  graph?: DatabaseInfrastructureConfig & { graph: GraphSpecificConfig };
  transaction: TransactionConfig;
}

export interface SqliteSpecificConfig {
  databasePath: string;
  backupPath?: string;
  backupInterval?: number;
  maxConnections?: number;
  queryTimeout?: number;
  journalMode?: 'WAL' | 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'OFF';
  synchronous?: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';
  cacheSize?: number;
  tempStore?: 'DEFAULT' | 'FILE' | 'MEMORY';
  autoVacuum?: 'NONE' | 'FULL' | 'INCREMENTAL';
  busyTimeout?: number;
}

export interface DatabaseInfrastructureConfig {
  cache: CacheConfig;
  performance: PerformanceConfig;
  batch: BatchConfig;
  connection: ConnectionConfig;
}
```

#### 3.2 更新DatabaseType枚举

```typescript
// src/infrastructure/types.ts
export enum DatabaseType {
  QDRANT = 'qdrant',
  NEBULA = 'nebula',
  VECTOR = 'vector',
  GRAPH = 'graph',
  SQLITE = 'sqlite'  // 新增SQLite类型
}
```

## 🔧 依赖注入配置

### 1. 更新DI容器配置

```typescript
// src/core/DIContainer.ts 或相应的DI配置文件中
import { SqliteInfrastructure } from '../infrastructure/implementations/SqliteInfrastructure';
import { SqliteDatabaseService } from '../database/sqlite/SqliteDatabaseService';
import { SqliteConnectionManager } from '../database/sqlite/SqliteConnectionManager';
import { SqliteProjectManager } from '../database/sqlite/SqliteProjectManager';

// 注册SQLite相关服务
container.bind<SqliteDatabaseService>(TYPES.SqliteDatabaseService).to(SqliteDatabaseService).inSingletonScope();
container.bind<SqliteConnectionManager>(TYPES.SqliteConnectionManager).to(SqliteConnectionManager).inSingletonScope();
container.bind<SqliteProjectManager>(TYPES.SqliteProjectManager).to(SqliteProjectManager).inSingletonScope();
container.bind<SqliteInfrastructure>(TYPES.SqliteInfrastructure).to(SqliteInfrastructure).inSingletonScope();

// 在InfrastructureManager中注入SQLite基础设施
```

### 2. 更新类型定义

```typescript
// src/types.ts
export const TYPES = {
  // ... 现有类型
  SqliteDatabaseService: Symbol.for('SqliteDatabaseService'),
  SqliteConnectionManager: Symbol.for('SqliteConnectionManager'),
  SqliteProjectManager: Symbol.for('SqliteProjectManager'),
  SqliteInfrastructure: Symbol.for('SqliteInfrastructure'),
  // ... 其他类型
};
```

## 🎯 实施优先级

### 高优先级（第一周）
1. **基础设施集成**
   - 扩展DatabaseType枚举
   - 创建SqliteInfrastructure类
   - 更新InfrastructureManager

2. **基础服务适配**
   - 创建SqliteConnectionManager
   - 创建SqliteProjectManager
   - 更新DI容器配置

### 中优先级（第二周）
3. **高级功能实现**
   - 完善SqliteDatabaseService
   - 实现数据迁移工具
   - 添加性能监控

### 低优先级（第三周）
4. **优化和测试**
   - 性能优化
   - 集成测试
   - 文档完善

## 📋 测试策略

### 单元测试覆盖
- SqliteInfrastructure 功能测试
- SqliteConnectionManager 连接测试
- SqliteProjectManager 数据操作测试
- 集成测试验证

### 集成测试场景
- 基础设施管理器集成
- 数据迁移流程
- 性能基准测试
- 错误处理测试

这个实现设计确保了SQLite数据库能够无缝集成到现有的基础设施体系中，提供与其他数据库类型一致的接口和功能。