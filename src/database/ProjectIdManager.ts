import { HashUtils } from '../utils/HashUtils';
import * as fs from 'fs/promises';
import * as path from 'path';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types';
import { ConfigService } from '../config/ConfigService';
import { QdrantConfigService } from '../config/service/QdrantConfigService';
import { NebulaConfigService } from '../config/service/NebulaConfigService';
import { LoggerService } from '../utils/LoggerService';
import { ErrorHandlerService } from '../utils/ErrorHandlerService';

// 项目映射信息的接口定义（保留用于兼容旧格式）
export interface ProjectMappingInfo {
  projectPath: string;
  projectId: string;
  collectionName: string;
  spaceName: string;
  lastUpdateTime: Date;
}

// 用户期望的映射格式接口
export interface UserExpectedMappingFormat {
  projectIdMap: { [path: string]: string };
  collectionMap: { [id: string]: string };
  spaceMap: { [id: string]: string };
  pathToProjectMap: { [id: string]: string };
  projectUpdateTimes: { [id: string]: string }; // ISO string format
}

@injectable()
export class ProjectIdManager {
  private projectIdMap: Map<string, string> = new Map(); // projectPath -> projectId
  private collectionMap: Map<string, string> = new Map(); // projectId -> collectionName
  private spaceMap: Map<string, string> = new Map(); // projectId -> spaceName
  private pathToProjectMap: Map<string, string> = new Map(); // projectId -> projectPath (reverse mapping)
  private projectUpdateTimes: Map<string, Date> = new Map(); // projectId -> last update time

  constructor(
    @inject(TYPES.ConfigService) private configService: ConfigService,
    @inject(TYPES.QdrantConfigService) private qdrantConfigService: QdrantConfigService,
    @inject(TYPES.NebulaConfigService) private nebulaConfigService: NebulaConfigService,
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService
  ) {
    // 检查是否在测试环境中
    const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

    if (isTestEnvironment) {
      // 在测试环境中，延迟加载映射以避免配置服务未初始化的问题
      setTimeout(() => {
        this.loadMapping().catch(error => {
          this.logger.warn('Failed to load project mapping in test environment:', error);
          this.errorHandler.handleError(error, { component: 'ProjectIdManager', operation: 'loadMapping' });
        });
      }, 10);
    } else {
      // 在生产环境中立即加载映射
      this.loadMapping().catch(error => {
        this.logger.warn('Failed to load project mapping at startup:', error);
        this.errorHandler.handleError(error, { component: 'ProjectIdManager', operation: 'loadMapping' });
      });
    }
  }

  /**
   * 格式化日期为ISO字符串
   */
  private formatDate(date: Date): string {
    return date.toISOString();
  }

  /**
   * 解析ISO字符串为Date对象
   */
  private parseDate(dateString: string): Date {
    return new Date(dateString);
  }


