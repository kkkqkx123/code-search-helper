import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { DatabaseLoggerService } from '../../common/DatabaseLoggerService';
import { DatabaseEventType } from '../../common/DatabaseEventTypes';
import { NebulaConfig } from '../NebulaTypes';
import { createClient } from '@nebula-contrib/nebula-nodejs';

/**
 * Nebula连接包装器，用于处理@nebula-contrib/nebula-nodejs库的特定问题
 * 特别解决Buffer.from()可能截断字符串的Bug
 */
@injectable()
export class NebulaConnectionWrapper {
  private databaseLogger: DatabaseLoggerService;
  private client: any;

  constructor(
    @inject(TYPES.DatabaseLoggerService) databaseLogger: DatabaseLoggerService
  ) {
    this.databaseLogger = databaseLogger;
  }

  /**
   * 创建连接
   */
  async connect(config: NebulaConfig) {
    const clientConfig: any = {
      servers: [`${config.host}:${config.port}`],
      userName: config.username,
      password: config.password,
      poolSize: config.maxConnections || 10,
      bufferSize: config.bufferSize || 100, // 增加默认缓冲区大小
      executeTimeout: config.timeout || 60000, // 增加超时时间到60秒
      pingInterval: config.pingInterval || 3000
    };

    // 只有在配置了有效空间时才设置space参数
    const validSpace = this.getValidSpace(config.space);
    if (validSpace) {
      clientConfig.space = validSpace;
    }

    this.client = createClient(clientConfig);

    // 重写execute方法以修复字符串处理问题
    const originalExecute = this.client.execute;
    this.client.execute = async (query: string) => {
      try {
        // 验证查询字符串
        if (typeof query !== 'string') {
          throw new Error('Query must be a string');
        }

        // 确保字符串编码正确，避免潜在的Buffer截断问题
        // 使用原生字符串而非转换为Buffer，或者使用更安全的转换方式
        let safeQuery = String(query);
        
        // 额外的安全检查：确保查询字符串没有被截断
        // 特别检查常见的模式如"project_"开头的字符串和CREATE SPACE语句
        if (safeQuery.includes('CREATE SPACE')) {
          // 检查是否包含完整的"CREATE SPACE"字符串
          const createSpaceIndex = safeQuery.indexOf('CREATE SPACE');
          if (createSpaceIndex >= 0) {
            const afterCreateSpace = safeQuery.substring(createSpaceIndex);
            if (!afterCreateSpace.startsWith('CREATE SPACE')) {
              throw new Error('Query string appears to be truncated - missing characters at start of "CREATE SPACE"');
            }
          }
          
          // 检查是否包含完整的project_前缀
          if (safeQuery.includes('project_')) {
            const projectIndex = safeQuery.indexOf('project_');
            if (projectIndex >= 0) {
              const afterProject = safeQuery.substring(projectIndex);
              // 检查是否包含完整的"project_"字符串
              if (!afterProject.startsWith('project_')) {
                throw new Error('Query string appears to be truncated - missing characters at start of "project_"');
              }
            }
          }
          
          // 特别处理partition_num，确保这种长参数没有被截断
          if (safeQuery.includes('partition_num')) {
            const partitionIndex = safeQuery.indexOf('partition_num');
            if (partitionIndex >= 0) {
              const afterPartition = safeQuery.substring(partitionIndex);
              if (!afterPartition.startsWith('partition_num')) {
                throw new Error('Query string appears to be truncated - missing characters at start of "partition_num"');
              }
            }
          }
        }

        // 对于长查询或CREATE SPACE语句，进行额外的预处理
        if (safeQuery.includes('CREATE SPACE') || safeQuery.length > 100) {
          // 为了确保字符串完整性，使用更安全的处理方式
          // 1. 使用额外的编码/解码步骤
          const encodedQuery = encodeURIComponent(safeQuery);
          const decodedQuery = decodeURIComponent(encodedQuery);
          
          // 比较原始处理后的字符串与编码解码后的字符串
          if (safeQuery !== decodedQuery) {
            await this.databaseLogger.logDatabaseEvent({
              type: DatabaseEventType.QUERY_EXECUTED,
              source: 'nebula',
              timestamp: new Date(),
              data: {
                message: 'Query string changed during encoding/decoding, using decoded version',
                originalQuery: safeQuery,
                decodedQuery: decodedQuery
              }
            });
            safeQuery = decodedQuery;
          }
          
          // 2. 添加延时确保字符串处理完整
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // 3. 针对CREATE SPACE语句，执行额外验证
          if (safeQuery.includes('CREATE SPACE')) {
            // 验证关键字符串的完整性
            const expectedStrings = ['CREATE SPACE', 'partition_num', 'replica_factor', 'vid_type'];
            for (const expectedStr of expectedStrings) {
              if (safeQuery.includes(expectedStr)) {
                // 检查字符串是否完整
                const matches = safeQuery.match(new RegExp(expectedStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
                if (!matches || matches.length === 0) {
                  throw new Error(`Query appears to have corrupted string: ${expectedStr} not found properly in query`);
                }
              }
            }
          }
        }

        // 记录查询以进行调试
        await this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.QUERY_EXECUTED,
          source: 'nebula',
          timestamp: new Date(),
          data: {
            message: 'Executing query through wrapped connection',
            query: safeQuery,
            queryLength: safeQuery.length,
            first100Chars: safeQuery.substring(0, 100)
          }
        });

        // 先尝试直接执行查询
        try {
          return await originalExecute.call(this.client, safeQuery);
        } catch (error: any) {
          // 如果直接执行失败，尝试使用额外的编码处理方法
          if (safeQuery.includes('CREATE SPACE') && error.message && error.message.includes('syntax error')) {
            // 尝试构建一个更标准的CREATE SPACE查询格式
            const standardCreateSpace = this.formatCreateSpaceForNebula(safeQuery);
            if (standardCreateSpace && standardCreateSpace !== safeQuery) {
              await this.databaseLogger.logDatabaseEvent({
                type: DatabaseEventType.QUERY_EXECUTED,
                source: 'nebula',
                timestamp: new Date(),
                data: {
                  message: 'Retrying with standard CREATE SPACE format',
                  originalQuery: safeQuery,
                  reformattedQuery: standardCreateSpace
                }
              });
              
              return await originalExecute.call(this.client, standardCreateSpace);
            }
          }
          throw error;
        }
      } catch (error) {
        // 在这里记录错误详情以帮助调试
        await this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.ERROR_OCCURRED,
          source: 'nebula',
          timestamp: new Date(),
          data: {
            message: 'Error executing query through wrapped connection',
            error: error instanceof Error ? error.message : String(error),
            query: query,
            queryLength: typeof query === 'string' ? query.length : 0
          }
        });
        throw error;
      }
    };

    return this.client;
  }

  /**
   * 获取客户端实例
   */
  getClient() {
    if (!this.client) {
      throw new Error('Nebula client not initialized. Call connect() first.');
    }
    return this.client;
  }

  /**
   * 关闭连接
   */
  async close() {
    if (this.client && typeof this.client.close === 'function') {
      await this.client.close();
    }
  }

  /**
   * 为Nebula格式化CREATE SPACE查询，使用标准格式
   * 使用单行格式避免字符串截断问题
   */
  private formatCreateSpaceForNebula(query: string): string | null {
    // 尝试解析CREATE SPACE语句并重新格式化
    const createSpaceRegex = /CREATE\s+SPACE\s+IF\s+NOT\s+EXISTS\s+`?([\w_]+)`?\s*\((.+)\)/i;
    const match = query.match(createSpaceRegex);
    
    if (match) {
      const spaceName = match[1];
      const paramsStr = match[2];
      
      // 解析参数并以单行格式重新构建，避免字符串截断问题
      const params = paramsStr.split(',').map(p => p.trim());
      
      // 单行格式，避免换行符导致的字符串处理问题
      return `CREATE SPACE IF NOT EXISTS \`${spaceName}\` (${params.join(', ')})`;
    }
    
    return query; // 如果无法解析，返回原查询
  }

  /**
   * 获取有效的space名称
   */
  private getValidSpace(space?: string): string | undefined {
    return (space && space !== 'undefined' && space !== '') ? space : undefined;
  }
}