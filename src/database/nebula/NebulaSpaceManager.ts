import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { NebulaService } from '../NebulaService';

export interface GraphConfig {
  partitionNum?: number;
  replicaFactor?: number;
  vidType?: string;
}

export interface SpaceInfo {
  name: string;
  partition_num: number;
  replica_factor: number;
  vid_type: string;
  charset: string;
  collate: string;
}

@injectable()
export class NebulaSpaceManager {
  private nebulaService: NebulaService;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;

  constructor(
    @inject(TYPES.NebulaService) nebulaService: NebulaService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService
  ) {
    this.nebulaService = nebulaService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
  }

  private generateSpaceName(projectId: string): string {
    return `project_${projectId}`;
  }

  async createSpace(projectId: string, config: GraphConfig): Promise<boolean> {
    const spaceName = this.generateSpaceName(projectId);
    try {
      // 创建空间
      const createQuery = `
        CREATE SPACE IF NOT EXISTS ${spaceName} (
          partition_num = ${config.partitionNum || 10},
          replica_factor = ${config.replicaFactor || 1},
          vid_type = ${config.vidType || 'FIXED_STRING(32)'}
        )
      `;

      await this.nebulaService.executeWriteQuery(createQuery);

      // 等待空间创建完成
      await this.waitForSpaceReady(spaceName);

      // 使用空间
      await this.nebulaService.executeWriteQuery(`USE ${spaceName}`);

      // 创建图结构
      await this.createGraphSchema();

      this.logger.info(`Successfully created space ${spaceName} for project ${projectId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to create space ${spaceName}:`, error);
      return false;
    }
  }

  async deleteSpace(projectId: string): Promise<boolean> {
    const spaceName = this.generateSpaceName(projectId);
    try {
      await this.nebulaService.executeWriteQuery(`DROP SPACE IF EXISTS ${spaceName}`);
      this.logger.info(`Successfully deleted space ${spaceName} for project ${projectId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete space ${spaceName}:`, error);
      return false;
    }
  }

  async listSpaces(): Promise<string[]> {
    try {
      const result = await this.nebulaService.executeReadQuery('SHOW SPACES');
      
      // 更健壮的结果格式检查
      if (!result) {
        this.logger.warn('SHOW SPACES returned null result');
        return [];
      }
      
      // 处理不同的返回格式
      let data = result.data;
      if (!data) {
        // 尝试其他可能的格式
        data = result.table || result.results || result.rows || [];
      }
      
      if (!Array.isArray(data)) {
        this.logger.warn('SHOW SPACES returned non-array data:', {
          resultType: typeof data,
          result: JSON.stringify(data).substring(0, 200)
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
          this.logger.debug(`No valid space name found in row ${index}:`, row);
          return '';
        } catch (rowError) {
          this.logger.warn(`Error processing row ${index} in SHOW SPACES result:`, rowError);
          return '';
        }
      }).filter((name: string) => name && name.length > 0);
      
      // 验证结果
      if (spaceNames.length === 0) {
        this.logger.warn('No valid space names found in SHOW SPACES result');
      } else {
        this.logger.debug(`Found ${spaceNames.length} spaces:`, spaceNames);
      }
      
      return spaceNames;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to list spaces:', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // 返回空数组而不是抛出异常，让调用者能够继续处理
      return [];
    }
  }

  async getSpaceInfo(projectId: string): Promise<SpaceInfo | null> {
    const spaceName = this.generateSpaceName(projectId);
    try {
      const result = await this.nebulaService.executeReadQuery(`DESCRIBE SPACE ${spaceName}`);
      
      // 更健壮的结果验证
      if (!result) {
        this.logger.warn(`DESCRIBE SPACE ${spaceName} returned null result`);
        return null;
      }
      
      // 处理不同的返回格式
      let data = result.data || result.table || result.results || result.rows || [];
      
      if (!Array.isArray(data) || data.length === 0) {
        this.logger.debug(`No space info found for ${spaceName}`);
        return null;
      }
      
      const spaceInfo = data[0];
      
      // 验证返回的数据结构
      if (!spaceInfo || typeof spaceInfo !== 'object') {
        this.logger.warn(`Invalid space info format for ${spaceName}:`, spaceInfo);
        return null;
      }
      
      // 创建标准化的SpaceInfo对象
      const normalizedInfo: SpaceInfo = {
        name: spaceName,
        partition_num: parseInt(spaceInfo.partition_num || spaceInfo.PartitionNum || spaceInfo.partitionNum || '10') || 10,
        replica_factor: parseInt(spaceInfo.replica_factor || spaceInfo.ReplicaFactor || spaceInfo.replicaFactor || '1') || 1,
        vid_type: spaceInfo.vid_type || spaceInfo.VidType || spaceInfo.vidType || 'FIXED_STRING(32)',
        charset: spaceInfo.charset || spaceInfo.Charset || 'utf8',
        collate: spaceInfo.collate || spaceInfo.Collate || 'utf8_bin'
      };
      
      this.logger.debug(`Retrieved space info for ${spaceName}:`, normalizedInfo);
      return normalizedInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get space info for ${spaceName}:`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      return null;
    }
  }

  async checkSpaceExists(projectId: string): Promise<boolean> {
    const spaceName = this.generateSpaceName(projectId);
    try {
      const spaces = await this.listSpaces();
      const exists = spaces.includes(spaceName);
      this.logger.debug(`Space ${spaceName} exists: ${exists}`);
      return exists;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to check if space ${spaceName} exists:`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      return false;
    }
  }

