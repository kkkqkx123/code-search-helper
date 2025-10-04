import { NebulaProjectManager } from '../../nebula/NebulaProjectManager';
import { DatabaseLoggerService } from '../../common/DatabaseLoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ProjectIdManager } from '../../ProjectIdManager';
import { INebulaSpaceManager } from '../../nebula/NebulaSpaceManager';
import { INebulaConnectionManager } from '../../nebula/NebulaConnectionManager';
import { INebulaQueryBuilder } from '../../nebula/NebulaQueryBuilder';
import { NebulaNode, NebulaRelationship } from '../../nebula/NebulaTypes';

// Mock 依赖项
const mockDatabaseLogger = {
  logDatabaseEvent: jest.fn().mockResolvedValue(undefined),
};

const mockErrorHandler = {
  handleError: jest.fn(),
};

const mockProjectIdManager = {
  generateProjectId: jest.fn().mockResolvedValue('project-123'),
  getProjectId: jest.fn().mockResolvedValue('project-123'),
  getSpaceName: jest.fn().mockReturnValue('project_project-123'),
  removeProject: jest.fn(),
  listAllProjectPaths: jest.fn().mockReturnValue(['/path/to/project']),
  getProjectsByUpdateTime: jest.fn().mockReturnValue([{ projectId: 'project-123', updateTime: new Date() }]),
};

const mockSpaceManager: INebulaSpaceManager = {
  createSpace: jest.fn().mockResolvedValue(true),
  deleteSpace: jest.fn().mockResolvedValue(true),
  clearSpace: jest.fn().mockResolvedValue(true),
  getSpaceInfo: jest.fn().mockResolvedValue({
    name: 'project_project-123',
    partition_num: 10,
    replica_factor: 1,
    vid_type: 'FIXED_STRING(30)',
    charset: 'utf8',
    collate: 'utf8_bin'
  }),
  listSpaces: jest.fn().mockResolvedValue([]),
  checkSpaceExists: jest.fn().mockResolvedValue(true),
};

const mockConnectionManager: INebulaConnectionManager = {
  getConnectionStatus: jest.fn(),
  executeQuery: jest.fn().mockResolvedValue({ data: [], error: null }),
  executeQueryInSpace: jest.fn().mockResolvedValue({ data: [], error: null }),
  executeTransaction: jest.fn().mockResolvedValue([]),
  createNode: jest.fn(),
  createRelationship: jest.fn(),
  findNodesByLabel: jest.fn(),
  findRelationships: jest.fn(),
  getDatabaseStats: jest.fn(),
  isConnectedToDatabase: jest.fn(),
  isConnected: jest.fn().mockReturnValue(true),
  connect: jest.fn(),
  disconnect: jest.fn(),
  getConfig: jest.fn(),
  updateConfig: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  getConnectionForSpace: jest.fn().mockResolvedValue({}),
};

