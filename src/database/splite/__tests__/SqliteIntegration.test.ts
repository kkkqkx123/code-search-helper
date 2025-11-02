import { Container } from 'inversify';
import { TYPES } from '../../../types';
import { SqliteDatabaseService } from '../SqliteDatabaseService';
import { SqliteConnectionManager } from '../SqliteConnectionManager';
import { SqliteProjectManager } from '../SqliteProjectManager';
import { SqliteInfrastructure } from '../SqliteInfrastructure';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { IndexingConfigService } from '../../../config/service/IndexingConfigService';
import { EnvironmentConfigService } from '../../../config/service/EnvironmentConfigService';
import { QdrantConfigService } from '../../../config/service/QdrantConfigService';
import { EmbeddingConfigService } from '../../../config/service/EmbeddingConfigService';
import { LoggingConfigService } from '../../../config/service/LoggingConfigService';
import { MonitoringConfigService } from '../../../config/service/MonitoringConfigService';
import { MemoryMonitorConfigService } from '../../../config/service/MemoryMonitorConfigService';
import { FileProcessingConfigService } from '../../../config/service/FileProcessingConfigService';
import { BatchProcessingConfigService } from '../../../config/service/BatchProcessingConfigService';
import { ProjectConfigService } from '../../../config/service/ProjectConfigService';
import { TreeSitterConfigService } from '../../../config/service/TreeSitterConfigService';
import { ProjectNamingConfigService } from '../../../config/service/ProjectNamingConfigService';
import { EmbeddingBatchConfigService } from '../../../config/service/EmbeddingBatchConfigService';
import { GraphCacheConfigService } from '../../../config/service/GraphCacheConfigService';
import { InfrastructureManager } from '../../../infrastructure/InfrastructureManager';
import { CacheService } from '../../../infrastructure/caching/CacheService';
import { PerformanceMonitor } from '../../../infrastructure/monitoring/PerformanceMonitor';
import { BatchOptimizer } from '../../../service/optimization/BatchOptimizerService';
import { DatabaseHealthChecker } from '../../../service/monitoring/DatabaseHealthChecker';

