import { Container } from 'inversify';
import { TYPES } from '../../types';
import { TransactionManager } from '../../database/core/TransactionManager';

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
import { GraphQueryBuilder, IGraphQueryBuilder } from '../../database/nebula/query/GraphQueryBuilder';
import { NebulaProjectManager } from '../../database/nebula/NebulaProjectManager';

// Nebula图数据库服务
import { NebulaService } from '../../database/nebula/NebulaService';
import { INebulaService } from '../../database/nebula/NebulaService';
import { NebulaConnectionManager } from '../../database/nebula/NebulaConnectionManager';
import { INebulaConnectionManager } from '../../database/nebula/NebulaConnectionManager';
import { NebulaSpaceManager } from '../../database/nebula/space/NebulaSpaceManager';
import { INebulaSpaceManager } from '../../database/nebula/space/NebulaSpaceManager';
import { NebulaQueryBuilder } from '../../database/nebula/NebulaQueryBuilder';
import { INebulaQueryBuilder } from '../../database/nebula/NebulaQueryBuilder';
import { NebulaGraphOperations } from '../../database/nebula/NebulaGraphOperations';
import { INebulaGraphOperations } from '../../database/nebula/NebulaGraphOperations';
import { ConnectionStateManager } from '../../database/nebula/ConnectionStateManager';
// 新增的Nebula服务
import { NebulaDataService, INebulaDataService } from '../../database/nebula/data/NebulaDataService';
import { NebulaSpaceService, INebulaSpaceService } from '../../database/nebula/space/NebulaSpaceService';
import { NebulaQueryUtils } from '../../database/nebula/NebulaQueryUtils';
import { NebulaResultFormatter } from '../../database/nebula/NebulaResultFormatter';
import { NebulaEventManager } from '../../database/nebula/NebulaEventManager';

// 图数据映射和验证服务
import { GraphDataMappingService } from '../../service/mapping/GraphDataMappingService';
import { AsyncTaskQueue } from '../../service/async/AsyncTaskQueue';
import { DataMappingValidator } from '../../service/validation/DataMappingValidator';
import { GraphMappingCache } from '../../service/caching/GraphMappingCache';

export class DatabaseServiceRegistrar {
  static register(container: Container): void {
    // 通用数据库服务
    container.bind<ProjectIdManager>(TYPES.ProjectIdManager).to(ProjectIdManager).inSingletonScope();
    container.bind<ProjectLookupService>(TYPES.ProjectLookupService).to(ProjectLookupService).inSingletonScope();
    container.bind<TransactionManager>(TYPES.TransactionManager).to(TransactionManager).inSingletonScope();

    // 数据库日志和监控服务
    container.bind<DatabaseLoggerService>(TYPES.DatabaseLoggerService).to(DatabaseLoggerService).inSingletonScope();
    container.bind<EventToLogBridge>(TYPES.EventToLogBridge).to(EventToLogBridge).inSingletonScope();
    container.bind<PerformanceMonitor>(TYPES.PerformanceMonitor).to(PerformanceMonitor).inSingletonScope();

    // Qdrant 向量数据库服务
    container.bind<QdrantConnectionManager>(TYPES.IQdrantConnectionManager).to(QdrantConnectionManager).inSingletonScope();
    container.bind<QdrantCollectionManager>(TYPES.IQdrantCollectionManager).to(QdrantCollectionManager).inSingletonScope();
    container.bind<QdrantVectorOperations>(TYPES.IQdrantVectorOperations).to(QdrantVectorOperations).inSingletonScope();
    container.bind<QdrantQueryUtils>(TYPES.IQdrantQueryUtils).to(QdrantQueryUtils).inSingletonScope();
    container.bind<QdrantProjectManager>(TYPES.IQdrantProjectManager).to(QdrantProjectManager).inSingletonScope();
    container.bind<QdrantService>(TYPES.QdrantService).to(QdrantService).inSingletonScope();

    // 图数据库核心服务
    container.bind<GraphDatabaseService>(TYPES.GraphDatabaseService).to(GraphDatabaseService).inSingletonScope();
    container.bind<GraphQueryBuilder>(TYPES.GraphQueryBuilder).to(GraphQueryBuilder).inSingletonScope();
    container.bind<IGraphQueryBuilder>(TYPES.IGraphQueryBuilder).to(GraphQueryBuilder).inSingletonScope();
    container.bind<NebulaProjectManager>(TYPES.INebulaProjectManager).to(NebulaProjectManager).inSingletonScope();

    // Nebula图数据库服务
    container.bind<NebulaService>(TYPES.NebulaService).to(NebulaService).inSingletonScope();
    container.bind<INebulaService>(TYPES.INebulaService).to(NebulaService).inSingletonScope();
    container.bind<NebulaConnectionManager>(TYPES.NebulaConnectionManager).to(NebulaConnectionManager).inSingletonScope();
    container.bind<INebulaConnectionManager>(TYPES.INebulaConnectionManager).to(NebulaConnectionManager).inSingletonScope();
    container.bind<NebulaSpaceManager>(TYPES.INebulaSpaceManager).to(NebulaSpaceManager).inSingletonScope();
    container.bind<NebulaQueryBuilder>(TYPES.NebulaQueryBuilder).to(NebulaQueryBuilder).inSingletonScope();
    container.bind<INebulaQueryBuilder>(TYPES.INebulaQueryBuilder).to(NebulaQueryBuilder).inSingletonScope();
    container.bind<NebulaGraphOperations>(TYPES.INebulaGraphOperations).to(NebulaGraphOperations).inSingletonScope();
    container.bind<ConnectionStateManager>(TYPES.ConnectionStateManager).to(ConnectionStateManager).inSingletonScope();
    container.bind<NebulaDataService>(TYPES.NebulaDataService).to(NebulaDataService).inSingletonScope();
    container.bind<INebulaDataService>(TYPES.INebulaDataService).to(NebulaDataService).inSingletonScope();
    container.bind<NebulaSpaceService>(TYPES.NebulaSpaceService).to(NebulaSpaceService).inSingletonScope();
    container.bind<INebulaSpaceService>(TYPES.INebulaSpaceService).to(NebulaSpaceService).inSingletonScope();

    // 工具类服务
    container.bind<NebulaQueryUtils>(TYPES.NebulaQueryUtils).to(NebulaQueryUtils).inSingletonScope();
    container.bind<NebulaResultFormatter>(TYPES.NebulaResultFormatter).to(NebulaResultFormatter).inSingletonScope();
    container.bind<NebulaEventManager>(TYPES.NebulaEventManager).to(NebulaEventManager).inSingletonScope();

    // 图数据映射和验证服务
    container.bind<GraphDataMappingService>(TYPES.GraphDataMappingService).to(GraphDataMappingService).inSingletonScope();
    container.bind<AsyncTaskQueue>(TYPES.AsyncTaskQueue).to(AsyncTaskQueue).inSingletonScope();
    container.bind<DataMappingValidator>(TYPES.DataMappingValidator).to(DataMappingValidator).inSingletonScope();
    // GraphMappingCache 已在 InfrastructureServiceRegistrar 中注册，不需要重复注册
  }
}