  async generateProjectId(projectPath: string): Promise<string> {
    try {
      // Normalize path to ensure consistency across different platforms
      const normalizedPath = HashUtils.normalizePath(projectPath);

      // Check if project ID already exists for this path
      const existingProjectId = this.projectIdMap.get(normalizedPath);
      if (existingProjectId) {
        // Update timestamp for existing project
        this.projectUpdateTimes.set(existingProjectId, new Date());
        return existingProjectId;
      }

      // Use SHA256 hash to generate project ID
      const directoryHash = await HashUtils.calculateDirectoryHash(projectPath);
      const projectId = directoryHash.hash.substring(0, 16);

      // Generate corresponding collection and space names using configuration services
      const collectionName = this.qdrantConfigService.getCollectionNameForProject(projectId);
      const spaceName = this.nebulaConfigService.getSpaceNameForProject(projectId);

      // Establish mapping relationships using normalized path
      this.projectIdMap.set(normalizedPath, projectId);
      this.pathToProjectMap.set(projectId, normalizedPath);
      this.collectionMap.set(projectId, collectionName);
      this.spaceMap.set(projectId, spaceName);

      // Set current time as the update time for this project
      this.projectUpdateTimes.set(projectId, new Date());

      this.logger.info(`Generated project ID: ${projectId} for path: ${projectPath}`);
      this.logger.info(`Collection name: ${collectionName}, Space name: ${spaceName}`);

      return projectId;
    } catch (error) {
      this.logger.error(`Failed to generate project ID for path: ${projectPath}`, error);
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Unknown error in generateProjectId'),
        { component: 'ProjectIdManager', operation: 'generateProjectId', projectPath }
      );
      throw error;
    }
  }

  getProjectId(projectPath: string): string | undefined {
    const normalizedPath = HashUtils.normalizePath(projectPath);
    return this.projectIdMap.get(normalizedPath);
  }

  getProjectPath(projectId: string): string | undefined {
    return this.pathToProjectMap.get(projectId);
  }

  getCollectionName(projectId: string): string | undefined {
    return this.collectionMap.get(projectId);
  }

  getSpaceName(projectId: string): string | undefined {
    return this.spaceMap.get(projectId);
  }

  // Update project's last update time
  updateProjectTimestamp(projectId: string): void {
    this.projectUpdateTimes.set(projectId, new Date());
  }

  // Get the project with the latest update time
  getLatestUpdatedProject(): string | null {
    let latestProjectId: string | null = null;
    let latestTime: Date | null = null;

    for (const [projectId, updateTime] of this.projectUpdateTimes.entries()) {
      if (!latestTime || updateTime > latestTime) {
        latestTime = updateTime;
        latestProjectId = projectId;
      }
    }

    return latestProjectId;
  }

  // Get all projects sorted by update time (latest first)
  getProjectsByUpdateTime(): Array<{ projectId: string; updateTime: Date; projectPath: string }> {
    const projects: Array<{ projectId: string; updateTime: Date; projectPath: string }> = [];

    for (const [projectId, updateTime] of this.projectUpdateTimes.entries()) {
      const projectPath = this.pathToProjectMap.get(projectId);
      if (projectPath) {
        projects.push({ projectId, updateTime, projectPath });
      }
    }

    // Sort by update time, latest first
    projects.sort((a, b) => b.updateTime.getTime() - a.updateTime.getTime());

    return projects;
  }

  // Persist mapping relationships
  async saveMapping(): Promise<void> {
    await this.saveMappingWithRetry();
  }

  /**
   * 带重试机制的映射保存
   */
  private async saveMappingWithRetry(maxRetries: number = 3): Promise<void> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // 将映射数据转换为数组格式，与 project-states.json 保持一致
        const mappingArray: any[] = [];

        // 遍历所有项目路径，创建映射信息对象
        for (const [projectPath, projectId] of this.projectIdMap.entries()) {
          const collectionName = this.collectionMap.get(projectId) || this.qdrantConfigService.getCollectionNameForProject(projectId);
          const spaceName = this.spaceMap.get(projectId) || this.nebulaConfigService.getSpaceNameForProject(projectId);
          const lastUpdateTime = this.projectUpdateTimes.get(projectId) || new Date();

          // 创建一个包含所有映射关系的对象，符合用户期望的格式
          const mappingInfo: any = {};
          mappingInfo.projectIdMap = { [projectPath]: projectId };
          mappingInfo.collectionMap = { [projectId]: collectionName };
          mappingInfo.spaceMap = { [projectId]: spaceName };
          mappingInfo.pathToProjectMap = { [projectId]: projectPath };
          mappingInfo.projectUpdateTimes = { [projectId]: lastUpdateTime };

          mappingArray.push(mappingInfo);
        }

        // Use configurable storage path from config service
        const storagePath = this.configService.get('project')?.mappingPath || './data/project-mapping.json';

        // Ensure directory exists
        const dir = path.dirname(storagePath);
        try {
          await fs.mkdir(dir, { recursive: true });
        } catch (error) {
          // Directory might already exist
        }

        // Use atomic write with temporary file + rename
        const tempPath = `${storagePath}.tmp`;
        const jsonData = JSON.stringify(mappingArray, (key, value) => {
          // 自定义序列化，处理日期对象
          if (value instanceof Date) {
            return this.formatDate(value);
          }
          return value;
        }, 2);

        await fs.writeFile(tempPath, jsonData);
        await fs.rename(tempPath, storagePath);

        // 成功则退出重试循环
        return;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          // 最后一次尝试仍然失败，抛出错误
          throw new Error(`Failed to save project mapping after ${maxRetries} attempts: ${error instanceof Error ? error.message : String(error)}`);
        }

        // 指数退避等待
        const waitTime = Math.pow(2, attempt) * 100;
        console.warn(`Save mapping attempt ${attempt + 1}/${maxRetries} failed, retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // Load mapping relationships
  async loadMapping(): Promise<void> {
    await this.loadMappingWithRetry();
  }

  /**
   * 带重试机制的映射加载
   */
  private async loadMappingWithRetry(maxRetries: number = 3): Promise<void> {
    // 检查是否在测试环境中
    const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

    // 在测试环境中减少重试次数和等待时间
    if (isTestEnvironment) {
      maxRetries = 1;
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const storagePath = this.configService.get('project')?.mappingPath || './data/project-mapping.json';
        
        // 检查文件是否存在，如果不存在则创建空文件
        try {
          await fs.access(storagePath);
        } catch (accessError) {
          // 文件不存在，创建空的JSON文件
          this.logger.warn(`Project mapping file does not exist at ${storagePath}, creating empty file...`);
          const dir = path.dirname(storagePath);
          await fs.mkdir(dir, { recursive: true });
          await fs.writeFile(storagePath, '[]', 'utf8');
        }
        
        const data = await fs.readFile(storagePath, 'utf8');
        const rawMapping = JSON.parse(data);

        // 检查是否是旧格式（对象格式）或新格式（数组格式）
        if (Array.isArray(rawMapping)) {
          // 新格式：数组格式，每个元素包含完整的映射信息
          this.initializeEmptyMapping();

          for (const mappingInfo of rawMapping) {
            // 检查是否是用户期望的格式（包含projectIdMap, collectionMap等）
            if (mappingInfo.projectIdMap && mappingInfo.collectionMap && mappingInfo.spaceMap &&
                mappingInfo.pathToProjectMap && mappingInfo.projectUpdateTimes) {
              // 用户期望的格式
              for (const [projectPath, projectId] of Object.entries(mappingInfo.projectIdMap)) {
                const normalizedPath = HashUtils.normalizePath(projectPath as string);
                const actualProjectId = projectId as string;

                // 添加到各个映射中
                this.projectIdMap.set(normalizedPath, actualProjectId);
                this.pathToProjectMap.set(actualProjectId, normalizedPath);
                this.collectionMap.set(actualProjectId, mappingInfo.collectionMap[actualProjectId]);
                this.spaceMap.set(actualProjectId, mappingInfo.spaceMap[actualProjectId]);
                this.projectUpdateTimes.set(actualProjectId, this.parseDate(mappingInfo.projectUpdateTimes[actualProjectId]));
              }
            } else {
              // 原来的数组格式
              const normalizedPath = HashUtils.normalizePath(mappingInfo.projectPath);
              this.projectIdMap.set(normalizedPath, mappingInfo.projectId);
              this.pathToProjectMap.set(mappingInfo.projectId, normalizedPath);
              this.collectionMap.set(mappingInfo.projectId, mappingInfo.collectionName);
              this.spaceMap.set(mappingInfo.projectId, mappingInfo.spaceName);
              this.projectUpdateTimes.set(mappingInfo.projectId, mappingInfo.lastUpdateTime);
            }
          }
        } else {
          // 旧格式：对象格式，需要转换
          this.logger.info('Detected old format project mapping, converting to new format');
          this.initializeEmptyMapping();

          // 从旧格式加载
          const projectIdMap = rawMapping.projectIdMap || {};
          const collectionMap = rawMapping.collectionMap || {};
          const spaceMap = rawMapping.spaceMap || {};
          const pathToProjectMap = rawMapping.pathToProjectMap || {};
          const projectUpdateTimes = rawMapping.projectUpdateTimes || {};

          for (const [projectPath, projectId] of Object.entries(projectIdMap)) {
            const normalizedPath = HashUtils.normalizePath(projectPath as string);
            const actualProjectId = projectId as string;

            // 添加到各个映射中
            this.projectIdMap.set(normalizedPath, actualProjectId);
            this.pathToProjectMap.set(actualProjectId, normalizedPath);
            this.collectionMap.set(actualProjectId, collectionMap[actualProjectId]);
            this.spaceMap.set(actualProjectId, spaceMap[actualProjectId]);
            this.projectUpdateTimes.set(actualProjectId, this.parseDate(projectUpdateTimes[actualProjectId] || new Date().toISOString()));
          }
        }

        // 成功则退出重试循环
        return;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          // 最后一次尝试仍然失败，初始化空映射
          if (isTestEnvironment) {
            // 在测试环境中静默初始化空映射，避免过多的警告信息
            this.initializeEmptyMapping();
            return;
          } else {
            console.warn(`Failed to load project mapping after ${maxRetries} attempts, initializing empty mapping:`, error);
            this.initializeEmptyMapping();
            return;
          }
        }

        // 指数退避等待
        const waitTime = isTestEnvironment ? 10 : Math.pow(2, attempt) * 1000;

        if (!isTestEnvironment) {
          console.warn(`Load mapping attempt ${attempt + 1}/${maxRetries} failed, retrying in ${waitTime}ms...`);
        }

        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  /**
   * 初始化空映射
   */
  private initializeEmptyMapping(): void {
    this.projectIdMap = new Map();
    this.collectionMap = new Map();
    this.spaceMap = new Map();
    this.pathToProjectMap = new Map();
    this.projectUpdateTimes = new Map();
  }



  /**
   * 验证映射的一致性
   */
  private validateMappingConsistency(
    projectIdMap: Map<string, string>,
    collectionMap: Map<string, string>,
    spaceMap: Map<string, string>,
    pathToProjectMap: Map<string, string>,
    projectUpdateTimes: Map<string, Date>
  ): void {
    try {
      // 验证项目ID映射的一致性
      for (const [projectPath, projectId] of projectIdMap.entries()) {
        // 确保反向映射存在
        if (!pathToProjectMap.has(projectId)) {
          this.logger.warn(`Missing reverse mapping for project ${projectId}, adding...`);
          pathToProjectMap.set(projectId, projectPath);
        }

        // 确保集合映射存在
        if (!collectionMap.has(projectId)) {
          this.logger.warn(`Missing collection mapping for project ${projectId}, adding...`);
          // 使用配置服务来生成默认集合名
          const collectionName = this.qdrantConfigService.getCollectionNameForProject(projectId);
          collectionMap.set(projectId, collectionName);
        }

        // 确保空间映射存在（使用配置服务来生成默认空间名）
        if (!spaceMap.has(projectId)) {
          this.logger.warn(`Missing space mapping for project ${projectId}, adding...`);
          // 使用配置服务来生成默认空间名
          const spaceName = this.nebulaConfigService.getSpaceNameForProject(projectId);
          spaceMap.set(projectId, spaceName);  // 统一使用配置服务生成的名称
        }

        // 确保更新时间存在
        if (!projectUpdateTimes.has(projectId)) {
          this.logger.warn(`Missing update time for project ${projectId}, adding...`);
          projectUpdateTimes.set(projectId, new Date());
        }
      }

      // 清理无效的反向映射
      for (const [projectId, projectPath] of pathToProjectMap.entries()) {
        if (!projectIdMap.has(projectPath)) {
          this.logger.warn(`Orphaned reverse mapping for project ${projectId}, removing...`);
          pathToProjectMap.delete(projectId);
          collectionMap.delete(projectId);
          spaceMap.delete(projectId);
          projectUpdateTimes.delete(projectId);
        }
      }
    } catch (error) {
      this.logger.error('Failed to validate mapping consistency', error);
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Unknown error in validateMappingConsistency'),
        { component: 'ProjectIdManager', operation: 'validateMappingConsistency' }
      );
    }
  }

  // List all projects
  listAllProjects(): string[] {
    return Array.from(this.projectIdMap.values());
  }

  // List all project paths
  listAllProjectPaths(): string[] {
    return Array.from(this.projectIdMap.keys());
  }

  // Check if a project exists
  hasProject(projectPath: string): boolean {
    const normalizedPath = HashUtils.normalizePath(projectPath);
    return this.projectIdMap.has(normalizedPath);
  }

  // Remove a project from mappings
  async removeProject(projectPath: string): Promise<boolean> {
    const normalizedPath = HashUtils.normalizePath(projectPath);
    const projectId = this.projectIdMap.get(normalizedPath);
    if (!projectId) {
      return false;
    }

    this.projectIdMap.delete(normalizedPath);
    this.collectionMap.delete(projectId);
    this.spaceMap.delete(projectId);
    this.pathToProjectMap.delete(projectId);
    this.projectUpdateTimes.delete(projectId);

    // 自动保存映射到文件
    await this.saveMapping();

    return true;
  }

  // Remove a project by projectId directly
  async removeProjectById(projectId: string): Promise<boolean> {
    // Find the project path associated with this projectId
    let projectPath: string | undefined;
    for (const [path, id] of this.projectIdMap.entries()) {
      if (id === projectId) {
        projectPath = path;
        break;
      }
    }

    // Remove all mappings for this projectId
    let removed = false;

    // Remove from projectIdMap if we found the path
    if (projectPath) {
      this.projectIdMap.delete(projectPath);
      removed = true;
    }

    // Remove from other maps using the projectId
    if (this.collectionMap.has(projectId)) {
      this.collectionMap.delete(projectId);
      removed = true;
    }

    if (this.spaceMap.has(projectId)) {
      this.spaceMap.delete(projectId);
      removed = true;
    }

    if (this.pathToProjectMap.has(projectId)) {
      this.pathToProjectMap.delete(projectId);
      removed = true;
    }

    if (this.projectUpdateTimes.has(projectId)) {
      this.projectUpdateTimes.delete(projectId);
      removed = true;
    }

    // 如果删除了任何映射，则保存到文件
    if (removed) {
      await this.saveMapping();
    }

    return removed;
  }

  // Refresh mapping from persistent storage
  async refreshMapping(): Promise<void> {
    // Load the latest mapping from storage
    await this.loadMapping();
  }

  /**
   * 清理无效的项目映射
   */
  async cleanupInvalidMappings(): Promise<number> {
    try {
      const initialCount = this.projectIdMap.size;
      this.logger.info(`Starting cleanup of invalid project mappings. Initial count: ${initialCount}`);

      const validProjectPaths = new Map<string, string>();
      const validCollectionMap = new Map<string, string>();
      const validSpaceMap = new Map<string, string>();
      const validPathToProjectMap = new Map<string, string>();
      const validProjectUpdateTimes = new Map<string, Date>();

      // 检查每个项目路径是否仍然有效
      for (const [projectPath, projectId] of this.projectIdMap.entries()) {
        const isValid = await this.isProjectPathValid(projectPath);
        if (isValid) {
          validProjectPaths.set(projectPath, projectId);
          // 使用配置服务来获取正确的集合名和空间名
          const collectionName = this.collectionMap.get(projectId) || this.qdrantConfigService.getCollectionNameForProject(projectId);
          const spaceName = this.spaceMap.get(projectId) || this.nebulaConfigService.getSpaceNameForProject(projectId);
          validCollectionMap.set(projectId, collectionName);
          validSpaceMap.set(projectId, spaceName);
          validPathToProjectMap.set(projectId, projectPath);
          validProjectUpdateTimes.set(projectId, this.projectUpdateTimes.get(projectId) || new Date());
        } else {
          this.logger.warn(`Removing invalid project mapping: ${projectId} at ${projectPath}`);
        }
      }

      // 更新映射
      this.projectIdMap = validProjectPaths;
      this.collectionMap = validCollectionMap;
      this.spaceMap = validSpaceMap;
      this.pathToProjectMap = validPathToProjectMap;
      this.projectUpdateTimes = validProjectUpdateTimes;

      // 保存清理后的映射
      await this.saveMapping();

      const removedCount = initialCount - this.projectIdMap.size;
      this.logger.info(`Cleaned up ${removedCount} invalid project mappings, ${this.projectIdMap.size} mappings remaining`);

      return removedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup invalid project mappings:', error);
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Unknown error in cleanupInvalidMappings'),
        { component: 'ProjectIdManager', operation: 'cleanupInvalidMappings' }
      );
      throw error;
    }
  }

  /**
   * 检查项目路径是否有效
   */
  private async isProjectPathValid(projectPath: string): Promise<boolean> {
    try {
      await fs.access(projectPath);
      return true;
    } catch (error) {
      // 路径不存在，项目无效
      return false;
    }
  }

  /**
   * 验证命名约定是否符合数据库约束
   * @param name 集合名或空间名
   * @returns 是否符合约束
   */
  public static validateNamingConvention(name: string): boolean {
    // 验证命名符合数据库约束
    const pattern = /^[a-zA-Z0-9_-]{1,63}$/;
    return pattern.test(name) && !name.startsWith('_');
  }

  /**
   * 验证配置是否冲突
   * @param explicitName 显式配置的名称
   * @param projectId 项目ID
   * @returns 是否存在冲突
   */
  public static checkConfigurationConflict(explicitName: string | undefined, projectId: string): boolean {
    // 如果没有显式配置，则无冲突
    if (!explicitName) {
      return false;
    }

    // 检查显式配置是否与项目隔离命名冲突
    const projectSpecificName = `project-${projectId}`;
    return explicitName !== projectSpecificName;
  }
}