import { NebulaSpaceManager } from '../../nebula/space/NebulaSpaceManager';
import { NebulaService } from '../../nebula/NebulaService';
import { DatabaseLoggerService } from '../../../database/common/DatabaseLoggerService';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { NebulaSpaceInfo } from '../../nebula/NebulaTypes';

// Mock 依赖项
const mockNebulaService = {
  executeQuery: jest.fn(),
};

const mockLoggerService = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const mockDatabaseLoggerService = {
  logDatabaseEvent: jest.fn().mockResolvedValue(undefined),
  logConnectionEvent: jest.fn(),
  logQueryPerformance: jest.fn(),
  logBatchOperation: jest.fn(),
  logCollectionOperation: jest.fn(),
  logVectorOperation: jest.fn(),
  logQueryOperation: jest.fn(),
  logProjectOperation: jest.fn(),
  updateLogLevel: jest.fn(),
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
      mockDatabaseLoggerService as any,
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
      mockNebulaService.executeQuery
        .mockResolvedValueOnce(undefined) // CREATE SPACE
        .mockResolvedValueOnce({ data: [{ name: 'test_space' }] }) // DESCRIBE SPACE for waitForSpaceReady
        .mockResolvedValueOnce(undefined) // USE SPACE
        .mockResolvedValueOnce(undefined) // CREATE TAG Project
        .mockResolvedValueOnce(undefined) // CREATE TAG File
        .mockResolvedValueOnce(undefined) // CREATE TAG Function
        .mockResolvedValueOnce(undefined) // CREATE TAG Class
        .mockResolvedValueOnce(undefined) // CREATE TAG Import
        .mockResolvedValueOnce(undefined) // CREATE EDGE BELONGS_TO
        .mockResolvedValueOnce(undefined) // CREATE EDGE CONTAINS
        .mockResolvedValueOnce(undefined) // CREATE EDGE IMPORTS
        .mockResolvedValueOnce(undefined) // CREATE EDGE CALLS
        .mockResolvedValueOnce(undefined) // CREATE EDGE EXTENDS
        .mockResolvedValueOnce(undefined) // CREATE EDGE IMPLEMENTS
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX project_id_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX project_name_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX file_id_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX file_path_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX file_name_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX file_language_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX function_id_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX function_name_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX function_language_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX class_id_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX class_name_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX class_language_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX import_id_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX import_module_index
        .mockResolvedValueOnce(undefined) // CREATE EDGE INDEX belongs_to_index
        .mockResolvedValueOnce(undefined) // CREATE EDGE INDEX contains_index
        .mockResolvedValueOnce(undefined) // CREATE EDGE INDEX imports_index
        .mockResolvedValueOnce(undefined) // CREATE EDGE INDEX calls_index
        .mockResolvedValueOnce(undefined) // CREATE EDGE INDEX extends_index
        .mockResolvedValueOnce(undefined); // CREATE EDGE INDEX implements_index

      const result = spaceManager.createSpace('test-project');

      // 使用 runAllTimers 来处理 waitForSpaceReady 中的 setTimeout
      jest.runAllTimers();

      await expect(result).resolves.toBe(true);
      expect(mockNebulaService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE SPACE IF NOT EXISTS `project_test-project`')
      );
      expect(mockDatabaseLoggerService.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'space_created',
          source: 'nebula',
          data: expect.objectContaining({
            message: 'Successfully created space project_test-project for project test-project'
          })
        })
      );
    });

    it('should create space with custom config', async () => {
      mockNebulaService.executeQuery
        .mockResolvedValueOnce(undefined) // CREATE SPACE
        .mockResolvedValueOnce({ data: [{ name: 'test_space' }] }) // DESCRIBE SPACE for waitForSpaceReady
        .mockResolvedValueOnce(undefined) // USE SPACE
        .mockResolvedValueOnce(undefined) // CREATE TAG Project
        .mockResolvedValueOnce(undefined) // CREATE TAG File
        .mockResolvedValueOnce(undefined) // CREATE TAG Function
        .mockResolvedValueOnce(undefined) // CREATE TAG Class
        .mockResolvedValueOnce(undefined) // CREATE TAG Import
        .mockResolvedValueOnce(undefined) // CREATE EDGE BELONGS_TO
        .mockResolvedValueOnce(undefined) // CREATE EDGE CONTAINS
        .mockResolvedValueOnce(undefined) // CREATE EDGE IMPORTS
        .mockResolvedValueOnce(undefined) // CREATE EDGE CALLS
        .mockResolvedValueOnce(undefined) // CREATE EDGE EXTENDS
        .mockResolvedValueOnce(undefined) // CREATE EDGE IMPLEMENTS
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX project_id_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX project_name_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX file_id_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX file_path_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX file_name_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX file_language_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX function_id_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX function_name_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX function_language_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX class_id_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX class_name_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX class_language_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX import_id_index
        .mockResolvedValueOnce(undefined) // CREATE TAG INDEX import_module_index
        .mockResolvedValueOnce(undefined) // CREATE EDGE INDEX belongs_to_index
        .mockResolvedValueOnce(undefined) // CREATE EDGE INDEX contains_index
        .mockResolvedValueOnce(undefined) // CREATE EDGE INDEX imports_index
        .mockResolvedValueOnce(undefined) // CREATE EDGE INDEX calls_index
        .mockResolvedValueOnce(undefined) // CREATE EDGE INDEX extends_index
        .mockResolvedValueOnce(undefined); // CREATE EDGE INDEX implements_index

      const config = {
        partitionNum: 20,
        replicaFactor: 3,
        vidType: '"FIXED_STRING(64)"'
      };

      const result = spaceManager.createSpace('test-project', config);

      // 使用 runAllTimers 来处理 waitForSpaceReady 中的 setTimeout
      jest.runAllTimers();

      await expect(result).resolves.toBe(true);
      expect(mockNebulaService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('partition_num = 20')
      );
      expect(mockNebulaService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('replica_factor = 3')
      );
    });

    it('should handle space creation error', async () => {
      mockNebulaService.executeQuery.mockRejectedValue(new Error('Creation failed'));

      const result = await spaceManager.createSpace('test-project');

      expect(result).toBe(false);
      expect(mockDatabaseLoggerService.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error_occurred',
          source: 'nebula',
          data: expect.objectContaining({
            message: 'Failed to create space project_test-project:'
          })
        })
      );
    });
  });

  describe('deleteSpace', () => {
    it('should delete space successfully', async () => {
      mockNebulaService.executeQuery.mockResolvedValue(undefined);

      const result = await spaceManager.deleteSpace('test-project');

      expect(result).toBe(true);
      expect(mockNebulaService.executeQuery).toHaveBeenCalledWith(
        'DROP SPACE IF EXISTS `project_test-project`'
      );
      expect(mockDatabaseLoggerService.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'space_deleted',
          source: 'nebula',
          data: expect.objectContaining({
            message: 'Successfully deleted space project_test-project for project test-project'
          })
        })
      );
    });

    it('should handle space deletion error', async () => {
      mockNebulaService.executeQuery.mockRejectedValue(new Error('Deletion failed'));

      const result = await spaceManager.deleteSpace('test-project');

      expect(result).toBe(false);
      expect(mockDatabaseLoggerService.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error_occurred',
          source: 'nebula',
          data: expect.objectContaining({
            message: 'Failed to delete space project_test-project:'
          })
        })
      );
    });
  });

  describe('listSpaces', () => {
    it('should list spaces successfully with standard format', async () => {
      // 重置模拟函数以确保干净的测试环境
      mockNebulaService.executeQuery.mockReset();

      const mockResult = {
        data: [
          { Name: 'space1' },
          { Name: 'space2' },
        ]
      };
      mockNebulaService.executeQuery.mockResolvedValue(mockResult);

      const result = await spaceManager.listSpaces();

      expect(result).toEqual(['space1', 'space2']);
      expect(mockNebulaService.executeQuery).toHaveBeenCalledWith('SHOW SPACES');
    });

    it('should handle different column name formats', async () => {
      const mockResult = {
        data: [
          { name: 'space1' },
          { NAME: 'space2' },
          { space_name: 'space3' },
        ]
      };
      mockNebulaService.executeQuery.mockResolvedValue(mockResult);

      const result = await spaceManager.listSpaces();

      expect(result).toEqual(['space1', 'space2', 'space3']);
    });

    it('should handle alternative result formats', async () => {
      const mockResult = {
        table: [
          { Name: 'space1' },
        ]
      };
      mockNebulaService.executeQuery.mockResolvedValue(mockResult);

      const result = await spaceManager.listSpaces();

      expect(result).toEqual(['space1']);
    });

    it('should handle null result', async () => {
      mockNebulaService.executeQuery.mockResolvedValue(null);

      const result = await spaceManager.listSpaces();

      expect(result).toEqual([]);
      expect(mockDatabaseLoggerService.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          source: 'nebula',
          data: expect.objectContaining({
            message: 'SHOW SPACES returned null result'
          })
        })
      );
    });

    it('should handle non-array data', async () => {
      mockNebulaService.executeQuery.mockResolvedValue({ data: 'invalid' });

      const result = await spaceManager.listSpaces();

      expect(result).toEqual([]);
      expect(mockDatabaseLoggerService.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          source: 'nebula',
          data: expect.objectContaining({
            message: 'SHOW SPACES returned non-array data:'
          })
        })
      );
    });

    it('should handle empty data array', async () => {
      mockNebulaService.executeQuery.mockResolvedValue({ data: [] });

      const result = await spaceManager.listSpaces();

      expect(result).toEqual([]);
    });

    it('should handle read query error', async () => {
      mockNebulaService.executeQuery.mockRejectedValue(new Error('Query failed'));

      const result = await spaceManager.listSpaces();

      expect(result).toEqual([]);
      expect(mockDatabaseLoggerService.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error_occurred',
          source: 'nebula',
          data: expect.objectContaining({
            message: 'Failed to list spaces:'
          })
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
      mockNebulaService.executeQuery.mockResolvedValue(mockResult);

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
      mockNebulaService.executeQuery.mockResolvedValue(mockResult);

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
      mockNebulaService.executeQuery.mockResolvedValue(mockResult);

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
      mockNebulaService.executeQuery.mockResolvedValue(null);

      const result = await spaceManager.getSpaceInfo('test-project');

      expect(result).toBeNull();
      expect(mockDatabaseLoggerService.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          source: 'nebula',
          data: expect.objectContaining({
            message: 'DESCRIBE SPACE project_test-project returned null result'
          })
        })
      );
    });

    it('should return null for empty data', async () => {
      mockNebulaService.executeQuery.mockResolvedValue({ data: [] });

      const result = await spaceManager.getSpaceInfo('test-project');

      expect(result).toBeNull();
    });

    it('should return null for invalid data format', async () => {
      mockNebulaService.executeQuery.mockResolvedValue({ data: 'invalid' });

      const result = await spaceManager.getSpaceInfo('test-project');

      expect(result).toBeNull();
    });

    it('should handle read query error', async () => {
      mockNebulaService.executeQuery.mockRejectedValue(new Error('Query failed'));

      const result = await spaceManager.getSpaceInfo('test-project');

      expect(result).toBeNull();
      expect(mockDatabaseLoggerService.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error_occurred',
          source: 'nebula',
          data: expect.objectContaining({
            message: 'Failed to get space info for project_test-project:'
          })
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
      expect(mockDatabaseLoggerService.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error_occurred',
          source: 'nebula',
          data: expect.objectContaining({
            message: 'Failed to check if space project_test-project exists:'
          })
        })
      );
    });
  });

  describe('waitForSpaceReady', () => {
    it('should wait for space to be ready', async () => {
      const mockResult = {
        data: [{ name: 'test-space' }]
      };
      mockNebulaService.executeQuery
        .mockResolvedValueOnce(null) // First call returns null
        .mockResolvedValueOnce(mockResult); // Second call returns result

      // @ts-ignore - accessing private method for testing
      const promise = spaceManager['waitForSpaceReady']('test-space', 5, 10);

      // 使用 runAllTimers 来处理 waitForSpaceReady 中的 setTimeout
      jest.runAllTimers();

      await promise;

      expect(mockNebulaService.executeQuery).toHaveBeenCalledWith(
        'DESCRIBE SPACE `test-space`'
      );
    });

    it('should throw error if space does not become ready', async () => {
      mockNebulaService.executeQuery.mockRejectedValue(new Error('Space not ready'));

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
      mockNebulaService.executeQuery.mockResolvedValue(undefined);

      // @ts-ignore - accessing private method for testing
      await spaceManager['createGraphSchema']();

      // 检查是否调用了创建标签的查询
      expect(mockNebulaService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TAG IF NOT EXISTS Project')
      );

      // 检查是否调用了创建边类型的查询
      expect(mockNebulaService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE EDGE IF NOT EXISTS BELONGS_TO')
      );

      // 检查是否调用了创建标签索引的查询
      expect(mockNebulaService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TAG INDEX IF NOT EXISTS project_id_index')
      );

      // 检查是否调用了创建边索引的查询
      expect(mockNebulaService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE EDGE INDEX IF NOT EXISTS belongs_to_index')
      );
    });

    it('should handle schema creation error', async () => {
      mockNebulaService.executeQuery.mockRejectedValue(new Error('Schema creation failed'));

      // @ts-ignore - accessing private method for testing
      await expect(spaceManager['createGraphSchema']()).rejects.toThrow('Schema creation failed');
    });
  });

  describe('createIndexWithRetry', () => {
    it('should create index successfully on first try', async () => {
      mockNebulaService.executeQuery.mockResolvedValue(undefined);

      // @ts-ignore - accessing private method for testing
      await spaceManager['createIndexWithRetry']('CREATE TAG INDEX test_index ON TestTag(name)');

      expect(mockNebulaService.executeQuery).toHaveBeenCalledWith(
        'CREATE TAG INDEX test_index ON TestTag(name)'
      );
      expect(mockDatabaseLoggerService.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'debug',
          source: 'nebula',
          data: expect.objectContaining({
            message: 'Successfully created index: CREATE TAG INDEX test_index ON TestTag(name)'
          })
        })
      );
    });

    it('should handle already exists error', async () => {
      mockNebulaService.executeQuery.mockRejectedValue(new Error('already exists'));

      // @ts-ignore - accessing private method for testing
      await spaceManager['createIndexWithRetry']('CREATE TAG INDEX test_index ON TestTag(name)');

      expect(mockDatabaseLoggerService.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'debug',
          source: 'nebula',
          data: expect.objectContaining({
            message: 'Index already exists: CREATE TAG INDEX test_index ON TestTag(name)'
          })
        })
      );
    });

    it('should retry on failure and eventually succeed', async () => {
      mockNebulaService.executeQuery
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(undefined);

      // @ts-ignore - accessing private method for testing
      const promise = spaceManager['createIndexWithRetry']('CREATE TAG INDEX test_index ON TestTag(name)', 3);

      // 使用 runAllTimers 来处理 createIndexWithRetry 中的 setTimeout
      jest.runAllTimers();

      await promise;

      expect(mockNebulaService.executeQuery).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      mockNebulaService.executeQuery.mockRejectedValue(new Error('Persistent failure'));

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
      mockNebulaService.executeQuery
        .mockResolvedValueOnce(undefined) // USE command
        .mockResolvedValueOnce({ data: [{ Name: 'TestTag' }] }) // SHOW TAGS
        .mockResolvedValueOnce({ data: [{ Name: 'TestEdge' }] }) // SHOW EDGES
        .mockResolvedValueOnce(undefined) // DELETE VERTEX
        .mockResolvedValueOnce(undefined); // DELETE EDGE

      const result = await spaceManager.clearSpace('test-project');

      expect(result).toBe(true);
      expect(mockNebulaService.executeQuery).toHaveBeenCalledWith('USE `project_test-project`');
      expect(mockNebulaService.executeQuery).toHaveBeenCalledWith('SHOW TAGS');
      expect(mockNebulaService.executeQuery).toHaveBeenCalledWith('SHOW EDGES');
      expect(mockDatabaseLoggerService.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          source: 'nebula',
          data: expect.objectContaining({
            message: 'Starting to clear space project_test-project for project test-project'
          })
        })
      );
    });

    it('should handle empty space', async () => {
      mockNebulaService.executeQuery
        .mockResolvedValueOnce(undefined) // USE command
        .mockResolvedValueOnce({ data: [] }) // SHOW TAGS - no tags
        .mockResolvedValueOnce({ data: [] }); // SHOW EDGES - no edges

      const result = await spaceManager.clearSpace('test-project');

      expect(result).toBe(true);
      expect(mockNebulaService.executeQuery).toHaveBeenCalledWith('USE `project_test-project`');
    });

    it('should handle errors during space clearing', async () => {
      mockNebulaService.executeQuery
        .mockRejectedValueOnce(new Error('Clear failed')); // USE command fails

      const result = await spaceManager.clearSpace('test-project');

      expect(result).toBe(false);
      expect(mockDatabaseLoggerService.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'space_error',
          source: 'nebula',
          data: expect.objectContaining({
            message: 'Failed to clear space project_test-project:'
          })
        })
      );
    });

    it('should continue processing even if some deletions fail', async () => {
      mockNebulaService.executeQuery
        .mockResolvedValueOnce(undefined) // USE command
        .mockResolvedValueOnce({ data: [{ Name: 'TestTag' }] }) // SHOW TAGS
        .mockResolvedValueOnce({ data: [{ Name: 'TestEdge' }] }) // SHOW EDGES
        .mockRejectedValueOnce(new Error('Delete edge failed')) // DELETE EDGE
        .mockResolvedValueOnce(undefined); // DELETE VERTEX

      const result = await spaceManager.clearSpace('test-project');

      expect(result).toBe(true);
      expect(mockDatabaseLoggerService.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'space_error',
          source: 'nebula',
          data: expect.objectContaining({
            message: 'Failed to delete edge TestEdge:'
          })
        })
      );
    });
  });
});