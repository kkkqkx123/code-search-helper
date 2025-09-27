import { HashUtils } from '../utils/HashUtils';
import fs from 'fs/promises';
import path from 'path';
import { injectable, inject } from 'inversify';
import { LoggerService } from '../utils/LoggerService';
import { ErrorHandlerService } from '../utils/ErrorHandlerService';
import { ConfigService } from '../config/ConfigService';
import { TYPES } from '../types';

@injectable()
export class ProjectIdManager {
  private projectIdMap: Map<string, string> = new Map(); // projectPath -> projectId
  private collectionMap: Map<string, string> = new Map(); // projectId -> collectionName
  private spaceMap: Map<string, string> = new Map(); // projectId -> spaceName
 private pathToProjectMap: Map<string, string> = new Map(); // projectId -> projectPath (reverse mapping)
  private projectUpdateTimes: Map<string, Date> = new Map(); // projectId -> last update time

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) private configService: ConfigService
  ) {}

  async initialize(): Promise<void> {
    await this.loadMapping();
  }

  async generateProjectId(projectPath: string): Promise<string> {
    try {
      // Check if project ID already exists for this path
      const existingProjectId = this.projectIdMap.get(projectPath);
      if (existingProjectId) {
        // Update timestamp for existing project
        this.projectUpdateTimes.set(existingProjectId, new Date());
        return existingProjectId;
      }

      // Use SHA256 hash to generate project ID
      const directoryHash = await HashUtils.calculateDirectoryHash(projectPath);
      const hashPart = directoryHash.hash.substring(0, 8); // Use shorter hash part for readability
      
      // Extract project name from path (last part of the path)
      const projectName = path.basename(projectPath).replace(/[^a-zA-Z0-9-_]/g, '-'); // Sanitize name
      const projectId = `${projectName}_${hashPart}`;

      // Establish mapping relationships
      this.projectIdMap.set(projectPath, projectId);
      this.pathToProjectMap.set(projectId, projectPath);

      // Generate corresponding collection and space names
      const collectionName = `project-${projectId}`;
      const spaceName = `project_${projectId}`;

      this.collectionMap.set(projectId, collectionName);
      this.spaceMap.set(projectId, spaceName);

      // Set current time as the update time for this project
      this.projectUpdateTimes.set(projectId, new Date());

      // Persist the mapping
      await this.saveMapping();

      this.logger.info(`Generated project ID ${projectId} for path ${projectPath}`);

      return projectId;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to generate project ID for ${projectPath}: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ProjectIdManager', operation: 'generateProjectId' }
      );
      throw error;
    }
  }

  getProjectId(projectPath: string): string | undefined {
    return this.projectIdMap.get(projectPath);
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
    try {
      const mapping = {
        projectIdMap: Object.fromEntries(this.projectIdMap),
        collectionMap: Object.fromEntries(this.collectionMap),
        spaceMap: Object.fromEntries(this.spaceMap),
        pathToProjectMap: Object.fromEntries(this.pathToProjectMap),
        projectUpdateTimes: Object.fromEntries(
          Array.from(this.projectUpdateTimes.entries()).map(([k, v]) => [k, v.toISOString()])
        ),
      };

      // Use configurable storage path, support different environments
      const storagePath = this.configService.get('project')?.mappingPath || './data/project-mapping.json';
      
      // Ensure directory exists
      const dirPath = path.dirname(storagePath);
      await fs.mkdir(dirPath, { recursive: true });

      await fs.writeFile(storagePath, JSON.stringify(mapping, null, 2));
      
      this.logger.info(`Project mapping saved to ${storagePath}`);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to save project mapping: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ProjectIdManager', operation: 'saveMapping' }
      );
      throw error;
    }
  }

  // Load mapping relationships
 async loadMapping(): Promise<void> {
    try {
      const storagePath = this.configService.get('project')?.mappingPath || './data/project-mapping.json';
      const data = await fs.readFile(storagePath, 'utf8');
      const mapping = JSON.parse(data);

      this.projectIdMap = new Map(Object.entries(mapping.projectIdMap || {}));
      this.collectionMap = new Map(Object.entries(mapping.collectionMap || {}));
      this.spaceMap = new Map(Object.entries(mapping.spaceMap || {}));
      this.pathToProjectMap = new Map(Object.entries(mapping.pathToProjectMap || {}));
      
      // Load project update times
      if (mapping.projectUpdateTimes) {
        this.projectUpdateTimes = new Map(
          Object.entries(mapping.projectUpdateTimes).map(([k, v]) => [k, new Date(v as string)])
        );
      } else {
        // Initialize update times for existing projects if not present
        for (const [projectId] of this.pathToProjectMap.entries()) {
          this.projectUpdateTimes.set(projectId, new Date());
        }
      }
      
      this.logger.info(`Project mapping loaded from ${storagePath}`);
    } catch (error) {
      // Check if error is due to file not existing
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.info('Project mapping file does not exist, initializing empty mapping');
        // If mapping file doesn't exist, initialize empty mapping
        this.projectIdMap = new Map();
        this.collectionMap = new Map();
        this.spaceMap = new Map();
        this.pathToProjectMap = new Map();
        this.projectUpdateTimes = new Map();
      } else {
        this.errorHandler.handleError(
          new Error(`Failed to load project mapping: ${error instanceof Error ? error.message : String(error)}`),
          { component: 'ProjectIdManager', operation: 'loadMapping' }
        );
        throw error;
      }
    }
  }

  // List all projects
  listAllProjects(): string[] {
    return Array.from(this.projectIdMap.values());
  }

  // Check if a project exists
  hasProject(projectPath: string): boolean {
    return this.projectIdMap.has(projectPath);
  }

 // Remove a project from mappings
  removeProject(projectPath: string): boolean {
    const projectId = this.projectIdMap.get(projectPath);
    if (!projectId) {
      return false;
    }

    this.projectIdMap.delete(projectPath);
    this.collectionMap.delete(projectId);
    this.spaceMap.delete(projectId);
    this.pathToProjectMap.delete(projectId);
    this.projectUpdateTimes.delete(projectId);

    return true;
  }
}