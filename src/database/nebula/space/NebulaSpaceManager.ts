import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { DatabaseLoggerService } from '../../common/DatabaseLoggerService';
import { DatabaseEventType } from '../../common/DatabaseEventTypes';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { NebulaSpaceInfo } from '../NebulaTypes';
import { INebulaConnectionManager } from '../NebulaConnectionManager';
import { INebulaQueryBuilder } from '../NebulaQueryBuilder';

export interface INebulaSpaceManager {
  createSpace(projectId: string, config?: any): Promise<boolean>;
  deleteSpace(projectId: string): Promise<boolean>;
  listSpaces(): Promise<string[]>;
  getSpaceInfo(projectId: string): Promise<NebulaSpaceInfo | null>;
  checkSpaceExists(projectId: string): Promise<boolean>;
  clearSpace(projectId: string): Promise<boolean>;
}

export interface GraphConfig {
  partitionNum?: number;
  replicaFactor?: number;
  vidType?: string;
}

@injectable()
export class NebulaSpaceManager implements INebulaSpaceManager {
  private nebulaConnection: INebulaConnectionManager;
  private nebulaQueryBuilder: INebulaQueryBuilder;
  private databaseLogger: DatabaseLoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;

  constructor(
    @inject(TYPES.INebulaConnectionManager) nebulaConnection: INebulaConnectionManager,
    @inject(TYPES.INebulaQueryBuilder) nebulaQueryBuilder: INebulaQueryBuilder,
    @inject(TYPES.DatabaseLoggerService) databaseLogger: DatabaseLoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService
  ) {
    this.nebulaConnection = nebulaConnection;
    this.nebulaQueryBuilder = nebulaQueryBuilder;
    this.databaseLogger = databaseLogger;
    this.errorHandler = errorHandler;
    this.configService = configService;
  }

  private generateSpaceName(projectId: string): string {
    return `project_${projectId}`;
  }

