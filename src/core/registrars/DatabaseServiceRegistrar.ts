import { Container } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';

import { TYPES } from '../../types';

// 项目管理服务
import { ProjectIdManager } from '../../database/ProjectIdManager';
import { ProjectLookupService } from '../../database/ProjectLookupService';

// Qdrant 向量数据库服务
import { QdrantService } from '../../database/qdrant/QdrantService';
import { QdrantConnectionManager } from '../../database/qdrant/QdrantConnectionManager';
import { QdrantCollectionManager } from '../../database/qdrant/QdrantCollectionManager';
import { QdrantVectorOperations } from '../../database/qdrant/QdrantVectorOperations';
import { QdrantQueryUtils } from '../../database/qdrant/QdrantQueryUtils';
import { QdrantProjectManager } from '../../database/qdrant/QdrantProjectManager';

// 数据库日志和监控服务
import { DatabaseLoggerService } from '../../database/common/DatabaseLoggerService';
import { EventToLogBridge } from '../../database/common/EventToLogBridge';
import { PerformanceMonitor } from '../../database/common/PerformanceMonitor';

// 图数据库服务
import { GraphDatabaseService } from '../../database/graph/GraphDatabaseService';
import { IGraphDatabaseService, INebulaClient } from '../../database/graph/interfaces';
import { GraphQueryBuilder, IGraphQueryBuilder } from '../../database/nebula/query/GraphQueryBuilder';
import { NebulaProjectManager } from '../../database/nebula/NebulaProjectManager';

// Nebula图数据库服务
import { NebulaConnectionManager } from '../../database/nebula/NebulaConnectionManager';
import { INebulaConnectionManager } from '../../database/nebula/NebulaConnectionManager';
import { NebulaSpaceManager } from '../../database/nebula/space/NebulaSpaceManager';
import { INebulaSpaceManager } from '../../database/nebula/space/NebulaSpaceManager';
import { NebulaQueryBuilder } from '../../database/nebula/query/NebulaQueryBuilder';
import { INebulaQueryBuilder } from '../../database/nebula/query/NebulaQueryBuilder';
import { NebulaGraphOperations } from '../../database/nebula/operation/NebulaGraphOperations';
import { INebulaGraphOperations } from '../../database/nebula/operation/NebulaGraphOperations';
import { NebulaDataService, INebulaDataService } from '../../database/nebula/data/NebulaDataService';
import { NebulaSpaceService, INebulaSpaceService } from '../../database/nebula/space/NebulaSpaceService';
import { NebulaQueryUtils } from '../../database/nebula/query/NebulaQueryUtils';
import { NebulaQueryService, INebulaQueryService } from '../../database/nebula/query/NebulaQueryService';
import { NebulaDataOperations, INebulaDataOperations } from '../../database/nebula/operation/NebulaDataOperations';
import { NebulaSchemaManager, INebulaSchemaManager } from '../../database/nebula/NebulaSchemaManager';
import { NebulaIndexManager, INebulaIndexManager } from '../../database/nebula/NebulaIndexManager';
import { SpaceNameUtils, ISpaceNameUtils } from '../../database/nebula/SpaceNameUtils';
import { NebulaDataBatchProcessor, INebulaDataBatchProcessor } from '../../database/nebula/batch/NebulaDataBatchProcessor';
import { NebulaFileDataService, INebulaFileDataService } from '../../database/nebula/file/NebulaFileDataService';

// Nebula客户端服务
import { NebulaClient } from '../../database/nebula/client/NebulaClient';

// Nebula 会话和连接管理服务
import { ConnectionPool, IConnectionPool } from '../../database/nebula/connection/ConnectionPool';
import { SessionManager, ISessionManager } from '../../database/nebula/session/SessionManager';
import { ExponentialBackoffRetryStrategy, IRetryStrategy } from '../../database/nebula/retry/RetryStrategy';
import { CircuitBreaker, ICircuitBreaker } from '../../database/nebula/circuit-breaker/CircuitBreaker';
import { QueryRunner, IQueryRunner } from '../../database/nebula/query/QueryRunner';
import { ConnectionWarmer } from '../../database/nebula/connection/ConnectionWarmer';
import { LoadBalancer } from '../../database/nebula/connection/LoadBalancer';
import { QueryPipeline } from '../../database/nebula/query/QueryPipeline';
import { ParallelQueryExecutor } from '../../database/nebula/query/ParallelQueryExecutor';
import { MemoryOptimizer } from '../../database/nebula/memory/MemoryOptimizer';

// SQLite数据库服务
import { SqliteDatabaseService } from '../../database/splite/SqliteDatabaseService';
import { SqliteConnectionManager } from '../../database/splite/SqliteConnectionManager';
import { SqliteProjectManager } from '../../database/splite/SqliteProjectManager';

