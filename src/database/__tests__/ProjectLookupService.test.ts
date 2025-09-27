import { ProjectLookupService } from '../ProjectLookupService';
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

// Mock ProjectIdManager
const mockProjectIdManager = {
  getProjectPath: jest.fn(),
  getLatestUpdatedProject: jest.fn(),
} as unknown as ProjectIdManager;

describe('ProjectLookupService', () => {
 let projectLookupService: ProjectLookupService;

  beforeEach(() => {
    jest.clearAllMocks();
    projectLookupService = new ProjectLookupService(
      mockProjectIdManager as ProjectIdManager,
      mockLogger,
      mockErrorHandler
    );
  });

  describe('getProjectIdByCollection', () => {
    it('should extract project ID from collection name with "project-" prefix', async () => {
      const collectionName = 'project-abc123def456';
      const result = await projectLookupService.getProjectIdByCollection(collectionName);

      expect(result).toBe('abc123def456');
    });

    it('should return null for collection names without "project-" prefix', async () => {
      const collectionName = 'other-collection';
      const result = await projectLookupService.getProjectIdByCollection(collectionName);

      expect(result).toBeNull();
    });

    it('should return null for empty collection name', async () => {
      const result = await projectLookupService.getProjectIdByCollection('');
      expect(result).toBeNull();
    });
 });

  describe('getProjectIdBySpace', () => {
    it('should extract project ID from space name with "project_" prefix', async () => {
      const spaceName = 'project_abc123def456';
      const result = await projectLookupService.getProjectIdBySpace(spaceName);

      expect(result).toBe('abc123def456');
    });

    it('should return null for space names without "project_" prefix', async () => {
      const spaceName = 'other_space';
      const result = await projectLookupService.getProjectIdBySpace(spaceName);

      expect(result).toBeNull();
    });

    it('should return null for empty space name', async () => {
      const result = await projectLookupService.getProjectIdBySpace('');
      expect(result).toBeNull();
    });
  });

  describe('getProjectPathByProjectId', () => {
    it('should return project path for a valid project ID', async () => {
      const projectId = 'abc123def456';
      const expectedPath = '/path/to/project';
      (mockProjectIdManager.getProjectPath as jest.Mock).mockReturnValue(expectedPath);

      const result = await projectLookupService.getProjectPathByProjectId(projectId);

      expect(result).toBe(expectedPath);
      expect(mockProjectIdManager.getProjectPath).toHaveBeenCalledWith(projectId);
    });

    it('should return null for invalid project ID', async () => {
      const projectId = 'invalid-id';
      (mockProjectIdManager.getProjectPath as jest.Mock).mockReturnValue(null);

      const result = await projectLookupService.getProjectPathByProjectId(projectId);

      expect(result).toBeNull();
      expect(mockProjectIdManager.getProjectPath).toHaveBeenCalledWith(projectId);
    });
  });

 describe('getProjectPathByCollection', () => {
    it('should return project path for a valid collection name', async () => {
      const collectionName = 'project-abc123def456';
      const projectId = 'abc123def456';
      const expectedPath = '/path/to/project';

      // Mock the chain of calls
      jest.spyOn(projectLookupService, 'getProjectIdByCollection').mockResolvedValue(projectId);
      (mockProjectIdManager.getProjectPath as jest.Mock).mockReturnValue(expectedPath);

      const result = await projectLookupService.getProjectPathByCollection(collectionName);

      expect(result).toBe(expectedPath);
      expect(projectLookupService.getProjectIdByCollection).toHaveBeenCalledWith(collectionName);
      expect(mockProjectIdManager.getProjectPath).toHaveBeenCalledWith(projectId);
    });

    it('should return null if collection name does not have project prefix', async () => {
      const collectionName = 'other-collection';
      jest.spyOn(projectLookupService, 'getProjectIdByCollection').mockResolvedValue(null);

      const result = await projectLookupService.getProjectPathByCollection(collectionName);

      expect(result).toBeNull();
      expect(projectLookupService.getProjectIdByCollection).toHaveBeenCalledWith(collectionName);
      expect(mockProjectIdManager.getProjectPath).not.toHaveBeenCalled();
    });

    it('should return null if project path is not found', async () => {
      const collectionName = 'project-abc123def456';
      const projectId = 'abc123def456';

      jest.spyOn(projectLookupService, 'getProjectIdByCollection').mockResolvedValue(projectId);
      (mockProjectIdManager.getProjectPath as jest.Mock).mockReturnValue(null);

      const result = await projectLookupService.getProjectPathByCollection(collectionName);

      expect(result).toBeNull();
      expect(projectLookupService.getProjectIdByCollection).toHaveBeenCalledWith(collectionName);
      expect(mockProjectIdManager.getProjectPath).toHaveBeenCalledWith(projectId);
    });
 });

  describe('getProjectPathBySpace', () => {
    it('should return project path for a valid space name', async () => {
      const spaceName = 'project_abc123def456';
      const projectId = 'abc123def456';
      const expectedPath = '/path/to/project';

      // Mock the chain of calls
      jest.spyOn(projectLookupService, 'getProjectIdBySpace').mockResolvedValue(projectId);
      (mockProjectIdManager.getProjectPath as jest.Mock).mockReturnValue(expectedPath);

      const result = await projectLookupService.getProjectPathBySpace(spaceName);

      expect(result).toBe(expectedPath);
      expect(projectLookupService.getProjectIdBySpace).toHaveBeenCalledWith(spaceName);
      expect(mockProjectIdManager.getProjectPath).toHaveBeenCalledWith(projectId);
    });

    it('should return null if space name does not have project prefix', async () => {
      const spaceName = 'other_space';
      jest.spyOn(projectLookupService, 'getProjectIdBySpace').mockResolvedValue(null);

      const result = await projectLookupService.getProjectPathBySpace(spaceName);

      expect(result).toBeNull();
      expect(projectLookupService.getProjectIdBySpace).toHaveBeenCalledWith(spaceName);
      expect(mockProjectIdManager.getProjectPath).not.toHaveBeenCalled();
    });

    it('should return null if project path is not found', async () => {
      const spaceName = 'project_abc123def456';
      const projectId = 'abc123def456';

      jest.spyOn(projectLookupService, 'getProjectIdBySpace').mockResolvedValue(projectId);
      (mockProjectIdManager.getProjectPath as jest.Mock).mockReturnValue(null);

      const result = await projectLookupService.getProjectPathBySpace(spaceName);

      expect(result).toBeNull();
      expect(projectLookupService.getProjectIdBySpace).toHaveBeenCalledWith(spaceName);
      expect(mockProjectIdManager.getProjectPath).toHaveBeenCalledWith(projectId);
    });
  });

  describe('getLatestUpdatedProjectId', () => {
    it('should return the latest updated project ID', async () => {
      const expectedProjectId = 'latest-project-id';
      (mockProjectIdManager.getLatestUpdatedProject as jest.Mock).mockReturnValue(expectedProjectId);

      const result = await projectLookupService.getLatestUpdatedProjectId();

      expect(result).toBe(expectedProjectId);
      expect(mockProjectIdManager.getLatestUpdatedProject).toHaveBeenCalled();
    });

    it('should return null if no projects exist', async () => {
      (mockProjectIdManager.getLatestUpdatedProject as jest.Mock).mockReturnValue(null);

      const result = await projectLookupService.getLatestUpdatedProjectId();

      expect(result).toBeNull();
      expect(mockProjectIdManager.getLatestUpdatedProject).toHaveBeenCalled();
    });
  });

 describe('getProjectPathForLatestUpdatedProject', () => {
    it('should return project path for the latest updated project', async () => {
      const latestProjectId = 'latest-project-id';
      const expectedPath = '/path/to/latest/project';

      (mockProjectIdManager.getLatestUpdatedProject as jest.Mock).mockReturnValue(latestProjectId);
      (mockProjectIdManager.getProjectPath as jest.Mock).mockReturnValue(expectedPath);

      const result = await projectLookupService.getProjectPathForLatestUpdatedProject();

      expect(result).toBe(expectedPath);
      expect(mockProjectIdManager.getLatestUpdatedProject).toHaveBeenCalled();
      expect(mockProjectIdManager.getProjectPath).toHaveBeenCalledWith(latestProjectId);
    });

    it('should return null if no latest project exists', async () => {
      (mockProjectIdManager.getLatestUpdatedProject as jest.Mock).mockReturnValue(null);

      const result = await projectLookupService.getProjectPathForLatestUpdatedProject();

      expect(result).toBeNull();
      expect(mockProjectIdManager.getLatestUpdatedProject).toHaveBeenCalled();
      expect(mockProjectIdManager.getProjectPath).not.toHaveBeenCalled();
    });

    it('should return null if latest project path is not found', async () => {
      const latestProjectId = 'latest-project-id';

      (mockProjectIdManager.getLatestUpdatedProject as jest.Mock).mockReturnValue(latestProjectId);
      (mockProjectIdManager.getProjectPath as jest.Mock).mockReturnValue(null);

      const result = await projectLookupService.getProjectPathForLatestUpdatedProject();

      expect(result).toBeNull();
      expect(mockProjectIdManager.getLatestUpdatedProject).toHaveBeenCalled();
      expect(mockProjectIdManager.getProjectPath).toHaveBeenCalledWith(latestProjectId);
    });
 });

  describe('error handling', () => {
    it('should handle errors in getProjectIdByCollection', async () => {
      jest.spyOn(String.prototype, 'startsWith').mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = await projectLookupService.getProjectIdByCollection('test-collection');
      expect(result).toBeNull();
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle errors in getProjectIdBySpace', async () => {
      jest.spyOn(String.prototype, 'startsWith').mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = await projectLookupService.getProjectIdBySpace('test_space');
      expect(result).toBeNull();
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle errors in getProjectPathByProjectId', async () => {
      (mockProjectIdManager.getProjectPath as jest.Mock).mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = await projectLookupService.getProjectPathByProjectId('test-id');
      expect(result).toBeNull();
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });

    it('should handle errors in getLatestUpdatedProjectId', async () => {
      (mockProjectIdManager.getLatestUpdatedProject as jest.Mock).mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = await projectLookupService.getLatestUpdatedProjectId();
      expect(result).toBeNull();
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });
});