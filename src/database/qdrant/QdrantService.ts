import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { TYPES } from '../../types';
import { ProjectIdManager } from '../ProjectIdManager';
import { IVectorStore, VectorPoint, CollectionInfo, SearchOptions, SearchResult } from '../IVectorStore';
import { IQdrantConnectionManager } from './QdrantConnectionManager';
import { IQdrantCollectionManager } from './QdrantCollectionManager';
import { IQdrantVectorOperations } from './QdrantVectorOperations';
import { IQdrantQueryUtils } from './QdrantQueryUtils';
import { IQdrantProjectManager } from './QdrantProjectManager';
import {
  QdrantConfig,
  VectorDistance,
  CollectionCreateOptions,
  VectorUpsertOptions,
  VectorSearchOptions,
  QueryFilter,
  BatchResult,
  ProjectInfo,
  QdrantEventType,
  QdrantEvent
} from './QdrantTypes';

/**
 * Qdrant 服务类
 * 
 * 作为外观模式，协调各个模块，提供统一的API接口
 * 保持向后兼容性，内部实现委托给各个专门的模块
 */
@injectable()
export class QdrantService implements IVectorStore {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private projectIdManager: ProjectIdManager;
  private connectionManager: IQdrantConnectionManager;
  private collectionManager: IQdrantCollectionManager;
  private vectorOperations: IQdrantVectorOperations;
  private queryUtils: IQdrantQueryUtils;
  private projectManager: IQdrantProjectManager;

