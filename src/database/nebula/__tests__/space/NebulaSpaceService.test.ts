import { Container } from 'inversify';
import { TYPES } from '../../../../types';
import { NebulaSpaceService, INebulaSpaceService } from '../../space/NebulaSpaceService';
import { INebulaConnectionManager } from '../../NebulaConnectionManager';
import { DatabaseLoggerService } from '../../../common/DatabaseLoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { NebulaConfigService } from '../../../../config/service/NebulaConfigService';
import { DatabaseEventType } from '../../../common/DatabaseEventTypes';
import { NebulaConfig } from '../../NebulaTypes';

// Mock services to avoid real instances with timers and event listeners
jest.mock('../../../../utils/LoggerService');
jest.mock('../../../../utils/ErrorHandlerService');
jest.mock('../../../common/DatabaseLoggerService');

describe('NebulaSpaceService', () => {
  let container: Container;
  let spaceService: INebulaSpaceService;
  let mockConnectionManager: jest.Mocked<INebulaConnectionManager>;
  let mockDatabaseLogger: jest.Mocked<DatabaseLoggerService>;
  let mockErrorHandler: jest.Mocked<ErrorHandlerService>;
  let mockConfigService: jest.Mocked<NebulaConfigService>;

  beforeEach(() => {
    container = new Container();

    // Create mock instances for services
    mockConnectionManager = {
      executeQuery: jest.fn(),
      isConnected: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      getConnectionForSpace: jest.fn(),
      executeTransaction: jest.fn(),
      getConnectionStatus: jest.fn(),
      getConfig: jest.fn(),
      updateConfig: jest.fn()
    } as any;

    mockDatabaseLogger = {
      logDatabaseEvent: jest.fn().mockResolvedValue(undefined),
      logConnectionEvent: jest.fn().mockResolvedValue(undefined),
      logQueryPerformance: jest.fn().mockResolvedValue(undefined),
      logBatchOperation: jest.fn().mockResolvedValue(undefined),
      logCollectionOperation: jest.fn().mockResolvedValue(undefined),
      logVectorOperation: jest.fn().mockResolvedValue(undefined),
      logQueryOperation: jest.fn().mockResolvedValue(undefined),
      logProjectOperation: jest.fn().mockResolvedValue(undefined),
      updateLogLevel: jest.fn()
    } as any;

    mockErrorHandler = {
      handleError: jest.fn(),
      getErrorReport: jest.fn(),
      getAllErrorReports: jest.fn(),
      clearErrorReport: jest.fn(),
      clearAllErrorReports: jest.fn(),
      getErrorStats: jest.fn()
    } as any;

    mockConfigService = {
      loadConfig: jest.fn().mockReturnValue({
        host: '127.0.0.1',
        port: 9669,
        username: 'root',
        password: 'nebula',
        timeout: 3000,
        maxConnections: 10,
        retryAttempts: 3,
        retryDelay: 30000,
        space: 'test_space',
        bufferSize: 10,
        pingInterval: 3000,
        vidTypeLength: 32
      } as NebulaConfig),
      getSpaceNameForProject: jest.fn().mockImplementation((projectId) => `project_${projectId}`),
      validateNamingConvention: jest.fn().mockReturnValue(true),
      validateConfig: jest.fn(),
      getDefaultConfig: jest.fn()
    } as any;

    // Bind mocks to container
    container.bind<INebulaConnectionManager>(TYPES.NebulaConnectionManager).toConstantValue(mockConnectionManager);
    container.bind<DatabaseLoggerService>(TYPES.DatabaseLoggerService).toConstantValue(mockDatabaseLogger);
    container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).toConstantValue(mockErrorHandler);
    container.bind<NebulaConfigService>(TYPES.NebulaConfigService).toConstantValue(mockConfigService);

    // Create instance
    spaceService = new NebulaSpaceService(
      mockConnectionManager,
      mockDatabaseLogger,
      mockErrorHandler,
      mockConfigService
    );

    // Clear mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSpace', () => {
    test('should create space successfully with default options', async () => {
      const spaceName = 'test_space';

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);
      mockConnectionManager.executeQuery.mockResolvedValue({} as any);

      const result = await spaceService.createSpace(spaceName);

      expect(result).toBe(true);
      expect(mockConnectionManager.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining(`CREATE SPACE IF NOT EXISTS \`${spaceName}\``)
      );
      expect(mockDatabaseLogger.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DatabaseEventType.SPACE_CREATED,
          data: expect.objectContaining({
            message: 'Space created successfully'
          })
        })
      );
    });

    test('should create space with custom options', async () => {
      const spaceName = 'test_space';
      const options = {
        partitionNum: 20,
        replicaFactor: 2,
        vidType: 'FIXED_STRING(64)'
      };

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);
      mockConnectionManager.executeQuery.mockResolvedValue({} as any);

      const result = await spaceService.createSpace(spaceName, options);

      expect(result).toBe(true);
      expect(mockConnectionManager.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('partition_num=20')
      );
      expect(mockConnectionManager.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('replica_factor=2')
      );
      expect(mockConnectionManager.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('vid_type=FIXED_STRING(64)')
      );
    });

    test('should handle space creation failure', async () => {
      const spaceName = 'test_space';

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);
      mockConnectionManager.executeQuery.mockResolvedValue({ error: 'Connection failed' } as any);

      const result = await spaceService.createSpace(spaceName);

      expect(result).toBe(false);
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });

    test('should throw error when not connected', async () => {
      const spaceName = 'test_space';

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(false);

      await expect(spaceService.createSpace(spaceName)).rejects.toThrow('Not connected to Nebula Graph');
    });

    test('should return false for invalid space name', async () => {
      const spaceName = '';

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);

      const result = await spaceService.createSpace(spaceName);

      expect(result).toBe(false);
    });
  });

  describe('dropSpace', () => {
    test('should drop space successfully', async () => {
      const spaceName = 'test_space';

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);
      mockConnectionManager.executeQuery.mockResolvedValue({} as any);

      const result = await spaceService.dropSpace(spaceName);

      expect(result).toBe(true);
      expect(mockConnectionManager.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining(`DROP SPACE IF EXISTS \`${spaceName}\``)
      );
      expect(mockDatabaseLogger.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DatabaseEventType.SPACE_DELETED,
          data: expect.objectContaining({
            message: 'Space dropped successfully'
          })
        })
      );
    });

    test('should handle space drop failure', async () => {
      const spaceName = 'test_space';

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);
      mockConnectionManager.executeQuery.mockResolvedValue({ error: 'Connection failed' } as any);

      const result = await spaceService.dropSpace(spaceName);

      expect(result).toBe(false);
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });

    test('should throw error when not connected', async () => {
      const spaceName = 'test_space';

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(false);

      await expect(spaceService.dropSpace(spaceName)).rejects.toThrow('Not connected to Nebula Graph');
    });

    test('should return false for invalid space name', async () => {
      const spaceName = '';

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);

      const result = await spaceService.dropSpace(spaceName);

      expect(result).toBe(false);
    });
  });

  describe('listSpaces', () => {
    test('should list spaces successfully', async () => {
      const mockSpaces = [
        { Name: 'space1' },
        { Name: 'space2' },
        { name: 'space3' }
      ];

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);
      mockConnectionManager.executeQuery.mockResolvedValue({ data: mockSpaces } as any);

      const result = await spaceService.listSpaces();

      expect(result).toEqual(mockSpaces);
      expect(mockConnectionManager.executeQuery).toHaveBeenCalledWith('SHOW SPACES');
      expect(mockDatabaseLogger.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DatabaseEventType.DATA_QUERIED,
          data: expect.objectContaining({
            message: 'Spaces listed successfully'
          })
        })
      );
    });

    test('should handle list spaces failure', async () => {
      const error = new Error('Connection failed');

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);
      mockConnectionManager.executeQuery.mockRejectedValue(error);

      await expect(spaceService.listSpaces()).rejects.toThrow('Connection failed');
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });

    test('should throw error when not connected', async () => {
      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(false);

      await expect(spaceService.listSpaces()).rejects.toThrow('Not connected to Nebula Graph');
    });
  });

  describe('useSpace', () => {
    test('should use space successfully', async () => {
      const spaceName = 'test_space';

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);
      mockConnectionManager.executeQuery.mockResolvedValue({} as any);

      const result = await spaceService.useSpace(spaceName);

      expect(result).toBe(true);
      expect(mockConnectionManager.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining(`USE \`${spaceName}\``)
      );
      expect(mockDatabaseLogger.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DatabaseEventType.SPACE_SELECTED,
          data: expect.objectContaining({
            message: 'Space used successfully'
          })
        })
      );
    });

    test('should handle use space failure', async () => {
      const spaceName = 'test_space';

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);
      mockConnectionManager.executeQuery.mockResolvedValue({ error: 'Connection failed' } as any);

      const result = await spaceService.useSpace(spaceName);

      expect(result).toBe(false);
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });

    test('should throw error when not connected', async () => {
      const spaceName = 'test_space';

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(false);

      await expect(spaceService.useSpace(spaceName)).rejects.toThrow('Not connected to Nebula Graph');
    });

    test('should return false for invalid space name', async () => {
      const spaceName = '';

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);

      const result = await spaceService.useSpace(spaceName);

      expect(result).toBe(false);
    });
  });

  describe('checkSpaceExists', () => {
    test('should return true when space exists', async () => {
      const spaceName = 'test_space';
      const mockSpaces = [
        { Name: 'space1' },
        { Name: spaceName },
        { name: 'space3' }
      ];

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);
      mockConnectionManager.executeQuery.mockResolvedValue({ data: mockSpaces } as any);

      const result = await spaceService.checkSpaceExists(spaceName);

      expect(result).toBe(true);
      expect(mockConnectionManager.executeQuery).toHaveBeenCalledWith('SHOW SPACES');
    });

    test('should return false when space does not exist', async () => {
      const spaceName = 'test_space';
      const mockSpaces = [
        { Name: 'space1' },
        { Name: 'space2' },
        { name: 'space3' }
      ];

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);
      mockConnectionManager.executeQuery.mockResolvedValue({ data: mockSpaces } as any);

      const result = await spaceService.checkSpaceExists(spaceName);

      expect(result).toBe(false);
    });

    test('should return false on query failure', async () => {
      const spaceName = 'test_space';

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);
      mockConnectionManager.executeQuery.mockRejectedValue(new Error('Connection failed'));

      const result = await spaceService.checkSpaceExists(spaceName);

      expect(result).toBe(false);
      expect(mockDatabaseLogger.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DatabaseEventType.ERROR_OCCURRED,
          data: expect.objectContaining({
            message: 'Failed to check if space exists'
          })
        })
      );
    });

    test('should throw error when not connected', async () => {
      const spaceName = 'test_space';

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(false);

      await expect(spaceService.checkSpaceExists(spaceName)).rejects.toThrow('Not connected to Nebula Graph');
    });

    test('should return false for invalid space name', async () => {
      const spaceName = '';

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);

      const result = await spaceService.checkSpaceExists(spaceName);

      expect(result).toBe(false);
    });
  });

  describe('executeQueryInSpace', () => {
    test('should execute query in space successfully', async () => {
      const spaceName = 'test_space';
      const query = 'SHOW TAGS';
      const mockResult = { data: [{ Name: 'tag1' }] };

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);
      mockConnectionManager.executeQuery
        .mockResolvedValueOnce({} as any) // USE
        .mockResolvedValueOnce(mockResult as any); // Actual query

      const result = await spaceService.executeQueryInSpace(spaceName, query);

      expect(result).toEqual(mockResult);
      expect(mockConnectionManager.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining(`USE \`${spaceName}\``)
      );
      expect(mockConnectionManager.executeQuery).toHaveBeenCalledWith(query, undefined);
      expect(mockDatabaseLogger.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DatabaseEventType.QUERY_EXECUTED,
          data: expect.objectContaining({
            message: 'Query executed in space successfully'
          })
        })
      );
    });

    test('should handle query execution failure', async () => {
      const spaceName = 'test_space';
      const query = 'SHOW TAGS';
      const error = new Error('Connection failed');

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);
      mockConnectionManager.executeQuery
        .mockResolvedValueOnce({} as any) // USE
        .mockRejectedValueOnce(error); // Actual query

      await expect(spaceService.executeQueryInSpace(spaceName, query)).rejects.toThrow('Connection failed');
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });

    test('should throw error when not connected', async () => {
      const spaceName = 'test_space';
      const query = 'SHOW TAGS';

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(false);

      await expect(spaceService.executeQueryInSpace(spaceName, query)).rejects.toThrow('Not connected to Nebula Graph');
    });

    test('should throw error for invalid space name', async () => {
      const spaceName = '';
      const query = 'SHOW TAGS';

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);

      await expect(spaceService.executeQueryInSpace(spaceName, query)).rejects.toThrow('Cannot execute query in invalid space');
    });
  });

  describe('getCurrentSpace', () => {
    test('should get current space successfully', () => {
      const spaceName = 'test_space';

      // Setup mocks
      mockConnectionManager.getConnectionStatus.mockReturnValue({ space: spaceName } as any);

      const result = spaceService.getCurrentSpace();

      expect(result).toBe(spaceName);
      expect(mockDatabaseLogger.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DatabaseEventType.DATA_QUERIED,
          data: expect.objectContaining({
            message: 'Getting current space'
          })
        })
      );
    });

    test('should return undefined when no current space', () => {
      // Setup mocks
      mockConnectionManager.getConnectionStatus.mockReturnValue({} as any);

      const result = spaceService.getCurrentSpace();

      expect(result).toBeUndefined();
    });

    test('should return undefined for invalid space name', () => {
      // Setup mocks
      mockConnectionManager.getConnectionStatus.mockReturnValue({ space: '' } as any);

      const result = spaceService.getCurrentSpace();

      expect(result).toBeUndefined();
    });

    test('should handle error when getting current space', () => {
      // Setup mocks
      mockConnectionManager.getConnectionStatus.mockImplementation(() => {
        throw new Error('Connection error');
      });

      const result = spaceService.getCurrentSpace();

      expect(result).toBeUndefined();
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('validateSpace', () => {
    test('should validate space successfully', async () => {
      const spaceName = 'test_space';

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);
      mockConnectionManager.executeQuery
        .mockResolvedValueOnce({ data: [{ Name: spaceName }] } as any) // checkSpaceExists
        .mockResolvedValueOnce({} as any) // USE
        .mockResolvedValueOnce({} as any); // SHOW TAGS

      const result = await spaceService.validateSpace(spaceName);

      expect(result).toBe(true);
      expect(mockDatabaseLogger.logDatabaseEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DatabaseEventType.DATA_QUERIED,
          data: expect.objectContaining({
            message: 'Space validation completed'
          })
        })
      );
    });

    test('should return false when space does not exist', async () => {
      const spaceName = 'test_space';

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);
      mockConnectionManager.executeQuery.mockResolvedValueOnce({ data: [] } as any); // checkSpaceExists

      const result = await spaceService.validateSpace(spaceName);

      expect(result).toBe(false);
    });

    test('should return false when space validation fails', async () => {
      const spaceName = 'test_space';

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);
      mockConnectionManager.executeQuery
        .mockResolvedValueOnce({ data: [{ Name: spaceName }] } as any) // checkSpaceExists
        .mockResolvedValueOnce({} as any) // USE
        .mockResolvedValueOnce({ error: 'Validation failed' } as any); // SHOW TAGS

      const result = await spaceService.validateSpace(spaceName);

      expect(result).toBe(false);
    });

    test('should return false for invalid space name', async () => {
      const spaceName = '';

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(true);

      const result = await spaceService.validateSpace(spaceName);

      expect(result).toBe(false);
    });

    test('should throw error when not connected', async () => {
      const spaceName = 'test_space';

      // Setup mocks
      mockConnectionManager.isConnected.mockReturnValue(false);

      await expect(spaceService.validateSpace(spaceName)).rejects.toThrow('Not connected to Nebula Graph');
    });
  });
});