import { ProjectIdManager } from '../ProjectIdManager';
import { HashUtils } from '../../utils/HashUtils';

// Mock HashUtils
jest.mock('../../utils/HashUtils', () => ({
  HashUtils: {
    normalizePath: jest.fn(),
    calculateDirectoryHash: jest.fn(),
  },
}));

// Mock fs
jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
}));

describe('ProjectIdManager', () => {
  let projectIdManager: ProjectIdManager;
  
  beforeEach(() => {
    projectIdManager = new ProjectIdManager();
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  describe('generateProjectId', () => {
    it('should generate a project ID based on directory hash', async () => {
      const projectPath = '/test/project';
      const normalizedPath = '/test/project';
      const mockHash = 'abcdef1234567890';
      
      (HashUtils.normalizePath as jest.Mock).mockReturnValue(normalizedPath);
      (HashUtils.calculateDirectoryHash as jest.Mock).mockResolvedValue({ hash: mockHash });
      
      const projectId = await projectIdManager.generateProjectId(projectPath);
      
      expect(projectId).toBe(mockHash.substring(0, 16));
      expect(HashUtils.normalizePath).toHaveBeenCalledWith(projectPath);
      expect(HashUtils.calculateDirectoryHash).toHaveBeenCalledWith(projectPath);
    });
  });
  
  describe('getProjectId', () => {
    it('should return the project ID for a given path', () => {
      const projectPath = '/test/project';
      const normalizedPath = '/test/project';
      const projectId = 'abcdef1234567890';
      
      (HashUtils.normalizePath as jest.Mock).mockReturnValue(normalizedPath);
      // Set up the map with a test value
      (projectIdManager as any).projectIdMap.set(normalizedPath, projectId);
      
      const result = projectIdManager.getProjectId(projectPath);
      
      expect(result).toBe(projectId);
    });
    
    it('should return undefined if project ID does not exist', () => {
      const projectPath = '/test/project';
      const normalizedPath = '/test/project';
      
      (HashUtils.normalizePath as jest.Mock).mockReturnValue(normalizedPath);
      
      const result = projectIdManager.getProjectId(projectPath);
      
      expect(result).toBeUndefined();
    });
  });
  
  describe('getProjectPath', () => {
    it('should return the project path for a given project ID', () => {
      const projectId = 'abcdef1234567890';
      const projectPath = '/test/project';
      
      // Set up the map with a test value
      (projectIdManager as any).pathToProjectMap.set(projectId, projectPath);
      
      const result = projectIdManager.getProjectPath(projectId);
      
      expect(result).toBe(projectPath);
    });
  });
  
  describe('getCollectionName', () => {
    it('should return the collection name for a given project ID', () => {
      const projectId = 'abcdef1234567890';
      const collectionName = 'project-abcdef1234567890';
      
      // Set up the map with a test value
      (projectIdManager as any).collectionMap.set(projectId, collectionName);
      
      const result = projectIdManager.getCollectionName(projectId);
      
      expect(result).toBe(collectionName);
    });
  });
  
  describe('getSpaceName', () => {
    it('should return the space name for a given project ID', () => {
      const projectId = 'abcdef1234567890';
      const spaceName = 'project_abcdef1234567890';
      
      // Set up the map with a test value
      (projectIdManager as any).spaceMap.set(projectId, spaceName);
      
      const result = projectIdManager.getSpaceName(projectId);
      
      expect(result).toBe(spaceName);
    });
  });
});