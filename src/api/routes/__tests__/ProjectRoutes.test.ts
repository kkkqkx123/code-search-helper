import express from 'express';
import request from 'supertest';
import { ProjectRoutes } from '../ProjectRoutes';
import { ProjectIdManager } from '../../../database/ProjectIdManager';
import { ProjectLookupService } from '../../../database/ProjectLookupService';
import { Logger } from '../../../utils/logger';
import { ProjectStateManager, ProjectState } from '../../../service/project/ProjectStateManager';
import { IndexService } from '../../../service/index/IndexService';
import { VectorIndexService } from '../../../service/index/VectorIndexService';
import { GraphIndexService } from '../../../service/index/GraphIndexService';

// Create mock implementations
const createMockProjectIdManager = () => ({
  refreshMapping: jest.fn(),
  listAllProjects: jest.fn(),
  getProjectPath: jest.fn(),
  removeProject: jest.fn(),
  saveMapping: jest.fn()
});

const createMockProjectLookupService = () => ({
  indexSyncService: {
    startIndexing: jest.fn(),
    stopIndexing: jest.fn(),
    getIndexStatus: jest.fn(),
    reindexProject: jest.fn(),
    on: jest.fn(),
    getAllIndexStatuses: jest.fn()
  }
});

const createMockProjectStateManager = () => ({
  getProjectState: jest.fn(),
  getAllProjectStates: jest.fn(),
  createOrUpdateProjectState: jest.fn(),
  deleteProjectState: jest.fn(),
  getProjectStats: jest.fn(),
  activateProject: jest.fn(),
  deactivateProject: jest.fn(),
  refreshProjectState: jest.fn(),
  refreshAllProjectStates: jest.fn()
});

// Create mock implementations for new services
const createMockVectorIndexService = () => ({
  indexVectors: jest.fn(),
  getVectorStatus: jest.fn(),
  batchIndexVectors: jest.fn()
});

const createMockGraphIndexService = () => ({
  indexGraph: jest.fn(),
  getGraphStatus: jest.fn(),
  batchIndexGraph: jest.fn()
});

