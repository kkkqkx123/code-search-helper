# SQLite数据迁移与配置管理方案

## 📊 数据迁移策略

### 1. 迁移架构设计

#### 1.1 迁移管理器类设计

```typescript
// src/database/sqlite/migration/JsonToSqliteMigrator.ts
import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { SqliteDatabaseService } from '../SqliteDatabaseService';
import fs from 'fs';
import path from 'path';

export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  errorCount: number;
  errors: string[];
  duration: number;
}

export interface MigrationSummary {
  projectMappings: MigrationResult;
  projectStates: MigrationResult;
  totalMigrated: number;
  totalErrors: number;
  overallSuccess: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  dataConsistency: {
    projects: number;
    fileStates: number;
    projectStatus: number;
    changeHistory: number;
  };
}

export interface RollbackResult {
  success: boolean;
  restoredFiles: string[];
  errors: string[];
}

@injectable()
export class JsonToSqliteMigrator {
  private logger: LoggerService;
  private sqliteService: SqliteDatabaseService;
  private dataDir: string;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.SqliteDatabaseService) sqliteService: SqliteDatabaseService
  ) {
    this.logger = logger;
    this.sqliteService = sqliteService;
    this.dataDir = path.join(process.cwd(), 'data');
  }

  /**
   * 执行完整的数据迁移
   */
  async migrateAll(): Promise<MigrationSummary> {
    const startTime = Date.now();
    
    this.logger.info('Starting complete data migration from JSON to SQLite');

    try {
      // 1. 备份现有JSON文件
      await this.backupJsonFiles();

      // 2. 确保数据库表结构存在
      this.sqliteService.initializeTables();

      // 3. 迁移项目映射数据
      const projectMappingsResult = await this.migrateProjectMappings();

      // 4. 迁移项目状态数据
      const projectStatesResult = await this.migrateProjectStates();

      // 5. 验证迁移结果
      const validationResult = await this.validateMigration();

      const duration = Date.now() - startTime;

      const summary: MigrationSummary = {
        projectMappings: projectMappingsResult,
        projectStates: projectStatesResult,
        totalMigrated: projectMappingsResult.migratedCount + projectStatesResult.migratedCount,
        totalErrors: projectMappingsResult.errorCount + projectStatesResult.errorCount,
        overallSuccess: projectMappingsResult.success && projectStatesResult.success && validationResult.isValid
      };

      this.logMigrationSummary(summary, duration);

      return summary;

    } catch (error) {
      this.logger.error('Migration failed', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      throw error;
    }
  }

  /**
   * 迁移项目映射数据
   */
  async migrateProjectMappings(): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: true,
      migratedCount: 0,
      errorCount: 0,
      errors: [],
      duration: 0
    };

    try {
      const projectMappingPath = path.join(this.dataDir, 'project-mapping.json');
      
      if (!fs.existsSync(projectMappingPath)) {
        this.logger.warn('Project mapping file not found, skipping migration');
        return result;
      }

      const projectMappings = JSON.parse(fs.readFileSync(projectMappingPath, 'utf-8'));
      
      if (!Array.isArray(projectMappings)) {
        throw new Error('Invalid project mapping file format');
      }

      const insertStmt = this.sqliteService.prepare(`
        INSERT INTO projects (id, path, name, description, collection_name, space_name, created_at, updated_at, status, settings, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const project of projectMappings) {
        try {
          insertStmt.run(
            project.id,
            project.path,
            project.name,
            project.description,
            project.collection_name,
            project.space_name,
            project.created_at,
            project.updated_at,
            project.status || 'active',
            JSON.stringify(project.settings || {}),
            JSON.stringify(project.metadata || {})
          );
          result.migratedCount++;
        } catch (error) {
          result.errorCount++;
          result.errors.push(`Failed to migrate project ${project.id}: ${(error as Error).message}`);
          this.logger.warn('Failed to migrate project', {
            projectId: project.id,
            error: (error as Error).message
          });
        }
      }

      result.duration = Date.now() - startTime;
      result.success = result.errorCount === 0;

      this.logger.info('Project mappings migration completed', {
        migrated: result.migratedCount,
        errors: result.errorCount,
        duration: result.duration
      });

    } catch (error) {
      result.success = false;
      result.errors.push(`Migration failed: ${(error as Error).message}`);
      this.logger.error('Project mappings migration failed', {
        error: (error as Error).message
      });
    }

    return result;
  }

  /**
   * 迁移项目状态数据
   */
  async migrateProjectStates(): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: true,
      migratedCount: 0,
      errorCount: 0,
      errors: [],
      duration: 0
    };

    try {
      const projectStatesPath = path.join(this.dataDir, 'project-states.json');
      
      if (!fs.existsSync(projectStatesPath)) {
        this.logger.warn('Project states file not found, skipping migration');
        return result;
      }

      const projectStates = JSON.parse(fs.readFileSync(projectStatesPath, 'utf-8'));
      
      if (!Array.isArray(projectStates)) {
        throw new Error('Invalid project states file format');
      }

      const insertStmt = this.sqliteService.prepare(`
        INSERT OR REPLACE INTO project_status 
        (project_id, vector_status, graph_status, indexing_progress, total_files, indexed_files, failed_files, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const state of projectStates) {
        try {
          insertStmt.run(
            state.project_id,
            JSON.stringify(state.vector_status || {}),
            JSON.stringify(state.graph_status || {}),
            state.indexing_progress || 0,
            state.total_files || 0,
            state.indexed_files || 0,
            state.failed_files || 0,
            state.last_updated || new Date().toISOString()
          );
          result.migratedCount++;
        } catch (error) {
          result.errorCount++;
          result.errors.push(`Failed to migrate project state ${state.project_id}: ${(error as Error).message}`);
          this.logger.warn('Failed to migrate project state', {
            projectId: state.project_id,
            error: (error as Error).message
          });
        }
      }

      result.duration = Date.now() - startTime;
      result.success = result.errorCount === 0;

      this.logger.info('Project states migration completed', {
        migrated: result.migratedCount,
        errors: result.errorCount,
        duration: result.duration
      });

    } catch (error) {
      result.success = false;
      result.errors.push(`Migration failed: ${(error as Error).message}`);
      this.logger.error('Project states migration failed', {
        error: (error as Error).message
      });
    }

    return result;
  }

  /**
   * 验证迁移结果
   */
  async validateMigration(): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      issues: [],
      dataConsistency: {
        projects: 0,
        fileStates: 0,
        projectStatus: 0,
        changeHistory: 0
      }
    };

    try {
      // 验证项目表数据
      const projectsStmt = this.sqliteService.prepare('SELECT COUNT(*) as count FROM projects');
      const projectsCount = (projectsStmt.get() as { count: number }).count;
      result.dataConsistency.projects = projectsCount;

      // 验证项目状态表数据
      const statusStmt = this.sqliteService.prepare('SELECT COUNT(*) as count FROM project_status');
      const statusCount = (statusStmt.get() as { count: number }).count;
      result.dataConsistency.projectStatus = statusCount;

      // 验证文件索引状态表数据
      const fileStatesStmt = this.sqliteService.prepare('SELECT COUNT(*) as count FROM file_index_states');
      const fileStatesCount = (fileStatesStmt.get() as { count: number }).count;
      result.dataConsistency.fileStates = fileStatesCount;

      // 验证变更历史表数据
      const changeHistoryStmt = this.sqliteService.prepare('SELECT COUNT(*) as count FROM file_change_history');
      const changeHistoryCount = (changeHistoryStmt.get() as { count: number }).count;
      result.dataConsistency.changeHistory = changeHistoryCount;

      // 检查数据一致性
      if (projectsCount === 0 && this.hasJsonProjectData()) {
        result.issues.push('No projects migrated despite existing JSON data');
        result.isValid = false;
      }

      if (statusCount === 0 && this.hasJsonStateData()) {
        result.issues.push('No project states migrated despite existing JSON data');
        result.isValid = false;
      }

      // 检查外键约束
      const foreignKeyCheck = this.sqliteService.prepare('PRAGMA foreign_key_check');
      const foreignKeyIssues = foreignKeyCheck.all() as any[];
      if (foreignKeyIssues.length > 0) {
        result.issues.push(`Foreign key constraint violations: ${foreignKeyIssues.length}`);
        result.isValid = false;
      }

      this.logger.info('Migration validation completed', {
        isValid: result.isValid,
        issues: result.issues.length,
        dataConsistency: result.dataConsistency
      });

    } catch (error) {
      result.isValid = false;
      result.issues.push(`Validation failed: ${(error as Error).message}`);
      this.logger.error('Migration validation failed', {
        error: (error as Error).message
      });
    }

    return result;
  }

  /**
   * 回滚迁移
   */
  async rollback(): Promise<RollbackResult> {
    const result: RollbackResult = {
      success: true,
      restoredFiles: [],
      errors: []
    };

    try {
      this.logger.info('Starting migration rollback');

      // 恢复备份的JSON文件
      const backupDir = path.join(this.dataDir, 'backup', 'migration');
      
      if (!fs.existsSync(backupDir)) {
        throw new Error('Backup directory not found, cannot rollback');
      }

      const filesToRestore = [
        'project-mapping.json',
        'project-states.json'
      ];

      for (const fileName of filesToRestore) {
        const backupPath = path.join(backupDir, fileName);
        const originalPath = path.join(this.dataDir, fileName);

        if (fs.existsSync(backupPath)) {
          fs.copyFileSync(backupPath, originalPath);
          result.restoredFiles.push(fileName);
          this.logger.info(`Restored file: ${fileName}`);
        }
      }

      // 清空SQLite表（可选）
      if (result.restoredFiles.length > 0) {
        this.sqliteService.exec('DELETE FROM projects');
        this.sqliteService.exec('DELETE FROM project_status');
        this.sqliteService.exec('DELETE FROM file_index_states');
        this.sqliteService.exec('DELETE FROM file_change_history');
        this.logger.info('Cleared SQLite tables');
      }

      this.logger.info('Migration rollback completed', {
        restoredFiles: result.restoredFiles.length,
        success: result.success
      });

    } catch (error) {
      result.success = false;
      result.errors.push(`Rollback failed: ${(error as Error).message}`);
      this.logger.error('Migration rollback failed', {
        error: (error as Error).message
      });
    }

    return result;
  }

  /**
   * 备份JSON文件
   */
  private async backupJsonFiles(): Promise<void> {
    const backupDir = path.join(this.dataDir, 'backup', 'migration');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const filesToBackup = [
      'project-mapping.json',
      'project-states.json'
    ];

    for (const fileName of filesToBackup) {
      const originalPath = path.join(this.dataDir, fileName);
      const backupPath = path.join(backupDir, fileName);

      if (fs.existsSync(originalPath)) {
        fs.copyFileSync(originalPath, backupPath);
        this.logger.info(`Backed up file: ${fileName}`);
      }
    }
  }

  /**
   * 检查是否存在JSON项目数据
   */
  private hasJsonProjectData(): boolean {
    const projectMappingPath = path.join(this.dataDir, 'project-mapping.json');
    if (!fs.existsSync(projectMappingPath)) {
      return false;
    }

    try {
      const data = JSON.parse(fs.readFileSync(projectMappingPath, 'utf-8'));
      return Array.isArray(data) && data.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * 检查是否存在JSON状态数据
   */
  private hasJsonStateData(): boolean {
    const projectStatesPath = path.join(this.dataDir, 'project-states.json');
    if (!fs.existsSync(projectStatesPath)) {
      return false;
    }

    try {
      const data = JSON.parse(fs.readFileSync(projectStatesPath, 'utf-8'));
      return Array.isArray(data) && data.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * 记录迁移摘要
   */
  private logMigrationSummary(summary: MigrationSummary, duration: number): void {
    this.logger.info('Migration summary', {
      duration,
      totalMigrated: summary.totalMigrated,
      totalErrors: summary.totalErrors,
      overallSuccess: summary.overallSuccess,
      projectMappings: {
        migrated: summary.projectMappings.migratedCount,
        errors: summary.projectMappings.errorCount
      },
      projectStates: {
        migrated: summary.projectStates.migratedCount,
        errors: summary.projectStates.errorCount
      }
    });

    if (!summary.overallSuccess) {
      this.logger.warn('Migration completed with errors', {
        errors: [...summary.projectMappings.errors, ...summary.projectStates.errors]
      });
    }
  }
}
```

### 2. 配置管理设计

#### 2.1 SQLite配置服务

```typescript
// src/infrastructure/config/SqliteConfigService.ts
import { injectable } from 'inversify';
import { BaseServiceConfig } from './BaseServiceConfig';
import { SqliteSpecificConfig } from './types';

@injectable()
export class SqliteConfigService extends BaseServiceConfig {
  private sqliteConfig: SqliteSpecificConfig;

  constructor() {
    super();
    this.sqliteConfig = this.loadSqliteConfig();
  }

  /**
   * 获取SQLite配置
   */
  getConfig(): SqliteSpecificConfig {
    return { ...this.sqliteConfig };
  }

  /**
   * 更新SQLite配置
   */
  updateConfig(newConfig: Partial<SqliteSpecificConfig>): void {
    this.sqliteConfig = {
      ...this.sqliteConfig,
      ...newConfig
    };
    
    this.saveConfig();
    this.emit('configUpdated', this.sqliteConfig);
  }

  /**
   * 验证配置
   */
  validateConfig(config: SqliteSpecificConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.databasePath) {
      errors.push('databasePath is required');
    }

    if (config.maxConnections && config.maxConnections < 1) {
      errors.push('maxConnections must be at least 1');
    }

    if (config.queryTimeout && config.queryTimeout < 0) {
      errors.push('queryTimeout must be non-negative');
    }

    if (config.backupInterval && config.backupInterval < 0) {
      errors.push('backupInterval must be non-negative');
    }

    const validJournalModes = ['WAL', 'DELETE', 'TRUNCATE', 'PERSIST', 'MEMORY', 'OFF'];
    if (config.journalMode && !validJournalModes.includes(config.journalMode)) {
      errors.push(`journalMode must be one of: ${validJournalModes.join(', ')}`);
    }

    const validSynchronousModes = ['OFF', 'NORMAL', 'FULL', 'EXTRA'];
    if (config.synchronous && !validSynchronousModes.includes(config.synchronous)) {
      errors.push(`synchronous must be one of: ${validSynchronousModes.join(', ')}`);
    }

    const validTempStores = ['DEFAULT', 'FILE', 'MEMORY'];
    if (config.tempStore && !validTempStores.includes(config.tempStore)) {
      errors.push(`tempStore must be one of: ${validTempStores.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig(): SqliteSpecificConfig {
    return {
      databasePath: './data/code-search-helper.db',
      backupPath: './data/backups',
      backupInterval: 86400000, // 24小时
      maxConnections: 10,
      queryTimeout: 30000,
      journalMode: 'WAL',
      synchronous: 'NORMAL',
      cacheSize: -2000, // 2MB
      tempStore: 'MEMORY',
      autoVacuum: 'NONE',
      busyTimeout: 5000
    };
  }

  /**
   * 加载配置
   */
  private loadSqliteConfig(): SqliteSpecificConfig {
    const defaultConfig = this.getDefaultConfig();
    
    try {
      // 从环境变量加载配置
      const envConfig = this.loadFromEnvironment();
      
      // 从配置文件加载配置
      const fileConfig = this.loadFromConfigFile();
      
      // 合并配置（环境变量优先级最高）
      const mergedConfig = {
        ...defaultConfig,
        ...fileConfig,
        ...envConfig
      };

      // 验证配置
      const validation = this.validateConfig(mergedConfig);
      if (!validation.isValid) {
        this.logger.warn('Invalid SQLite configuration, using defaults', {
          errors: validation.errors
        });
        return defaultConfig;
      }

      return mergedConfig;

    } catch (error) {
      this.logger.warn('Failed to load SQLite configuration, using defaults', {
        error: (error as Error).message
      });
      return defaultConfig;
    }
  }

  /**
   * 从环境变量加载配置
   */
  private loadFromEnvironment(): Partial<SqliteSpecificConfig> {
    const config: Partial<SqliteSpecificConfig> = {};

    if (process.env.SQLITE_DB_PATH) {
      config.databasePath = process.env.SQLITE_DB_PATH;
    }

    if (process.env.SQLITE_BACKUP_PATH) {
      config.backupPath = process.env.SQLITE_BACKUP_PATH;
    }

    if (process.env.SQLITE_BACKUP_INTERVAL) {
      config.backupInterval = parseInt(process.env.SQLITE_BACKUP_INTERVAL);
    }

    if (process.env.SQLITE_MAX_CONNECTIONS) {
      config.maxConnections = parseInt(process.env.SQLITE_MAX_CONNECTIONS);
    }

    if (process.env.SQLITE_QUERY_TIMEOUT) {
      config.queryTimeout = parseInt(process.env.SQLITE_QUERY_TIMEOUT);
    }

    if (process.env.SQLITE_JOURNAL_MODE) {
      config.journalMode = process.env.SQLITE_JOURNAL_MODE as any;
    }

    if (process.env.SQLITE_SYNCHRONOUS) {
      config.synchronous = process.env.SQLITE_SYNCHRONOUS as any;
    }

    if (process.env.SQLITE_CACHE_SIZE) {
      config.cacheSize = parseInt(process.env.SQLITE_CACHE_SIZE);
    }

    if (process.env.SQLITE_TEMP_STORE) {
      config.tempStore = process.env.SQLITE_TEMP_STORE as any;
    }

    if (process.env.SQLITE_AUTO_VACUUM) {
      config.autoVacuum = process.env.SQLITE_AUTO_VACUUM as any;
    }

    if (process.env.SQLITE_BUSY_TIMEOUT) {
      config.busyTimeout = parseInt(process.env.SQLITE_BUSY_TIMEOUT);
    }

    return config;
  }

  /**
   * 从配置文件加载配置
   */
  private loadFromConfigFile(): Partial<SqliteSpecificConfig> {
    // 这里可以实现从配置文件加载配置的逻辑
    // 例如从 config/sqlite.json 或 app.config.json 中加载
    return {};
  }

  /**
   * 保存配置
   */
  private saveConfig(): void {
    // 这里可以实现配置持久化逻辑
    // 例如保存到配置文件或数据库
    this.logger.debug('SQLite configuration updated', this.sqliteConfig);
  }
}
```

#### 2.2 配置验证器扩展

```typescript
// src/infrastructure/config/ConfigValidator.ts
import { InfrastructureConfig, SqliteSpecificConfig } from './types';

export class ConfigValidator {
  // ... 现有验证方法

  /**
   * 验证SQLite特定配置
   */
  static validateSqliteConfig(config: SqliteSpecificConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.databasePath) {
      errors.push('SQLite databasePath is required');
    }

    if (config.maxConnections && config.maxConnections < 1) {
      errors.push('SQLite maxConnections must be at least 1');
    }

    if (config.queryTimeout && config.queryTimeout < 0) {
      errors.push('SQLite queryTimeout must be non-negative');
    }

    const validJournalModes = ['WAL', 'DELETE', 'TRUNCATE', 'PERSIST', 'MEMORY', 'OFF'];
    if (config.journalMode && !validJournalModes.includes(config.journalMode)) {
      errors.push(`SQLite journalMode must be one of: ${validJournalModes.join(', ')}`);
    }

    const validSynchronousModes = ['OFF', 'NORMAL', 'FULL', 'EXTRA'];
    if (config.synchronous && !validSynchronousModes.includes(config.synchronous)) {
      errors.push(`SQLite synchronous must be one of: ${validSynchronousModes.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证完整的基础设施配置（包含SQLite）
   */
  static validateFullConfig(config: InfrastructureConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证通用配置
    const commonValidation = this.validateCommonConfig(config.common);
    if (!commonValidation.isValid) {
      errors.push(...commonValidation.errors);
    }

    // 验证SQLite配置
    if (config.sqlite) {
      const sqliteValidation = this.validateSqliteConfig(config.sqlite.database);
      if (!sqliteValidation.isValid) {
        errors.push(...sqliteValidation.errors.map(e => `SQLite: ${e}`));
      }
    }

    // 验证其他数据库配置...
    // Qdrant, Nebula等

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
```

### 3. 迁移执行策略

#### 3.1 渐进式迁移

```typescript
// src/database/sqlite/migration/MigrationOrchestrator.ts
export class MigrationOrchestrator {
  private migrator: JsonToSqliteMigrator;
  private logger: LoggerService;
  private migrationEnabled: boolean = false;

  constructor(migrator: JsonToSqliteMigrator, logger: LoggerService) {
    this.migrator = migrator;
    this.logger = logger;
  }

  /**
   * 执行渐进式迁移
   */
  async executeProgressiveMigration(): Promise<MigrationSummary> {
    this.logger.info('Starting progressive migration');

    // 1. 检查是否需要迁移
    if (!this.shouldMigrate()) {
      this.logger.info('No migration needed, SQLite data is up to date');
      return {
        projectMappings: { success: true, migratedCount: 0, errorCount: 0, errors: [], duration: 0 },
        projectStates: { success: true, migratedCount: 0, errorCount: 0, errors: [], duration: 0 },
        totalMigrated: 0,
        totalErrors: 0,
        overallSuccess: true
      };
    }

    // 2. 执行完整迁移
    const summary = await this.migrator.migrateAll();

    // 3. 启用SQLite数据访问
    if (summary.overallSuccess) {
      this.enableSqliteAccess();
    }

    return summary;
  }

  /**
   * 检查是否需要迁移
   */
  private shouldMigrate(): boolean {
    // 检查SQLite数据库是否存在且包含数据
    const dbExists = fs.existsSync('./data/code-search-helper.db');
    
    if (!dbExists) {
      return true; // 数据库文件不存在，需要迁移
    }

    // 检查JSON文件是否存在且比数据库新
    const jsonFilesExist = this.hasJsonDataFiles();
    if (!jsonFilesExist) {
      return false; // 没有JSON数据文件，不需要迁移
    }

    // 检查数据库是否为空
    return this.isDatabaseEmpty();
  }

  /**
   * 检查是否存在JSON数据文件
   */
  private hasJsonDataFiles(): boolean {
    const projectMappingPath = './data/project-mapping.json';
    const projectStatesPath = './data/project-states.json';
    
    return fs.existsSync(projectMappingPath) || fs.existsSync(projectStatesPath);
  }

  /**
   * 检查数据库是否为空
   */
  private isDatabaseEmpty(): boolean {
    try {
      // 这里需要访问SQLite数据库来检查是否有数据
      // 暂时返回true表示需要迁移
      return true;
    } catch (error) {
      this.logger.warn('Failed to check database emptiness, assuming migration needed', {
        error: (error as Error).message
      });
      return true;
    }
  }

  /**
   * 启用SQLite数据访问
   */
  private enableSqliteAccess(): void {
    this.migrationEnabled = true;
    this.logger.info('SQLite data access enabled');
  }

  /**
   * 检查是否已启用SQLite数据访问
   */
  isMigrationEnabled(): boolean {
    return this.migrationEnabled;
  }

  /**
   * 获取迁移状态
   */
  getMigrationStatus(): MigrationStatus {
    return {
      enabled: this.migrationEnabled,
      lastMigration: this.getLastMigrationTime(),
      dataSource: this.migrationEnabled ? 'sqlite' : 'json'
    };
  }

  private getLastMigrationTime(): Date | null {
    // 实现获取最后迁移时间的逻辑
    return null;
  }
}

export interface MigrationStatus {
  enabled: boolean;
  lastMigration: Date | null;
  dataSource: 'sqlite' | 'json';
}
```

## 🚀 实施计划

### 阶段一：配置和迁移工具开发（3-4天）
1. **配置管理**
   - 实现SqliteConfigService
   - 扩展ConfigValidator
   - 更新基础设施配置类型

2. **迁移工具**
   - 实现JsonToSqliteMigrator
   - 创建MigrationOrchestrator
   - 开发迁移测试工具

### 阶段二：数据迁移执行（2-3天）
1. **迁移准备**
   - 备份现有数据
   - 验证迁移条件
   - 执行数据迁移

2. **迁移验证**
   - 数据完整性检查
   - 性能基准测试
   - 回滚测试

### 阶段三：生产环境部署（1-2天）
1. **生产部署**
   - 配置生产环境
   - 执行生产数据迁移
   - 监控迁移过程

2. **后续优化**
   - 性能调优
   - 监控告警
   - 文档更新

## 📋 风险评估与缓解

### 数据丢失风险
- **风险**: 迁移过程中数据丢失
- **缓解**: 
  - 完整的备份机制
  - 数据验证步骤
  - 可回滚的设计

### 性能风险
- **风险**: SQLite性能不如预期
- **缓解**:
  - 性能基准测试
  - 渐进式迁移
  - 性能监控

### 兼容性风险
- **风险**: 与现有系统不兼容
- **缓解**:
  - 功能开关控制
  - 并行运行测试
  - 快速回滚能力

这个迁移和配置管理方案确保了数据的安全迁移和灵活的配置管理，为SQLite集成提供了完整的解决方案。