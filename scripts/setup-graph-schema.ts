import { NebulaService } from '../src/database/nebula/NebulaService';
import { Container } from 'inversify';
import { DatabaseServiceRegistrar } from '../src/core/registrars/DatabaseServiceRegistrar';
import { TYPES } from '../src/types';

async function setupGraphSchema() {
  const container = new Container();
  DatabaseServiceRegistrar.register(container);

  try {
    const nebulaService = container.get<NebulaService>(TYPES.NebulaService);
    
    // 初始化 Nebula 服务
    const initialized = await nebulaService.initialize();
    if (!initialized) {
      console.error('Failed to initialize Nebula service');
      return;
    }

    console.log('Creating graph schema...');

    // 创建标签 (Tags)
    const tagQueries = [
      'CREATE TAG IF NOT EXISTS File(name string, path string, language string, line_count int)',
      'CREATE TAG IF NOT EXISTS Class(name string, file_path string, start_line int, end_line int, method_count int, property_count int)',
      'CREATE TAG IF NOT EXISTS Function(name string, file_path string, start_line int, end_line int, signature string, cyclomatic_complexity int, is_method bool)',
      'CREATE TAG IF NOT EXISTS Interface(name string, file_path string, start_line int, end_line int)',
      'CREATE TAG IF NOT EXISTS Import(source string, specifiers string, file_path string)',
      'CREATE TAG IF NOT EXISTS Export(name string, file_path string)'
    ];

    // 创建边类型 (Edge Types)
    const edgeQueries = [
      'CREATE EDGE IF NOT EXISTS CONTAINS(line_number int)',
      'CREATE EDGE IF NOT EXISTS IMPORTS_FROM(line_number int)',
      'CREATE EDGE IF NOT EXISTS CALLS(line_number int)',
      'CREATE EDGE IF NOT EXISTS INHERITS_FROM(line_number int)',
      'CREATE EDGE IF NOT EXISTS IMPLEMENTS(line_number int)'
    ];

    // 执行标签创建查询
    for (const query of tagQueries) {
      try {
        await nebulaService.executeWriteQuery(query);
        console.log(`Executed: ${query}`);
      } catch (error) {
        console.warn(`Warning executing tag query: ${query}`, error);
        // 继续执行其他查询
      }
    }

    // 执行边类型创建查询
    for (const query of edgeQueries) {
      try {
        await nebulaService.executeWriteQuery(query);
        console.log(`Executed: ${query}`);
      } catch (error) {
        console.warn(`Warning executing edge query: ${query}`, error);
        // 继续执行其他查询
      }
    }

    console.log('Graph schema setup completed successfully!');
  } catch (error) {
    console.error('Error setting up graph schema:', error);
  } finally {
    // 关闭连接
    try {
      const nebulaService = container.get<NebulaService>(TYPES.NebulaService);
      await nebulaService.close();
    } catch (error) {
      console.error('Error closing Nebula service:', error);
    }
 }
}

// 运行脚本
if (require.main === module) {
  setupGraphSchema().catch(error => {
    console.error('Unhandled error in setup-graph-schema:', error);
    process.exit(1);
  });
}

export { setupGraphSchema };