import { ProjectIdManager } from '../ProjectIdManager';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';

// Mock the dependencies
const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'project') {
      return { mappingPath: './data/test-project-mapping.json' };
    }
    return undefined;
  })
} as unknown as ConfigService;

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as unknown as LoggerService;

const mockErrorHandler = {
  handleError: jest.fn(),
} as unknown as ErrorHandlerService;

// Mock the fs module
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockRejectedValue({ code: 'ENOENT' }), // Simulate file not found
  writeFile: jest.fn(),
  mkdir: jest.fn(),
}));

// Mock the HashUtils
jest.mock('../../utils/HashUtils', () => ({
  HashUtils: {
    calculateDirectoryHash: jest.fn().mockImplementation((path: string) => {
      // Generate different hash based on the path to avoid conflicts
      if (path.includes('project1')) {
        return Promise.resolve({
          path: path,
          hash: 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678',
          fileCount: 5,
          files: []
        });
      } else if (path.includes('project2')) {
        return Promise.resolve({
          path: path,
          hash: 'f8e7d6c5b4a392817f8e7d6c5b4a392817f8e7d6c5b4a392817f8e7d6c5b4a392',
          fileCount: 3,
          files: []
        });
      } else {
        return Promise.resolve({
          path: path,
          hash: 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678',
          fileCount: 5,
          files: []
        });
      }
    })
  }
}));

