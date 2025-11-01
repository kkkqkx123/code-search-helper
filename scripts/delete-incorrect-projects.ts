import Database from 'better-sqlite3';
import path from 'path';

async function deleteIncorrectProjects() {
  console.log('开始删除错误的项目映射...');
  
  // 直接使用better-sqlite3连接数据库
  const dbPath = path.join(process.cwd(), 'data', 'code-search-helper.db');
  const db = new Database(dbPath);
  console.log('数据库连接成功');
  
  try {
    console.log('数据库连接成功');
    
    // 要删除的项目ID
    const projectIds = ['86b62e2ebce0231b', 'd44e2ff16a046d3b'];
    
    // 首先查询这些项目是否存在
    for (const projectId of projectIds) {
      console.log(`\n检查项目 ${projectId} 是否存在...`);
      
      // 检查projects表
      const projectQuery = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
      if (projectQuery) {
        console.log(`在projects表中找到项目:`, projectQuery);
      } else {
        console.log(`在projects表中未找到项目 ${projectId}`);
      }
      
      // 检查project_status表
      const statusQuery = db.prepare('SELECT * FROM project_status WHERE project_id = ?').get(projectId) as any;
      if (statusQuery) {
        console.log(`在project_status表中找到项目状态:`, {
          project_id: statusQuery.project_id,
          indexing_progress: statusQuery.indexing_progress,
          total_files: statusQuery.total_files
        });
      } else {
        console.log(`在project_status表中未找到项目状态 ${projectId}`);
      }
      
      // 检查project_path_mapping表
      const mappingQuery = db.prepare('SELECT * FROM project_path_mapping WHERE hash = ?').get(projectId) as any;
      if (mappingQuery) {
        console.log(`在project_path_mapping表中找到映射:`, {
          hash: mappingQuery.hash,
          original_path: mappingQuery.original_path
        });
      } else {
        console.log(`在project_path_mapping表中未找到映射 ${projectId}`);
      }
    }
    
    // 开始删除操作
    console.log('\n开始删除操作...');
    
    for (const projectId of projectIds) {
      console.log(`\n删除项目 ${projectId}:`);
      
      // 删除project_status表中的记录
      try {
        const statusResult = db.prepare('DELETE FROM project_status WHERE project_id = ?').run(projectId);
        console.log(`  - 从project_status表删除了 ${statusResult.changes} 条记录`);
      } catch (error) {
        console.error(`  - 删除project_status记录失败:`, error);
      }
      
      // 删除project_path_mapping表中的记录
      try {
        const mappingResult = db.prepare('DELETE FROM project_path_mapping WHERE hash = ?').run(projectId);
        console.log(` - 从project_path_mapping表删除了 ${mappingResult.changes} 条记录`);
      } catch (error) {
        console.error(`  - 删除project_path_mapping记录失败:`, error);
      }
      
      // 删除projects表中的记录
      try {
        const projectResult = db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
        console.log(`  - 从projects表删除了 ${projectResult.changes} 条记录`);
      } catch (error) {
        console.error(`  - 删除projects记录失败:`, error);
      }
    }
    
    // 验证删除结果
    console.log('\n验证删除结果...');
    for (const projectId of projectIds) {
      console.log(`\n验证项目 ${projectId}:`);
      
      const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects WHERE id = ?').get(projectId) as { count: number };
      console.log(`  - projects表中剩余记录数: ${projectCount.count}`);
      
      const statusCount = db.prepare('SELECT COUNT(*) as count FROM project_status WHERE project_id = ?').get(projectId) as { count: number };
      console.log(`  - project_status表中剩余记录数: ${statusCount.count}`);
      
      const mappingCount = db.prepare('SELECT COUNT(*) as count FROM project_path_mapping WHERE hash = ?').get(projectId) as { count: number };
      console.log(`  - project_path_mapping表中剩余记录数: ${mappingCount.count}`);
    }
    
    console.log('\n项目删除操作完成！');
    
  } catch (error) {
    console.error('删除项目时发生错误:', error);
  } finally {
    // 关闭数据库连接
    db.close();
    console.log('数据库连接已关闭');
  }
}

// 运行删除操作
deleteIncorrectProjects().catch(console.error);