describe('SQLite Integration Tests', () => {
  let container: Container;
  let sqliteService: SqliteDatabaseService;
  let connectionManager: SqliteConnectionManager;
  let projectManager: SqliteProjectManager;
  let infrastructure: SqliteInfrastructure;

  beforeAll(async () => {
    // 设置DI容器
    container = new Container();

    // 注册基础服务
    container.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
    container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
    container.bind<ConfigService>(TYPES.ConfigService).to(ConfigService).inSingletonScope();
    container.bind<EnvironmentConfigService>(TYPES.EnvironmentConfigService).to(EnvironmentConfigService).inSingletonScope();
    container.bind<QdrantConfigService>(TYPES.QdrantConfigService).to(QdrantConfigService).inSingletonScope();
    container.bind<EmbeddingConfigService>(TYPES.EmbeddingConfigService).to(EmbeddingConfigService).inSingletonScope();
    container.bind<LoggingConfigService>(TYPES.LoggingConfigService).to(LoggingConfigService).inSingletonScope();
    container.bind<MonitoringConfigService>(TYPES.MonitoringConfigService).to(MonitoringConfigService).inSingletonScope();
    container.bind<MemoryMonitorConfigService>(TYPES.MemoryMonitorConfigService).to(MemoryMonitorConfigService).inSingletonScope();
    container.bind<FileProcessingConfigService>(TYPES.FileProcessingConfigService).to(FileProcessingConfigService).inSingletonScope();
    container.bind<BatchProcessingConfigService>(TYPES.BatchProcessingConfigService).to(BatchProcessingConfigService).inSingletonScope();
    container.bind<ProjectConfigService>(TYPES.ProjectConfigService).to(ProjectConfigService).inSingletonScope();
    container.bind<IndexingConfigService>(TYPES.IndexingConfigService).to(IndexingConfigService).inSingletonScope();
    container.bind<TreeSitterConfigService>(TYPES.TreeSitterConfigService).to(TreeSitterConfigService).inSingletonScope();
    container.bind<ProjectNamingConfigService>(TYPES.ProjectNamingConfigService).to(ProjectNamingConfigService).inSingletonScope();
    container.bind<EmbeddingBatchConfigService>(TYPES.EmbeddingBatchConfigService).to(EmbeddingBatchConfigService).inSingletonScope();
    container.bind<GraphCacheConfigService>(TYPES.GraphCacheConfigService).to(GraphCacheConfigService).inSingletonScope();
    container.bind<InfrastructureManager>(TYPES.InfrastructureManager).to(InfrastructureManager).inSingletonScope();
    container.bind<CacheService>(TYPES.CacheService).to(CacheService).inSingletonScope();
    container.bind<PerformanceMonitor>(TYPES.PerformanceMonitor).to(PerformanceMonitor).inSingletonScope();
    container.bind<BatchOptimizer>(TYPES.BatchOptimizer).to(BatchOptimizer).inSingletonScope();
    container.bind<DatabaseHealthChecker>(TYPES.HealthChecker).to(DatabaseHealthChecker).inSingletonScope();

    // 注册SQLite服务
    container.bind<SqliteDatabaseService>(TYPES.SqliteDatabaseService).to(SqliteDatabaseService).inSingletonScope();
    container.bind<SqliteConnectionManager>(TYPES.SqliteConnectionManager).to(SqliteConnectionManager).inSingletonScope();
    container.bind<SqliteProjectManager>(TYPES.SqliteProjectManager).to(SqliteProjectManager).inSingletonScope();
    container.bind<SqliteInfrastructure>(TYPES.SqliteInfrastructure).to(SqliteInfrastructure).inSingletonScope();

    // 解析服务
    sqliteService = container.get<SqliteDatabaseService>(TYPES.SqliteDatabaseService);
    connectionManager = container.get<SqliteConnectionManager>(TYPES.SqliteConnectionManager);
    projectManager = container.get<SqliteProjectManager>(TYPES.SqliteProjectManager);
    infrastructure = container.get<SqliteInfrastructure>(TYPES.SqliteInfrastructure);

    // 初始化基础设施
    await infrastructure.initialize();
  });

  afterAll(async () => {
    // 清理资源
    if (infrastructure) {
      await infrastructure.shutdown();
    }
  });

  describe('SqliteDatabaseService', () => {
    test('should initialize and connect to database', async () => {
      expect(sqliteService.isConnected()).toBe(true);
    });

    test('should create tables on initialization', () => {
      const db = sqliteService.getDatabase();
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
      expect(tables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'projects' }),
          expect.objectContaining({ name: 'file_index_states' }),
          expect.objectContaining({ name: 'project_status' }),
          expect.objectContaining({ name: 'file_change_history' })
        ])
      );
    });

    test('should get database statistics', () => {
      const stats = sqliteService.getStats();
      expect(stats).toHaveProperty('projects');
      expect(stats).toHaveProperty('fileStates');
      expect(stats).toHaveProperty('projectStatus');
      expect(stats).toHaveProperty('changeHistory');
      expect(stats).toHaveProperty('databaseSize');
    });
  });

  describe('SqliteConnectionManager', () => {
    test('should connect and disconnect', async () => {
      expect(connectionManager.isConnected()).toBe(true);

      await connectionManager.disconnect();
      expect(connectionManager.isConnected()).toBe(false);

      await connectionManager.connect();
      expect(connectionManager.isConnected()).toBe(true);
    });

    test('should get connection status', () => {
      const status = connectionManager.getConnectionStatus();
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('databasePath');
      expect(status).toHaveProperty('stats');
    });
  });

  describe('SqliteProjectManager', () => {
    const testProjectPath = '/test/project/path';

    test('should create project space', async () => {
      const result = await projectManager.createProjectSpace(testProjectPath, {
        name: 'Test Project',
        description: 'A test project for SQLite integration'
      });
      expect(result).toBe(true);
    });

    test('should get project space info', async () => {
      const info = await projectManager.getProjectSpaceInfo(testProjectPath);
      expect(info).not.toBeNull();
      expect(info.project).toHaveProperty('id');
      expect(info.project).toHaveProperty('path', testProjectPath);
      expect(info.project).toHaveProperty('name', 'Test Project');
      expect(info).toHaveProperty('status');
      expect(info).toHaveProperty('fileStats');
    });

    test('should list project spaces', async () => {
      const projects = await projectManager.listProjectSpaces();
      expect(Array.isArray(projects)).toBe(true);
      expect(projects.length).toBeGreaterThan(0);

      const testProject = projects.find(p => p.path === testProjectPath);
      expect(testProject).toBeDefined();
      expect(testProject.name).toBe('Test Project');
    });

    test('should update project status', async () => {
      const project = await projectManager.getProjectSpaceInfo(testProjectPath);
      const status = {
        project_id: project.project.id,
        vector_status: { indexed: true },
        graph_status: { indexed: false },
        indexing_progress: 0.5,
        total_files: 10,
        indexed_files: 5,
        failed_files: 0,
        last_updated: new Date()
      };

      const result = await projectManager.updateProjectStatus(project.project.id, status);
      expect(result).toBe(true);
    });

    test('should clear project space', async () => {
      const result = await projectManager.clearProjectSpace(testProjectPath);
      expect(result).toBe(true);
    });

    test('should delete project space', async () => {
      const result = await projectManager.deleteProjectSpace(testProjectPath);
      expect(result).toBe(true);
    });
  });

  describe('SqliteInfrastructure', () => {
    test('should be properly initialized', () => {
      expect(infrastructure.isInitialized()).toBe(true);
    });

    test('should provide infrastructure services', () => {
      expect(infrastructure.getCacheService()).toBeDefined();
      expect(infrastructure.getPerformanceMonitor()).toBeDefined();
      expect(infrastructure.getBatchOptimizer()).toBeDefined();
      expect(infrastructure.getHealthChecker()).toBeDefined();
      expect(infrastructure.getConnectionManager()).toBeDefined();
    });

    test('should execute SQL queries', async () => {
      const result = await infrastructure.executeSqlQuery('SELECT COUNT(*) as count FROM projects');
      expect(result).toBeDefined();
    });

    test('should get database stats', async () => {
      const stats = await infrastructure.getDatabaseStats();
      expect(stats).toHaveProperty('projects');
      expect(stats).toHaveProperty('fileStates');
      expect(stats).toHaveProperty('projectStatus');
      expect(stats).toHaveProperty('changeHistory');
      expect(stats).toHaveProperty('databaseSize');
    });
  });
});