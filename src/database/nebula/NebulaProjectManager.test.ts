import { NebulaProjectManager } from './NebulaProjectManager';
import { DatabaseLoggerService } from '../common/DatabaseLoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ProjectIdManager } from '../ProjectIdManager';
import { INebulaSpaceManager } from './space/NebulaSpaceManager';
import { INebulaConnectionManager } from './NebulaConnectionManager';
import { INebulaQueryBuilder } from './NebulaQueryBuilder';
import { NebulaNode, NebulaRelationship } from './NebulaTypes';
import { DatabaseServiceValidator } from '../common/DatabaseServiceValidator';
import { DatabaseError } from '../common/DatabaseError';

// Mock implementations
class MockDatabaseLoggerService implements Partial<DatabaseLoggerService> {
  logDatabaseEvent = jest.fn().mockResolvedValue(undefined);
}

class MockErrorHandlerService implements Partial<ErrorHandlerService> {
  handleError = jest.fn();
}

class MockProjectIdManager implements Partial<ProjectIdManager> {
  generateProjectId = jest.fn().mockResolvedValue('test-project-id');
  getProjectId = jest.fn().mockResolvedValue('test-project-id');
  getSpaceName = jest.fn().mockReturnValue('test_space_name');
  removeProject = jest.fn();
  listAllProjectPaths = jest.fn().mockReturnValue(['/test/project']);
  getProjectsByUpdateTime = jest.fn().mockReturnValue([{ projectId: 'test-project-id', updateTime: new Date() }]);
}

class MockNebulaSpaceManager implements Partial<INebulaSpaceManager> {
  createSpace = jest.fn().mockResolvedValue(true);
  deleteSpace = jest.fn().mockResolvedValue(true);
  getSpaceInfo = jest.fn().mockResolvedValue({ name: 'test_space_name', partition_num: 1, replica_factor: 1, vid_type: 'FIXED_STRING(8)', charset: 'utf8', collate: 'utf8_bin' });
  clearSpace = jest.fn().mockResolvedValue(true);
}

class MockNebulaConnectionManager implements Partial<INebulaConnectionManager> {
  executeQuery = jest.fn().mockResolvedValue({ data: [] });
  executeTransaction = jest.fn().mockResolvedValue([]);
  connect = jest.fn().mockResolvedValue(true);
  disconnect = jest.fn().mockResolvedValue(undefined);
  isConnected = jest.fn().mockReturnValue(true);
  getConfig = jest.fn();
  updateConfig = jest.fn();
  getConnectionStatus = jest.fn();
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
}

class MockNebulaQueryBuilder implements Partial<INebulaQueryBuilder> {
  // Mock implementation for query builder
}

