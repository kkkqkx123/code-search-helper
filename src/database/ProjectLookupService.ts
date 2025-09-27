import { injectable, inject } from 'inversify';
import { TYPES } from '../types';
import { ProjectIdManager } from './ProjectIdManager';
import { LoggerService } from '../utils/LoggerService';
import { ErrorHandlerService } from '../utils/ErrorHandlerService';

@injectable()
export class ProjectLookupService {
  constructor(
    @inject(TYPES.ProjectIdManager) private projectIdManager: ProjectIdManager,
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService
  ) {}

  async getProjectIdByCollection(collectionName: string): Promise<string | null> {
    try {
      // Parse project ID from collection name
      if (collectionName.startsWith('project-')) {
        return collectionName.substring(8); // Remove 'project-' prefix
      }
      return null;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get project ID by collection: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ProjectLookupService', operation: 'getProjectIdByCollection', collectionName }
      );
      return null;
    }
  }

 async getProjectIdBySpace(spaceName: string): Promise<string | null> {
    try {
      // Parse project ID from space name
      if (spaceName.startsWith('project_')) {
        return spaceName.substring(8); // Remove 'project_' prefix
      }
      return null;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get project ID by space: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ProjectLookupService', operation: 'getProjectIdBySpace', spaceName }
      );
      return null;
    }
  }

  async getProjectPathByProjectId(projectId: string): Promise<string | null> {
    try {
      // Get project path from project ID using the project ID manager
      const projectPath = this.projectIdManager.getProjectPath(projectId);
      return projectPath || null;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get project path by project ID: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ProjectLookupService', operation: 'getProjectPathByProjectId', projectId }
      );
      return null;
    }
  }

  async getProjectPathByCollection(collectionName: string): Promise<string | null> {
    try {
      const projectId = await this.getProjectIdByCollection(collectionName);
      if (!projectId) {
        return null;
      }
      return this.getProjectPathByProjectId(projectId);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get project path by collection: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ProjectLookupService', operation: 'getProjectPathByCollection', collectionName }
      );
      return null;
    }
  }

 async getProjectPathBySpace(spaceName: string): Promise<string | null> {
    try {
      const projectId = await this.getProjectIdBySpace(spaceName);
      if (!projectId) {
        return null;
      }
      return this.getProjectPathByProjectId(projectId);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get project path by space: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ProjectLookupService', operation: 'getProjectPathBySpace', spaceName }
      );
      return null;
    }
  }
  
  // Get the project ID with the latest update time
  async getLatestUpdatedProjectId(): Promise<string | null> {
    try {
      return this.projectIdManager.getLatestUpdatedProject();
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get latest updated project ID: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ProjectLookupService', operation: 'getLatestUpdatedProjectId' }
      );
      return null;
    }
  }
  
  // Get project path for the latest updated project
  async getProjectPathForLatestUpdatedProject(): Promise<string | null> {
    try {
      const latestProjectId = await this.getLatestUpdatedProjectId();
      if (!latestProjectId) {
        return null;
      }
      return this.getProjectPathByProjectId(latestProjectId);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get project path for latest updated project: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ProjectLookupService', operation: 'getProjectPathForLatestUpdatedProject' }
      );
      return null;
    }
  }
}