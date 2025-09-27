import { NebulaSpaceManager } from '../NebulaSpaceManager';
import { LoggerService } from '../../../core/LoggerService';
import { ErrorHandlerService } from '../../../core/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { NebulaService } from '../../NebulaService';

// Mocks
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
};

const mockErrorHandler = {
  handleError: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue({
    partitionNum: 10,
    replicaFactor: 1,
    vidType: 'FIXED_STRING(32)',
  }),
  getAll: jest.fn().mockReturnValue({
    nebula: {
      host: 'localhost',
      port: 9669,
      username: 'root',
      password: 'nebula',
      space: 'test_space',
    },
  }),
};

const mockNebulaService = {
  executeReadQuery: jest.fn(),
  executeWriteQuery: jest.fn(),
};

describe('NebulaSpaceManager', () => {
  let spaceManager: NebulaSpaceManager;
  let mockProjectId: string;

  beforeEach(() => {
    spaceManager = new NebulaSpaceManager(
      mockNebulaService as any,
      mockLogger as any,
      mockErrorHandler as any,
      mockConfigService as any
    );

    mockProjectId = 'test-project-id';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSpaceName', () => {
    it('should generate correct space name', () => {
      const spaceName = (spaceManager as any).generateSpaceName(mockProjectId);
      expect(spaceName).toBe('project_test-project-id');
    });
  });

  describe('createSpace', () => {
    it('should create space successfully', async () => {
      mockNebulaService.executeWriteQuery.mockResolvedValueOnce({});
      mockNebulaService.executeReadQuery.mockResolvedValueOnce({ data: [{}] });

      const result = await spaceManager.createSpace(mockProjectId, {
        partitionNum: 10,
        replicaFactor: 1,
        vidType: 'FIXED_STRING(32)',
      });

      expect(result).toBe(true);
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE SPACE IF NOT EXISTS project_test-project-id')
      );
    });

    it('should handle create space failure', async () => {
      mockNebulaService.executeWriteQuery.mockRejectedValueOnce(new Error('Create failed'));

      const result = await spaceManager.createSpace(mockProjectId, {
        partitionNum: 10,
        replicaFactor: 1,
        vidType: 'FIXED_STRING(32)',
      });

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('deleteSpace', () => {
    it('should delete space successfully', async () => {
      mockNebulaService.executeWriteQuery.mockResolvedValueOnce({});

      const result = await spaceManager.deleteSpace(mockProjectId);

      expect(result).toBe(true);
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        'DROP SPACE IF EXISTS project_test-project-id'
      );
    });

    it('should handle delete space failure', async () => {
      mockNebulaService.executeWriteQuery.mockRejectedValueOnce(new Error('Delete failed'));

      const result = await spaceManager.deleteSpace(mockProjectId);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('listSpaces', () => {
    it('should list spaces successfully', async () => {
      mockNebulaService.executeReadQuery.mockResolvedValueOnce({
        data: [{ Name: 'space1' }, { Name: 'project_test-project-id' }],
      });

      const result = await spaceManager.listSpaces();

      expect(result).toEqual(['space1', 'project_test-project-id']);
    });

    it('should handle list spaces failure', async () => {
      mockNebulaService.executeReadQuery.mockRejectedValueOnce(new Error('List failed'));

      const result = await spaceManager.listSpaces();

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getSpaceInfo', () => {
    it('should get space info successfully', async () => {
      const mockSpaceInfo = {
        name: 'project_test-project-id',
        partition_num: 10,
        replica_factor: 1,
        vid_type: 'FIXED_STRING(32)',
        charset: 'utf8',
        collate: 'utf8_bin',
      };

      mockNebulaService.executeReadQuery.mockResolvedValueOnce({
        data: [mockSpaceInfo],
      });

      const result = await spaceManager.getSpaceInfo(mockProjectId);

      expect(result).toEqual(mockSpaceInfo);
    });

    it('should return null when space does not exist', async () => {
      mockNebulaService.executeReadQuery.mockResolvedValueOnce({
        data: [],
      });

      const result = await spaceManager.getSpaceInfo(mockProjectId);

      expect(result).toBeNull();
    });
  });

  describe('checkSpaceExists', () => {
    it('should return true when space exists', async () => {
      mockNebulaService.executeReadQuery.mockResolvedValueOnce({
        data: [{ Name: 'space1' }, { Name: 'project_test-project-id' }],
      });

      const result = await spaceManager.checkSpaceExists(mockProjectId);

      expect(result).toBe(true);
    });

    it('should return false when space does not exist', async () => {
      mockNebulaService.executeReadQuery.mockResolvedValueOnce({
        data: [{ Name: 'space1' }, { Name: 'space2' }],
      });

      const result = await spaceManager.checkSpaceExists(mockProjectId);

      expect(result).toBe(false);
    });
  });
});
