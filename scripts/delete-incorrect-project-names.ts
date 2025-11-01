import Database from 'better-sqlite3';
import path from 'path';

async function deleteIncorrectProjectNames() {
  console.log('开始删除错误的项目名称映射...');
  
  // 直接使用better-sqlite3连接数据库
  const dbPath = path.join(process.cwd(), 'data', 'code-search-helper.db');
  const db = new Database(dbPath);
  console.log('数据库连接成功');
  
   // 要删除的错误项目名称（这些是应该作为ID的值，但被错误地用作名称）
   const incorrectProjectNames = ['86b62e2ebce0231b', 'd44e2ff16a046d3b'];
  
  for (const incorrectName of incorrectProjectNames) {
    console.log(`\n删除项目名称为 ${incorrectName} 的错误记录...`);
    
    // 首先查询要删除的记录
    const projectQuery = db.prepare('SELECT * FROM projects WHERE name = ?').all(incorrectName) as any[];
    if (projectQuery.length > 0) {
      console.log(`将删除 ${projectQuery.length} 条projects表记录:`);
      for (const proj of projectQuery) {
        console.log(`  - ID: ${proj.id}, Name: ${proj.name}, Path: ${proj.path}`);
      }
      
      // 删除projects表中的记录
      const deleteProjectResult = db.prepare('DELETE FROM projects WHERE name = ?').run(incorrectName);
      console.log(`  - 从projects表删除了 ${deleteProjectResult.changes} 条记录`);
      
      // 同时删除相关的project_status表记录（使用项目的真实ID作为project_id）
      for (const proj of projectQuery) {
        const deleteStatusResult = db.prepare('DELETE FROM project_status WHERE project_id = ?').run(proj.id);
        console.log(`  - 从project_status表删除了 ${deleteStatusResult.changes} 条相关记录 (基于项目真实ID: ${proj.id})`);
      }
    } else {
      console.log(`在projects表中未找到以 ${incorrectName} 为名称的记录`);
    }
  }
  
  // 额外检查并删除可能的project_path_mapping表中的错误记录
  for (const incorrectName of incorrectProjectNames) {
    const mappingQuery = db.prepare('SELECT * FROM project_path_mapping WHERE hash = ? OR original_path LIKE ?').all(incorrectName, `%${incorrectName}%`) as any[];
    if (mappingQuery.length > 0) {
      console.log(`\n删除project_path_mapping表中的 ${mappingQuery.length} 条相关记录:`);
      for (const mapping of mappingQuery) {
        console.log(`  - Hash: ${mapping.hash}, Original Path: ${mapping.original_path}`);
      }
      
      // 删除project_path_mapping表中的记录
      const deleteMappingResult = db.prepare('DELETE FROM project_path_mapping WHERE hash = ?').run(incorrectName);
      console.log(`  - 从project_path_mapping表删除了 ${deleteMappingResult.changes} 条记录`);
    }
  }
  
 // 验证删除结果
  console.log('\n验证删除结果...');
  for (const incorrectName of incorrectProjectNames) {
    const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects WHERE name = ?').get(incorrectName) as { count: number };
    console.log(`  - projects表中以 ${incorrectName} 为名称的剩余记录数: ${projectCount.count}`);
  }
  
  console.log('\n错误的项目名称映射删除操作完成！');
  
  // 关闭数据库连接
 db.close();
  console.log('数据库连接已关闭');
}

// 运行删除操作
deleteIncorrectProjectNames().catch(console.error);