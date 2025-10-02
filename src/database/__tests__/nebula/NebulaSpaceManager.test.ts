import { NebulaSpaceManager } from '../../nebula/NebulaSpaceManager';
import { NebulaService } from '../../nebula/NebulaService';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { NebulaSpaceInfo } from '../../nebula/NebulaTypes';

// Mock 依赖项
const mockNebulaService = {
  executeWriteQuery: jest.fn(),
  executeReadQuery: jest.fn(),
};

const mockLoggerService = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const mockErrorHandlerService = {
  handleError: jest.fn(),
};

const mockConfigService = {
  get: jest.fn(),
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

describe('NebulaSpaceManager', () => {
  let spaceManager: NebulaSpaceManager;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers(); // 启用模拟定时器

    // Mock setTimeout to resolve immediately
    jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
      callback();
      return {} as any;
    });

    spaceManager = new NebulaSpaceManager(
      mockNebulaService as any,
      mockNebulaQueryBuilder as any,
      mockLoggerService as any,
      mockErrorHandlerService as any,
      mockConfigService as any
    );
  });

  afterEach(() => {
    jest.useRealTimers(); // 恢复真实定时器
    jest.restoreAllMocks(); // 恢复所有模拟
  });

  describe('constructor', () => {
    it('should initialize with correct dependencies', () => {
      expect(spaceManager).toBeDefined();
    });
  });

  describe('generateSpaceName', () => {
    it('should generate correct space name', () => {
      // @ts-ignore - accessing private method for testing
      const result = spaceManager['generateSpaceName']('test-project');
      expect(result).toBe('project_test-project');
    });

    it('should handle special characters in project ID', () => {
      // @ts-ignore - accessing private method for testing
      const result = spaceManager['generateSpaceName']('test_project-123');
      expect(result).toBe('project_test_project-123');
    });
  });

  describe('createSpace', () => {
    it('should create space successfully with default config', async () => {
      mockNebulaService.executeWriteQuery.mockResolvedValue(undefined);
      mockNebulaService.executeReadQuery
        .mockResolvedValueOnce(undefined) // First call for CREATE SPACE
        .mockResolvedValueOnce({ data: [{ name: 'test_space' }] }) // For waitForSpaceReady
        .mockResolvedValueOnce(undefined); // For USE SPACE and schema creation

      const result = spaceManager.createSpace('test-project');

      // 使用 runAllTimers 来处理 waitForSpaceReady 中的 setTimeout
      jest.runAllTimers();

      await expect(result).resolves.toBe(true);
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE SPACE IF NOT EXISTS `project_test-project`')
      );
      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'Successfully created space project_test-project for project test-project'
      );
    });

    it('should create space with custom config', async () => {
      mockNebulaService.executeWriteQuery.mockResolvedValue(undefined);
      mockNebulaService.executeReadQuery
        .mockResolvedValueOnce(undefined) // First call for CREATE SPACE
        .mockResolvedValueOnce({ data: [{ name: 'test_space' }] }) // For waitForSpaceReady
        .mockResolvedValueOnce(undefined); // For USE SPACE and schema creation

      const config = {
        partitionNum: 20,
        replicaFactor: 3,
        vidType: '"FIXED_STRING(64)"'
      };

      const result = spaceManager.createSpace('test-project', config);

      // 使用 runAllTimers 来处理 waitForSpaceReady 中的 setTimeout
      jest.runAllTimers();

      await expect(result).resolves.toBe(true);
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        expect.stringContaining('partition_num = 20')
      );
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        expect.stringContaining('replica_factor = 3')
      );
    });

    it('should handle space creation error', async () => {
      mockNebulaService.executeWriteQuery.mockRejectedValue(new Error('Creation failed'));

      const result = await spaceManager.createSpace('test-project');

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to create space project_test-project:',
        expect.any(Error)
      );
    });
  });

  describe('deleteSpace', () => {
    it('should delete space successfully', async () => {
      mockNebulaService.executeWriteQuery.mockResolvedValue(undefined);

      const result = await spaceManager.deleteSpace('test-project');

      expect(result).toBe(true);
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        'DROP SPACE IF EXISTS `project_test-project`'
      );
      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'Successfully deleted space project_test-project for project test-project'
      );
    });

    it('should handle space deletion error', async () => {
      mockNebulaService.executeWriteQuery.mockRejectedValue(new Error('Deletion failed'));

      const result = await spaceManager.deleteSpace('test-project');

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to delete space project_test-project:',
        expect.any(Error)
      );
    });
  });

  describe('listSpaces', () => {
    it('should list spaces successfully with standard format', async () => {
      // 重置模拟函数以确保干净的测试环境
      mockNebulaService.executeReadQuery.mockReset();

      const mockResult = {
        data: [
          { Name: 'space1' },
          { Name: 'space2' },
        ]
      };
      mockNebulaService.executeReadQuery.mockResolvedValue(mockResult);

      const result = await spaceManager.listSpaces();

      expect(result).toEqual(['space1', 'space2']);
      expect(mockNebulaService.executeReadQuery).toHaveBeenCalledWith('SHOW SPACES');
    });

    it('should handle different column name formats', async () => {
      const mockResult = {
        data: [
          { name: 'space1' },
          { NAME: 'space2' },
          { space_name: 'space3' },
        ]
      };
      mockNebulaService.executeReadQuery.mockResolvedValue(mockResult);

      const result = await spaceManager.listSpaces();

      expect(result).toEqual(['space1', 'space2', 'space3']);
    });

    it('should handle alternative result formats', async () => {
      const mockResult = {
        table: [
          { Name: 'space1' },
        ]
      };
      mockNebulaService.executeReadQuery.mockResolvedValue(mockResult);

      const result = await spaceManager.listSpaces();

      expect(result).toEqual(['space1']);
    });

    it('should handle null result', async () => {
      mockNebulaService.executeReadQuery.mockResolvedValue(null);

      const result = await spaceManager.listSpaces();

      expect(result).toEqual([]);
      expect(mockLoggerService.warn).toHaveBeenCalledWith('SHOW SPACES returned null result');
    });

    it('should handle non-array data', async () => {
      mockNebulaService.executeReadQuery.mockResolvedValue({ data: 'invalid' });

      const result = await spaceManager.listSpaces();

      expect(result).toEqual([]);
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        'SHOW SPACES returned non-array data:',
        expect.any(Object)
      );
    });

    it('should handle empty data array', async () => {
      mockNebulaService.executeReadQuery.mockResolvedValue({ data: [] });

      const result = await spaceManager.listSpaces();

      expect(result).toEqual([]);
    });

    it('should handle read query error', async () => {
      mockNebulaService.executeReadQuery.mockRejectedValue(new Error('Query failed'));

      const result = await spaceManager.listSpaces();

      expect(result).toEqual([]);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to list spaces:',
        expect.objectContaining({
          error: 'Query failed'
        })
      );
    });
  });

  describe('getSpaceInfo', () => {
    it('should get space info successfully', async () => {
      const mockResult = {
        data: [{
          partition_num: '10',
          replica_factor: '1',
          vid_type: 'FIXED_STRING(32)',
          charset: 'utf8',
          collate: 'utf8_bin'
        }]
      };
      mockNebulaService.executeReadQuery.mockResolvedValue(mockResult);

      const result = await spaceManager.getSpaceInfo('test-project');

      expect(result).toEqual({
        name: 'project_test-project',
        partition_num: 10,
        replica_factor: 1,
        vid_type: 'FIXED_STRING(32)',
        charset: 'utf8',
        collate: 'utf8_bin'
      });
    });

    it('should handle different field name cases', async () => {
      const mockResult = {
        data: [{
          PartitionNum: '20',
          ReplicaFactor: '3',
          VidType: 'FIXED_STRING(64)',
        }]
      };
      mockNebulaService.executeReadQuery.mockResolvedValue(mockResult);

      const result = await spaceManager.getSpaceInfo('test-project');

      expect(result).toEqual({
        name: 'project_test-project',
        partition_num: 20,
        replica_factor: 3,
        vid_type: 'FIXED_STRING(64)',
        charset: 'utf8',
        collate: 'utf8_bin'
      });
    });

    it('should handle alternative result formats', async () => {
      const mockResult = {
        table: [{
          partitionNum: '15',
        }]
      };
      mockNebulaService.executeReadQuery.mockResolvedValue(mockResult);

      const result = await spaceManager.getSpaceInfo('test-project');

      expect(result).toEqual({
        name: 'project_test-project',
        partition_num: 15,
        replica_factor: 1, // default value
        vid_type: 'FIXED_STRING(32)', // default value
        charset: 'utf8', // default value
        collate: 'utf8_bin' // default value
      });
    });

    it('should return null for null result', async () => {
      mockNebulaService.executeReadQuery.mockResolvedValue(null);

      const result = await spaceManager.getSpaceInfo('test-project');

      expect(result).toBeNull();
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        'DESCRIBE SPACE project_test-project returned null result'
      );
    });

    it('should return null for empty data', async () => {
      mockNebulaService.executeReadQuery.mockResolvedValue({ data: [] });

      const result = await spaceManager.getSpaceInfo('test-project');

      expect(result).toBeNull();
    });

    it('should return null for invalid data format', async () => {
      mockNebulaService.executeReadQuery.mockResolvedValue({ data: 'invalid' });

      const result = await spaceManager.getSpaceInfo('test-project');

      expect(result).toBeNull();
    });

    it('should handle read query error', async () => {
      mockNebulaService.executeReadQuery.mockRejectedValue(new Error('Query failed'));

      const result = await spaceManager.getSpaceInfo('test-project');

      expect(result).toBeNull();
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to get space info for project_test-project:',
        expect.objectContaining({
          error: 'Query failed'
        })
      );
    });
  });

  describe('checkSpaceExists', () => {
    it('should return true when space exists', async () => {
      jest.spyOn(spaceManager, 'listSpaces').mockResolvedValue(['project_test-project', 'other-space']);

      const result = await spaceManager.checkSpaceExists('test-project');

      expect(result).toBe(true);
    });

    it('should return false when space does not exist', async () => {
      jest.spyOn(spaceManager, 'listSpaces').mockResolvedValue(['other-space']);

      const result = await spaceManager.checkSpaceExists('test-project');

      expect(result).toBe(false);
    });

    it('should handle listSpaces error', async () => {
      jest.spyOn(spaceManager, 'listSpaces').mockRejectedValue(new Error('List failed'));

      const result = await spaceManager.checkSpaceExists('test-project');

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to check if space project_test-project exists:',
        expect.objectContaining({
          error: 'List failed'
        })
      );
    });
  });

  describe('waitForSpaceReady', () => {
    it('should wait for space to be ready', async () => {
      const mockResult = {
        data: [{ name: 'test-space' }]
      };
      mockNebulaService.executeReadQuery
        .mockResolvedValueOnce(null) // First call returns null
        .mockResolvedValueOnce(mockResult); // Second call returns result

      // @ts-ignore - accessing private method for testing
      const promise = spaceManager['waitForSpaceReady']('test-space', 5, 10);

      // 使用 runAllTimers 来处理 waitForSpaceReady 中的 setTimeout
      jest.runAllTimers();

      await promise;

      expect(mockNebulaService.executeReadQuery).toHaveBeenCalledWith(
        'DESCRIBE SPACE `test-space`'
      );
    });

    it('should throw error if space does not become ready', async () => {
      mockNebulaService.executeReadQuery.mockRejectedValue(new Error('Space not ready'));

      // @ts-ignore - accessing private method for testing
      const promise = spaceManager['waitForSpaceReady']('test-space', 2, 10);

      // 使用 runAllTimers 来处理 waitForSpaceReady 中的 setTimeout
      jest.runAllTimers();

      await expect(promise).rejects.toThrow(
        'Space test-space did not become ready within 2 retries'
      );
    });
  });

  describe('createGraphSchema', () => {
    it('should create graph schema successfully', async () => {
      mockNebulaService.executeWriteQuery.mockResolvedValue(undefined);

      // @ts-ignore - accessing private method for testing
      await spaceManager['createGraphSchema']();

      // 检查是否调用了创建标签的查询
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TAG IF NOT EXISTS Project')
      );

      // 检查是否调用了创建边类型的查询
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE EDGE IF NOT EXISTS BELONGS_TO')
      );

      // 检查是否调用了创建标签索引的查询
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TAG INDEX IF NOT EXISTS project_id_index')
      );

      // 检查是否调用了创建边索引的查询
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE EDGE INDEX IF NOT EXISTS belongs_to_index')
      );
    });

    it('should handle schema creation error', async () => {
      mockNebulaService.executeWriteQuery.mockRejectedValue(new Error('Schema creation failed'));

      // @ts-ignore - accessing private method for testing
      await expect(spaceManager['createGraphSchema']()).rejects.toThrow('Schema creation failed');
    });
  });

  describe('createIndexWithRetry', () => {
    it('should create index successfully on first try', async () => {
      mockNebulaService.executeWriteQuery.mockResolvedValue(undefined);

      // @ts-ignore - accessing private method for testing
      await spaceManager['createIndexWithRetry']('CREATE TAG INDEX test_index ON TestTag(name)');

      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        'CREATE TAG INDEX test_index ON TestTag(name)'
      );
      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Successfully created index: CREATE TAG INDEX test_index ON TestTag(name)'
      );
    });

    it('should handle already exists error', async () => {
      mockNebulaService.executeWriteQuery.mockRejectedValue(new Error('already exists'));

      // @ts-ignore - accessing private method for testing
      await spaceManager['createIndexWithRetry']('CREATE TAG INDEX test_index ON TestTag(name)');

      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Index already exists: CREATE TAG INDEX test_index ON TestTag(name)'
      );
    });

    it('should retry on failure and eventually succeed', async () => {
      mockNebulaService.executeWriteQuery
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(undefined);

      // @ts-ignore - accessing private method for testing
      const promise = spaceManager['createIndexWithRetry']('CREATE TAG INDEX test_index ON TestTag(name)', 3);

      // 使用 runAllTimers 来处理 createIndexWithRetry 中的 setTimeout
      jest.runAllTimers();

      await promise;

      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      mockNebulaService.executeWriteQuery.mockRejectedValue(new Error('Persistent failure'));

      // @ts-ignore - accessing private method for testing
      const promise = spaceManager['createIndexWithRetry']('CREATE TAG INDEX test_index ON TestTag(name)', 2);

      // 使用 runAllTimers 来处理 createIndexWithRetry 中的 setTimeout
      jest.runAllTimers();

      await expect(promise).rejects.toThrow('Failed to create index: CREATE TAG INDEX test_index ON TestTag(name). Error: Persistent failure');
    });
  });

  describe('clearSpace', () => {
    it('should clear space successfully', async () => {
      // Mock the queries that are called during space clearing
      mockNebulaService.executeWriteQuery.mockResolvedValue(undefined);
      mockNebulaService.executeReadQuery
        .mockResolvedValueOnce({ data: [{ Name: 'TestTag' }] }) // SHOW TAGS
        .mockResolvedValueOnce({ data: [{ Name: 'TestEdge' }] }); // SHOW EDGES

      const result = await spaceManager.clearSpace('test-project');

      expect(result).toBe(true);
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith('USE `project_test-project`');
      expect(mockNebulaService.executeReadQuery).toHaveBeenCalledWith('SHOW TAGS');
      expect(mockNebulaService.executeReadQuery).toHaveBeenCalledWith('SHOW EDGES');
      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'Starting to clear space project_test-project for project test-project'
      );
    });

    it('should handle empty space', async () => {
      mockNebulaService.executeWriteQuery.mockResolvedValue(undefined);
      mockNebulaService.executeReadQuery
        .mockResolvedValueOnce({ data: [] }) // SHOW TAGS - no tags
        .mockResolvedValueOnce({ data: [] }); // SHOW EDGES - no edges

      const result = await spaceManager.clearSpace('test-project');

      expect(result).toBe(true);
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith('USE `project_test-project`');
    });

    it('should handle errors during space clearing', async () => {
      mockNebulaService.executeWriteQuery.mockRejectedValue(new Error('Clear failed'));

      const result = await spaceManager.clearSpace('test-project');

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to clear space project_test-project:',
        expect.objectContaining({
          error: 'Clear failed'
        })
      );
    });

    it('should continue processing even if some deletions fail', async () => {
      mockNebulaService.executeWriteQuery
        .mockResolvedValueOnce(undefined) // USE command
        .mockRejectedValueOnce(new Error('Delete edge failed')) // First DELETE EDGE
        .mockResolvedValueOnce(undefined) // Second DELETE VERTEX
        .mockResolvedValueOnce(undefined); // Final success

      mockNebulaService.executeReadQuery
        .mockResolvedValueOnce({ data: [{ Name: 'TestTag' }] }) // SHOW TAGS
        .mockResolvedValueOnce({ data: [{ Name: 'TestEdge' }] }); // SHOW EDGES

      const result = await spaceManager.clearSpace('test-project');

      expect(result).toBe(true);
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        'Failed to delete edge TestEdge:',
        expect.any(Error)
      );
    });
  });
});