const mockQueryBuilder: INebulaQueryBuilder = {
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

describe('NebulaProjectManager', () => {
  let projectManager: NebulaProjectManager;

  beforeEach(() => {
    jest.clearAllMocks();

    projectManager = new NebulaProjectManager(
      mockDatabaseLogger as any,
      mockErrorHandler as any,
      mockProjectIdManager as any,
      mockSpaceManager as any,
      mockConnectionManager as any,
      mockQueryBuilder as any
    );
  });

  describe('insertNodesForProject', () => {
    it('should insert nodes for a project using executeQueryInSpace', async () => {
      const projectPath = '/path/to/project';
      const nodes: NebulaNode[] = [
        {
          id: 'node1',
          label: 'TestClass',
          properties: { name: 'Test Node', value: 123 }
        }
      ];

      const result = await projectManager.insertNodesForProject(projectPath, nodes);

      expect(result).toBe(true);
      // 验证 executeQueryInSpace 被调用
      expect(mockConnectionManager.executeQueryInSpace).toHaveBeenCalled();
      // 验证使用了正确的空间名
      expect(mockConnectionManager.executeQueryInSpace).toHaveBeenCalledWith(
        'project_project-123',
        expect.stringContaining('INSERT VERTEX'),
        {}
      );
    });

    it('should handle errors during node insertion', async () => {
      const projectPath = '/path/to/project';
      const nodes: NebulaNode[] = [
        {
          id: 'node1',
          label: 'TestClass',
          properties: { name: 'Test Node', value: 123 }
        }
      ];

      // 模拟 executeQueryInSpace 抛出错误
      (mockConnectionManager as any).executeQueryInSpace = jest.fn().mockRejectedValue(new Error('Query failed'));

      const result = await projectManager.insertNodesForProject(projectPath, nodes);

      expect(result).toBe(false);
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('insertRelationshipsForProject', () => {
    it('should insert relationships for a project using executeQueryInSpace', async () => {
      const projectPath = '/path/to/project';
      const relationships: NebulaRelationship[] = [
        {
          type: 'TEST_REL',
          sourceId: 'node1',
          targetId: 'node2',
          properties: { weight: 1.0 }
        }
      ];

      // 修复 mock，返回正确的结果
      (mockConnectionManager as any).executeQueryInSpace = jest.fn().mockResolvedValue({ data: [], error: null });

      const result = await projectManager.insertRelationshipsForProject(projectPath, relationships);

      expect(result).toBe(true);
      // 验证 executeQueryInSpace 被调用
      expect(mockConnectionManager.executeQueryInSpace).toHaveBeenCalled();
      // 验证使用了正确的空间名
      expect(mockConnectionManager.executeQueryInSpace).toHaveBeenCalledWith(
        'project_project-123',
        expect.stringContaining('INSERT EDGE'),
        {}
      );
    });

    it('should handle errors during relationship insertion', async () => {
      const projectPath = '/path/to/project';
      const relationships: NebulaRelationship[] = [
        {
          type: 'TEST_REL',
          sourceId: 'node1',
          targetId: 'node2',
          properties: { weight: 1.0 }
        }
      ];

      // 模拟 executeQueryInSpace 抛出错误
      (mockConnectionManager as any).executeQueryInSpace = jest.fn().mockRejectedValue(new Error('Query failed'));

      const result = await projectManager.insertRelationshipsForProject(projectPath, relationships);

      expect(result).toBe(false);
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('findNodesForProject', () => {
    it('should find nodes for a project using executeQueryInSpace', async () => {
      const projectPath = '/path/to/project';
      const label = 'TestClass';

      const result = await projectManager.findNodesForProject(projectPath, label);

      expect(result).toEqual([]);
      // 验证 executeQueryInSpace 被调用
      expect(mockConnectionManager.executeQueryInSpace).toHaveBeenCalled();
      
      // 检查调用的参数
      const calls = (mockConnectionManager.executeQueryInSpace as jest.Mock).mock.calls;
      const matchingCall = calls.find((call: any[]) =>
        call[0] === 'project_project-123' &&
        call[1] &&
        call[1].includes('MATCH (v:TestClass) WHERE v.projectId == "project-123" RETURN v')
      );
      expect(matchingCall).toBeDefined();
    });

    it('should find nodes with filter using executeQueryInSpace', async () => {
      const projectPath = '/path/to/project';
      const label = 'TestClass';
      const filter = { name: 'Test' };

      const result = await projectManager.findNodesForProject(projectPath, label, filter);

      expect(result).toEqual([]);
      // 验证 executeQueryInSpace 被调用
      expect(mockConnectionManager.executeQueryInSpace).toHaveBeenCalled();
      
      // 检查调用的参数
      const calls = (mockConnectionManager.executeQueryInSpace as jest.Mock).mock.calls;
      const matchingCall = calls.find((call: any[]) =>
        call[0] === 'project_project-123' &&
        call[1] &&
        call[1].includes('MATCH (v:TestClass) WHERE v.projectId == "project-123" RETURN v AND v.name == "Test"')
      );
      expect(matchingCall).toBeDefined();
    });

    it('should handle errors during node finding', async () => {
      const projectPath = '/path/to/project';
      const label = 'TestClass';

      // 模拟 executeQueryInSpace 抛出错误
      (mockConnectionManager as any).executeQueryInSpace = jest.fn().mockRejectedValue(new Error('Query failed'));

      const result = await projectManager.findNodesForProject(projectPath, label);

      expect(result).toEqual([]);
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('findRelationshipsForProject', () => {
    it('should find relationships for a project using executeQueryInSpace', async () => {
      const projectPath = '/path/to/project';
      const type = 'TEST_REL';

      const result = await projectManager.findRelationshipsForProject(projectPath, type);

      expect(result).toEqual([]);
      expect(result).toEqual([]);
      // 验证 executeQueryInSpace 被调用
      expect(mockConnectionManager.executeQueryInSpace).toHaveBeenCalled();
      
      // 检查调用的参数
      const calls = (mockConnectionManager.executeQueryInSpace as jest.Mock).mock.calls;
      const matchingCall = calls.find((call: any[]) =>
        call[0] === 'project_project-123' &&
        call[1] &&
        call[1].includes('MATCH () -[e:TEST_REL]-> () WHERE e.projectId == "project-123" RETURN e')
      );
      expect(matchingCall).toBeDefined();
    });

    it('should find relationships with filter using executeQueryInSpace', async () => {
      const projectPath = '/path/to/project';
      const type = 'TEST_REL';
      const filter = { weight: 1.0 };

      const result = await projectManager.findRelationshipsForProject(projectPath, type, filter);

      expect(result).toEqual([]);
      expect(result).toEqual([]);
      // 验证 executeQueryInSpace 被调用
      expect(mockConnectionManager.executeQueryInSpace).toHaveBeenCalled();
      
      // 检查调用的参数
      const calls = (mockConnectionManager.executeQueryInSpace as jest.Mock).mock.calls;
      const matchingCall = calls.find((call: any[]) =>
        call[0] === 'project_project-123' &&
        call[1] &&
        call[1].includes('MATCH () -[e:TEST_REL]-> () WHERE e.projectId == "project-123" RETURN e AND e.weight == 1')
      );
      expect(matchingCall).toBeDefined();
    });

    it('should handle errors during relationship finding', async () => {
      const projectPath = '/path/to/project';
      const type = 'TEST_REL';

      // 模拟 executeQueryInSpace 抛出错误
      (mockConnectionManager as any).executeQueryInSpace = jest.fn().mockRejectedValue(new Error('Query failed'));

      const result = await projectManager.findRelationshipsForProject(projectPath, type);

      expect(result).toEqual([]);
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('createSpaceForProject', () => {
    it('should create space for a project', async () => {
      const projectPath = '/path/to/project';

      const result = await projectManager.createSpaceForProject(projectPath);

      expect(result).toBe(true);
      expect(mockSpaceManager.createSpace).toHaveBeenCalledWith('project-123', undefined);
      expect(mockProjectIdManager.generateProjectId).toHaveBeenCalledWith(projectPath);
    });

    it('should handle errors during space creation', async () => {
      const projectPath = '/path/to/project';

      (mockSpaceManager as any).createSpace = jest.fn().mockRejectedValue(new Error('Space creation failed'));

      const result = await projectManager.createSpaceForProject(projectPath);

      expect(result).toBe(false);
      expect(mockErrorHandler.handleError).toHaveBeenCalled(); // 验证错误处理被调用
    });
  });

  describe('deleteSpaceForProject', () => {
    it('should delete space for a project', async () => {
      const projectPath = '/path/to/project';

      const result = await projectManager.deleteSpaceForProject(projectPath);

      expect(result).toBe(true);
      expect(mockSpaceManager.deleteSpace).toHaveBeenCalledWith('project-123');
    });

    it('should handle errors during space deletion', async () => {
      const projectPath = '/path/to/project';
      
      // 临时修改 getProjectId 行为
      const originalGetProjectId = mockProjectIdManager.getProjectId;
      (mockProjectIdManager as any).getProjectId = jest.fn().mockResolvedValue(null);

      const result = await projectManager.deleteSpaceForProject(projectPath);
      expect(result).toBe(false);

      // 恢复原始行为
      (mockProjectIdManager as any).getProjectId = originalGetProjectId;
    });
  });

  describe('getSpaceInfoForProject', () => {
    it('should get space info for a project', async () => {
      const projectPath = '/path/to/project';

      const result = await projectManager.getSpaceInfoForProject(projectPath);

      expect(result).toBeDefined();
      expect(mockSpaceManager.getSpaceInfo).toHaveBeenCalled();
      // 检查调用的参数
      const calls = (mockSpaceManager.getSpaceInfo as jest.Mock).mock.calls;
      const matchingCall = calls.find((call: any[]) =>
        call[0] === 'project-123'
      );
      expect(matchingCall).toBeDefined();
    });

    it('should return null if project not found', async () => {
      // 临时修改 mockProjectIdManager 的行为
      const originalGetProjectId = mockProjectIdManager.getProjectId;
      (mockProjectIdManager as any).getProjectId = jest.fn().mockResolvedValue(null);

      const result = await projectManager.getSpaceInfoForProject('/nonexistent/project');

      expect(result).toBeNull();

      // 恢复原始行为
      (mockProjectIdManager as any).getProjectId = originalGetProjectId;
    });
  });

  describe('listProjectSpaces', () => {
    it('should list all project spaces', async () => {
      const result = await projectManager.listProjectSpaces();

      expect(result).toEqual([
        expect.objectContaining({
          projectPath: '/path/to/project',
          spaceName: 'project_project-123',
        })
      ]);
    });
  });
});