
import { LoggerService } from '../../../utils/LoggerService';
import { ProjectState, StorageStatus } from '../ProjectStateManager';

/**
 * 项目状态监听器管理器
 * 职责：事件监听、回调处理、错误恢复
 */
export class ProjectStateListenerManager {
  private projectStates: Map<string, ProjectState>;
  private updateProjectStatus: (projectId: string, status: ProjectState['status']) => Promise<void>;
  private updateProjectIndexingProgress: (projectId: string, progress: number) => Promise<void>;
  private updateProjectLastIndexed: (projectId: string) => Promise<void>;
  private updateProjectMetadata: (projectId: string, metadata: Record<string, any>) => Promise<void>;
  private updateVectorStatus: (projectId: string, status: Partial<StorageStatus>) => Promise<void>;
  private updateGraphStatus: (projectId: string, status: Partial<StorageStatus>) => Promise<void>;

  constructor(
    private logger: LoggerService,
    projectStates: Map<string, ProjectState>,
    updateProjectStatus: (projectId: string, status: ProjectState['status']) => Promise<void>,
    updateProjectIndexingProgress: (projectId: string, progress: number) => Promise<void>,
    updateProjectLastIndexed: (projectId: string) => Promise<void>,
    updateProjectMetadata: (projectId: string, metadata: Record<string, any>) => Promise<void>,
    updateVectorStatus: (projectId: string, status: Partial<StorageStatus>) => Promise<void>,
    updateGraphStatus: (projectId: string, status: Partial<StorageStatus>) => Promise<void>
  ) {
    this.projectStates = projectStates;
    this.updateProjectStatus = updateProjectStatus;
    this.updateProjectIndexingProgress = updateProjectIndexingProgress;
    this.updateProjectLastIndexed = updateProjectLastIndexed;
    this.updateProjectMetadata = updateProjectMetadata;
    this.updateVectorStatus = updateVectorStatus;
    this.updateGraphStatus = updateGraphStatus;
  }

  /**
   * 设置索引同步服务监听器
   */
  setupIndexSyncListeners(): void {
    // 注意：事件监听功能已移除，因为IndexService已被弃用
    // 现在通过ProjectStateManager直接管理状态更新
  }

  /**
   * 处理索引开始事件
   */
  private async handleIndexingStarted(projectId: string): Promise<void> {
    try {
      await this.updateProjectStatus(projectId, 'indexing');
      // 同时更新向量和图的状态为索引中
      await this.updateVectorStatus(projectId, {
        status: 'indexing',
        progress: 0
      });
      await this.updateGraphStatus(projectId, {
        status: 'indexing',
        progress: 0
      });
    } catch (error) {
      this.logger.error('Failed to update project status to indexing', { projectId, error });
    }
  }

  /**
   * 处理索引进度事件
   */
  private async handleIndexingProgress(projectId: string, progress: number): Promise<void> {
    try {
      await this.updateProjectIndexingProgress(projectId, progress);
      
      // 获取当前项目状态以确定哪些存储类型正在索引
      const projectState = this.projectStates.get(projectId);
      if (!projectState) {
        this.logger.warn(`Project state not found for indexing progress: ${projectId}`);
        return;
      }

      // 只更新实际正在进行的索引状态
      if (projectState.vectorStatus.status === 'indexing') {
        await this.updateVectorStatus(projectId, {
          status: 'indexing',
          progress: progress
        });
      }
      
      if (projectState.graphStatus.status === 'indexing') {
        await this.updateGraphStatus(projectId, {
          status: 'indexing',
          progress: progress
        });
      }
    } catch (error) {
      this.logger.error('Failed to update project indexing progress', { projectId, progress, error });
    }
  }

  /**
   * 处理索引完成事件
   */
  private async handleIndexingCompleted(projectId: string): Promise<void> {
    try {
      await this.updateProjectStatus(projectId, 'active');
      await this.updateProjectLastIndexed(projectId);
      // 同时更新向量和图的状态为完成
      await this.updateVectorStatus(projectId, {
        status: 'completed',
        progress: 100
      });
      await this.updateGraphStatus(projectId, {
        status: 'completed',
        progress: 100
      });
    } catch (error) {
      this.logger.error('Failed to update project status to active', { projectId, error });
      // 即使更新状态失败，也尝试更新最后索引时间
      try {
        await this.updateProjectLastIndexed(projectId);
      } catch (lastIndexedError) {
        this.logger.error('Failed to update project last indexed time', { projectId, error: lastIndexedError });
      }
    }
  }

  /**
   * 处理索引错误事件
   */
  private async handleIndexingError(projectId: string, error: Error): Promise<void> {
    try {
      await this.updateProjectStatus(projectId, 'error');
      await this.updateProjectMetadata(projectId, { lastError: error.message });
      // 同时更新向量和图的状态为错误
      await this.updateVectorStatus(projectId, {
        status: 'error',
        progress: 0
      });
      await this.updateGraphStatus(projectId, {
        status: 'error',
        progress: 0
      });
    } catch (updateError) {
      this.logger.error('Failed to update project status to error', { projectId, error: updateError });
      // 即使更新状态失败，也尝试更新元数据
      try {
        await this.updateProjectMetadata(projectId, { lastError: error.message });
      } catch (metadataError) {
        this.logger.error('Failed to update project metadata', { projectId, error: metadataError });
      }
    }
 }

  /**
   * 更新项目状态映射引用
   * 当主类的项目状态映射重新创建时，需要更新引用
   */
  updateProjectStatesReference(projectStates: Map<string, ProjectState>): void {
    this.projectStates = projectStates;
  }
}