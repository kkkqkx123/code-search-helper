import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { SqliteDatabaseService } from './SqliteDatabaseService';
import { LoggerService } from '../../utils/LoggerService';

export interface ProjectState {
  projectId: string;
  vectorStatus: any;
  graphStatus: any;
  indexingProgress: number;
  totalFiles: number;
  indexedFiles: number;
  failedFiles: number;
  lastUpdated: Date;
}

@injectable()
export class SqliteStateManager {
  constructor(
    @inject(TYPES.SqliteDatabaseService) private sqliteService: SqliteDatabaseService,
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {}

  /**
   * 保存项目状态
   */
  async saveProjectState(state: ProjectState): Promise<boolean> {
    try {
      const stmt = this.sqliteService.prepare(`
        INSERT OR REPLACE INTO project_status 
        (project_id, vector_status, graph_status, indexing_progress, total_files, indexed_files, failed_files, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        state.projectId,
        JSON.stringify(state.vectorStatus),
        JSON.stringify(state.graphStatus),
        state.indexingProgress || 0,
        state.totalFiles || 0,
        state.indexedFiles || 0,
        state.failedFiles || 0,
        state.lastUpdated.toISOString()
      );
      
      return result.changes > 0;
    } catch (error) {
      this.logger.error(`Failed to save project state: ${state.projectId}`, error);
      return false;
    }
  }

  /**
   * 获取项目状态
   */
  async getProjectState(projectId: string): Promise<ProjectState | null> {
    try {
      const stmt = this.sqliteService.prepare(`
        SELECT * FROM project_status WHERE project_id = ?
      `);
      
      const result = stmt.get(projectId) as any;
      
      if (!result) {
        return null;
      }
      
      return {
        projectId: result.project_id,
        vectorStatus: JSON.parse(result.vector_status),
        graphStatus: JSON.parse(result.graph_status),
        indexingProgress: result.indexing_progress,
        totalFiles: result.total_files,
        indexedFiles: result.indexed_files,
        failedFiles: result.failed_files,
        lastUpdated: new Date(result.last_updated)
      };
    } catch (error) {
      this.logger.error(`Failed to get project state: ${projectId}`, error);
      return null;
    }
  }

  /**
   * 获取所有项目状态
   */
  async getAllProjectStates(): Promise<ProjectState[]> {
    try {
      const stmt = this.sqliteService.prepare(`
        SELECT * FROM project_status ORDER BY last_updated DESC
      `);
      
      const results = stmt.all() as any[];
      
      return results.map(result => ({
        projectId: result.project_id,
        vectorStatus: JSON.parse(result.vector_status),
        graphStatus: JSON.parse(result.graph_status),
        indexingProgress: result.indexing_progress,
        totalFiles: result.total_files,
        indexedFiles: result.indexed_files,
        failedFiles: result.failed_files,
        lastUpdated: new Date(result.last_updated)
      }));
    } catch (error) {
      this.logger.error('Failed to get all project states', error);
      return [];
    }
  }

  /**
   * 删除项目状态
   */
  async deleteProjectState(projectId: string): Promise<boolean> {
    try {
      const stmt = this.sqliteService.prepare(`
        DELETE FROM project_status WHERE project_id = ?
      `);
      
      const result = stmt.run(projectId);
      return result.changes > 0;
    } catch (error) {
      this.logger.error(`Failed to delete project state: ${projectId}`, error);
      return false;
    }
  }

  /**
   * 批量保存项目状态
   */
  async batchSaveProjectStates(states: ProjectState[]): Promise<boolean> {
    if (states.length === 0) return true;
    
    try {
      this.sqliteService.transaction(() => {
        const stmt = this.sqliteService.prepare(`
          INSERT OR REPLACE INTO project_status 
          (project_id, vector_status, graph_status, indexing_progress, total_files, indexed_files, failed_files, last_updated)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const state of states) {
          stmt.run(
            state.projectId,
            JSON.stringify(state.vectorStatus),
            JSON.stringify(state.graphStatus),
            state.indexingProgress || 0,
            state.totalFiles || 0,
            state.indexedFiles || 0,
            state.failedFiles || 0,
            state.lastUpdated.toISOString()
          );
        }
      });
      
      this.logger.info(`Batch saved ${states.length} project states`);
      return true;
    } catch (error) {
      this.logger.error('Failed to batch save project states', error);
      return false;
    }
  }

  /**
   * 更新项目状态的部分字段
   */
  async updateProjectStateFields(projectId: string, updates: Partial<ProjectState>): Promise<boolean> {
    const existingState = await this.getProjectState(projectId);
    if (!existingState) {
      return false;
    }
    
    const updatedState: ProjectState = {
      ...existingState,
      ...updates,
      projectId,
      lastUpdated: new Date()
    };
    
    return await this.saveProjectState(updatedState);
  }

  /**
   * 获取项目状态统计信息
   */
  async getProjectStateStats(): Promise<{
    totalProjects: number;
    activeProjects: number;
    indexingProjects: number;
    errorProjects: number;
  }> {
    try {
      const stmt = this.sqliteService.prepare(`
        SELECT 
          COUNT(*) as total_projects,
          SUM(CASE WHEN json_extract(vector_status, '$.status') = 'indexing' OR json_extract(graph_status, '$.status') = 'indexing' THEN 1 ELSE 0 END) as indexing_projects,
          SUM(CASE WHEN json_extract(vector_status, '$.status') = 'error' OR json_extract(graph_status, '$.status') = 'error' THEN 1 ELSE 0 END) as error_projects
        FROM project_status
      `);
      
      const result = stmt.get() as any;
      
      return {
        totalProjects: result.total_projects,
        activeProjects: result.total_projects - result.error_projects,
        indexingProjects: result.indexing_projects,
        errorProjects: result.error_projects
      };
    } catch (error) {
      this.logger.error('Failed to get project state stats', error);
      return {
        totalProjects: 0,
        activeProjects: 0,
        indexingProjects: 0,
        errorProjects: 0
      };
    }
  }
}