  async createSpace(projectId: string, config: GraphConfig = {}): Promise<boolean> {
    const spaceName = this.generateSpaceName(projectId);
    try {
      // 创建空间
      const createQuery = `
        CREATE SPACE IF NOT EXISTS \`${spaceName}\` (
          partition_num = ${config.partitionNum || 10},
          replica_factor = ${config.replicaFactor || 1},
          vid_type = ${config.vidType || '"FIXED_STRING(32)"'}
        )
      `;

      await this.nebulaConnection.executeQuery(createQuery);

      // 等待空间创建完成
      await this.waitForSpaceReady(spaceName);

      // 使用空间
      await this.nebulaConnection.executeQuery(`USE \`${spaceName}\``);

      // 创建图结构
      await this.createGraphSchema();

      // 使用 DatabaseLoggerService 记录空间创建成功信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.SPACE_CREATED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: `Successfully created space ${spaceName} for project ${projectId}` }
      }).catch(error => {
        // 如果日志记录失败，我们不希望影响主流程
        console.error('Failed to log space creation success:', error);
      });
      return true;
    } catch (error) {
      // 使用 DatabaseLoggerService 记录空间创建失败信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.ERROR_OCCURRED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: `Failed to create space ${spaceName}:`,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      }).catch(error => {
        // 如果日志记录失败，我们不希望影响主流程
        console.error('Failed to log space creation failure:', error);
      });
      return false;
    }
  }

  async deleteSpace(projectId: string): Promise<boolean> {
    const spaceName = this.generateSpaceName(projectId);
    try {
      await this.nebulaConnection.executeQuery(`DROP SPACE IF EXISTS \`${spaceName}\``);
      // 使用 DatabaseLoggerService 记录空间删除成功信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.SPACE_DELETED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: `Successfully deleted space ${spaceName} for project ${projectId}` }
      }).catch(error => {
        // 如果日志记录失败，我们不希望影响主流程
        console.error('Failed to log space deletion success:', error);
      });
      return true;
    } catch (error) {
      // 使用 DatabaseLoggerService 记录空间删除失败信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.ERROR_OCCURRED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: `Failed to delete space ${spaceName}:`,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      }).catch(error => {
        // 如果日志记录失败，我们不希望影响主流程
        console.error('Failed to log space deletion failure:', error);
      });
      return false;
    }
  }

  async listSpaces(): Promise<string[]> {
    try {
      const result = await this.nebulaConnection.executeQuery('SHOW SPACES');

      // 更健壮的结果格式检查
      if (!result) {
        // 使用 DatabaseLoggerService 记录 SHOW SPACES 返回空结果的警告
        this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.WARNING,
          source: 'nebula',
          timestamp: new Date(),
          data: { message: 'SHOW SPACES returned null result' }
        }).catch(error => {
          // 如果日志记录失败，我们不希望影响主流程
          console.error('Failed to log SHOW SPACES null result warning:', error);
        });
        return [];
      }

      // 处理不同的返回格式
      let data = result.data;
      if (!data) {
        // 尝试其他可能的格式
        data = result.table || result.results || result.rows || [];
      }

      if (!Array.isArray(data)) {
        // 使用 DatabaseLoggerService 记录 SHOW SPACES 返回非数组数据的警告
        this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.WARNING,
          source: 'nebula',
          timestamp: new Date(),
          data: {
            message: 'SHOW SPACES returned non-array data:',
            resultType: typeof data,
            result: JSON.stringify(data).substring(0, 200)
          }
        }).catch(error => {
          // 如果日志记录失败，我们不希望影响主流程
          console.error('Failed to log SHOW SPACES non-array data warning:', error);
        });
        return [];
      }

      // 提取空间名称
      const spaceNames = data.map((row: any, index: number) => {
        try {
          // 处理多种可能的列名格式
          const name = row.Name || row.name || row.NAME || row.space_name || row.SpaceName;
          if (name && typeof name === 'string') return name.trim();

          // 如果没有找到标准列名，尝试获取第一个字符串属性
          const keys = Object.keys(row);
          for (const key of keys) {
            const value = row[key];
            if (typeof value === 'string' && value.length > 0 && value.length < 100) {
              // 过滤掉过长的字符串，可能是错误数据
              return value.trim();
            }
          }

          // 如果仍然没有找到合适的值，记录调试信息
          // 使用 DatabaseLoggerService 记录未找到有效空间名称的调试信息
          this.databaseLogger.logDatabaseEvent({
            type: DatabaseEventType.DEBUG,
            source: 'nebula',
            timestamp: new Date(),
            data: { message: `No valid space name found in row ${index}:`, row }
          }).catch(error => {
            // 如果日志记录失败，我们不希望影响主流程
            console.error('Failed to log no valid space name debug:', error);
          });
          return '';
        } catch (rowError) {
          // 使用 DatabaseLoggerService 记录处理 SHOW SPACES 结果行时出现错误的警告
          this.databaseLogger.logDatabaseEvent({
            type: DatabaseEventType.WARNING,
            source: 'nebula',
            timestamp: new Date(),
            data: { message: `Error processing row ${index} in SHOW SPACES result:`, rowError }
          }).catch(error => {
            // 如果日志记录失败，我们不希望影响主流程
            console.error('Failed to log row processing error warning:', error);
          });
          return '';
        }
      }).filter((name: string) => name && name.length > 0);

      // 验证结果
      if (spaceNames.length === 0) {
        // 使用 DatabaseLoggerService 记录未找到有效空间名称的警告
        this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.WARNING,
          source: 'nebula',
          timestamp: new Date(),
          data: { message: 'No valid space names found in SHOW SPACES result' }
        }).catch(error => {
          // 如果日志记录失败，我们不希望影响主流程
          console.error('Failed to log no valid space names warning:', error);
        });
      } else {
        // 使用 DatabaseLoggerService 记录找到的空间数量的调试信息
        this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.DEBUG,
          source: 'nebula',
          timestamp: new Date(),
          data: { message: `Found ${spaceNames.length} spaces:`, spaceNames }
        }).catch(error => {
          // 如果日志记录失败，我们不希望影响主流程
          console.error('Failed to log found spaces debug:', error);
        });
      }

      return spaceNames;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // 使用 DatabaseLoggerService 记录列出空间失败的错误信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.ERROR_OCCURRED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Failed to list spaces:',
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        }
      }).catch(error => {
        // 如果日志记录失败，我们不希望影响主流程
        console.error('Failed to log list spaces failure:', error);
      });

      // 返回空数组而不是抛出异常，让调用者能够继续处理
      return [];
    }
  }

  async getSpaceInfo(projectId: string): Promise<NebulaSpaceInfo | null> {
    const spaceName = this.generateSpaceName(projectId);
    try {
      const result = await this.nebulaConnection.executeQuery(`DESCRIBE SPACE \`${spaceName}\``);

      // 更健壮的结果验证
      if (!result) {
        // 使用 DatabaseLoggerService 记录 DESCRIBE SPACE 返回空结果的警告
        this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.WARNING,
          source: 'nebula',
          timestamp: new Date(),
          data: { message: `DESCRIBE SPACE ${spaceName} returned null result` }
        }).catch(error => {
          // 如果日志记录失败，我们不希望影响主流程
          console.error('Failed to log DESCRIBE SPACE null result warning:', error);
        });
        return null;
      }

      // 处理不同的返回格式
      let data = result.data || result.table || result.results || result.rows || [];

      if (!Array.isArray(data) || data.length === 0) {
        // 使用 DatabaseLoggerService 记录未找到空间信息的调试信息
        this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.DEBUG,
          source: 'nebula',
          timestamp: new Date(),
          data: { message: `No space info found for ${spaceName}` }
        }).catch(error => {
          // 如果日志记录失败，我们不希望影响主流程
          console.error('Failed to log no space info debug:', error);
        });
        return null;
      }

      const spaceInfo = data[0];

      // 验证返回的数据结构
      if (!spaceInfo || typeof spaceInfo !== 'object') {
        // 使用 DatabaseLoggerService 记录无效空间信息格式的警告
        this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.SPACE_ERROR,
          source: 'nebula',
          timestamp: new Date(),
          data: { message: `Invalid space info format for ${spaceName}:`, spaceInfo }
        }).catch(error => {
          // 如果日志记录失败，我们不希望影响主流程
          console.error('Failed to log invalid space info format warning:', error);
        });
        return null;
      }

      // 创建标准化的SpaceInfo对象
      const normalizedInfo: NebulaSpaceInfo = {
        name: spaceName,
        partition_num: parseInt(spaceInfo.partition_num || spaceInfo.PartitionNum || spaceInfo.partitionNum || '10') || 10,
        replica_factor: parseInt(spaceInfo.replica_factor || spaceInfo.ReplicaFactor || spaceInfo.replicaFactor || '1') || 1,
        vid_type: spaceInfo.vid_type || spaceInfo.VidType || spaceInfo.vidType || 'FIXED_STRING(32)',
        charset: spaceInfo.charset || spaceInfo.Charset || 'utf8',
        collate: spaceInfo.collate || spaceInfo.Collate || 'utf8_bin'
      };

      // 使用 DatabaseLoggerService 记录检索到的空间信息的调试信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.SERVICE_INITIALIZED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: `Retrieved space info for ${spaceName}:`, normalizedInfo }
      }).catch(error => {
        // 如果日志记录失败，我们不希望影响主流程
        console.error('Failed to log retrieved space info debug:', error);
      });
      return normalizedInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // 使用 DatabaseLoggerService 记录获取空间信息失败的错误信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.ERROR_OCCURRED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: `Failed to get space info for ${spaceName}:`,
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        }
      }).catch(error => {
        // 如果日志记录失败，我们不希望影响主流程
        console.error('Failed to log get space info failure:', error);
      });
      return null;
    }
  }

  async checkSpaceExists(projectId: string): Promise<boolean> {
    const spaceName = this.generateSpaceName(projectId);
    try {
      const spaces = await this.listSpaces();
      const exists = spaces.includes(spaceName);
      // 使用 DatabaseLoggerService 记录空间存在性检查的调试信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.SERVICE_INITIALIZED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: `Space ${spaceName} exists: ${exists}` }
      }).catch(error => {
        // 如果日志记录失败，我们不希望影响主流程
        console.error('Failed to log space exists debug:', error);
      });
      return exists;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // 使用 DatabaseLoggerService 记录检查空间存在性失败的错误信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.ERROR_OCCURRED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: `Failed to check if space ${spaceName} exists:`,
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        }
      }).catch(error => {
        // 如果日志记录失败，我们不希望影响主流程
        console.error('Failed to log check space exists failure:', error);
      });
      return false;
    }
  }

  private async waitForSpaceReady(
    spaceName: string,
    maxRetries: number = 30,
    retryDelay: number = 1000
  ): Promise<void> {
    // 使用 DatabaseLoggerService 记录等待空间准备就绪的信息
    this.databaseLogger.logDatabaseEvent({
      type: DatabaseEventType.SERVICE_STARTED,
      source: 'nebula',
      timestamp: new Date(),
      data: { message: `Waiting for space ${spaceName} to be ready...` }
    }).catch(error => {
      // 如果日志记录失败，我们不希望影响主流程
      console.error('Failed to log waiting for space ready info:', error);
    });

    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await this.nebulaConnection.executeQuery(`DESCRIBE SPACE \`${spaceName}\``);

        // 更健壮的结果检查
        if (result) {
          const data = result.data || result.table || result.results || result.rows || [];
          if (Array.isArray(data) && data.length > 0) {
            // 使用 DatabaseLoggerService 记录空间准备就绪的信息
            this.databaseLogger.logDatabaseEvent({
              type: DatabaseEventType.INFO,
              source: 'nebula',
              timestamp: new Date(),
              data: { message: `Space ${spaceName} is ready after ${i + 1} attempts` }
            }).catch(error => {
              // 如果日志记录失败，我们不希望影响主流程
              console.error('Failed to log space ready info:', error);
            });
            return;
          }
        }

        // 如果还没有准备好，记录调试信息
        if (i % 5 === 0) { // 每5次尝试记录一次
          // 使用 DatabaseLoggerService 记录空间尚未准备就绪的调试信息
          this.databaseLogger.logDatabaseEvent({
            type: DatabaseEventType.DEBUG,
            source: 'nebula',
            timestamp: new Date(),
            data: { message: `Space ${spaceName} not ready yet, attempt ${i + 1}/${maxRetries}` }
          }).catch(error => {
            // 如果日志记录失败，我们不希望影响主流程
            console.error('Failed to log space not ready debug:', error);
          });
        }
      } catch (error) {
        // Space not ready yet, continue waiting
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (i % 5 === 0) { // 每5次尝试记录一次
          // 使用 DatabaseLoggerService 记录空间尚未准备就绪（带错误信息）的调试信息
          this.databaseLogger.logDatabaseEvent({
            type: DatabaseEventType.DEBUG,
            source: 'nebula',
            timestamp: new Date(),
            data: { message: `Space ${spaceName} not ready yet (error: ${errorMessage}), attempt ${i + 1}/${maxRetries}` }
          }).catch(error => {
            // 如果日志记录失败，我们不希望影响主流程
            console.error('Failed to log space not ready with error debug:', error);
          });
        }
      }

      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }

    throw new Error(`Space ${spaceName} did not become ready within ${maxRetries} retries`);
  }

  private async createGraphSchema(): Promise<void> {
    try {
      // 创建标签（Tags）
      const tagQueries = [
        'CREATE TAG IF NOT EXISTS Project(id string, name string, createdAt string, updatedAt string)',
        'CREATE TAG IF NOT EXISTS File(id string, path string, relativePath string, name string, language string, size int, hash string, linesOfCode int, functions int, classes int, lastModified string, updatedAt string)',
        'CREATE TAG IF NOT EXISTS Function(id string, name string, content string, startLine int, endLine int, complexity int, parameters string, returnType string, language string, updatedAt string)',
        'CREATE TAG IF NOT EXISTS Class(id string, name string, content string, startLine int, endLine int, methods int, properties int, inheritance string, language string, updatedAt string)',
        'CREATE TAG IF NOT EXISTS Import(id string, module string, updatedAt string)',
      ];

      for (const query of tagQueries) {
        await this.nebulaConnection.executeQuery(query);
      }

      // 创建边类型（Edge Types）
      const edgeQueries = [
        'CREATE EDGE IF NOT EXISTS BELONGS_TO()',
        'CREATE EDGE IF NOT EXISTS CONTAINS()',
        'CREATE EDGE IF NOT EXISTS IMPORTS()',
        'CREATE EDGE IF NOT EXISTS CALLS()',
        'CREATE EDGE IF NOT EXISTS EXTENDS()',
        'CREATE EDGE IF NOT EXISTS IMPLEMENTS()',
      ];

      for (const query of edgeQueries) {
        await this.nebulaConnection.executeQuery(query);
      }

      // 创建标签索引（Tag Indexes）- 确保查询性能
      const tagIndexQueries = [
        'CREATE TAG INDEX IF NOT EXISTS project_id_index ON Project(id(64))',
        'CREATE TAG INDEX IF NOT EXISTS project_name_index ON Project(name)',
        'CREATE TAG INDEX IF NOT EXISTS file_id_index ON File(id(64))',
        'CREATE TAG INDEX IF NOT EXISTS file_path_index ON File(path)',
        'CREATE TAG INDEX IF NOT EXISTS file_name_index ON File(name)',
        'CREATE TAG INDEX IF NOT EXISTS file_language_index ON File(language)',
        'CREATE TAG INDEX IF NOT EXISTS function_id_index ON Function(id(64))',
        'CREATE TAG INDEX IF NOT EXISTS function_name_index ON Function(name)',
        'CREATE TAG INDEX IF NOT EXISTS function_language_index ON Function(language)',
        'CREATE TAG INDEX IF NOT EXISTS class_id_index ON Class(id(64))',
        'CREATE TAG INDEX IF NOT EXISTS class_name_index ON Class(name)',
        'CREATE TAG INDEX IF NOT EXISTS class_language_index ON Class(language)',
        'CREATE TAG INDEX IF NOT EXISTS import_id_index ON Import(id(64))',
        'CREATE TAG INDEX IF NOT EXISTS import_module_index ON Import(module)',
      ];

      for (const query of tagIndexQueries) {
        await this.createIndexWithRetry(query);
      }

      // 创建边索引（Edge Indexes）- 确保关系查询性能
      const edgeIndexQueries = [
        'CREATE EDGE INDEX IF NOT EXISTS belongs_to_index ON BELONGS_TO()',
        'CREATE EDGE INDEX IF NOT EXISTS contains_index ON CONTAINS()',
        'CREATE EDGE INDEX IF NOT EXISTS imports_index ON IMPORTS()',
        'CREATE EDGE INDEX IF NOT EXISTS calls_index ON CALLS()',
        'CREATE EDGE INDEX IF NOT EXISTS extends_index ON EXTENDS()',
        'CREATE EDGE INDEX IF NOT EXISTS implements_index ON IMPLEMENTS()',
      ];

      for (const query of edgeIndexQueries) {
        await this.createIndexWithRetry(query);
      }

      // 使用 DatabaseLoggerService 记录图结构和索引创建成功的消息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.INFO,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: 'Graph schema and indexes created successfully' }
      }).catch(error => {
        // 如果日志记录失败，我们不希望影响主流程
        console.error('Failed to log graph schema creation success:', error);
      });
    } catch (error) {
      // 使用 DatabaseLoggerService 记录图结构创建失败的错误信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.ERROR_OCCURRED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Failed to create graph schema:',
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      }).catch(error => {
        // 如果日志记录失败，我们不希望影响主流程
        console.error('Failed to log graph schema creation failure:', error);
      });
      throw error;
    }
  }

  /**
   * 创建索引并带有重试机制
   */
  private async createIndexWithRetry(indexQuery: string, maxRetries: number = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.nebulaConnection.executeQuery(indexQuery);
        // 使用 DatabaseLoggerService 记录索引创建成功的调试信息
        this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.DEBUG,
          source: 'nebula',
          timestamp: new Date(),
          data: { message: `Successfully created index: ${indexQuery}` }
        }).catch(error => {
          // 如果日志记录失败，我们不希望影响主流程
          console.error('Failed to log index creation success:', error);
        });
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // 检查是否是"已存在"错误
        if (errorMessage.includes('already exists') || errorMessage.includes('existed')) {
          // 使用 DatabaseLoggerService 记录索引已存在的调试信息
          this.databaseLogger.logDatabaseEvent({
            type: DatabaseEventType.DEBUG,
            source: 'nebula',
            timestamp: new Date(),
            data: { message: `Index already exists: ${indexQuery}` }
          }).catch(error => {
            // 如果日志记录失败，我们不希望影响主流程
            console.error('Failed to log index already exists debug:', error);
          });
          return;
        }

        if (attempt === maxRetries) {
          // 使用 DatabaseLoggerService 记录索引创建失败的错误信息
          this.databaseLogger.logDatabaseEvent({
            type: DatabaseEventType.ERROR_OCCURRED,
            source: 'nebula',
            timestamp: new Date(),
            data: {
              message: `Failed to create index after ${maxRetries} attempts: ${indexQuery}`,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined
            }
          }).catch(error => {
            // 如果日志记录失败，我们不希望影响主流程
            console.error('Failed to log index creation failure:', error);
          });
          throw new Error(`Failed to create index: ${indexQuery}. Error: ${errorMessage}`);
        }

        // 使用 DatabaseLoggerService 记录索引创建重试的警告信息
        this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.WARNING,
          source: 'nebula',
          timestamp: new Date(),
          data: {
            message: `Attempt ${attempt} failed to create index: ${indexQuery}. Retrying...`,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          }
        }).catch(error => {
          // 如果日志记录失败，我们不希望影响主流程
          console.error('Failed to log index creation retry warning:', error);
        });
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  async clearSpace(projectId: string): Promise<boolean> {
    const spaceName = this.generateSpaceName(projectId);
    try {
      // 使用 DatabaseLoggerService 记录开始清理空间的信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.INFO,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: `Starting to clear space ${spaceName} for project ${projectId}` }
      }).catch(error => {
        // 如果日志记录失败，我们不希望影响主流程
        console.error('Failed to log starting to clear space info:', error);
      });

      // 首先，切换到空间
      await this.nebulaConnection.executeQuery(`USE \`${spaceName}\``);

      // 获取空间中的所有标签
      const tagsResult = await this.nebulaConnection.executeQuery('SHOW TAGS');
      const tagsData = tagsResult?.data || tagsResult?.table || tagsResult?.results || [];
      const tags = Array.isArray(tagsData)
        ? tagsData.map((row: any) => row.Name || row.name || row.NAME || row.tag_name).filter(Boolean)
        : [];

      // 使用 DatabaseLoggerService 记录在空间中找到的标签数量的调试信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.SERVICE_INITIALIZED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: `Found ${tags.length} tags in space ${spaceName}:`, tags }
      }).catch(error => {
        // 如果日志记录失败，我们不希望影响主流程
        console.error('Failed to log found tags debug:', error);
      });

      // 获取所有边类型
      const edgesResult = await this.nebulaConnection.executeQuery('SHOW EDGES');
      const edgesData = edgesResult?.data || edgesResult?.table || edgesResult?.results || [];
      const edges = Array.isArray(edgesData)
        ? edgesData.map((row: any) => row.Name || row.name || row.NAME || row.edge_name).filter(Boolean)
        : [];

      // 使用 DatabaseLoggerService 记录在空间中找到的边数量的调试信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.SERVICE_INITIALIZED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: `Found ${edges.length} edges in space ${spaceName}:`, edges }
      }).catch(error => {
        // 如果日志记录失败，我们不希望影响主流程
        console.error('Failed to log found edges debug:', error);
      });

      // 首先删除所有边
      for (const edge of edges) {
        try {
          await this.nebulaConnection.executeQuery(`DELETE EDGE \`${edge}\` * -> *`);
          // 使用 DatabaseLoggerService 记录删除边的调试信息
          this.databaseLogger.logDatabaseEvent({
            type: DatabaseEventType.SERVICE_INITIALIZED,
            source: 'nebula',
            timestamp: new Date(),
            data: { message: `Deleted edge: ${edge}` }
          }).catch(error => {
            // 如果日志记录失败，我们不希望影响主流程
            console.error('Failed to log deleted edge debug:', error);
          });
        } catch (edgeError) {
          // 使用 DatabaseLoggerService 记录删除边失败的警告信息
          this.databaseLogger.logDatabaseEvent({
            type: DatabaseEventType.SPACE_ERROR,
            source: 'nebula',
            timestamp: new Date(),
            data: {
              message: `Failed to delete edge ${edge}:`,
              edgeError: edgeError instanceof Error ? edgeError.message : String(edgeError),
              stack: edgeError instanceof Error ? edgeError.stack : undefined
            }
          }).catch(error => {
            // 如果日志记录失败，我们不希望影响主流程
            console.error('Failed to log delete edge failure:', error);
          });
          // 继续处理其他边
        }
      }

      // 删除所有顶点
      for (const tag of tags) {
        try {
          await this.nebulaConnection.executeQuery(`DELETE VERTEX * WITH EDGE`);
          // 使用 DatabaseLoggerService 记录删除顶点的调试信息
          this.databaseLogger.logDatabaseEvent({
            type: DatabaseEventType.SERVICE_INITIALIZED,
            source: 'nebula',
            timestamp: new Date(),
            data: { message: `Deleted vertices for tag: ${tag}` }
          }).catch(error => {
            // 如果日志记录失败，我们不希望影响主流程
            console.error('Failed to log deleted vertices debug:', error);
          });
        } catch (vertexError) {
          // 使用 DatabaseLoggerService 记录删除顶点失败的警告信息
          this.databaseLogger.logDatabaseEvent({
            type: DatabaseEventType.SPACE_ERROR,
            source: 'nebula',
            timestamp: new Date(),
            data: {
              message: `Failed to delete vertices for tag ${tag}:`,
              vertexError: vertexError instanceof Error ? vertexError.message : String(vertexError),
              stack: vertexError instanceof Error ? vertexError.stack : undefined
            }
          }).catch(error => {
            // 如果日志记录失败，我们不希望影响主流程
            console.error('Failed to log delete vertices failure:', error);
          });
          // 继续处理其他标签
        }
      }

      // 使用 DatabaseLoggerService 记录成功清理空间的信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.SPACE_CLEARED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: `Successfully cleared space ${spaceName} for project ${projectId}` }
      }).catch(error => {
        // 如果日志记录失败，我们不希望影响主流程
        console.error('Failed to log successfully cleared space:', error);
      });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // 使用 DatabaseLoggerService 记录清理空间失败的错误信息
      this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.SPACE_ERROR,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: `Failed to clear space ${spaceName}:`,
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        }
      }).catch(error => {
        // 如果日志记录失败，我们不希望影响主流程
        console.error('Failed to log clear space failure:', error);
      });
      return false;
    }
  }
}