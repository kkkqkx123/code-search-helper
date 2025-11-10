import Database from 'better-sqlite3';
import path from 'path';

async function checkIncorrectProjectNames() {
  console.log('开始检查错误的项目名称映射...');
  
  // 直接使用better-sqlite3连接数据库
  const dbPath = path.join(process.cwd(), 'data', 'code-search-helper.db');
  const db = new Database(dbPath);
 console.log('数据库连接成功');
  
  // 要检查的项目ID（这些可能被错误地用作项目名称）
  const projectIds = ['86b62e2ebce0231b', 'd44e2ff16a046d3b'];
  
  for (const projectId of projectIds) {
    console.log(`\n检查项目名称为 ${projectId} 的记录...`);
    
    // 检查projects表中是否有name字段为projectId的记录
    const projectQuery = db.prepare('SELECT * FROM projects WHERE name = ?').all(projectId) as any[];
    if (projectQuery.length > 0) {
      console.log(`在projects表中找到 ${projectQuery.length} 条以 ${projectId} 为名称的记录:`);
      for (const proj of projectQuery) {
        console.log(`  - ID: ${proj.id}, Name: ${proj.name}, Path: ${proj.path}`);
      }
    } else {
      console.log(`在projects表中未找到以 ${projectId} 为名称的记录`);
    }
    
    // 检查unified_project_mapping表中是否有project_name字段为projectId的记录
    try {
      const unifiedMappingQuery = db.prepare('SELECT * FROM unified_project_mapping WHERE project_name = ?').all(projectId) as any[];
      if (unifiedMappingQuery.length > 0) {
        console.log(`在unified_project_mapping表中找到 ${unifiedMappingQuery.length} 条以 ${projectId} 为项目名称的记录:`);
        for (const mapping of unifiedMappingQuery) {
          console.log(`  - Project ID: ${mapping.project_id}, Project Name: ${mapping.project_name}, Path: ${mapping.project_path}`);
        }
      } else {
        console.log(`在unified_project_mapping表中未找到以 ${projectId} 为项目名称的记录`);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.log(`unified_project_mapping表不存在或查询失败:`, error.message);
      } else {
        console.log(`unified_project_mapping表不存在或查询失败:`, String(error));
      }
    }
  }
  
  // 同时检查projects表中所有记录，看看是否包含这些ID作为name
  console.log('\n检查projects表中的所有相关记录...');
  const allProjects = db.prepare('SELECT * FROM projects').all() as any[];
  const matchingProjects = allProjects.filter(proj => 
    projectIds.includes(proj.name) || projectIds.some(id => proj.id.includes(id) || proj.name.includes(id))
  );
  
  if (matchingProjects.length > 0) {
    console.log(`找到 ${matchingProjects.length} 条相关记录:`);
    for (const proj of matchingProjects) {
      console.log(`  - ID: ${proj.id}, Name: ${proj.name}, Path: ${proj.path}`);
    }
 } else {
    console.log('未找到任何相关的项目记录');
  }
  
  // 检查unified_project_mapping表
  console.log('\n检查unified_project_mapping表...');
  for (const projectId of projectIds) {
    const mappingQuery = db.prepare('SELECT * FROM unified_project_mapping WHERE project_id = ? OR project_path LIKE ?').all(projectId, `%${projectId}%`) as any[];
    if (mappingQuery.length > 0) {
      console.log(`在unified_project_mapping表中找到 ${mappingQuery.length} 条相关记录:`);
      for (const mapping of mappingQuery) {
        console.log(`  - Project ID: ${mapping.project_id}, Project Path: ${mapping.project_path}`);
      }
    } else {
      console.log(`在unified_project_mapping表中未找到与 ${projectId} 相关的记录`);
    }
  }
  
  console.log('\n检查完成！');
  
  // 关闭数据库连接
 db.close();
  console.log('数据库连接已关闭');
}

// 运行检查操作
checkIncorrectProjectNames().catch(console.error);