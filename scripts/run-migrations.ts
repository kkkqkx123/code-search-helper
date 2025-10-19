#!/usr/bin/env node

/**
 * 数据库迁移运行脚本
 * 用于执行数据库迁移，添加热重载相关字段
 */

import { Container } from 'inversify';
import { TYPES } from '../src/types';
import { LoggerService } from '../src/utils/LoggerService';
import { SqliteDatabaseService } from '../src/database/splite/SqliteDatabaseService';
import { MigrationManager } from '../src/database/splite/migrations/MigrationManager';
import { DatabaseMigrationRunner } from '../src/database/splite/migrations/DatabaseMigrationRunner';

async function runMigrations(): Promise<void> {
  console.log('🚀 Starting database migration...');
  
  // 创建DI容器
  const container = new Container();
  
  // 注册基础服务
  container.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
  container.bind<SqliteDatabaseService>(TYPES.SqliteDatabaseService).to(SqliteDatabaseService).inSingletonScope();
  container.bind<MigrationManager>(TYPES.MigrationManager).to(MigrationManager).inSingletonScope();
  container.bind<DatabaseMigrationRunner>(TYPES.DatabaseMigrationRunner).to(DatabaseMigrationRunner).inSingletonScope();
  
  try {
    // 获取服务实例
    const logger = container.get<LoggerService>(TYPES.LoggerService);
    const migrationRunner = container.get<DatabaseMigrationRunner>(TYPES.DatabaseMigrationRunner);
    
    // 检查迁移状态
    const status = await migrationRunner.checkMigrationStatus();
    console.log(`📊 Migration status: ${status.status.available} available, ${status.status.executed} executed, ${status.status.pending} pending`);
    
    if (status.needsMigration) {
      console.log('🔄 Running database migrations...');
      
      // 运行迁移
      const success = await migrationRunner.runMigrations();
      
      if (success) {
        console.log('✅ Database migrations completed successfully!');
        
        // 验证数据库结构
        const validation = await migrationRunner.validateDatabaseStructure();
        if (validation.isValid) {
          console.log('✅ Database structure validation passed!');
        } else {
          console.log('⚠️  Database structure validation failed:');
          validation.issues.forEach(issue => console.log(`   - ${issue}`));
        }
        
        // 获取数据库统计信息
        const stats = await migrationRunner.getDatabaseStats();
        console.log(`📈 Database stats: ${stats.tables} tables, ${stats.migrations} migrations`);
        if (stats.lastMigration) {
          console.log(`🕐 Last migration: ${stats.lastMigration}`);
        }
      } else {
        console.error('❌ Database migrations failed!');
        process.exit(1);
      }
    } else {
      console.log('✅ Database is up to date, no migrations needed.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// 运行迁移
runMigrations().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});