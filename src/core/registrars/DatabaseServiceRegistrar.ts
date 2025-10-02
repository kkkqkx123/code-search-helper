import { Container } from 'inversify';
import { TYPES } from '../../types';
import { TransactionManager } from '../../database/core/TransactionManager';
import { ProjectIdManager } from '../../database/ProjectIdManager';

// Qdrant 向量数据库服务
import { QdrantService } from '../../database/qdrant/QdrantService';
import { QdrantConnectionManager } from '../../database/qdrant/QdrantConnectionManager';
import { QdrantCollectionManager } from '../../database/qdrant/QdrantCollectionManager';
import { QdrantVectorOperations } from '../../database/qdrant/QdrantVectorOperations';
import { QdrantQueryUtils } from '../../database/qdrant/QdrantQueryUtils';
import { QdrantProjectManager } from '../../database/qdrant/QdrantProjectManager';

// 图数据库服务
import { GraphDatabaseService } from '../../database/graph/GraphDatabaseService';
import { GraphQueryBuilder, IGraphQueryBuilder } from '../../database/query/GraphQueryBuilder';

export class DatabaseServiceRegistrar {
  static register(container: Container): void {
    // 通用数据库服务
    container.bind<ProjectIdManager>(TYPES.ProjectIdManager).to(ProjectIdManager).inSingletonScope();
    container.bind<TransactionManager>(TYPES.TransactionManager).to(TransactionManager).inSingletonScope();

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
  }
}