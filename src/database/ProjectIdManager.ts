import { HashUtils } from '../utils/HashUtils';
import fs from 'fs/promises';
import path from 'path';

export class ProjectIdManager {
  private projectIdMap: Map<string, string> = new Map(); // projectPath -> projectId
  private collectionMap: Map<string, string> = new Map(); // projectId -> collectionName
 private spaceMap: Map<string, string> = new Map(); // projectId -> spaceName
  private pathToProjectMap: Map<string, string> = new Map(); // projectId -> projectPath (reverse mapping)
  private projectUpdateTimes: Map<string, Date> = new Map(); // projectId -> last update time

  constructor() {
    // 自动加载持久化映射
    this.loadMapping().catch(error => {
      console.warn('Failed to load project mapping at startup:', error);
    });
  }

  async generateProjectId(projectPath: string): Promise<string> {
    // Normalize path to ensure consistency across different platforms
    const normalizedPath = HashUtils.normalizePath(projectPath);
    
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
    const storagePath = process.env.PROJECT_MAPPING_PATH || './data/project-mapping.json';
    
    // Ensure directory exists
    const dir = path.dirname(storagePath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    await fs.writeFile(storagePath, JSON.stringify(mapping, null, 2));
  }

  // Load mapping relationships
  async loadMapping(): Promise<void> {
    try {
      const storagePath = process.env.PROJECT_MAPPING_PATH || './data/project-mapping.json';
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
    } catch (error) {
      console.warn('Failed to load project mapping:', error);
      // If mapping file doesn't exist, initialize empty mapping
      this.projectIdMap = new Map();
      this.collectionMap = new Map();
      this.spaceMap = new Map();
      this.pathToProjectMap = new Map();
      this.projectUpdateTimes = new Map();
    }
  }

  // List all projects
  listAllProjects(): string[] {
    return Array.from(this.projectIdMap.values());
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
}