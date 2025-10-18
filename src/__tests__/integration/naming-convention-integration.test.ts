import { ProjectIdManager } from '../../database/ProjectIdManager';
import { ConfigService } from '../../config/ConfigService';
import { QdrantConfigService } from '../../config/service/QdrantConfigService';
import { NebulaConfigService } from '../../config/service/NebulaConfigService';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { SqliteProjectManager } from '../../database/splite/SqliteProjectManager';

// Mock ConfigService
jest.mock('../../config/ConfigService', () => ({
  ConfigService: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockReturnValue({ mappingPath: './data/test-project-mapping.json' })
  }))
}));

// Mock QdrantConfigService
jest.mock('../../config/service/QdrantConfigService', () => ({
  QdrantConfigService: jest.fn().mockImplementation(() => ({
    getCollectionNameForProject: jest.fn().mockImplementation((projectId: string) => `project-${projectId}`)
  }))
}));

// Mock NebulaConfigService
jest.mock('../../config/service/NebulaConfigService', () => ({
  NebulaConfigService: jest.fn().mockImplementation(() => ({
    getSpaceNameForProject: jest.fn().mockImplementation((projectId: string) => `project-${projectId}`)
  }))
}));

// Mock LoggerService
jest.mock('../../utils/LoggerService', () => ({
  LoggerService: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }))
}));

// Mock ErrorHandlerService
jest.mock('../../utils/ErrorHandlerService', () => ({
  ErrorHandlerService: jest.fn().mockImplementation(() => ({
    handleError: jest.fn(),
  }))
}));

// Mock SqliteProjectManager
jest.mock('../../database/splite/SqliteProjectManager', () => ({
  SqliteProjectManager: jest.fn().mockImplementation(() => ({
    listProjectSpaces: jest.fn().mockResolvedValue([]),
    createProjectSpace: jest.fn().mockResolvedValue(undefined),
    deleteProjectSpace: jest.fn().mockResolvedValue(undefined)
  }))
}));

// Mock HashUtils to avoid file system operations
jest.mock('../../utils/HashUtils', () => ({
  HashUtils: {
    normalizePath: (path: string) => path,
    calculateDirectoryHash: jest.fn().mockResolvedValue({ hash: 'abcdef1234567890abcdef1234567890' })
  }
}));

// Mock fs/promises to avoid file system operations
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(JSON.stringify({})),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  rename: jest.fn(),
}));