// 图数据映射和验证服务
import { GraphDataMappingService } from '../../service/graph/mapping/GraphDataMappingService';
import { DataConsistencyChecker } from '../../database/common/DataConsistencyChecker';
import { IGraphService } from '../../service/graph/core/IGraphService';
import { DataMappingValidator } from '../../service/graph/mapping/DataMappingValidator';
import { GraphMappingCache } from '../../service/graph/caching/GraphMappingCache';

export class DatabaseServiceRegistrar {
  static register(container: Container): void {
    try {
      // 通用数据库服务
      container.bind<ProjectIdManager>(TYPES.ProjectIdManager).to(ProjectIdManager).inSingletonScope();
      container.bind<ProjectLookupService>(TYPES.ProjectLookupService).to(ProjectLookupService).inSingletonScope();

      // 数据库日志和监控服务
      container.bind<DatabaseLoggerService>(TYPES.DatabaseLoggerService).to(DatabaseLoggerService).inSingletonScope();
      container.bind<EventToLogBridge>(TYPES.EventToLogBridge).to(EventToLogBridge).inSingletonScope();
      // 数据库层的PerformanceMonitor，使用独立的符号避免与基础设施层冲突
      container.bind<PerformanceMonitor>(TYPES.DatabasePerformanceMonitor).to(PerformanceMonitor).inSingletonScope();

      // Qdrant 向量数据库服务
      container.bind<QdrantConnectionManager>(TYPES.IQdrantConnectionManager).to(QdrantConnectionManager).inSingletonScope();
      container.bind<QdrantCollectionManager>(TYPES.IQdrantCollectionManager).to(QdrantCollectionManager).inSingletonScope();
      container.bind<QdrantVectorOperations>(TYPES.IQdrantVectorOperations).to(QdrantVectorOperations).inSingletonScope();
      container.bind<QdrantQueryUtils>(TYPES.IQdrantQueryUtils).to(QdrantQueryUtils).inSingletonScope();
      container.bind<QdrantProjectManager>(TYPES.IQdrantProjectManager).to(QdrantProjectManager).inSingletonScope();
      container.bind<QdrantService>(TYPES.QdrantService).to(QdrantService).inSingletonScope();

      // 图数据库核心服务
      container.bind<IGraphDatabaseService>(TYPES.IGraphDatabaseService).to(GraphDatabaseService).inSingletonScope();
      container.bind<GraphDatabaseService>(TYPES.GraphDatabaseService).to(GraphDatabaseService).inSingletonScope();
      container.bind<GraphQueryBuilder>(TYPES.GraphQueryBuilder).to(GraphQueryBuilder).inSingletonScope();
      container.bind<IGraphQueryBuilder>(TYPES.IGraphQueryBuilder).to(GraphQueryBuilder).inSingletonScope();
      container.bind<NebulaProjectManager>(TYPES.INebulaProjectManager).to(NebulaProjectManager).inSingletonScope();

      // Nebula图数据库服务
      container.bind<NebulaConnectionManager>(TYPES.NebulaConnectionManager).to(NebulaConnectionManager).inSingletonScope();
      container.bind<INebulaConnectionManager>(TYPES.INebulaConnectionManager).to(NebulaConnectionManager).inSingletonScope();
      container.bind<INebulaSpaceManager>(TYPES.INebulaSpaceManager).to(NebulaSpaceManager).inSingletonScope();
      container.bind<NebulaQueryBuilder>(TYPES.NebulaQueryBuilder).to(NebulaQueryBuilder).inSingletonScope();
      container.bind<INebulaQueryBuilder>(TYPES.INebulaQueryBuilder).to(NebulaQueryBuilder).inSingletonScope();
      container.bind<NebulaGraphOperations>(TYPES.INebulaGraphOperations).to(NebulaGraphOperations).inSingletonScope();
      container.bind<NebulaDataService>(TYPES.NebulaDataService).to(NebulaDataService).inSingletonScope();
      container.bind<INebulaDataService>(TYPES.INebulaDataService).to(NebulaDataService).inSingletonScope();
      container.bind<NebulaSpaceService>(TYPES.NebulaSpaceService).to(NebulaSpaceService).inSingletonScope();
      container.bind<INebulaSpaceService>(TYPES.INebulaSpaceService).to(NebulaSpaceService).inSingletonScope();
      container.bind<NebulaQueryService>(TYPES.NebulaQueryService).to(NebulaQueryService).inSingletonScope();
      container.bind<INebulaQueryService>(TYPES.INebulaQueryService).to(NebulaQueryService).inSingletonScope();
      container.bind<NebulaDataOperations>(TYPES.NebulaDataOperations).to(NebulaDataOperations).inSingletonScope();
      container.bind<INebulaDataOperations>(TYPES.INebulaDataOperations).to(NebulaDataOperations).inSingletonScope();
      container.bind<NebulaSchemaManager>(TYPES.NebulaSchemaManager).to(NebulaSchemaManager).inSingletonScope();
      container.bind<INebulaSchemaManager>(TYPES.INebulaSchemaManager).to(NebulaSchemaManager).inSingletonScope();
      container.bind<NebulaIndexManager>(TYPES.NebulaIndexManager).to(NebulaIndexManager).inSingletonScope();
      container.bind<INebulaIndexManager>(TYPES.INebulaIndexManager).to(NebulaIndexManager).inSingletonScope();
      container.bind<SpaceNameUtils>(TYPES.SpaceNameUtils).to(SpaceNameUtils).inSingletonScope();
      container.bind<ISpaceNameUtils>(TYPES.ISpaceNameUtils).to(SpaceNameUtils).inSingletonScope();

      // Nebula 批量处理和文件数据服务
      container.bind<NebulaDataBatchProcessor>(TYPES.NebulaDataBatchProcessor).to(NebulaDataBatchProcessor).inSingletonScope();
      container.bind<INebulaDataBatchProcessor>(TYPES.INebulaDataBatchProcessor).to(NebulaDataBatchProcessor).inSingletonScope();
      container.bind<NebulaFileDataService>(TYPES.NebulaFileDataService).to(NebulaFileDataService).inSingletonScope();
      container.bind<INebulaFileDataService>(TYPES.INebulaFileDataService).to(NebulaFileDataService).inSingletonScope();

      // Nebula 会话和连接管理服务
      container.bind<ConnectionPool>(TYPES.IConnectionPool).to(ConnectionPool).inSingletonScope();
      container.bind<SessionManager>(TYPES.ISessionManager).to(SessionManager).inSingletonScope();
      container.bind<ExponentialBackoffRetryStrategy>(TYPES.IRetryStrategy).to(ExponentialBackoffRetryStrategy).inSingletonScope();
      container.bind<CircuitBreaker>(TYPES.ICircuitBreaker).to(CircuitBreaker).inSingletonScope();
      container.bind<QueryRunner>(TYPES.IQueryRunner).to(QueryRunner).inSingletonScope();
      container.bind<ConnectionWarmer>(TYPES.ConnectionWarmer).to(ConnectionWarmer).inSingletonScope();
      container.bind<LoadBalancer>(TYPES.LoadBalancer).to(LoadBalancer).inSingletonScope();
      container.bind<QueryPipeline>(TYPES.QueryPipeline).to(QueryPipeline).inSingletonScope();
      container.bind<ParallelQueryExecutor>(TYPES.ParallelQueryExecutor).to(ParallelQueryExecutor).inSingletonScope();
      container.bind<MemoryOptimizer>(TYPES.MemoryOptimizer).to(MemoryOptimizer).inSingletonScope();

      // NebulaClient 服务 - 底层客户端
      container.bind<INebulaClient>(TYPES.INebulaClient).to(NebulaClient).inSingletonScope();
      container.bind<NebulaClient>(TYPES.NebulaClient).to(NebulaClient).inSingletonScope();

      // 工具类服务
      container.bind<NebulaQueryUtils>(TYPES.NebulaQueryUtils).to(NebulaQueryUtils).inSingletonScope();

      // 图数据映射和验证服务
      container.bind<DataConsistencyChecker>(TYPES.DataConsistencyService).to(DataConsistencyChecker).inSingletonScope();

      // SQLite数据库服务
      container.bind<SqliteDatabaseService>(TYPES.SqliteDatabaseService).to(SqliteDatabaseService).inSingletonScope();
      container.bind<SqliteConnectionManager>(TYPES.SqliteConnectionManager).to(SqliteConnectionManager).inSingletonScope();
      container.bind<SqliteProjectManager>(TYPES.SqliteProjectManager).to(SqliteProjectManager).inSingletonScope();
      container.bind<GraphDataMappingService>(TYPES.GraphDataMappingService).to(GraphDataMappingService).inSingletonScope();
      container.bind<DataMappingValidator>(TYPES.DataMappingValidator).to(DataMappingValidator).inSingletonScope();
      // GraphMappingCache 已在 InfrastructureServiceRegistrar 中注册，不需要重复注册
    } catch (error: any) {
      console.error('Error registering database services:', error);
      console.error('Error stack:', error?.stack);
      throw error;
    }
  }
}