  constructor(
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ProjectIdManager) projectIdManager: ProjectIdManager,
    @inject(TYPES.IQdrantConnectionManager) connectionManager: IQdrantConnectionManager,
    @inject(TYPES.IQdrantCollectionManager) collectionManager: IQdrantCollectionManager,
    @inject(TYPES.IQdrantVectorOperations) vectorOperations: IQdrantVectorOperations,
    @inject(TYPES.IQdrantQueryUtils) queryUtils: IQdrantQueryUtils,
    @inject(TYPES.IQdrantProjectManager) projectManager: IQdrantProjectManager
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.projectIdManager = projectIdManager;
    this.connectionManager = connectionManager;
    this.collectionManager = collectionManager;
    this.vectorOperations = vectorOperations;
    this.queryUtils = queryUtils;
    this.projectManager = projectManager;
  }

  /**
   * 初始化 Qdrant 服务
   */
  async initialize(): Promise<boolean> {
    return this.connectionManager.initialize();
  }

  /**
   * 创建集合
   */
  async createCollection(
    name: string,
    vectorSize: number,
    distance: VectorDistance = 'Cosine',
    recreateIfExists: boolean = false
  ): Promise<boolean> {
    return this.collectionManager.createCollection(name, vectorSize, distance, recreateIfExists);
  }

  /**
   * 使用选项创建集合
   */
  async createCollectionWithOptions(name: string, options: CollectionCreateOptions): Promise<boolean> {
    return this.collectionManager.createCollectionWithOptions(name, options);
  }

  /**
   * 检查集合是否存在
   */
  async collectionExists(name: string): Promise<boolean> {
    return this.collectionManager.collectionExists(name);
  }

  /**
   * 删除集合
   */
  async deleteCollection(name: string): Promise<boolean> {
    return this.collectionManager.deleteCollection(name);
  }

  /**
   * 获取集合信息
   */
  async getCollectionInfo(collectionName: string): Promise<CollectionInfo | null> {
    return this.collectionManager.getCollectionInfo(collectionName);
  }

  /**
   * 获取集合统计信息
   */
  async getCollectionStats(collectionName: string): Promise<any> {
    return this.collectionManager.getCollectionStats(collectionName);
  }

  /**
   * 创建有效载荷索引
   */
  async createPayloadIndex(collectionName: string, field: string, fieldType?: string): Promise<boolean> {
    return this.collectionManager.createPayloadIndex(collectionName, field, fieldType);
  }

  /**
   * 批量创建有效载荷索引
   */
  async createPayloadIndexes(collectionName: string, fields: string[]): Promise<boolean> {
    return this.collectionManager.createPayloadIndexes(collectionName, fields);
  }

  /**
   * 列出所有集合
   */
  async listCollections(): Promise<string[]> {
    return this.collectionManager.listCollections();
  }

  /**
   * 插入或更新向量
   */
  async upsertVectors(collectionName: string, vectors: VectorPoint[]): Promise<boolean> {
    return this.vectorOperations.upsertVectors(collectionName, vectors);
  }

  /**
   * 使用选项插入或更新向量
   */
  async upsertVectorsWithOptions(collectionName: string, vectors: VectorPoint[], options?: VectorUpsertOptions): Promise<BatchResult> {
    return this.vectorOperations.upsertVectorsWithOptions(collectionName, vectors, options);
  }

  /**
   * 搜索向量
   */
  async searchVectors(
    collectionName: string,
    query: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    return this.vectorOperations.searchVectors(collectionName, query, options);
  }

  /**
   * 使用选项搜索向量
   */
  async searchVectorsWithOptions(collectionName: string, query: number[], options?: VectorSearchOptions): Promise<SearchResult[]> {
    return this.vectorOperations.searchVectorsWithOptions(collectionName, query, options);
  }

  /**
   * 删除点
   */
  async deletePoints(collectionName: string, pointIds: string[]): Promise<boolean> {
    return this.vectorOperations.deletePoints(collectionName, pointIds);
  }

  /**
   * 清空集合
   */
  async clearCollection(collectionName: string): Promise<boolean> {
    return this.vectorOperations.clearCollection(collectionName);
  }

  /**
   * 获取点数量
   */
  async getPointCount(collectionName: string): Promise<number> {
    return this.vectorOperations.getPointCount(collectionName);
  }

  /**
   * 根据文件路径获取块ID
   */
  async getChunkIdsByFiles(collectionName: string, filePaths: string[]): Promise<string[]> {
    return this.queryUtils.getChunkIdsByFiles(collectionName, filePaths);
  }

  /**
   * 获取已存在的块ID
   */
  async getExistingChunkIds(collectionName: string, chunkIds: string[]): Promise<string[]> {
    return this.queryUtils.getExistingChunkIds(collectionName, chunkIds);
  }

  /**
   * 滚动浏览点
   */
  async scrollPoints(collectionName: string, filter?: any, limit?: number, offset?: any): Promise<any[]> {
    return this.queryUtils.scrollPoints(collectionName, filter, limit, offset);
  }

  /**
   * 计算点数量
   */
  async countPoints(collectionName: string, filter?: any): Promise<number> {
    return this.queryUtils.countPoints(collectionName, filter);
  }

  /**
   * 构建查询过滤器
   */
  buildFilter(filter: SearchOptions['filter']): any {
    return this.queryUtils.buildFilter(filter);
  }

  /**
   * 构建高级查询过滤器
   */
  buildAdvancedFilter(filter: QueryFilter): any {
    return this.queryUtils.buildAdvancedFilter(filter);
  }

  /**
   * 为特定项目创建集合
   */
  async createCollectionForProject(projectPath: string, vectorSize: number, distance?: VectorDistance): Promise<boolean> {
    return this.projectManager.createCollectionForProject(projectPath, vectorSize, distance);
  }

  /**
   * 为特定项目插入或更新向量
   */
  async upsertVectorsForProject(projectPath: string, vectors: VectorPoint[]): Promise<boolean> {
    return this.projectManager.upsertVectorsForProject(projectPath, vectors);
  }

  /**
   * 在特定项目的集合中搜索向量
   */
  async searchVectorsForProject(projectPath: string, query: number[], options?: SearchOptions): Promise<SearchResult[]> {
    return this.projectManager.searchVectorsForProject(projectPath, query, options);
  }

  /**
   * 获取特定项目的集合信息
   */
  async getCollectionInfoForProject(projectPath: string): Promise<CollectionInfo | null> {
    return this.projectManager.getCollectionInfoForProject(projectPath);
  }

  /**
   * 删除特定项目的集合
   */
  async deleteCollectionForProject(projectPath: string): Promise<boolean> {
    return this.projectManager.deleteCollectionForProject(projectPath);
  }

  /**
   * 获取项目信息
   */
  async getProjectInfo(projectPath: string): Promise<ProjectInfo | null> {
    return this.projectManager.getProjectInfo(projectPath);
  }

  /**
   * 列出所有项目
   */
  async listProjects(): Promise<ProjectInfo[]> {
    return this.projectManager.listProjects();
  }

  /**
   * 根据项目ID获取项目路径
   */
  getProjectPath(projectId: string): string | undefined {
    return this.projectIdManager.getProjectPath(projectId);
  }

  /**
   * 删除项目中的特定向量
   */
  async deleteVectorsForProject(projectPath: string, vectorIds: string[]): Promise<boolean> {
    return this.projectManager.deleteVectorsForProject(projectPath, vectorIds);
  }

  /**
   * 清空项目
   */
  async clearProject(projectPath: string): Promise<boolean> {
    return this.projectManager.clearProject(projectPath);
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connectionManager.isConnected();
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(): any {
    return this.connectionManager.getConnectionStatus();
  }

  /**
   * 获取配置信息
   */
  getConfig(): QdrantConfig {
    return this.connectionManager.getConfig();
  }

  /**
   * 更新配置信息
   */
  updateConfig(config: Partial<QdrantConfig>): void {
    this.connectionManager.updateConfig(config);
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    return this.connectionManager.close();
  }

  /**
   * 添加事件监听器
   */
  addEventListener(type: QdrantEventType, listener: (event: QdrantEvent) => void): void {
    // 将事件监听器添加到所有模块
    this.connectionManager.addEventListener(type, listener);
    this.collectionManager.addEventListener(type, listener);
    this.vectorOperations.addEventListener(type, listener);
    this.queryUtils.addEventListener(type, listener);
    this.projectManager.addEventListener(type, listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(type: QdrantEventType, listener: (event: QdrantEvent) => void): void {
    // 从所有模块中移除事件监听器
    this.connectionManager.removeEventListener(type, listener);
    this.collectionManager.removeEventListener(type, listener);
    this.vectorOperations.removeEventListener(type, listener);
    this.queryUtils.removeEventListener(type, listener);
    this.projectManager.removeEventListener(type, listener);
  }
}