describe('NebulaProjectManager', () => {
  let nebulaProjectManager: NebulaProjectManager;
  let mockDatabaseLogger: MockDatabaseLoggerService;
  let mockErrorHandler: MockErrorHandlerService;
  let mockProjectIdManager: MockProjectIdManager;
  let mockSpaceManager: MockNebulaSpaceManager;
  let mockConnectionManager: MockNebulaConnectionManager;
  let mockQueryBuilder: MockNebulaQueryBuilder;

  beforeEach(() => {
    mockDatabaseLogger = new MockDatabaseLoggerService();
    mockErrorHandler = new MockErrorHandlerService();
    mockProjectIdManager = new MockProjectIdManager();
    mockSpaceManager = new MockNebulaSpaceManager();
    mockConnectionManager = new MockNebulaConnectionManager();
    mockQueryBuilder = new MockNebulaQueryBuilder();

    nebulaProjectManager = new NebulaProjectManager(
      mockDatabaseLogger as any,
      mockErrorHandler as any,
      mockProjectIdManager as any,
      mockSpaceManager as any,
      mockConnectionManager as any,
      mockQueryBuilder as any
    );
  });

  describe('createSpaceForProject', () => {
    it('should create a space for a project successfully', async () => {
      const projectPath = '/test/project';
      
      const result = await nebulaProjectManager.createSpaceForProject(projectPath);
      
      expect(result).toBe(true);
      expect(mockProjectIdManager.generateProjectId).toHaveBeenCalledWith(projectPath);
      expect(mockSpaceManager.createSpace).toHaveBeenCalledWith('test-project-id', undefined);
    });

    it('should handle validation errors', async () => {
      await expect(nebulaProjectManager.createSpaceForProject('')).rejects.toThrow(DatabaseError);
      await expect(nebulaProjectManager.createSpaceForProject('invalid<path>')).rejects.toThrow(DatabaseError);
    });

    it('should handle errors during space creation', async () => {
      mockSpaceManager.createSpace = jest.fn().mockResolvedValue(false);
      
      const result = await nebulaProjectManager.createSpaceForProject('/test/project');
      
      expect(result).toBe(false);
    });
  });

  describe('deleteSpaceForProject', () => {
    it('should delete a space for a project successfully', async () => {
      const projectPath = '/test/project';
      
      const result = await nebulaProjectManager.deleteSpaceForProject(projectPath);
      
      expect(result).toBe(true);
      expect(mockProjectIdManager.getProjectId).toHaveBeenCalledWith(projectPath);
      expect(mockSpaceManager.deleteSpace).toHaveBeenCalledWith('test-project-id');
    });

    it('should handle validation errors', async () => {
      await expect(nebulaProjectManager.deleteSpaceForProject('')).rejects.toThrow(DatabaseError);
    });
  });

  describe('getSpaceInfoForProject', () => {
    it('should get space info for a project successfully', async () => {
      const projectPath = '/test/project';
      
      const result = await nebulaProjectManager.getSpaceInfoForProject(projectPath);
      
      expect(result).not.toBeNull();
      expect(mockProjectIdManager.getProjectId).toHaveBeenCalledWith(projectPath);
      expect(mockSpaceManager.getSpaceInfo).toHaveBeenCalledWith('test-project-id');
    });

    it('should return null if project not found', async () => {
      mockProjectIdManager.getProjectId = jest.fn().mockResolvedValue(null);
      
      const result = await nebulaProjectManager.getSpaceInfoForProject('/test/project');
      
      expect(result).toBeNull();
    });
  });

  describe('clearSpaceForProject', () => {
    it('should clear a space for a project successfully', async () => {
      const projectPath = '/test/project';
      
      const result = await nebulaProjectManager.clearSpaceForProject(projectPath);
      
      expect(result).toBe(true);
      expect(mockProjectIdManager.getProjectId).toHaveBeenCalledWith(projectPath);
      expect(mockSpaceManager.clearSpace).toHaveBeenCalledWith('test-project-id');
    });

    it('should handle validation errors', async () => {
      await expect(nebulaProjectManager.clearSpaceForProject('')).rejects.toThrow(DatabaseError);
    });
  });

  describe('listProjectSpaces', () => {
    it('should list project spaces successfully', async () => {
      const result = await nebulaProjectManager.listProjectSpaces();
      
      expect(result).toHaveLength(1);
      expect(mockProjectIdManager.listAllProjectPaths).toHaveBeenCalled();
      expect(mockSpaceManager.getSpaceInfo).toHaveBeenCalledWith('test-project-id');
    });
  });

  describe('insertNodesForProject', () => {
    it('should insert nodes for a project successfully', async () => {
      const projectPath = '/test/project';
      const nodes: NebulaNode[] = [
        { id: 'node1', label: 'TestLabel', properties: { name: 'Test Node' } }
      ];
      
      const result = await nebulaProjectManager.insertNodesForProject(projectPath, nodes);
      
      expect(result).toBe(true);
      expect(mockProjectIdManager.getProjectId).toHaveBeenCalledWith(projectPath);
    });

    it('should handle validation errors', async () => {
      const invalidNodes = [{ invalid: 'node' }];
      await expect(nebulaProjectManager.insertNodesForProject('', [])).rejects.toThrow(DatabaseError);
      await expect(nebulaProjectManager.insertNodesForProject('/test/project', invalidNodes as any)).rejects.toThrow(DatabaseError);
    });
  });

  describe('insertRelationshipsForProject', () => {
    it('should insert relationships for a project successfully', async () => {
      const projectPath = '/test/project';
      const relationships: NebulaRelationship[] = [
        { type: 'TEST_REL', sourceId: 'node1', targetId: 'node2', properties: { value: 123 } }
      ];
      
      const result = await nebulaProjectManager.insertRelationshipsForProject(projectPath, relationships);
      
      expect(result).toBe(true);
      expect(mockProjectIdManager.getProjectId).toHaveBeenCalledWith(projectPath);
    });

    it('should handle validation errors', async () => {
      const invalidRelationships = [{ invalid: 'relationship' }];
      await expect(nebulaProjectManager.insertRelationshipsForProject('', [])).rejects.toThrow(DatabaseError);
      await expect(nebulaProjectManager.insertRelationshipsForProject('/test/project', invalidRelationships as any)).rejects.toThrow(DatabaseError);
    });
  });

  describe('updateProjectData', () => {
    it('should update node data successfully', async () => {
      const projectPath = '/test/project';
      const nodeId = 'node1';
      const data = { properties: { updated: true } };
      
      // Mock a successful query result for finding the node
      mockConnectionManager.executeQuery = jest.fn()
        .mockResolvedValueOnce({ data: [{ id: 'node1' }] }) // For the first query (finding node)
        .mockResolvedValueOnce({ data: [] }); // For the update query
      
      const result = await nebulaProjectManager.updateProjectData(projectPath, nodeId, data);
      
      expect(result).toBe(true);
      expect(mockConnectionManager.executeQuery).toHaveBeenCalledTimes(2);
    });

    it('should update relationship data successfully', async () => {
      const projectPath = '/test/project';
      const relId = 'rel1';
      const data = { properties: { updated: true } };
      
      // Mock queries: first one finds no node, second one finds relationship
      mockConnectionManager.executeQuery = jest.fn()
        .mockResolvedValueOnce({ data: [] }) // For the first query (finding node)
        .mockResolvedValueOnce({ data: [{ id: 'rel1' }] }); // For the second query (finding relationship)
      
      const result = await nebulaProjectManager.updateProjectData(projectPath, relId, data);
      
      expect(result).toBe(true);
      expect(mockConnectionManager.executeQuery).toHaveBeenCalledTimes(2);
    });

    it('should handle validation errors', async () => {
      await expect(nebulaProjectManager.updateProjectData('', 'id', {})).rejects.toThrow(DatabaseError);
      await expect(nebulaProjectManager.updateProjectData('/test/project', '', {})).rejects.toThrow(DatabaseError);
    });
  });

  describe('deleteProjectData', () => {
    it('should delete node data successfully', async () => {
      const projectPath = '/test/project';
      const nodeId = 'node1';
      
      // Mock a successful query result for finding the node
      mockConnectionManager.executeQuery = jest.fn()
        .mockResolvedValueOnce({ data: [{ id: 'node1' }] }) // For the first query (finding node)
        .mockResolvedValueOnce({ data: [] }); // For the delete query
      
      const result = await nebulaProjectManager.deleteProjectData(projectPath, nodeId);
      
      expect(result).toBe(true);
      expect(mockConnectionManager.executeQuery).toHaveBeenCalledTimes(2);
    });

    it('should delete relationship data successfully', async () => {
      const projectPath = '/test/project';
      const relId = 'rel1';
      
      // Mock queries: first one finds no node, second one finds relationship
      mockConnectionManager.executeQuery = jest.fn()
        .mockResolvedValueOnce({ data: [] }) // For the first query (finding node)
        .mockResolvedValueOnce({ data: [{ id: 'rel1' }] }); // For the second query (finding relationship)
      
      const result = await nebulaProjectManager.deleteProjectData(projectPath, relId);
      
      expect(result).toBe(true);
      expect(mockConnectionManager.executeQuery).toHaveBeenCalledTimes(2);
    });

    it('should handle validation errors', async () => {
      await expect(nebulaProjectManager.deleteProjectData('', 'id')).rejects.toThrow(DatabaseError);
      await expect(nebulaProjectManager.deleteProjectData('/test/project', '')).rejects.toThrow(DatabaseError);
    });
  });

  describe('searchProjectData', () => {
    it('should search project data with string query', async () => {
      const projectPath = '/test/project';
      const query = 'MATCH (n) RETURN n';
      
      const result = await nebulaProjectManager.searchProjectData(projectPath, query);
      
      expect(result).toEqual([]);
      expect(mockConnectionManager.executeQuery).toHaveBeenCalled();
    });

    it('should search project data with node query', async () => {
      const projectPath = '/test/project';
      const query = { type: 'node', label: 'TestLabel', filter: { name: 'Test' } };
      
      const result = await nebulaProjectManager.searchProjectData(projectPath, query);
      
      expect(result).toEqual([]);
      expect(mockConnectionManager.executeQuery).toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      await expect(nebulaProjectManager.searchProjectData('', {})).rejects.toThrow(DatabaseError);
      await expect(nebulaProjectManager.searchProjectData('/test/project', null)).rejects.toThrow(DatabaseError);
    });
  });

  describe('getProjectDataById', () => {
    it('should get node data by ID successfully', async () => {
      const projectPath = '/test/project';
      const nodeId = 'node1';
      const mockNodeData = { id: 'node1', name: 'Test Node' };
      
      // Mock a successful query result for finding the node
      mockConnectionManager.executeQuery = jest.fn()
        .mockResolvedValueOnce({ data: [mockNodeData] }); // For the first query (finding node)
      
      const result = await nebulaProjectManager.getProjectDataById(projectPath, nodeId);
      
      expect(result).toEqual(mockNodeData);
      expect(mockConnectionManager.executeQuery).toHaveBeenCalledTimes(1);
    });

    it('should get relationship data by ID successfully', async () => {
      const projectPath = '/test/project';
      const relId = 'rel1';
      const mockRelData = { id: 'rel1', type: 'TEST_REL' };
      
      // Mock queries: first one finds no node, second one finds relationship
      mockConnectionManager.executeQuery = jest.fn()
        .mockResolvedValueOnce({ data: [] }) // For the first query (finding node)
        .mockResolvedValueOnce({ data: [mockRelData] }); // For the second query (finding relationship)
      
      const result = await nebulaProjectManager.getProjectDataById(projectPath, relId);
      
      expect(result).toEqual(mockRelData);
      expect(mockConnectionManager.executeQuery).toHaveBeenCalledTimes(2);
    });

    it('should return null if data not found', async () => {
      const projectPath = '/test/project';
      const nodeId = 'nonexistent';
      
      // Mock empty results for both node and relationship queries
      mockConnectionManager.executeQuery = jest.fn()
        .mockResolvedValueOnce({ data: [] }) // For the first query (finding node)
        .mockResolvedValueOnce({ data: [] }); // For the second query (finding relationship)
      
      const result = await nebulaProjectManager.getProjectDataById(projectPath, nodeId);
      
      expect(result).toBeNull();
    });

    it('should handle validation errors', async () => {
      await expect(nebulaProjectManager.getProjectDataById('', 'id')).rejects.toThrow(DatabaseError);
      await expect(nebulaProjectManager.getProjectDataById('/test/project', '')).rejects.toThrow(DatabaseError);
    });
 });

  describe('DatabaseServiceValidator integration', () => {
    it('should validate all inputs through the validator', () => {
      // Test that the validator is properly integrated by checking if validation errors are thrown
      expect(() => {
        DatabaseServiceValidator.validateProjectPath('');
      }).toThrow(DatabaseError);
      
      expect(() => {
        DatabaseServiceValidator.validateId('');
      }).toThrow(DatabaseError);
      
      expect(() => {
        DatabaseServiceValidator.validateData(null);
      }).toThrow(DatabaseError);
    });
  });
});