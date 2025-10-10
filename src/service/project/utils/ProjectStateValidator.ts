
import { ProjectState, StorageStatus } from '../ProjectStateManager';
import { ProjectStateStorageUtils } from './ProjectStateStorageUtils';

/**
 * 项目状态验证工具类
 * 职责：状态验证、数据规范化、类型检查
 */
export class ProjectStateValidator {
  /**
   * 初始化存储状态
   */
  static initializeStorageStatus(): StorageStatus {
    return {
      status: 'pending',
      progress: 0,
      lastUpdated: new Date(),
    };
  }

  /**
   * 规范化存储状态
   */
  static normalizeStorageStatus(rawStatus: any): StorageStatus {
    if (!rawStatus) {
      return ProjectStateValidator.initializeStorageStatus();
    }

    return {
      status: ['pending', 'indexing', 'completed', 'error', 'partial'].includes(rawStatus.status)
        ? rawStatus.status
        : 'pending',
      progress: typeof rawStatus.progress === 'number' && rawStatus.progress >= 0 && rawStatus.progress <= 100
        ? rawStatus.progress
        : 0,
      totalFiles: typeof rawStatus.totalFiles === 'number' ? rawStatus.totalFiles : undefined,
      processedFiles: typeof rawStatus.processedFiles === 'number' ? rawStatus.processedFiles : undefined,
      failedFiles: typeof rawStatus.failedFiles === 'number' ? rawStatus.failedFiles : undefined,
      lastUpdated: rawStatus.lastUpdated ? ProjectStateStorageUtils.parseDate(rawStatus.lastUpdated) : new Date(),
      lastCompleted: rawStatus.lastCompleted ? ProjectStateStorageUtils.parseDate(rawStatus.lastCompleted) : undefined,
      error: typeof rawStatus.error === 'string' ? rawStatus.error : undefined,
    };
  }

  /**
   * 验证和规范化项目状态数据
   */
  static validateAndNormalizeProjectState(rawState: any): ProjectState {
    // 验证必需字段
    if (!rawState.projectId || typeof rawState.projectId !== 'string') {
      throw new Error('Invalid or missing projectId');
    }

    if (!rawState.projectPath || typeof rawState.projectPath !== 'string') {
      throw new Error('Invalid or missing projectPath');
    }

    // 验证 projectPath 是非空字符串且不是仅包含空格
    if (rawState.projectPath.trim().length === 0) {
      throw new Error('projectPath cannot be empty or contain only whitespace');
    }

    if (!rawState.name || typeof rawState.name !== 'string') {
      throw new Error('Invalid or missing name');
    }

    if (!rawState.status || !['active', 'inactive', 'indexing', 'error'].includes(rawState.status)) {
      throw new Error('Invalid or missing status');
    }

    if (!rawState.createdAt || !rawState.updatedAt) {
      throw new Error('Missing timestamp fields');
    }

    // 验证settings对象
    if (!rawState.settings || typeof rawState.settings !== 'object') {
      throw new Error('Invalid or missing settings');
    }

    // 构建规范化的项目状态
    const normalizedState: ProjectState = {
      projectId: rawState.projectId,
      projectPath: rawState.projectPath,
      name: rawState.name,
      description: rawState.description || undefined,
      status: rawState.status,
      vectorStatus: rawState.vectorStatus ? ProjectStateValidator.normalizeStorageStatus(rawState.vectorStatus) : ProjectStateValidator.initializeStorageStatus(),
      graphStatus: rawState.graphStatus ? ProjectStateValidator.normalizeStorageStatus(rawState.graphStatus) : ProjectStateValidator.initializeStorageStatus(),
      createdAt: ProjectStateStorageUtils.parseDate(rawState.createdAt),
      updatedAt: ProjectStateStorageUtils.parseDate(rawState.updatedAt),
      lastIndexedAt: rawState.lastIndexedAt ? ProjectStateStorageUtils.parseDate(rawState.lastIndexedAt) : undefined,
      indexingProgress: typeof rawState.indexingProgress === 'number' ? rawState.indexingProgress : undefined,
      totalFiles: typeof rawState.totalFiles === 'number' ? rawState.totalFiles : undefined,
      indexedFiles: typeof rawState.indexedFiles === 'number' ? rawState.indexedFiles : undefined,
      failedFiles: typeof rawState.failedFiles === 'number' ? rawState.failedFiles : undefined,
      collectionInfo: rawState.collectionInfo ? {
        name: rawState.collectionInfo.name,
        vectorsCount: typeof rawState.collectionInfo.vectorsCount === 'number' ? rawState.collectionInfo.vectorsCount : 0,
        status: rawState.collectionInfo.status || 'unknown'
      } : undefined,

      settings: {
        autoIndex: typeof rawState.settings.autoIndex === 'boolean' ? rawState.settings.autoIndex : true,
        watchChanges: typeof rawState.settings.watchChanges === 'boolean' ? rawState.settings.watchChanges : true,
        includePatterns: Array.isArray(rawState.settings.includePatterns) ? rawState.settings.includePatterns : undefined,
        excludePatterns: Array.isArray(rawState.settings.excludePatterns) ? rawState.settings.excludePatterns : undefined,
        chunkSize: typeof rawState.settings.chunkSize === 'number' ? rawState.settings.chunkSize : undefined,
        chunkOverlap: typeof rawState.settings.chunkOverlap === 'number' ? rawState.settings.chunkOverlap : undefined,
      },
      metadata: rawState.metadata && typeof rawState.metadata === 'object' ? rawState.metadata : {}
    };

    return normalizedState;
  }

  /**
   * 检查项目状态是否有效
   */
  static async isProjectStateValid(state: ProjectState): Promise<boolean> {
    try {
      // 检查项目路径是否存在
      const fs = await import('fs/promises');
      await fs.access(state.projectPath);
      return true;
    } catch (error) {
      // 路径不存在，状态无效
      return false;
    }
  }
}