describe('ProjectIdManager', () => {
  let projectIdManager: ProjectIdManager;

  beforeEach(() => {
    jest.clearAllMocks();
    projectIdManager = new ProjectIdManager();
  });

  describe('generateProjectId', () => {
    it('should generate a project ID based on directory hash', async () => {
      const projectPath = '/test/project';
      const result = await projectIdManager.generateProjectId(projectPath);

      // Should be project name followed by underscore and 8-char hash
      expect(result).toMatch(/^project_[a-z0-9]{8}$/);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Generated project ID ${result} for path ${projectPath}`
      );
    });

    it('should return existing project ID for the same path', async () => {
      const projectPath = '/test/project';
      
      // First call generates the ID
      const firstResult = await projectIdManager.generateProjectId(projectPath);
      
      // Second call should return the same ID
      const secondResult = await projectIdManager.generateProjectId(projectPath);

      expect(firstResult).toBe(secondResult);
    });

    it('should create mapping relationships', async () => {
      const projectPath = '/test/project';
      const projectId = await projectIdManager.generateProjectId(projectPath);

      expect(projectIdManager.getProjectId(projectPath)).toBe(projectId);
      expect(projectIdManager.getProjectPath(projectId)).toBe(projectPath);
      expect(projectIdManager.getCollectionName(projectId)).toBe(`project-${projectId}`);
      expect(projectIdManager.getSpaceName(projectId)).toBe(`project_${projectId}`);
    });
  });

  describe('getProjectId', () => {
    it('should return project ID for a given path', async () => {
      const projectPath = '/test/project';
      const projectId = await projectIdManager.generateProjectId(projectPath);

      const result = projectIdManager.getProjectId(projectPath);
      expect(result).toBe(projectId);
    });

    it('should return undefined for unknown path', () => {
      const result = projectIdManager.getProjectId('/unknown/path');
      expect(result).toBeUndefined();
    });
 });

  describe('getProjectPath', () => {
    it('should return project path for a given ID', async () => {
      const projectPath = '/test/project';
      const projectId = await projectIdManager.generateProjectId(projectPath);

      const result = projectIdManager.getProjectPath(projectId);
      expect(result).toBe(projectPath);
    });

    it('should return undefined for unknown ID', () => {
      const result = projectIdManager.getProjectPath('unknown-id');
      expect(result).toBeUndefined();
    });
  });

 describe('getCollectionName and getSpaceName', () => {
    it('should return collection and space names for a given project ID', async () => {
      const projectPath = '/test/project';
      const projectId = await projectIdManager.generateProjectId(projectPath);

      const collectionName = projectIdManager.getCollectionName(projectId);
      const spaceName = projectIdManager.getSpaceName(projectId);

      expect(collectionName).toBe(`project-${projectId}`);
      expect(spaceName).toBe(`project_${projectId}`);
    });
  });

  describe('updateProjectTimestamp', () => {
    it('should update the timestamp for a project', async () => {
      const projectPath = '/test/project';
      const projectId = await projectIdManager.generateProjectId(projectPath);

      const initialTime = projectIdManager.getProjectsByUpdateTime()[0]?.updateTime;
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      projectIdManager.updateProjectTimestamp(projectId);
      const updatedTime = projectIdManager.getProjectsByUpdateTime()[0]?.updateTime;

      expect(updatedTime.getTime()).toBeGreaterThan(initialTime.getTime());
    });
  });

  describe('getLatestUpdatedProject', () => {
    it('should return the project with the latest update time', async () => {
      const projectPath1 = '/test/project1';
      const projectPath2 = '/test/project2';
      
      const projectId1 = await projectIdManager.generateProjectId(projectPath1);
      
      // Wait to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const projectId2 = await projectIdManager.generateProjectId(projectPath2);

      // Wait to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Update project2 to make it more recent
      projectIdManager.updateProjectTimestamp(projectId2);

      const latestProjectId = projectIdManager.getLatestUpdatedProject();
      expect(latestProjectId).toBe(projectId2);
    });
  });

  describe('getProjectsByUpdateTime', () => {
    it('should return projects sorted by update time', async () => {
      const projectPath1 = '/test/project1';
      const projectPath2 = '/test/project2';
      
      const projectId1 = await projectIdManager.generateProjectId(projectPath1);
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const projectId2 = await projectIdManager.generateProjectId(projectPath2);
      
      // Wait a bit more before updating to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Update project1 to make it the most recent
      projectIdManager.updateProjectTimestamp(projectId1);

      const projects = projectIdManager.getProjectsByUpdateTime();
      
      // Verify we have 2 projects
      expect(projects).toHaveLength(2);
      
      // Verify the first one is the most recently updated (projectId1)
      expect(projects[0].projectId).toBe(projectId1);
      
      // Verify the second one is the earlier updated (projectId2)
      expect(projects[1].projectId).toBe(projectId2);
      
      // Verify that the first project has a more recent timestamp
      expect(projects[0].updateTime.getTime()).toBeGreaterThan(projects[1].updateTime.getTime());
    });
  });

 describe('hasProject', () => {
    it('should return true if project exists', async () => {
      const projectPath = '/test/project';
      await projectIdManager.generateProjectId(projectPath);

      const result = projectIdManager.hasProject(projectPath);
      expect(result).toBe(true);
    });

    it('should return false if project does not exist', () => {
      const result = projectIdManager.hasProject('/unknown/path');
      expect(result).toBe(false);
    });
  });

  describe('removeProject', () => {
    it('should remove project from mappings', async () => {
      const projectPath = '/test/project';
      const projectId = await projectIdManager.generateProjectId(projectPath);

      // Verify project exists before removal
      expect(projectIdManager.hasProject(projectPath)).toBe(true);
      expect(projectIdManager.getProjectId(projectPath)).toBe(projectId);

      // Remove project
      const result = projectIdManager.removeProject(projectPath);
      expect(result).toBe(true);

      // Verify project no longer exists
      expect(projectIdManager.hasProject(projectPath)).toBe(false);
      expect(projectIdManager.getProjectId(projectPath)).toBeUndefined();
    });

    it('should return false if project does not exist', () => {
      const result = projectIdManager.removeProject('/unknown/path');
      expect(result).toBe(false);
    });
 });

  describe('listAllProjects', () => {
    it('should return all project IDs', async () => {
      const projectPath1 = '/test/project1';
      const projectPath2 = '/test/project2';
      
      const projectId1 = await projectIdManager.generateProjectId(projectPath1);
      const projectId2 = await projectIdManager.generateProjectId(projectPath2);

      const allProjects = projectIdManager.listAllProjects();
      expect(allProjects).toContain(projectId1);
      expect(allProjects).toContain(projectId2);
      expect(allProjects).toHaveLength(2);
    });
  });
});