  private async waitForSpaceReady(
    spaceName: string,
    maxRetries: number = 30,
    retryDelay: number = 1000
  ): Promise<void> {
    this.logger.info(`Waiting for space ${spaceName} to be ready...`);
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await this.nebulaService.executeReadQuery(`DESCRIBE SPACE ${spaceName}`);
        
        // 更健壮的结果检查
        if (result) {
          const data = result.data || result.table || result.results || result.rows || [];
          if (Array.isArray(data) && data.length > 0) {
            this.logger.info(`Space ${spaceName} is ready after ${i + 1} attempts`);
            return;
          }
        }
        
        // 如果还没有准备好，记录调试信息
        if (i % 5 === 0) { // 每5次尝试记录一次
          this.logger.debug(`Space ${spaceName} not ready yet, attempt ${i + 1}/${maxRetries}`);
        }
      } catch (error) {
        // Space not ready yet, continue waiting
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (i % 5 === 0) { // 每5次尝试记录一次
          this.logger.debug(`Space ${spaceName} not ready yet (error: ${errorMessage}), attempt ${i + 1}/${maxRetries}`);
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
        await this.nebulaService.executeWriteQuery(query);
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
        await this.nebulaService.executeWriteQuery(query);
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

      this.logger.info('Graph schema and indexes created successfully');
    } catch (error) {
      this.logger.error('Failed to create graph schema:', error);
      throw error;
    }
  }

