import { HashUtils } from '../utils/HashUtils';
import * as fs from 'fs/promises';
import * as path from 'path';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types';
import { ConfigService } from '../config/ConfigService';

@injectable()
export class ProjectIdManager {
  private projectIdMap: Map<string, string> = new Map(); // projectPath -> projectId
  private collectionMap: Map<string, string> = new Map(); // projectId -> collectionName
  private spaceMap: Map<string, string> = new Map(); // projectId -> spaceName
  private pathToProjectMap: Map<string, string> = new Map(); // projectId -> projectPath (reverse mapping)
  private projectUpdateTimes: Map<string, Date> = new Map(); // projectId -> last update time

  constructor(
    @inject(TYPES.ConfigService) private configService: ConfigService
  ) {
    // 自动加载持久化映射
    this.loadMapping().catch(error => {
      console.warn('Failed to load project mapping at startup:', error);
    });
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

    // Establish mapping relationships using normalized path
    this.projectIdMap.set(normalizedPath, projectId);
    this.pathToProjectMap.set(projectId, normalizedPath);

    // Generate corresponding collection and space names
    const collectionName = `project-${projectId}`;
    const spaceName = `project_${projectId}`;

    this.collectionMap.set(projectId, collectionName);
    this.spaceMap.set(projectId, spaceName);

    // Set current time as the update time for this project
    this.projectUpdateTimes.set(projectId, new Date());

    return projectId;
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
        const mapping = {
          projectIdMap: Object.fromEntries(this.projectIdMap),
          collectionMap: Object.fromEntries(this.collectionMap),
          spaceMap: Object.fromEntries(this.spaceMap),
          pathToProjectMap: Object.fromEntries(this.pathToProjectMap),
          projectUpdateTimes: Object.fromEntries(
            Array.from(this.projectUpdateTimes.entries()).map(([k, v]) => [k, this.formatDate(v)])
          ),
        };

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
        const jsonData = JSON.stringify(mapping, null, 2);
        
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
        const waitTime = Math.pow(2, attempt) * 1000;
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
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const storagePath = this.configService.get('project')?.mappingPath || './data/project-mapping.json';
        const data = await fs.readFile(storagePath, 'utf8');
        const mapping = JSON.parse(data);

        // 验证和规范化映射数据
        const validatedMapping = this.validateAndNormalizeMapping(mapping);

        this.projectIdMap = validatedMapping.projectIdMap;
        this.collectionMap = validatedMapping.collectionMap;
        this.spaceMap = validatedMapping.spaceMap;
        this.pathToProjectMap = validatedMapping.pathToProjectMap;
        this.projectUpdateTimes = validatedMapping.projectUpdateTimes;
        
        // 成功则退出重试循环
        return;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          // 最后一次尝试仍然失败，初始化空映射
          console.warn(`Failed to load project mapping after ${maxRetries} attempts, initializing empty mapping:`, error);
          this.initializeEmptyMapping();
          return;
        }
        
        // 指数退避等待
        const waitTime = Math.pow(2, attempt) * 1000;
        console.warn(`Load mapping attempt ${attempt + 1}/${maxRetries} failed, retrying in ${waitTime}ms...`);
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
   * 验证和规范化映射数据
   */
  private validateAndNormalizeMapping(rawMapping: any): {
    projectIdMap: Map<string, string>;
    collectionMap: Map<string, string>;
    spaceMap: Map<string, string>;
    pathToProjectMap: Map<string, string>;
    projectUpdateTimes: Map<string, Date>;
  } {
    // 验证基本结构
    if (!rawMapping || typeof rawMapping !== 'object') {
      throw new Error('Invalid mapping data: not an object');
    }

    // 验证和规范化各个映射
    const projectIdMap: Map<string, string> = new Map(Object.entries(rawMapping.projectIdMap || {}));
    const collectionMap: Map<string, string> = new Map(Object.entries(rawMapping.collectionMap || {}));
    const spaceMap: Map<string, string> = new Map(Object.entries(rawMapping.spaceMap || {}));
    const pathToProjectMap: Map<string, string> = new Map(Object.entries(rawMapping.pathToProjectMap || {}));

    // 验证和规范化项目更新时间
    const projectUpdateTimes: Map<string, Date> = new Map<string, Date>();
    if (rawMapping.projectUpdateTimes && typeof rawMapping.projectUpdateTimes === 'object') {
      for (const [projectId, timestamp] of Object.entries(rawMapping.projectUpdateTimes)) {
        try {
          if (typeof timestamp === 'string') {
            projectUpdateTimes.set(projectId, this.parseDate(timestamp));
          } else {
            console.warn(`Invalid timestamp format for project ${projectId}, skipping`);
          }
        } catch (error) {
          console.warn(`Failed to parse timestamp for project ${projectId}: ${error}, skipping`);
        }
      }
    }

    // 验证映射的一致性
    this.validateMappingConsistency(projectIdMap, collectionMap, spaceMap, pathToProjectMap, projectUpdateTimes);

    return {
      projectIdMap,
      collectionMap,
      spaceMap,
      pathToProjectMap,
      projectUpdateTimes
    };
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
    // 验证项目ID映射的一致性
    for (const [projectPath, projectId] of projectIdMap.entries()) {
      // 确保反向映射存在
      if (!pathToProjectMap.has(projectId)) {
        console.warn(`Missing reverse mapping for project ${projectId}, adding...`);
        pathToProjectMap.set(projectId, projectPath);
      }
      
      // 确保集合映射存在
      if (!collectionMap.has(projectId)) {
        console.warn(`Missing collection mapping for project ${projectId}, adding...`);
        collectionMap.set(projectId, `project-${projectId}`);
      }
      
      // 确保空间映射存在
      if (!spaceMap.has(projectId)) {
        console.warn(`Missing space mapping for project ${projectId}, adding...`);
        spaceMap.set(projectId, `project_${projectId}`);
      }
      
      // 确保更新时间存在
      if (!projectUpdateTimes.has(projectId)) {
        console.warn(`Missing update time for project ${projectId}, adding...`);
        projectUpdateTimes.set(projectId, new Date());
      }
    }

    // 清理无效的反向映射
    for (const [projectId, projectPath] of pathToProjectMap.entries()) {
      if (!projectIdMap.has(projectPath)) {
        console.warn(`Orphaned reverse mapping for project ${projectId}, removing...`);
        pathToProjectMap.delete(projectId);
        collectionMap.delete(projectId);
        spaceMap.delete(projectId);
        projectUpdateTimes.delete(projectId);
      }
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
  removeProject(projectPath: string): boolean {
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

    return true;
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
          validCollectionMap.set(projectId, this.collectionMap.get(projectId) || `project-${projectId}`);
          validSpaceMap.set(projectId, this.spaceMap.get(projectId) || `project_${projectId}`);
          validPathToProjectMap.set(projectId, projectPath);
          validProjectUpdateTimes.set(projectId, this.projectUpdateTimes.get(projectId) || new Date());
        } else {
          console.warn(`Removing invalid project mapping: ${projectId} at ${projectPath}`);
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
      console.log(`Cleaned up ${removedCount} invalid project mappings, ${this.projectIdMap.size} mappings remaining`);
      
      return removedCount;
    } catch (error) {
      console.error('Failed to cleanup invalid project mappings:', error);
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
}