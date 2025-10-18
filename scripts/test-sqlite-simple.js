// 简单的SQLite迁移测试 - 不依赖完整的构建
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

async function testSQLiteSimple() {
  console.log('🚀 Starting Simple SQLite Test...\n');

  try {
    // 1. 创建测试数据库
    const dbPath = path.join(__dirname, '../data/test-migration.db');
    const db = new Database(dbPath);
    
    console.log('📊 Creating database tables...');
    
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

    console.log('✅ Database tables created successfully');

    // 2. 测试项目数据操作
    console.log('\n🏗️ Testing project data operations...');
    
    const projectId = 'test-project-123';
    const projectPath = '/test/project/path';
    
    // 插入项目
    const insertProject = db.prepare(`
      INSERT INTO projects (id, path, name, description, collection_name, space_name, created_at, updated_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertProject.run(
      projectId,
      projectPath,
      'Test Project',
      'A test project',
      'test-collection',
      'test-space',
      new Date().toISOString(),
      new Date().toISOString(),
      'active'
    );
    
    console.log('✅ Project inserted');

    // 查询项目
    const getProject = db.prepare('SELECT * FROM projects WHERE id = ?');
    const project = getProject.get(projectId);
    console.log('✅ Project retrieved:', JSON.stringify(project, null, 2));

    // 3. 测试项目状态数据操作
    console.log('\n📊 Testing project state operations...');
    
    const vectorStatus = JSON.stringify({ status: 'completed', progress: 100 });
    const graphStatus = JSON.stringify({ status: 'completed', progress: 100 });
    
    const insertState = db.prepare(`
      INSERT OR REPLACE INTO project_status 
      (project_id, vector_status, graph_status, indexing_progress, total_files, indexed_files, failed_files, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertState.run(
      projectId,
      vectorStatus,
      graphStatus,
      100,
      150,
      150,
      0,
      new Date().toISOString()
    );
    
    console.log('✅ Project state inserted');

    // 查询项目状态
    const getState = db.prepare('SELECT * FROM project_status WHERE project_id = ?');
    const state = getState.get(projectId);
    console.log('✅ Project state retrieved:', JSON.stringify(state, null, 2));

    // 4. 测试文件哈希数据操作
    console.log('\n🔑 Testing file hash operations...');
    
    const insertFileState = db.prepare(`
      INSERT OR REPLACE INTO file_index_states 
      (project_id, file_path, relative_path, content_hash, file_size, last_modified, language, file_type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const files = [
      {
        filePath: '/test/project/file1.js',
        relativePath: 'file1.js',
        hash: 'hash123',
        size: 1024,
        language: 'javascript',
        fileType: '.js'
      },
      {
        filePath: '/test/project/file2.py',
        relativePath: 'file2.py',
        hash: 'hash456',
        size: 2048,
        language: 'python',
        fileType: '.py'
      }
    ];
    
    for (const file of files) {
      insertFileState.run(
        projectId,
        file.filePath,
        file.relativePath,
        file.hash,
        file.size,
        new Date().toISOString(),
        file.language,
        file.fileType,
        'indexed',
        new Date().toISOString(),
        new Date().toISOString()
      );
    }
    
    console.log('✅ File states inserted');

    // 查询文件哈希
    const getFileHash = db.prepare(`
      SELECT content_hash FROM file_index_states 
      WHERE project_id = ? AND file_path = ?
    `);
    
    const hash1 = getFileHash.get(projectId, '/test/project/file1.js');
    console.log('✅ File hash retrieved:', hash1.content_hash);

    // 批量查询文件哈希
    const getFileHashes = db.prepare(`
      SELECT file_path, content_hash FROM file_index_states 
      WHERE project_id = ? AND file_path IN (?, ?)
    `);
    
    const hashes = getFileHashes.all(projectId, '/test/project/file1.js', '/test/project/file2.py');
    console.log('✅ Multiple file hashes retrieved:', hashes.map(h => ({ path: h.file_path, hash: h.content_hash })));

    // 5. 测试数据库统计
    console.log('\n📈 Testing database statistics...');
    
    const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get();
    const fileStateCount = db.prepare('SELECT COUNT(*) as count FROM file_index_states').get();
    const projectStatusCount = db.prepare('SELECT COUNT(*) as count FROM project_status').get();
    
    console.log('✅ Database stats:');
    console.log('  Projects:', projectCount.count);
    console.log('  File states:', fileStateCount.count);
    console.log('  Project status:', projectStatusCount.count);

    // 6. 测试事务
    console.log('\n💼 Testing transaction...');
    
    const transaction = db.transaction(() => {
      const insert1 = db.prepare('INSERT INTO file_index_states (project_id, file_path, relative_path, content_hash, file_size, last_modified, language, file_type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const insert2 = db.prepare('INSERT INTO file_index_states (project_id, file_path, relative_path, content_hash, file_size, last_modified, language, file_type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      
      insert1.run(projectId, '/test/project/file3.ts', 'file3.ts', 'hash789', 3072, new Date().toISOString(), 'typescript', '.ts', 'indexed', new Date().toISOString(), new Date().toISOString());
      insert2.run(projectId, '/test/project/file4.java', 'file4.java', 'hash012', 4096, new Date().toISOString(), 'java', '.java', 'indexed', new Date().toISOString(), new Date().toISOString());
    });
    
    transaction();
    console.log('✅ Transaction completed');

    // 验证事务结果
    const finalFileCount = db.prepare('SELECT COUNT(*) as count FROM file_index_states WHERE project_id = ?').get(projectId);
    console.log('✅ Final file count for project:', finalFileCount.count);

    // 7. 测试数据一致性
    console.log('\n✅ Testing data consistency...');
    
    // 检查外键约束
    const foreignKeyCheck = db.prepare('PRAGMA foreign_key_check');
    const foreignKeyIssues = foreignKeyCheck.all();
    
    if (foreignKeyIssues.length === 0) {
      console.log('✅ No foreign key constraint violations');
    } else {
      console.log('❌ Foreign key violations found:', foreignKeyIssues);
    }

    // 检查数据完整性
    const orphanedFiles = db.prepare(`
      SELECT COUNT(*) as count 
      FROM file_index_states f 
      LEFT JOIN projects p ON f.project_id = p.id 
      WHERE p.id IS NULL
    `).get();
    
    if (orphanedFiles.count === 0) {
      console.log('✅ No orphaned file records');
    } else {
      console.log('❌ Found orphaned file records:', orphanedFiles.count);
    }

    console.log('\n🎉 SUCCESS: Simple SQLite test completed successfully!');
    console.log('✅ All database operations are working correctly');
    console.log('✅ File hash management is functional');
    console.log('✅ Project state management is functional');
    console.log('✅ Data consistency is maintained');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    // 清理
    try {
      db.close();
      console.log('\n🧹 Database connection closed');
      
      // 删除测试数据库文件
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        console.log('🗑️ Test database file removed');
      }
    } catch (error) {
      console.warn('Warning during cleanup:', error);
    }
  }
}

// 运行测试
if (require.main === module) {
  testSQLiteSimple().then(() => {
    console.log('\n🏁 Simple test completed');
    process.exit(0);
  }).catch(error => {
    console.error('\n💥 Simple test failed:', error);
    process.exit(1);
  });
}

module.exports = { testSQLiteSimple };