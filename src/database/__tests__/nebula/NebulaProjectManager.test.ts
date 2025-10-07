import { NebulaProjectManager } from '../../nebula/NebulaProjectManager';
import { DatabaseLoggerService } from '../../common/DatabaseLoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ProjectIdManager } from '../../ProjectIdManager';
import { INebulaSpaceManager } from '../../nebula/space/NebulaSpaceManager';
import { INebulaConnectionManager } from '../../nebula/NebulaConnectionManager';
import { INebulaQueryBuilder } from '../../nebula/NebulaQueryBuilder';
import { NebulaEventManager } from '../../nebula/NebulaEventManager';
import { PerformanceMonitor } from '../../common/PerformanceMonitor';
import {
  NebulaNode,
  NebulaRelationship,
  NebulaSpaceInfo,
  ProjectSpaceInfo,
  NebulaEventType,
 NebulaEvent
} from '../../nebula/NebulaTypes';

// Mock 依赖项
const mockDatabaseLoggerService = {
  logDatabaseEvent: jest.fn().mockResolvedValue(undefined),
};

const mockErrorHandlerService = {
  handleError: jest.fn(),
};

const mockProjectIdManager = {
  generateProjectId: jest.fn(),
  getProjectId: jest.fn(),
  getSpaceName: jest.fn(),
  removeProject: jest.fn(),
  listAllProjectPaths: jest.fn(),
  getProjectsByUpdateTime: jest.fn(),
};

const mockNebulaSpaceManager = {
  createSpace: jest.fn(),
  deleteSpace: jest.fn(),
  getSpaceInfo: jest.fn(),
  clearSpace: jest.fn(),
};

const mockNebulaConnectionManager = {
  executeQuery: jest.fn(),
};

const mockNebulaQueryBuilder = {
  insertVertex: jest.fn(),
  batchInsertVertices: jest.fn(),
  insertEdge: jest.fn(),
  batchInsertEdges: jest.fn(),
  go: jest.fn(),
  buildComplexTraversal: jest.fn(),
  buildShortestPath: jest.fn(),
  updateVertex: jest.fn(),
  updateEdge: jest.fn(),
  deleteVertices: jest.fn(),
  deleteEdges: jest.fn(),
  buildNodeCountQuery: jest.fn(),
  buildRelationshipCountQuery: jest.fn(),
};

const mockNebulaEventManager = {
  emit: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
};