  /**
   * 创建索引并带有重试机制
   */
  private async createIndexWithRetry(indexQuery: string, maxRetries: number = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.nebulaService.executeWriteQuery(indexQuery);
        this.logger.debug(`Successfully created index: ${indexQuery}`);
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // 检查是否是"已存在"错误
        if (errorMessage.includes('already exists') || errorMessage.includes('existed')) {
          this.logger.debug(`Index already exists: ${indexQuery}`);
          return;
        }
        
        if (attempt === maxRetries) {
          this.logger.error(`Failed to create index after ${maxRetries} attempts: ${indexQuery}`, error);
          throw new Error(`Failed to create index: ${indexQuery}. Error: ${errorMessage}`);
        }
        
        this.logger.warn(`Attempt ${attempt} failed to create index: ${indexQuery}. Retrying...`, error);
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  async clearSpace(projectId: string): Promise<boolean> {
    const spaceName = this.generateSpaceName(projectId);
    try {
      this.logger.info(`Starting to clear space ${spaceName} for project ${projectId}`);
      
      // First, switch to the space
      await this.nebulaService.executeWriteQuery(`USE ${spaceName}`);
      
      // Get all tags in the space with enhanced error handling
      const tagsResult = await this.nebulaService.executeReadQuery('SHOW TAGS');
      const tagsData = tagsResult?.data || tagsResult?.table || tagsResult?.results || [];
      const tags = Array.isArray(tagsData)
        ? tagsData.map((row: any) => row.Name || row.name || row.NAME || row.tag_name).filter(Boolean)
        : [];
      
      this.logger.debug(`Found ${tags.length} tags in space ${spaceName}:`, tags);

      // Get all edges with enhanced error handling
      const edgesResult = await this.nebulaService.executeReadQuery('SHOW EDGES');
      const edgesData = edgesResult?.data || edgesResult?.table || edgesResult?.results || [];
      const edges = Array.isArray(edgesData)
        ? edgesData.map((row: any) => row.Name || row.name || row.NAME || row.edge_name).filter(Boolean)
        : [];
      
      this.logger.debug(`Found ${edges.length} edges in space ${spaceName}:`, edges);

      // Delete all edges first
      for (const edge of edges) {
        try {
          await this.nebulaService.executeWriteQuery(`DELETE EDGE ${edge} * -> *`);
          this.logger.debug(`Deleted edge: ${edge}`);
        } catch (edgeError) {
          this.logger.warn(`Failed to delete edge ${edge}:`, edgeError);
          // Continue with other edges
        }
      }

      // Delete all vertices
      for (const tag of tags) {
        try {
          await this.nebulaService.executeWriteQuery(`DELETE VERTEX * WITH EDGE`);
          this.logger.debug(`Deleted vertices for tag: ${tag}`);
        } catch (vertexError) {
          this.logger.warn(`Failed to delete vertices for tag ${tag}:`, vertexError);
          // Continue with other tags
        }
      }

      this.logger.info(`Successfully cleared space ${spaceName} for project ${projectId}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to clear space ${spaceName}:`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      return false;
    }
  }

  async getSpaceSize(projectId: string): Promise<number> {
    try {
      const info = await this.getSpaceInfo(projectId);
      // This is a simplified implementation - in a real scenario, you would need
      // to query Nebula Graph for actual space size statistics
      return info ? 1 : 0;
    } catch (error) {
      this.logger.error(`Failed to get space size for project ${projectId}:`, error);
      return 0;
    }
  }

  /**
   * 检查NebulaGraph服务器状态和版本兼容性
   */
  async checkServerCompatibility(): Promise<{
    isCompatible: boolean;
    serverVersion?: string;
    clientVersion?: string;
    issues: string[];
  }> {
    const issues: string[] = [];
    let serverVersion: string | undefined;
    let clientVersion: string | undefined;

    try {
      this.logger.info('Checking NebulaGraph server compatibility...');

      // 检查服务器连接状态
      const isConnected = this.nebulaService.isConnected();
      if (!isConnected) {
        issues.push('NebulaGraph client is not connected to server');
        return { isCompatible: false, issues };
      }

      // 获取服务器版本信息
      try {
        const versionResult = await this.nebulaService.executeReadQuery('SHOW HOSTS');
        const hostsData = versionResult?.data || versionResult?.table || versionResult?.results || [];
        
        if (Array.isArray(hostsData) && hostsData.length > 0) {
          const hostInfo = hostsData[0];
          serverVersion = hostInfo.version || hostInfo.Version || hostInfo.VERSION || 'unknown';
          this.logger.info(`NebulaGraph server version: ${serverVersion}`);
        } else {
          issues.push('Unable to retrieve server version information');
        }
      } catch (versionError) {
        const errorMessage = versionError instanceof Error ? versionError.message : String(versionError);
        issues.push(`Failed to get server version: ${errorMessage}`);
      }

      // 获取客户端版本信息
      try {
        // 尝试从package.json获取客户端版本
        const packageJson = require('../../../../package.json');
        const nebulaDependency = packageJson.dependencies?.['@nebula-contrib/nebula-nodejs'];
        clientVersion = nebulaDependency || 'unknown';
        this.logger.info(`NebulaGraph client version: ${clientVersion}`);
      } catch (clientError) {
        issues.push('Unable to determine client version');
      }

      // 检查版本兼容性
      if (serverVersion && clientVersion && clientVersion !== 'unknown') {
        const compatibility = this.checkVersionCompatibility(serverVersion, clientVersion);
        if (!compatibility.isCompatible) {
          issues.push(...compatibility.issues);
        }
      }

      // 检查服务器基本功能
      try {
        const testResult = await this.nebulaService.executeReadQuery('SHOW SPACES');
        if (!testResult) {
          issues.push('Server is not responding to basic queries');
        }
      } catch (testError) {
        const errorMessage = testError instanceof Error ? testError.message : String(testError);
        issues.push(`Server basic functionality test failed: ${errorMessage}`);
      }

      const isCompatible = issues.length === 0;
      
      this.logger.info('NebulaGraph compatibility check completed:', {
        isCompatible,
        serverVersion,
        clientVersion,
        issues
      });

      return {
        isCompatible,
        serverVersion,
        clientVersion,
        issues
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to check NebulaGraph server compatibility:', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      issues.push(`Compatibility check failed: ${errorMessage}`);
      return {
        isCompatible: false,
        issues
      };
    }
  }

  /**
   * 检查服务器和客户端版本兼容性
   */
  private checkVersionCompatibility(serverVersion: string, clientVersion: string): {
    isCompatible: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    try {
      // 简化的版本检查逻辑
      const serverMajor = this.extractMajorVersion(serverVersion);
      const clientMajor = this.extractMajorVersion(clientVersion);
      
      // 检查主要版本号
      if (serverMajor !== clientMajor) {
        issues.push(`Version mismatch: server v${serverMajor}.x, client v${clientMajor}.x`);
      }
      
      // 检查最低版本要求
      if (serverMajor < 3) {
        issues.push(`Server version ${serverVersion} is too old, minimum required is 3.x`);
      }
      
      return {
        isCompatible: issues.length === 0,
        issues
      };
    } catch (error) {
      issues.push('Failed to parse version information');
      return {
        isCompatible: false,
        issues
      };
    }
  }

  /**
   * 提取主要版本号
   */
  private extractMajorVersion(version: string): number {
    try {
      // 移除 'v' 前缀并分割版本字符串
      const cleanVersion = version.replace(/^v/i, '');
      const parts = cleanVersion.split('.');
      return parseInt(parts[0]) || 0;
    } catch (error) {
      return 0;
    }
  }
}
