import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * SQLite数据库服务类
 * 提供数据库连接管理和基本操作
 */
export class SqliteDatabaseService {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'code-search-helper.db');
    this.ensureDataDirectory();
  }

  /**
   * 确保数据目录存在
   */
  private ensureDataDirectory(): void {
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  /**
   * 连接到数据库
   */
  connect(): void {
    if (this.db) {
      return; // 已经连接
    }

    try {
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      console.log(`SQLite数据库连接成功: ${this.dbPath}`);
    } catch (error) {
      console.error('SQLite数据库连接失败:', error);
      throw error;
    }
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('SQLite数据库连接已关闭');
    }
  }

  /**
   * 获取数据库实例
   */
  getDatabase(): Database.Database {
    if (!this.db) {
      throw new Error('数据库未连接，请先调用connect()方法');
    }
    return this.db;
  }

  /**
   * 初始化数据库表结构
   */
  initializeTables(): void {
    const db = this.getDatabase();

    // 创建项目表
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          path TEXT UNIQUE NOT NULL,
          name TEXT,
          description TEXT,
          collection_name TEXT,
          space_name TEXT,
          created_at DATETIME NOT NULL,
          updated_at DATETIME NOT NULL,
          last_indexed_at DATETIME,
          status TEXT NOT NULL,
          settings JSON,
          metadata JSON
      )
    `);

    // 创建文件索引状态表
    db.exec(`
      CREATE TABLE IF NOT EXISTS file_index_states (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          file_path TEXT NOT NULL,
          relative_path TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          file_size INTEGER,
          last_modified DATETIME NOT NULL,
          last_indexed DATETIME,
          indexing_version INTEGER DEFAULT 1,
          chunk_count INTEGER,
          vector_count INTEGER,
          language TEXT,
          file_type TEXT,
          status TEXT DEFAULT 'pending',
          error_message TEXT,
          metadata JSON,
          created_at DATETIME NOT NULL,
          updated_at DATETIME NOT NULL,
          
          UNIQUE(project_id, file_path),
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // 创建项目状态表
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_status (
          project_id TEXT PRIMARY KEY,
          vector_status JSON NOT NULL,
          graph_status JSON NOT NULL,
          indexing_progress REAL DEFAULT 0,
          total_files INTEGER DEFAULT 0,
          indexed_files INTEGER DEFAULT 0,
          failed_files INTEGER DEFAULT 0,
          last_updated DATETIME NOT NULL,
          
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // 创建文件变更历史表
    db.exec(`
      CREATE TABLE IF NOT EXISTS file_change_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_path TEXT NOT NULL,
          project_id TEXT NOT NULL,
          change_type TEXT NOT NULL,
          previous_hash TEXT,
          current_hash TEXT,
          file_size INTEGER,
          timestamp DATETIME NOT NULL,
          metadata JSON,
          
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // 创建索引
    db.exec('CREATE INDEX IF NOT EXISTS idx_file_states_project ON file_index_states(project_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_file_states_hash ON file_index_states(content_hash)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_file_states_path ON file_index_states(file_path)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_file_states_modified ON file_index_states(last_modified)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_change_history_project ON file_change_history(project_id, timestamp)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_change_history_file ON file_change_history(file_path, timestamp)');

    console.log('数据库表结构初始化完成');
  }

  /**
   * 执行事务
   */
  transaction<T>(fn: () => T): T {
    const db = this.getDatabase();
    const transaction = db.transaction(fn);
    return transaction();
  }

  /**
   * 准备SQL语句
   */
  prepare(sql: string): Database.Statement {
    const db = this.getDatabase();
    return db.prepare(sql);
  }

  /**
   * 执行SQL语句
   */
  exec(sql: string): void {
    const db = this.getDatabase();
    db.exec(sql);
  }

  /**
   * 检查数据库连接状态
   */
  isConnected(): boolean {
    return this.db !== null && this.db.open;
  }

  /**
   * 获取数据库文件路径
   */
  getDatabasePath(): string {
    return this.dbPath;
  }

  /**
   * 备份数据库
   */
  backup(backupPath: string): void {
    if (!this.isConnected()) {
      throw new Error('数据库未连接，无法执行备份');
    }
    
    // 先关闭数据库连接以避免文件锁定
    const db = this.db;
    this.db = null;
    
    try {
      // 使用文件复制进行备份
      fs.copyFileSync(this.dbPath, backupPath);
      console.log(`数据库备份完成: ${backupPath}`);
    } catch (error) {
      console.error('数据库备份失败:', error);
      throw error;
    } finally {
      // 恢复数据库连接
      this.db = db;
    }
  }

  /**
   * 获取数据库统计信息
   */
  getStats(): {
    projects: number;
    fileStates: number;
    projectStatus: number;
    changeHistory: number;
    databaseSize: number;
  } {
    const db = this.getDatabase();
    
    const projects = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
    const fileStates = db.prepare('SELECT COUNT(*) as count FROM file_index_states').get() as { count: number };
    const projectStatus = db.prepare('SELECT COUNT(*) as count FROM project_status').get() as { count: number };
    const changeHistory = db.prepare('SELECT COUNT(*) as count FROM file_change_history').get() as { count: number };
    
    let databaseSize = 0;
    try {
      const stats = fs.statSync(this.dbPath);
      databaseSize = stats.size;
    } catch (error) {
      console.warn('无法获取数据库文件大小:', error);
    }

    return {
      projects: projects.count,
      fileStates: fileStates.count,
      projectStatus: projectStatus.count,
      changeHistory: changeHistory.count,
      databaseSize
    };
  }
}

// 创建单例实例
export const sqliteDatabaseService = new SqliteDatabaseService();