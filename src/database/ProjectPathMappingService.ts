import { injectable, inject } from 'inversify';
import { TYPES } from '../types';
import { SqliteDatabaseService } from './splite/SqliteDatabaseService';
import { LoggerService } from '../utils/LoggerService';

export interface ProjectPathMapping {
  id?: number;
  hash: string;
  originalPath: string;
  createdAt?: Date;
  updatedAt?: Date;
}

@injectable()
export class ProjectPathMappingService {
  constructor(
    @inject(TYPES.SqliteDatabaseService) private dbService: SqliteDatabaseService,
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {
    this.initializeTable();
  }

  private async initializeTable(): Promise<void> {
    try {
      // 确保数据库已连接
      if (!this.dbService.isConnected()) {
        this.dbService.connect();
      }
      
      // 运行迁移以确保表存在
      await this.runMigration();
      
      this.logger.info('Project path mapping table initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize project path mapping table', error);
      throw error;
    }
  }

  /**
   * 运行迁移以确保表结构存在
   */
  private async runMigration(): Promise<void> {
    try {
      // 检查表是否已存在
      const checkTableSQL = `
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='project_path_mapping'
      `;
      
      const result = this.dbService.prepare(checkTableSQL).get() as { name: string } | undefined;
      
      if (!result) {
        // 表不存在，执行迁移
        this.logger.info('Running migration for project_path_mapping table');
        
        // 直接执行表创建SQL
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS project_path_mapping (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hash TEXT UNIQUE NOT NULL,
            original_path TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `;
        
        this.dbService.exec(createTableSQL);
        
        // 创建索引
        this.dbService.exec('CREATE INDEX IF NOT EXISTS idx_project_path_mapping_hash ON project_path_mapping(hash)');
        this.dbService.exec('CREATE INDEX IF NOT EXISTS idx_project_path_mapping_original_path ON project_path_mapping(original_path)');
        this.dbService.exec('CREATE INDEX IF NOT EXISTS idx_project_path_mapping_created_at ON project_path_mapping(created_at)');
        
        // 创建触发器
        this.dbService.exec(`
          CREATE TRIGGER IF NOT EXISTS update_project_path_mapping_timestamp 
          AFTER UPDATE ON project_path_mapping
          BEGIN
            UPDATE project_path_mapping 
            SET updated_at = CURRENT_TIMESTAMP 
            WHERE id = NEW.id;
          END
        `);
        
        this.logger.info('Project path mapping table created successfully');
      }
    } catch (error) {
      this.logger.error('Failed to run migration for project_path_mapping table', error);
      throw error;
    }
  }

  /**
   * 保存路径映射关系
   * @param hash 生成的安全名称哈希部分
   * @param originalPath 原始项目路径
   */
  async saveMapping(hash: string, originalPath: string): Promise<void> {
    const insertSQL = `
      INSERT OR REPLACE INTO project_path_mapping (hash, original_path, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `;
    
    try {
      this.dbService.prepare(insertSQL).run(hash, originalPath);
      this.logger.debug(`Saved mapping: ${hash} -> ${originalPath}`);
    } catch (error) {
      this.logger.error(`Failed to save mapping for hash: ${hash}`, error);
      throw error;
    }
  }

  /**
   * 根据哈希值获取原始路径
   * @param hash 安全名称的哈希部分
   * @returns 原始项目路径，如果未找到则返回null
   */
  async getOriginalPath(hash: string): Promise<string | null> {
    const selectSQL = `
      SELECT original_path FROM project_path_mapping WHERE hash = ?
    `;
    
    try {
      const result = this.dbService.prepare(selectSQL).get(hash) as { original_path: string } | undefined;
      return result ? result.original_path : null;
    } catch (error) {
      this.logger.error(`Failed to get original path for hash: ${hash}`, error);
      throw error;
    }
  }

  /**
   * 根据原始路径获取哈希值
   * @param originalPath 原始项目路径
   * @returns 哈希值，如果未找到则返回null
   */
  async getHashByPath(originalPath: string): Promise<string | null> {
    const selectSQL = `
      SELECT hash FROM project_path_mapping WHERE original_path = ?
    `;
    
    try {
      const result = this.dbService.prepare(selectSQL).get(originalPath) as { hash: string } | undefined;
      return result ? result.hash : null;
    } catch (error) {
      this.logger.error(`Failed to get hash for path: ${originalPath}`, error);
      throw error;
    }
  }

  /**
   * 获取所有映射关系
   * @returns 所有映射关系的数组
   */
  async getAllMappings(): Promise<ProjectPathMapping[]> {
    const selectSQL = `
      SELECT id, hash, original_path as originalPath, created_at as createdAt, updated_at as updatedAt 
      FROM project_path_mapping 
      ORDER BY created_at DESC
    `;
    
    try {
      const results = this.dbService.prepare(selectSQL).all() as any[];
      return results.map(row => ({
        id: row.id,
        hash: row.hash,
        originalPath: row.originalPath,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt)
      }));
    } catch (error) {
      this.logger.error('Failed to get all mappings', error);
      throw error;
    }
  }

  /**
   * 删除指定的映射关系
   * @param hash 安全名称的哈希部分
   */
  async deleteMapping(hash: string): Promise<void> {
    const deleteSQL = `
      DELETE FROM project_path_mapping WHERE hash = ?
    `;
    
    try {
      const result = this.dbService.prepare(deleteSQL).run(hash);
      if (result.changes > 0) {
        this.logger.debug(`Deleted mapping for hash: ${hash}`);
      } else {
        this.logger.warn(`No mapping found to delete for hash: ${hash}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete mapping for hash: ${hash}`, error);
      throw error;
    }
  }

  /**
   * 根据原始路径删除映射关系
   * @param originalPath 原始项目路径
   */
  async deleteMappingByPath(originalPath: string): Promise<void> {
    const deleteSQL = `
      DELETE FROM project_path_mapping WHERE original_path = ?
    `;
    
    try {
      const result = this.dbService.prepare(deleteSQL).run(originalPath);
      if (result.changes > 0) {
        this.logger.debug(`Deleted mapping for path: ${originalPath}`);
      } else {
        this.logger.warn(`No mapping found to delete for path: ${originalPath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete mapping for path: ${originalPath}`, error);
      throw error;
    }
  }

  /**
   * 检查映射关系是否存在
   * @param hash 安全名称的哈希部分
   * @returns 如果存在返回true，否则返回false
   */
  async mappingExists(hash: string): Promise<boolean> {
    const selectSQL = `
      SELECT COUNT(*) as count FROM project_path_mapping WHERE hash = ?
    `;
    
    try {
      const result = this.dbService.prepare(selectSQL).get(hash) as { count: number };
      return result.count > 0;
    } catch (error) {
      this.logger.error(`Failed to check mapping existence for hash: ${hash}`, error);
      throw error;
    }
  }

  /**
   * 获取映射关系统计信息
   * @returns 映射关系的统计信息
   */
  async getMappingStats(): Promise<{
    total: number;
    createdToday: number;
    createdThisWeek: number;
    createdThisMonth: number;
  }> {
    try {
      const totalSQL = `SELECT COUNT(*) as count FROM project_path_mapping`;
      const todaySQL = `SELECT COUNT(*) as count FROM project_path_mapping WHERE DATE(created_at) = DATE('now')`;
      const weekSQL = `SELECT COUNT(*) as count FROM project_path_mapping WHERE created_at >= DATE('now', '-7 days')`;
      const monthSQL = `SELECT COUNT(*) as count FROM project_path_mapping WHERE created_at >= DATE('now', '-30 days')`;
      
      const total = this.dbService.prepare(totalSQL).get() as { count: number };
      const today = this.dbService.prepare(todaySQL).get() as { count: number };
      const week = this.dbService.prepare(weekSQL).get() as { count: number };
      const month = this.dbService.prepare(monthSQL).get() as { count: number };
      
      return {
        total: total.count,
        createdToday: today.count,
        createdThisWeek: week.count,
        createdThisMonth: month.count
      };
    } catch (error) {
      this.logger.error('Failed to get mapping stats', error);
      throw error;
    }
  }
}