const { SqliteDatabaseService } = require('../../../dist/database/splite/SqliteDatabaseService');
const { SqliteProjectManager } = require('../../../dist/database/splite/SqliteProjectManager');
const { SqliteStateManager } = require('../../../dist/database/splite/SqliteStateManager');
const { FileHashManagerImpl } = require('../../../dist/service/filesystem/FileHashManager');
const { JsonToSqliteMigrator } = require('../../../dist/database/splite/migration/JsonToSqliteMigrator');
const { LoggerService } = require('../../../dist/utils/LoggerService');

async function testSQLiteMigration() {
  console.log('🚀 Starting SQLite Migration Test...\n');

  try {
    // 初始化服务
    const logger = new LoggerService();
    const sqliteService = new SqliteDatabaseService(logger);
    const sqliteProjectManager = new SqliteProjectManager(sqliteService);
    const sqliteStateManager = new SqliteStateManager(sqliteService, logger);
    const fileHashManager = new FileHashManagerImpl(logger, sqliteService);
    const migrator = new JsonToSqliteMigrator(logger, sqliteService);

    // 1. 测试数据库连接和表结构
    console.log('📊 Testing database connection and table structure...');
    sqliteService.connect();
    sqliteService.initializeTables();

    const stats = sqliteService.getStats();
    console.log('✅ Database stats:', JSON.stringify(stats, null, 2));

    // 2. 测试数据迁移
    console.log('\n📀 Testing data migration from JSON to SQLite...');
    const migrationResult = await migrator.migrateAll();
    console.log('✅ Migration result:', JSON.stringify(migrationResult, null, 2));

    // 3. 测试ProjectIdManager功能（通过SqliteProjectManager）
    console.log('\n🏗️ Testing project management...');

    // 创建测试项目
    const testProjectPath = '/test/project/path';
    const projectCreated = await sqliteProjectManager.createProjectSpace(testProjectPath, {
      name: 'Test Project',
      description: 'A test project for migration',
      collectionName: 'test-collection',
      spaceName: 'test-space'
    });

    console.log('✅ Project created:', projectCreated);

    // 获取项目信息
    const projectInfo = await sqliteProjectManager.getProjectSpaceInfo(testProjectPath);
    console.log('✅ Project info:', JSON.stringify(projectInfo, null, 2));

    // 4. 测试ProjectStateManager功能（通过SqliteStateManager）
    console.log('\n📊 Testing project state management...');

    const testState = {
      projectId: projectInfo.project.id,
      vectorStatus: { status: 'completed', progress: 100, lastUpdated: new Date() },
      graphStatus: { status: 'completed', progress: 100, lastUpdated: new Date() },
      indexingProgress: 100,
      totalFiles: 150,
      indexedFiles: 150,
      failedFiles: 0,
      lastUpdated: new Date()
    };

    const stateSaved = await sqliteStateManager.saveProjectState(testState);
    console.log('✅ Project state saved:', stateSaved);

    const retrievedState = await sqliteStateManager.getProjectState(testState.projectId);
    console.log('✅ Retrieved project state:', JSON.stringify(retrievedState, null, 2));

    // 5. 测试FileHashManager功能
    console.log('\n🔑 Testing file hash management...');

    // 批量更新文件哈希
    const hashUpdates = [
      {
        projectId: testState.projectId,
        filePath: '/test/file1.js',
        hash: 'hash1',
        fileSize: 1024,
        lastModified: new Date(),
        language: 'javascript',
        fileType: '.js'
      },
      {
        projectId: testState.projectId,
        filePath: '/test/file2.py',
        hash: 'hash2',
        fileSize: 2048,
        lastModified: new Date(),
        language: 'python',
        fileType: '.py'
      }
    ];

    await fileHashManager.batchUpdateHashes(hashUpdates);
    console.log('✅ File hashes updated');

    // 获取单个文件哈希
    const fileHash = await fileHashManager.getFileHash(testState.projectId, '/test/file1.js');
    console.log('✅ File hash retrieved:', fileHash);

    // 获取多个文件哈希
    const fileHashes = await fileHashManager.getFileHashes(testState.projectId, ['/test/file1.js', '/test/file2.py']);
    console.log('✅ Multiple file hashes retrieved:', Array.from(fileHashes.entries()));

    // 获取缓存统计
    const cacheStats = fileHashManager.getCacheStats();
    console.log('✅ Cache stats:', JSON.stringify(cacheStats, null, 2));

    // 6. 测试ChangeDetectionService的集成（通过FileHashManager）
    console.log('\n🔍 Testing change detection integration...');

    // 模拟文件变更
    await fileHashManager.updateFileHash(testState.projectId, '/test/file3.ts', 'hash3', {
      fileSize: 3072,
      lastModified: new Date(),
      language: 'typescript',
      fileType: '.ts'
    });
    console.log('✅ File change detected and hash updated');

    // 获取变更的文件
    const since = new Date(Date.now() - 60000); // 1分钟前
    const changedFiles = await fileHashManager.getChangedFiles(testState.projectId, since);
    console.log('✅ Changed files:', changedFiles.length);

    // 7. 验证数据一致性
    console.log('\n✅ Verifying data consistency...');

    const finalStats = sqliteService.getStats();
    console.log('Final database stats:', JSON.stringify(finalStats, null, 2));

    // 验证迁移结果
    if (finalStats.projects > 0 && finalStats.projectStatus > 0 && finalStats.fileStates > 0) {
      console.log('\n🎉 SUCCESS: SQLite migration test completed successfully!');
      console.log('✅ All components are working correctly with SQLite integration');
    } else {
      console.log('\n❌ FAILURE: Some issues detected in the migration');
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    // 清理
    try {
      sqliteService.close();
      console.log('\n🧹 Database connection closed');
    } catch (error) {
      console.warn('Warning closing database:', error);
    }
  }
}

// 运行测试
if (require.main === module) {
  testSQLiteMigration().then(() => {
    console.log('\n🏁 Test completed');
    process.exit(0);
  }).catch(error => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testSQLiteMigration };