describe('NebulaProjectManager', () => {
  let nebulaProjectManager: NebulaProjectManager;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock PerformanceMonitor for testing
    const mockPerformanceMonitor = {} as any;

    nebulaProjectManager = new NebulaProjectManager(
      mockDatabaseLoggerService as unknown as DatabaseLoggerService,
      mockErrorHandlerService as unknown as ErrorHandlerService,
      mockProjectIdManager as unknown as ProjectIdManager,
      mockNebulaSpaceManager as unknown as INebulaSpaceManager,
      mockNebulaConnectionManager as unknown as INebulaConnectionManager,
      mockNebulaQueryBuilder as unknown as INebulaQueryBuilder,
      mockPerformanceMonitor as unknown as PerformanceMonitor,
      mockNebulaEventManager as unknown as NebulaEventManager
    );
  });

  describe('constructor', () => {
    it('should initialize with correct dependencies', () => {
      expect(nebulaProjectManager).toBeDefined();
    });
  });

  describe('createSpaceForProject', () => {
    it('should create space successfully', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';
      const spaceName = 'project_test-project-id';

      mockProjectIdManager.generateProjectId.mockResolvedValue(projectId);
      mockProjectIdManager.getSpaceName.mockReturnValue(spaceName);
      mockNebulaSpaceManager.createSpace.mockResolvedValue(true);

      const result = await nebulaProjectManager.createSpaceForProject(projectPath);

      expect(result).toBe(true);
      expect(mockProjectIdManager.generateProjectId).toHaveBeenCalledWith(projectPath);
      expect(mockNebulaSpaceManager.createSpace).toHaveBeenCalledWith(projectId, undefined);
    });

    it('should return false when space name generation fails', async () => {
      const projectPath = '/test/project';

      mockProjectIdManager.generateProjectId.mockResolvedValue('test-project-id');
      mockProjectIdManager.getSpaceName.mockReturnValue(null);

      const result = await nebulaProjectManager.createSpaceForProject(projectPath);

      expect(result).toBe(false);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });

    it('should handle space creation failure', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';
      const spaceName = 'project_test-project-id';

      mockProjectIdManager.generateProjectId.mockResolvedValue(projectId);
      mockProjectIdManager.getSpaceName.mockReturnValue(spaceName);
      mockNebulaSpaceManager.createSpace.mockResolvedValue(false);

      const result = await nebulaProjectManager.createSpaceForProject(projectPath);

      expect(result).toBe(false);
    });

    it('should handle errors during space creation', async () => {
      const projectPath = '/test/project';
      const error = new Error('Creation failed');

      mockProjectIdManager.generateProjectId.mockRejectedValue(error);

      const result = await nebulaProjectManager.createSpaceForProject(projectPath);

      expect(result).toBe(false);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('deleteSpaceForProject', () => {
    it('should delete space successfully', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';
      const spaceName = 'project_test-project-id';

      mockProjectIdManager.getProjectId.mockResolvedValue(projectId);
      mockProjectIdManager.getSpaceName.mockReturnValue(spaceName);
      mockNebulaSpaceManager.deleteSpace.mockResolvedValue(true);

      const result = await nebulaProjectManager.deleteSpaceForProject(projectPath);

      expect(result).toBe(true);
      expect(mockProjectIdManager.removeProject).toHaveBeenCalledWith(projectPath);
    });

    it('should return false when project is not found', async () => {
      const projectPath = '/test/project';

      mockProjectIdManager.getProjectId.mockResolvedValue(null);

      const result = await nebulaProjectManager.deleteSpaceForProject(projectPath);

      expect(result).toBe(false);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });

    it('should handle space deletion failure', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';
      const spaceName = 'project_test-project-id';

      mockProjectIdManager.getProjectId.mockResolvedValue(projectId);
      mockProjectIdManager.getSpaceName.mockReturnValue(spaceName);
      mockNebulaSpaceManager.deleteSpace.mockResolvedValue(false);

      const result = await nebulaProjectManager.deleteSpaceForProject(projectPath);

      expect(result).toBe(false);
    });

    it('should handle errors during space deletion', async () => {
      const projectPath = '/test/project';
      const error = new Error('Deletion failed');

      mockProjectIdManager.getProjectId.mockRejectedValue(error);

      const result = await nebulaProjectManager.deleteSpaceForProject(projectPath);

      expect(result).toBe(false);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('getSpaceInfoForProject', () => {
    it('should get space info successfully', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';
      const spaceInfo: NebulaSpaceInfo = {
        name: 'project_test-project-id',
        partition_num: 10,
        replica_factor: 1,
        vid_type: 'FIXED_STRING(32)',
        charset: 'utf8',
        collate: 'utf8_bin'
      };

      mockProjectIdManager.getProjectId.mockResolvedValue(projectId);
      mockNebulaSpaceManager.getSpaceInfo.mockResolvedValue(spaceInfo);

      const result = await nebulaProjectManager.getSpaceInfoForProject(projectPath);

      expect(result).toEqual(spaceInfo);
    });

    it('should return null when project is not found', async () => {
      const projectPath = '/test/project';

      mockProjectIdManager.getProjectId.mockResolvedValue(null);

      const result = await nebulaProjectManager.getSpaceInfoForProject(projectPath);

      expect(result).toBeNull();
    });

    it('should handle errors during space info retrieval', async () => {
      const projectPath = '/test/project';
      const error = new Error('Retrieval failed');

      mockProjectIdManager.getProjectId.mockRejectedValue(error);

      const result = await nebulaProjectManager.getSpaceInfoForProject(projectPath);

      expect(result).toBeNull();
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('clearSpaceForProject', () => {
    it('should clear space successfully', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';
      const spaceName = 'project_test-project-id';

      mockProjectIdManager.getProjectId.mockResolvedValue(projectId);
      mockProjectIdManager.getSpaceName.mockReturnValue(spaceName);
      mockNebulaSpaceManager.clearSpace.mockResolvedValue(true);

      const result = await nebulaProjectManager.clearSpaceForProject(projectPath);

      expect(result).toBe(true);
    });

    it('should return false when project is not found', async () => {
      const projectPath = '/test/project';

      mockProjectIdManager.getProjectId.mockResolvedValue(null);

      const result = await nebulaProjectManager.clearSpaceForProject(projectPath);

      expect(result).toBe(false);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });

    it('should handle space clearing failure', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';
      const spaceName = 'project_test-project-id';

      mockProjectIdManager.getProjectId.mockResolvedValue(projectId);
      mockProjectIdManager.getSpaceName.mockReturnValue(spaceName);
      mockNebulaSpaceManager.clearSpace.mockResolvedValue(false);

      const result = await nebulaProjectManager.clearSpaceForProject(projectPath);

      expect(result).toBe(false);
    });

    it('should handle errors during space clearing', async () => {
      const projectPath = '/test/project';
      const error = new Error('Clearing failed');

      mockProjectIdManager.getProjectId.mockRejectedValue(error);

      const result = await nebulaProjectManager.clearSpaceForProject(projectPath);

      expect(result).toBe(false);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('listProjectSpaces', () => {
    it('should list project spaces successfully', async () => {
      const projectPaths = ['/test/project1', '/test/project2'];
      const projectSpaces: ProjectSpaceInfo[] = [
        {
          projectPath: '/test/project1',
          spaceName: 'project_test-project1-id',
          spaceInfo: {
            name: 'project_test-project1-id',
            partition_num: 10,
            replica_factor: 1,
            vid_type: 'FIXED_STRING(32)',
            charset: 'utf8',
            collate: 'utf8_bin'
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockProjectIdManager.listAllProjectPaths.mockReturnValue(projectPaths);
      mockProjectIdManager.getProjectId.mockReturnValue('test-project1-id');
      mockProjectIdManager.getSpaceName.mockReturnValue('project_test-project1-id');
      mockNebulaSpaceManager.getSpaceInfo.mockResolvedValue(projectSpaces[0].spaceInfo);
      mockProjectIdManager.getProjectsByUpdateTime.mockReturnValue([
        { projectId: 'test-project1-id', updateTime: new Date(), projectPath: '/test/project1' }
      ]);

      const result = await nebulaProjectManager.listProjectSpaces();

      expect(result).toHaveLength(1);
    });

    it('should handle errors during project space listing', async () => {
      const error = new Error('Listing failed');

      mockProjectIdManager.listAllProjectPaths.mockImplementation(() => {
        throw error;
      });

      const result = await nebulaProjectManager.listProjectSpaces();

      expect(result).toEqual([]);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('insertNodesForProject', () => {
    it('should insert nodes successfully', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';
      const spaceName = 'project_test-project-id';
      const nodes: NebulaNode[] = [
        {
          id: 'node1',
          label: 'TestLabel',
          properties: { prop1: 'value1' }
        }
      ];

      mockProjectIdManager.getProjectId.mockResolvedValue(projectId);
      mockProjectIdManager.getSpaceName.mockReturnValue(spaceName);
      mockNebulaConnectionManager.executeQuery
        .mockResolvedValueOnce(undefined) // USE command
        .mockResolvedValueOnce({ error: null }); // INSERT VERTEX

      const result = await nebulaProjectManager.insertNodesForProject(projectPath, nodes);

      expect(result).toBe(true);
      expect(mockNebulaConnectionManager.executeQuery).toHaveBeenCalledTimes(2);
    });

    it('should return false when project is not found', async () => {
      const projectPath = '/test/project';
      const nodes: NebulaNode[] = [
        {
          id: 'node1',
          label: 'TestLabel',
          properties: { prop1: 'value1' }
        }
      ];

      mockProjectIdManager.getProjectId.mockResolvedValue(null);

      const result = await nebulaProjectManager.insertNodesForProject(projectPath, nodes);

      expect(result).toBe(false);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });

    it('should handle errors during node insertion', async () => {
      const projectPath = '/test/project';
      const nodes: NebulaNode[] = [
        {
          id: 'node1',
          label: 'TestLabel',
          properties: { prop1: 'value1' }
        }
      ];
      const error = new Error('Insertion failed');

      mockProjectIdManager.getProjectId.mockRejectedValue(error);

      const result = await nebulaProjectManager.insertNodesForProject(projectPath, nodes);

      expect(result).toBe(false);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('insertRelationshipsForProject', () => {
    it('should insert relationships successfully', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';
      const spaceName = 'project_test-project-id';
      const relationships: NebulaRelationship[] = [
        {
          type: 'TestType',
          sourceId: 'node1',
          targetId: 'node2',
          properties: { prop1: 'value1' }
        }
      ];

      mockProjectIdManager.getProjectId.mockResolvedValue(projectId);
      mockProjectIdManager.getSpaceName.mockReturnValue(spaceName);
      mockNebulaConnectionManager.executeQuery
        .mockResolvedValueOnce(undefined) // USE command
        .mockResolvedValueOnce({ error: null }); // INSERT EDGE

      const result = await nebulaProjectManager.insertRelationshipsForProject(projectPath, relationships);

      expect(result).toBe(true);
      expect(mockNebulaConnectionManager.executeQuery).toHaveBeenCalledTimes(2);
    });

    it('should return false when project is not found', async () => {
      const projectPath = '/test/project';
      const relationships: NebulaRelationship[] = [
        {
          type: 'TestType',
          sourceId: 'node1',
          targetId: 'node2',
          properties: { prop1: 'value1' }
        }
      ];

      mockProjectIdManager.getProjectId.mockResolvedValue(null);

      const result = await nebulaProjectManager.insertRelationshipsForProject(projectPath, relationships);

      expect(result).toBe(false);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });

    it('should handle errors during relationship insertion', async () => {
      const projectPath = '/test/project';
      const relationships: NebulaRelationship[] = [
        {
          type: 'TestType',
          sourceId: 'node1',
          targetId: 'node2',
          properties: { prop1: 'value1' }
        }
      ];
      const error = new Error('Insertion failed');

      mockProjectIdManager.getProjectId.mockRejectedValue(error);

      const result = await nebulaProjectManager.insertRelationshipsForProject(projectPath, relationships);

      expect(result).toBe(false);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('findNodesForProject', () => {
    it('should find nodes successfully', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';
      const spaceName = 'project_test-project-id';
      const label = 'TestLabel';
      const queryResult = { data: [{ id: 'node1', label: 'TestLabel' }] };

      mockProjectIdManager.getProjectId.mockResolvedValue(projectId);
      mockProjectIdManager.getSpaceName.mockReturnValue(spaceName);
      mockNebulaConnectionManager.executeQuery
        .mockResolvedValueOnce(undefined) // USE command
        .mockResolvedValueOnce(queryResult); // MATCH query

      const result = await nebulaProjectManager.findNodesForProject(projectPath, label);

      expect(result).toEqual(queryResult.data);
      expect(mockNebulaConnectionManager.executeQuery).toHaveBeenCalledTimes(2);
    });

    it('should return empty array when project is not found', async () => {
      const projectPath = '/test/project';
      const label = 'TestLabel';

      mockProjectIdManager.getProjectId.mockResolvedValue(null);

      const result = await nebulaProjectManager.findNodesForProject(projectPath, label);

      expect(result).toEqual([]);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });

    it('should handle errors during node search', async () => {
      const projectPath = '/test/project';
      const label = 'TestLabel';
      const error = new Error('Search failed');

      mockProjectIdManager.getProjectId.mockRejectedValue(error);

      const result = await nebulaProjectManager.findNodesForProject(projectPath, label);

      expect(result).toEqual([]);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('findRelationshipsForProject', () => {
    it('should find relationships successfully', async () => {
      const projectPath = '/test/project';
      const projectId = 'test-project-id';
      const spaceName = 'project_test-project-id';
      const type = 'TestType';
      const queryResult = { data: [{ id: 'rel1', type: 'TestType' }] };

      mockProjectIdManager.getProjectId.mockResolvedValue(projectId);
      mockProjectIdManager.getSpaceName.mockReturnValue(spaceName);
      mockNebulaConnectionManager.executeQuery
        .mockResolvedValueOnce(undefined) // USE command
        .mockResolvedValueOnce(queryResult); // MATCH query

      const result = await nebulaProjectManager.findRelationshipsForProject(projectPath, type);

      expect(result).toEqual(queryResult.data);
      expect(mockNebulaConnectionManager.executeQuery).toHaveBeenCalledTimes(2);
    });

    it('should return empty array when project is not found', async () => {
      const projectPath = '/test/project';
      const type = 'TestType';

      mockProjectIdManager.getProjectId.mockResolvedValue(null);

      const result = await nebulaProjectManager.findRelationshipsForProject(projectPath, type);

      expect(result).toEqual([]);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });

    it('should handle errors during relationship search', async () => {
      const projectPath = '/test/project';
      const type = 'TestType';
      const error = new Error('Search failed');

      mockProjectIdManager.getProjectId.mockRejectedValue(error);

      const result = await nebulaProjectManager.findRelationshipsForProject(projectPath, type);

      expect(result).toEqual([]);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('addEventListener and removeEventListener', () => {
    it('should add and remove event listeners correctly', () => {
      const listener = jest.fn();
      const eventType = NebulaEventType.SPACE_CREATED;

      // Add listener
      nebulaProjectManager.addEventListener(eventType, listener);

      // Emit event to test listener was added
      // @ts-ignore - accessing private method for testing
      nebulaProjectManager['emitEvent'](eventType, { test: 'data' });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: eventType,
          data: { test: 'data' }
        })
      );

      // Remove listener
      nebulaProjectManager.removeEventListener(eventType, listener);

      // Emit event again to test listener was removed
      listener.mockClear();
      // @ts-ignore - accessing private method for testing
      nebulaProjectManager['emitEvent'](eventType, { test: 'data2' });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('IProjectManager interface methods', () => {
    it('should delegate createProjectSpace to createSpaceForProject', async () => {
      const projectPath = '/test/project';
      const spy = jest.spyOn(nebulaProjectManager, 'createSpaceForProject').mockResolvedValue(true);

      const result = await nebulaProjectManager.createProjectSpace(projectPath);

      expect(result).toBe(true);
      expect(spy).toHaveBeenCalledWith(projectPath, undefined);
    });

    it('should delegate deleteProjectSpace to deleteSpaceForProject', async () => {
      const projectPath = '/test/project';
      const spy = jest.spyOn(nebulaProjectManager, 'deleteSpaceForProject').mockResolvedValue(true);

      const result = await nebulaProjectManager.deleteProjectSpace(projectPath);

      expect(result).toBe(true);
      expect(spy).toHaveBeenCalledWith(projectPath);
    });

    it('should delegate getProjectSpaceInfo to getSpaceInfoForProject', async () => {
      const projectPath = '/test/project';
      const spaceInfo = { name: 'test-space' };
      const spy = jest.spyOn(nebulaProjectManager, 'getSpaceInfoForProject').mockResolvedValue(spaceInfo as any);

      const result = await nebulaProjectManager.getProjectSpaceInfo(projectPath);

      expect(result).toEqual(spaceInfo);
      expect(spy).toHaveBeenCalledWith(projectPath);
    });

    it('should delegate clearProjectSpace to clearSpaceForProject', async () => {
      const projectPath = '/test/project';
      const spy = jest.spyOn(nebulaProjectManager, 'clearSpaceForProject').mockResolvedValue(true);

      const result = await nebulaProjectManager.clearProjectSpace(projectPath);

      expect(result).toBe(true);
      expect(spy).toHaveBeenCalledWith(projectPath);
    });

    it('should delegate insertProjectData to insertNodesForProject and insertRelationshipsForProject', async () => {
      const projectPath = '/test/project';
      const data = {
        nodes: [{ id: 'node1', label: 'TestLabel', properties: {} }],
        relationships: [{ type: 'TestType', sourceId: 'node1', targetId: 'node2' }]
      };

      const insertNodesSpy = jest.spyOn(nebulaProjectManager, 'insertNodesForProject').mockResolvedValue(true);
      const insertRelationshipsSpy = jest.spyOn(nebulaProjectManager, 'insertRelationshipsForProject').mockResolvedValue(true);

      const result = await nebulaProjectManager.insertProjectData(projectPath, data);

      expect(result).toBe(true);
      expect(insertNodesSpy).toHaveBeenCalledWith(projectPath, data.nodes);
      expect(insertRelationshipsSpy).toHaveBeenCalledWith(projectPath, data.relationships);
    });

    it('should update node data successfully', async () => {
      const projectPath = '/test/project';
      const nodeId = 'node1';
      const data = { properties: { updated: true } };

      // Mock a successful query result for finding the node
      mockNebulaConnectionManager.executeQuery = jest.fn()
        .mockResolvedValueOnce(undefined) // USE command
        .mockResolvedValueOnce({ data: [{ id: 'node1' }] }) // For the first query (finding node)
        .mockResolvedValueOnce({ error: null }); // For the update query

      const result = await nebulaProjectManager.updateProjectData(projectPath, nodeId, data);

      expect(result).toBe(true);
      expect(mockNebulaConnectionManager.executeQuery).toHaveBeenCalledTimes(3);
    });

    it('should update relationship data successfully', async () => {
      const projectPath = '/test/project';
      const relId = 'rel1';
      const data = { properties: { updated: true } };

      // Mock queries: first one finds no node, second one finds relationship
      mockNebulaConnectionManager.executeQuery = jest.fn()
        .mockResolvedValueOnce(undefined) // USE command
        .mockResolvedValueOnce({ data: [] }) // For the first query (finding node)
        .mockResolvedValueOnce({ data: [{ id: 'rel1' }] }); // For the second query (finding relationship)

      const result = await nebulaProjectManager.updateProjectData(projectPath, relId, data);

      expect(result).toBe(true);
      expect(mockNebulaConnectionManager.executeQuery).toHaveBeenCalledTimes(3);
    });

    it('should handle validation errors', async () => {
      await expect(nebulaProjectManager.updateProjectData('', 'id', {})).rejects.toThrow();
      await expect(nebulaProjectManager.updateProjectData('/test/project', '', {})).rejects.toThrow();
    });

    it('should delete node data successfully', async () => {
      const projectPath = '/test/project';
      const nodeId = 'node1';

      // Mock a successful query result for finding the node
      mockNebulaConnectionManager.executeQuery = jest.fn()
        .mockResolvedValueOnce(undefined) // USE command
        .mockResolvedValueOnce({ data: [{ id: 'node1' }] }) // For the first query (finding node)
        .mockResolvedValueOnce({ error: null }); // For the delete query

      const result = await nebulaProjectManager.deleteProjectData(projectPath, nodeId);

      expect(result).toBe(true);
      expect(mockNebulaConnectionManager.executeQuery).toHaveBeenCalledTimes(3);
    });

    it('should delete relationship data successfully', async () => {
      const projectPath = '/test/project';
      const relId = 'rel1';

      // Mock queries: first one finds no node, second one finds relationship
      mockNebulaConnectionManager.executeQuery = jest.fn()
        .mockResolvedValueOnce(undefined) // USE command
        .mockResolvedValueOnce({ data: [] }) // For the first query (finding node)
        .mockResolvedValueOnce({ data: [{ id: 'rel1' }] }); // For the second query (finding relationship)

      const result = await nebulaProjectManager.deleteProjectData(projectPath, relId);

      expect(result).toBe(true);
      expect(mockNebulaConnectionManager.executeQuery).toHaveBeenCalledTimes(3);
    });

    it('should handle validation errors', async () => {
      await expect(nebulaProjectManager.deleteProjectData('', 'id')).rejects.toThrow();
      await expect(nebulaProjectManager.deleteProjectData('/test/project', '')).rejects.toThrow();
    });

    it('should search project data with string query', async () => {
      const projectPath = '/test/project';
      const query = 'MATCH (n) RETURN n';

      mockNebulaConnectionManager.executeQuery = jest.fn()
        .mockResolvedValueOnce(undefined) // USE command
        .mockResolvedValueOnce({ data: [] }); // Query result

      const result = await nebulaProjectManager.searchProjectData(projectPath, query);

      expect(result).toEqual([]);
      expect(mockNebulaConnectionManager.executeQuery).toHaveBeenCalledTimes(2);
    });

    it('should search project data with node query', async () => {
      const projectPath = '/test/project';
      const query = { type: 'node', label: 'TestLabel', filter: { name: 'Test' } };

      mockNebulaConnectionManager.executeQuery = jest.fn()
        .mockResolvedValueOnce(undefined) // USE command
        .mockResolvedValueOnce({ data: [] }); // Query result

      const result = await nebulaProjectManager.searchProjectData(projectPath, query);

      expect(result).toEqual([]);
      expect(mockNebulaConnectionManager.executeQuery).toHaveBeenCalledTimes(2);
    });

    it('should handle validation errors', async () => {
      await expect(nebulaProjectManager.searchProjectData('', {})).rejects.toThrow();
      await expect(nebulaProjectManager.searchProjectData('/test/project', null)).rejects.toThrow();
    });

    it('should get node data by ID successfully', async () => {
      const projectPath = '/test/project';
      const nodeId = 'node1';
      const mockNodeData = { id: 'node1', name: 'Test Node' };

      // Mock a successful query result for finding the node
      mockNebulaConnectionManager.executeQuery = jest.fn()
        .mockResolvedValueOnce(undefined) // USE command
        .mockResolvedValueOnce({ data: [mockNodeData] }); // For the first query (finding node)

      const result = await nebulaProjectManager.getProjectDataById(projectPath, nodeId);

      expect(result).toEqual(mockNodeData);
      expect(mockNebulaConnectionManager.executeQuery).toHaveBeenCalledTimes(2);
    });

    it('should get relationship data by ID successfully', async () => {
      const projectPath = '/test/project';
      const relId = 'rel1';
      const mockRelData = { id: 'rel1', type: 'TEST_REL' };

      // Mock queries: first one finds no node, second one finds relationship
      mockNebulaConnectionManager.executeQuery = jest.fn()
        .mockResolvedValueOnce(undefined) // USE command
        .mockResolvedValueOnce({ data: [] }) // For the first query (finding node)
        .mockResolvedValueOnce({ data: [mockRelData] }); // For the second query (finding relationship)

      const result = await nebulaProjectManager.getProjectDataById(projectPath, relId);

      expect(result).toEqual(mockRelData);
      expect(mockNebulaConnectionManager.executeQuery).toHaveBeenCalledTimes(3);
    });

    it('should return null if data not found', async () => {
      const projectPath = '/test/project';
      const nodeId = 'nonexistent';

      // Mock empty results for both node and relationship queries
      mockNebulaConnectionManager.executeQuery = jest.fn()
        .mockResolvedValueOnce(undefined) // USE command
        .mockResolvedValueOnce({ data: [] }) // For the first query (finding node)
        .mockResolvedValueOnce({ data: [] }); // For the second query (finding relationship)

      const result = await nebulaProjectManager.getProjectDataById(projectPath, nodeId);

      expect(result).toBeNull();
      expect(mockNebulaConnectionManager.executeQuery).toHaveBeenCalledTimes(3);
    });

    it('should handle validation errors', async () => {
      await expect(nebulaProjectManager.getProjectDataById('', 'id')).rejects.toThrow();
      await expect(nebulaProjectManager.getProjectDataById('/test/project', '')).rejects.toThrow();
    });
  });

  describe('DatabaseServiceValidator integration', () => {
    it('should validate all inputs through the validator', () => {
      // Add DatabaseServiceValidator import
      const { DatabaseServiceValidator } = require('../../common/DatabaseServiceValidator');

      // Test that the validator is properly integrated by checking if validation errors are thrown
      expect(() => {
        DatabaseServiceValidator.validateProjectPath('');
      }).toThrow();

      expect(() => {
        DatabaseServiceValidator.validateId('');
      }).toThrow();

      expect(() => {
        DatabaseServiceValidator.validateData(null);
      }).toThrow();
    });
  });
});