describe('Naming Convention Integration Test', () => {
  let projectIdManager: ProjectIdManager;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockQdrantConfigService: jest.Mocked<QdrantConfigService>;
  let mockNebulaConfigService: jest.Mocked<NebulaConfigService>;
  let mockSqliteProjectManager: jest.Mocked<SqliteProjectManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfigService = {
      get: jest.fn().mockReturnValue({ mappingPath: './data/test-project-mapping.json' })
    } as unknown as jest.Mocked<ConfigService>;
    
    mockQdrantConfigService = {
      getCollectionNameForProject: jest.fn().mockImplementation((projectId: string) => `project-${projectId}`)
    } as unknown as jest.Mocked<QdrantConfigService>;
    
    mockNebulaConfigService = {
      getSpaceNameForProject: jest.fn().mockImplementation((projectId: string) => `project-${projectId}`)
    } as unknown as jest.Mocked<NebulaConfigService>;

    mockSqliteProjectManager = {
      listProjectSpaces: jest.fn().mockResolvedValue([]),
      createProjectSpace: jest.fn().mockResolvedValue(undefined),
      deleteProjectSpace: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<SqliteProjectManager>;
    
    const mockLoggerService = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;
    
    const mockErrorHandlerService = {
      handleError: jest.fn(),
    } as unknown as jest.Mocked<ErrorHandlerService>;
    
    projectIdManager = new ProjectIdManager(
      mockConfigService,
      mockQdrantConfigService,
      mockNebulaConfigService,
      mockLoggerService,
      mockErrorHandlerService,
      mockSqliteProjectManager
    );
  });

  describe('Project ID Generation and Naming', () => {
    it('should generate project ID and corresponding names correctly', async () => {
      const projectPath = '/test/project';
      const mockHash = 'abcdef1234567890abcdef1234567890';
      
      // Since we're mocking HashUtils, we can control the hash value
      const hashUtilsMock = require('../../utils/HashUtils').HashUtils;
      (hashUtilsMock.calculateDirectoryHash as jest.MockedFunction<any>).mockResolvedValue({ hash: mockHash });
      
      // Generate project ID
      const projectId = await projectIdManager.generateProjectId(projectPath);
      const expectedProjectId = mockHash.substring(0, 16);
      
      expect(projectId).toBe(expectedProjectId);
      
      // Get collection and space names
      const collectionName = projectIdManager.getCollectionName(projectId);
      const spaceName = projectIdManager.getSpaceName(projectId);
      
      // Verify naming conventions
      expect(collectionName).toBe(`project-${expectedProjectId}`);
      expect(spaceName).toBe(`project-${expectedProjectId}`); // Both should use unified naming convention
      
      // Verify that config services were called
      expect(mockQdrantConfigService.getCollectionNameForProject).toHaveBeenCalledWith(expectedProjectId);
      expect(mockNebulaConfigService.getSpaceNameForProject).toHaveBeenCalledWith(expectedProjectId);
    });

    it('should handle explicit configuration overrides', async () => {
      // Create a new manager with different config service behavior
      const mockQdrantConfigServiceWithOverride = {
        getCollectionNameForProject: jest.fn().mockImplementation((projectId: string) => 'explicit-collection')
      } as unknown as jest.Mocked<QdrantConfigService>;
      
      const mockNebulaConfigServiceWithOverride = {
        getSpaceNameForProject: jest.fn().mockImplementation((projectId: string) => 'explicit-space')
      } as unknown as jest.Mocked<NebulaConfigService>;
      
      const mockLoggerService = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      } as unknown as jest.Mocked<LoggerService>;
      
      const mockErrorHandlerService = {
        handleError: jest.fn(),
      } as unknown as jest.Mocked<ErrorHandlerService>;

      const mockSqliteProjectManager = {
        listProjectSpaces: jest.fn().mockResolvedValue([]),
        createProjectSpace: jest.fn().mockResolvedValue(undefined),
        deleteProjectSpace: jest.fn().mockResolvedValue(undefined)
      } as unknown as jest.Mocked<SqliteProjectManager>;
      
      const overrideProjectIdManager = new ProjectIdManager(
        mockConfigService,
        mockQdrantConfigServiceWithOverride,
        mockNebulaConfigServiceWithOverride,
        mockLoggerService,
        mockErrorHandlerService,
        mockSqliteProjectManager
      );
      
      const projectPath = '/test/explicit-project';
      const mockHash = '1234567890abcdef1234567890abcdef';
      
      // Mock the hash calculation
      const hashUtilsMock = require('../../utils/HashUtils').HashUtils;
      (hashUtilsMock.calculateDirectoryHash as jest.MockedFunction<any>).mockResolvedValue({ hash: mockHash });
      
      // Generate project ID
      const projectId = await overrideProjectIdManager.generateProjectId(projectPath);
      const expectedProjectId = mockHash.substring(0, 16);
      
      expect(projectId).toBe(expectedProjectId);
      
      // Get collection and space names
      const collectionName = overrideProjectIdManager.getCollectionName(projectId);
      const spaceName = overrideProjectIdManager.getSpaceName(projectId);
      
      // Verify that explicit configurations are used
      expect(collectionName).toBe('explicit-collection');
      expect(spaceName).toBe('explicit-space');
    });

    it('should maintain consistency between generated names', async () => {
      const projectPath1 = '/test/project1';
      const projectPath2 = '/test/project2';
      const mockHash1 = 'abcdef1234567890abcdef1234567890';
      const mockHash2 = 'fedcba0987654321fedcba0987654321';
      
      // Mock the hash calculation to return different values
      const hashUtilsMock = require('../../utils/HashUtils').HashUtils;
      (hashUtilsMock.calculateDirectoryHash as jest.MockedFunction<any>)
        .mockResolvedValueOnce({ hash: mockHash1 })
        .mockResolvedValueOnce({ hash: mockHash2 });
      
      // Generate project IDs
      const projectId1 = await projectIdManager.generateProjectId(projectPath1);
      const projectId2 = await projectIdManager.generateProjectId(projectPath2);
      
      const expectedProjectId1 = mockHash1.substring(0, 16);
      const expectedProjectId2 = mockHash2.substring(0, 16);
      
      expect(projectId1).toBe(expectedProjectId1);
      expect(projectId2).toBe(expectedProjectId2);
      expect(projectId1).not.toBe(projectId2);
      
      // Get collection and space names for both projects
      const collectionName1 = projectIdManager.getCollectionName(projectId1);
      const spaceName1 = projectIdManager.getSpaceName(projectId1);
      const collectionName2 = projectIdManager.getCollectionName(projectId2);
      const spaceName2 = projectIdManager.getSpaceName(projectId2);
      
      // Verify naming consistency
      expect(collectionName1).toBe(`project-${expectedProjectId1}`);
      expect(spaceName1).toBe(`project-${expectedProjectId1}`);
      expect(collectionName2).toBe(`project-${expectedProjectId2}`);
      expect(spaceName2).toBe(`project-${expectedProjectId2}`);
      
      // Verify names are different for different projects
      expect(collectionName1).not.toBe(collectionName2);
      expect(spaceName1).not.toBe(spaceName2);
    });
  });

  describe('Naming Convention Validation', () => {
    it('should validate naming convention format', () => {
      // Test valid names
      expect(ProjectIdManager.validateNamingConvention('project-abc123')).toBe(true);
      expect(ProjectIdManager.validateNamingConvention('project_abc123')).toBe(true);
      expect(ProjectIdManager.validateNamingConvention('project123')).toBe(true);
      expect(ProjectIdManager.validateNamingConvention('project-123_abc')).toBe(true);
      
      // Test invalid names
      expect(ProjectIdManager.validateNamingConvention('')).toBe(false); // Empty
      expect(ProjectIdManager.validateNamingConvention('project abc')).toBe(false); // Contains space
      expect(ProjectIdManager.validateNamingConvention('project.abc')).toBe(false); // Contains dot
      expect(ProjectIdManager.validateNamingConvention('_project')).toBe(false); // Starts with underscore
      expect(ProjectIdManager.validateNamingConvention('a'.repeat(64))).toBe(false); // Too long
    });

    it('should detect configuration conflicts', () => {
      const projectId = 'test1234567890';
      const explicitName = 'different-name';
      
      // Should return true when explicit config conflicts with project-specific name
      expect(ProjectIdManager.checkConfigurationConflict(explicitName, projectId)).toBe(true);
      
      // Should return false when explicit config matches project-specific name
      expect(ProjectIdManager.checkConfigurationConflict(`project-${projectId}`, projectId)).toBe(false);
      
      // Should return false when no explicit config
      expect(ProjectIdManager.checkConfigurationConflict(undefined, projectId)).toBe(false);
    });
  });
});