describe('ProjectRoutes', () => {
  let app: express.Application;
  let projectRoutes: ProjectRoutes;
  let mockProjectIdManager: any;
  let mockProjectLookupService: any;
  let mockLogger: any;
  let mockProjectStateManager: any;
  let mockVectorIndexService: any;
  let mockGraphIndexService: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockProjectIdManager = createMockProjectIdManager();
    mockProjectLookupService = createMockProjectLookupService();
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };
    mockProjectStateManager = createMockProjectStateManager();
    mockVectorIndexService = createMockVectorIndexService();
    mockGraphIndexService = createMockGraphIndexService();

    // Create ProjectRoutes instance
    projectRoutes = new ProjectRoutes(
      mockProjectIdManager as ProjectIdManager,
      mockProjectLookupService as ProjectLookupService,
      mockLogger as Logger,
      mockProjectStateManager as ProjectStateManager,
      mockProjectLookupService.indexSyncService as IndexService,
      mockVectorIndexService as VectorIndexService,
      mockGraphIndexService as GraphIndexService,
      {} as any, // Mock hotReloadConfigService
      {} as any // Mock projectPathMappingService
    );

    // Create express app and use the router
    app = express();
    app.use(express.json());
    app.use('/api/v1/projects', projectRoutes.getRouter());
  });

  describe('GET /api/v1/projects', () => {
    it('should return all projects', async () => {
      // Mock data
      const mockProjectIds = ['project1', 'project2'];
      const mockProjectPath1 = '/path/to/project1';
      const mockProjectPath2 = '/path/to/project2';

      // Mock ProjectIdManager methods
      mockProjectIdManager.refreshMapping.mockResolvedValue(undefined);
      mockProjectIdManager.listAllProjects.mockReturnValue(mockProjectIds);
      mockProjectIdManager.getProjectPath.mockImplementation((projectId: string) => {
        if (projectId === 'project1') return mockProjectPath1;
        if (projectId === 'project2') return mockProjectPath2;
        return undefined;
      });

      // Mock ProjectStateManager methods
      mockProjectStateManager.getProjectState.mockImplementation((projectId: string) => {
        if (projectId === 'project1') {
          return {
            projectId: 'project1',
            projectPath: mockProjectPath1,
            name: 'Project 1',
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
            settings: {
              autoIndex: true,
              watchChanges: true
            }
          } as ProjectState;
        }
        if (projectId === 'project2') {
          return {
            projectId: 'project2',
            projectPath: mockProjectPath2,
            name: 'Project 2',
            status: 'inactive',
            createdAt: new Date(),
            updatedAt: new Date(),
            settings: {
              autoIndex: true,
              watchChanges: true
            }
          } as ProjectState;
        }
        return null;
      });

      const response = await request(app).get('/api/v1/projects');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(mockProjectIdManager.refreshMapping).toHaveBeenCalled();
      expect(mockProjectIdManager.listAllProjects).toHaveBeenCalled();
    });

    it('should handle error when getting projects fails', async () => {
      // Mock ProjectIdManager to throw an error
      mockProjectIdManager.refreshMapping.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/v1/projects');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/v1/projects/:projectId', () => {
    it('should return project details when project exists', async () => {
      const projectId = 'test-project-id';
      const projectPath = '/path/to/project';

      // Mock ProjectIdManager methods
      mockProjectIdManager.getProjectPath.mockImplementation((id: string) => {
        return id === projectId ? projectPath : undefined;
      });

      // Mock ProjectStateManager methods
      mockProjectStateManager.getProjectState.mockReturnValue({
        projectId,
        projectPath,
        name: 'Test Project',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        settings: {
          autoIndex: true,
          watchChanges: true
        }
      } as ProjectState);

      const response = await request(app).get(`/api/v1/projects/${projectId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(projectId);
      expect(response.body.data.path).toBe(projectPath);
    });

    it('should return 404 when project is not found', async () => {
      const projectId = 'non-existent-project';

      // Mock ProjectIdManager to return undefined for project path
      mockProjectIdManager.getProjectPath.mockReturnValue(undefined);

      const response = await request(app).get(`/api/v1/projects/${projectId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Project not found');
    });

    it('should handle error when getting project details fails', async () => {
      const projectId = 'test-project-id';

      // Mock ProjectIdManager to throw an error
      mockProjectIdManager.getProjectPath.mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app).get(`/api/v1/projects/${projectId}`);

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/v1/projects/:projectId', () => {
    it('should delete project when it exists', async () => {
      const projectId = 'test-project-id';
      const projectPath = '/path/to/project';

      // Mock ProjectIdManager methods
      mockProjectIdManager.getProjectPath.mockReturnValue(projectPath);
      mockProjectIdManager.removeProject.mockReturnValue(true);
      mockProjectIdManager.saveMapping.mockResolvedValue(undefined);

      const response = await request(app).delete(`/api/v1/projects/${projectId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Project deleted successfully');
      expect(mockProjectIdManager.removeProject).toHaveBeenCalledWith(projectPath);
      expect(mockProjectIdManager.saveMapping).toHaveBeenCalled();
    });

    it('should return 404 when project is not found', async () => {
      const projectId = 'non-existent-project';

      // Mock ProjectIdManager to return undefined for project path
      mockProjectIdManager.getProjectPath.mockReturnValue(undefined);

      const response = await request(app).delete(`/api/v1/projects/${projectId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Project not found');
    });

    it('should handle error when deleting project fails', async () => {
      const projectId = 'test-project-id';
      const projectPath = '/path/to/project';

      // Mock ProjectIdManager methods
      mockProjectIdManager.getProjectPath.mockReturnValue(projectPath);
      mockProjectIdManager.removeProject.mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app).delete(`/api/v1/projects/${projectId}`);

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/v1/projects/:projectId/reindex', () => {
    it('should start reindexing when project exists', async () => {
      const projectId = 'test-project-id';
      const projectPath = '/path/to/project';

      // Mock ProjectIdManager methods
      mockProjectIdManager.getProjectPath.mockImplementation((id: string) => {
        return id === projectId ? projectPath : undefined;
      });

      // Mock IndexSyncService reindexProject method to return the projectId
      mockProjectLookupService.indexSyncService.reindexProject.mockResolvedValue(projectId);

      const response = await request(app).post(`/api/v1/projects/${projectId}/reindex`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.projectId).toBe(projectId);
      expect(response.body.data.message).toBe('Re-indexing started');
    });

    it('should return 404 when project is not found', async () => {
      const projectId = 'non-existent-project';

      // Mock ProjectIdManager to return undefined for project path
      mockProjectIdManager.getProjectPath.mockReturnValue(undefined);

      const response = await request(app).post(`/api/v1/projects/${projectId}/reindex`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Project not found');
    });

    it('should handle error when reindexing fails', async () => {
      const projectId = 'test-project-id';

      // Mock ProjectIdManager to throw an error
      mockProjectIdManager.getProjectPath.mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app).post(`/api/v1/projects/${projectId}/reindex`);

      expect(response.status).toBe(500);
    });
  });
});