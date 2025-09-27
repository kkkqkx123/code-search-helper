import { ProjectIdManager } from '../ProjectIdManager';
import { QdrantCollectionManager } from '../qdrant/QdrantCollectionManager';
import { NebulaSpaceManager } from '../nebula/NebulaSpaceManager';
import { StorageCoordinator } from '../../services/storage/StorageCoordinator';
import { IndexCoordinator } from '../../services/indexing/IndexCoordinator';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { QdrantClientWrapper } from '../qdrant/QdrantClientWrapper';
import { NebulaService } from '../NebulaService';

// Mock services to isolate the components being tested
class MockLoggerService {
  info(message: string, meta?: any) {
    console.log(`[INFO] ${message}`, meta);
  }

  error(message: string, error?: any) {
    console.error(`[ERROR] ${message}`, error);
  }

  warn(message: string, meta?: any) {
    console.warn(`[WARN] ${message}`, meta);
  }

  debug(message: string, meta?: any) {
    console.debug(`[DEBUG] ${message}`, meta);
  }
}

class MockErrorHandlerService {
  handleError(error: Error, context?: any) {
    console.error(`[ERROR HANDLER] ${error.message}`, context);
    console.error(`[ERROR STACK] ${error.stack}`);
    return {
      id: 'test-error-id',
      timestamp: new Date(),
      type: 'test',
      message: error.message,
      stack: error.stack,
      context: context || {},
      severity: 'medium',
      handled: false,
    };
  }
}

// Test configuration
const TEST_PROJECT_1_PATH = './test/mock-folder/project1';
//.为项目根目录
const TEST_PROJECT_2_PATH = './test/mock-folder/project2';

describe('Multi-Project Isolation Integration', () => {
  let projectIdManager: ProjectIdManager;
  let qdrantCollectionManager: QdrantCollectionManager;
  let nebulaSpaceManager: NebulaSpaceManager;
  let storageCoordinator: StorageCoordinator;
  let indexCoordinator: IndexCoordinator;
  let mockLogger: LoggerService;
  let mockErrorHandler: ErrorHandlerService;
  let configService: ConfigService;
  let mockQdrantClient: jest.Mocked<QdrantClientWrapper>;
  let mockNebulaService: jest.Mocked<NebulaService>;

  beforeAll(() => {
    // Initialize mock services
    mockLogger = new MockLoggerService() as unknown as LoggerService;
    mockErrorHandler = new MockErrorHandlerService() as unknown as ErrorHandlerService;
    configService = ConfigService.getInstance();
  });

  beforeEach(() => {
    // Reset modules to ensure clean test environment
    jest.resetModules();

    // Create instances of the managers and coordinators
    projectIdManager = new ProjectIdManager();

    // Create mocks for QdrantClientWrapper and NebulaService
    mockQdrantClient = {
      connect: jest.fn().mockResolvedValue(true),
      isConnectedToDatabase: jest.fn().mockReturnValue(true),
      createCollection: jest.fn().mockResolvedValue(true),
      deleteCollection: jest.fn().mockResolvedValue(true),
      getCollections: jest.fn().mockResolvedValue({ collections: [] }),
      getCollectionInfo: jest.fn().mockResolvedValue(null),
      collectionExists: jest.fn().mockResolvedValue(false),
      clearCollection: jest.fn().mockResolvedValue(true),
      close: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockNebulaService = {
      executeWriteQuery: jest.fn().mockResolvedValue({ data: [] }),
      executeReadQuery: jest.fn().mockResolvedValue({ data: [] }),
      isConnectedToDatabase: jest.fn().mockReturnValue(true),
      connect: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Create managers with mocked dependencies
    qdrantCollectionManager = new QdrantCollectionManager(
      mockQdrantClient,
      mockLogger,
      mockErrorHandler,
      configService
    );

    nebulaSpaceManager = new NebulaSpaceManager(
      mockNebulaService,
      mockLogger,
      mockErrorHandler,
      configService
    );
  });

  afterEach(() => {
    // Clean up any resources
    jest.clearAllMocks();
  });

  describe('Project ID Management', () => {
    it('should generate consistent project IDs for the same path', async () => {
      const projectId1 = await projectIdManager.generateProjectId(TEST_PROJECT_1_PATH);
      const projectId2 = await projectIdManager.generateProjectId(TEST_PROJECT_1_PATH);

      expect(projectId1).toBe(projectId2);
      expect(projectId1).toHaveLength(16);
    });

    it('should generate different project IDs for different paths', async () => {
      const projectId1 = await projectIdManager.generateProjectId(TEST_PROJECT_1_PATH);
      const projectId2 = await projectIdManager.generateProjectId(TEST_PROJECT_2_PATH);

      expect(projectId1).not.toBe(projectId2);
    });

    it('should generate correct collection and space names', async () => {
      const projectId = await projectIdManager.generateProjectId(TEST_PROJECT_1_PATH);
      const collectionName = projectIdManager.getCollectionName(projectId);
      const spaceName = projectIdManager.getSpaceName(projectId);

      expect(collectionName).toBe(`project-${projectId}`);
      expect(spaceName).toBe(`project_${projectId}`);
    });
  });

  describe('Qdrant Collection Management', () => {
    it('should create project-specific collections', async () => {
      const projectId = await projectIdManager.generateProjectId(TEST_PROJECT_1_PATH);
      const config = { vectorSize: 128, distance: 'Cosine' as const };

      const result = await qdrantCollectionManager.createCollection(projectId, config);

      expect(result).toBe(true);
      expect(mockQdrantClient.createCollection).toHaveBeenCalledWith(
        `project-${projectId}`,
        config.vectorSize,
        config.distance,
        undefined
      );
    });

    it('should check if project-specific collections exist', async () => {
      const projectId = await projectIdManager.generateProjectId(TEST_PROJECT_1_PATH);

      await qdrantCollectionManager.collectionExists(projectId);

      expect(mockQdrantClient.collectionExists).toHaveBeenCalledWith(`project-${projectId}`);
    });

    it('should delete project-specific collections', async () => {
      const projectId = await projectIdManager.generateProjectId(TEST_PROJECT_1_PATH);

      const result = await qdrantCollectionManager.deleteCollection(projectId);

      expect(result).toBe(true);
      expect(mockQdrantClient.deleteCollection).toHaveBeenCalledWith(`project-${projectId}`);
    });
  });

  describe('Nebula Space Management', () => {
    it('should create project-specific spaces', async () => {
      const projectId = await projectIdManager.generateProjectId(TEST_PROJECT_1_PATH);
      const config = { partitionNum: 10, replicaFactor: 1, vidType: 'FIXED_STRING(32)' };

      // Mock the waitForSpaceReady function to resolve immediately
      (nebulaSpaceManager as any).waitForSpaceReady = jest.fn().mockResolvedValue(undefined);
      // Mock the createGraphSchema function to resolve immediately
      (nebulaSpaceManager as any).createGraphSchema = jest.fn().mockResolvedValue(undefined);

      const result = await nebulaSpaceManager.createSpace(projectId, config);

      expect(result).toBe(true);
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        expect.stringContaining(`CREATE SPACE IF NOT EXISTS project_${projectId}`)
      );
    });

    it('should check if project-specific spaces exist', async () => {
      const projectId = await projectIdManager.generateProjectId(TEST_PROJECT_1_PATH);

      // Mock the listSpaces function to return a list that includes our space
      (nebulaSpaceManager as any).listSpaces = jest
        .fn()
        .mockResolvedValue([`project_${projectId}`]);

      const result = await nebulaSpaceManager.checkSpaceExists(projectId);

      expect(result).toBe(true);
    });

    it('should delete project-specific spaces', async () => {
      const projectId = await projectIdManager.generateProjectId(TEST_PROJECT_1_PATH);

      const result = await nebulaSpaceManager.deleteSpace(projectId);

      expect(result).toBe(true);
      expect(mockNebulaService.executeWriteQuery).toHaveBeenCalledWith(
        `DROP SPACE IF EXISTS project_${projectId}`
      );
    });
  });

  describe('Storage Coordinator Integration', () => {
    beforeEach(() => {
      // Create mocks for VectorStorageService and GraphPersistenceService
      const mockVectorStorage = {
        initialize: jest.fn().mockResolvedValue(undefined),
        storeChunks: jest.fn().mockResolvedValue({ success: true, chunksStored: 0, errors: [] }),
        search: jest.fn().mockResolvedValue([]),
        getCollectionStats: jest.fn().mockResolvedValue({ totalPoints: 0 }),
      };

      const mockGraphStorage = {
        initializeProjectSpace: jest.fn().mockResolvedValue(undefined),
        storeChunks: jest.fn().mockResolvedValue({ success: true, chunksStored: 0, errors: [] }),
        search: jest.fn().mockResolvedValue([]),
        getGraphStats: jest.fn().mockResolvedValue({ nodes: 0, edges: 0 }),
      };

      // Create mocks for TransactionCoordinator
      const mockTransactionCoordinator = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        addVectorOperation: jest.fn().mockResolvedValue(undefined),
        addGraphOperation: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(true),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      };

      // Create StorageCoordinator with mocked dependencies
      storageCoordinator = new StorageCoordinator(
        mockLogger,
        mockErrorHandler,
        configService,
        mockVectorStorage as any,
        mockGraphStorage as any,
        mockTransactionCoordinator as any,
        mockQdrantClient
      );
    });

    it('should initialize project resources correctly', async () => {
      const projectId = await projectIdManager.generateProjectId(TEST_PROJECT_1_PATH);

      // Mock the initializeProject method to avoid actual initialization
      const mockInitializeProject = jest
        .spyOn(storageCoordinator as any, 'initializeProject')
        .mockResolvedValue(undefined);

      await storageCoordinator.getProjectResources(projectId);

      expect(mockInitializeProject).toHaveBeenCalledWith(projectId);
    });
  });

  describe('Index Coordinator Integration', () => {
    beforeEach(() => {
      // Create mocks for all dependencies of IndexCoordinator
      const mockChangeDetectionService = {};
      const mockParserService = {
        parseFiles: jest.fn().mockResolvedValue([]),
      };
      const mockFileSystemTraversal = {
        traverseDirectory: jest.fn().mockResolvedValue({ files: [] }),
      };
      const mockAsyncPipeline = {
        execute: jest.fn().mockResolvedValue({ success: true, data: {}, totalTime: 0, steps: [] }),
        clearSteps: jest.fn(),
        addStep: jest.fn().mockReturnThis(),
        getMetrics: jest.fn().mockReturnValue({}),
      };
      const mockBatchProcessor = {
        processInBatches: jest.fn().mockResolvedValue({ results: [] }),
      };
      const mockMemoryManager = {
        startMonitoring: jest.fn(),
        checkMemory: jest.fn().mockReturnValue(true),
      };
      const mockSearchCoordinator = {
        search: jest.fn().mockResolvedValue({ results: [] }),
      };

      // Create IndexCoordinator with mocked dependencies
      indexCoordinator = new IndexCoordinator(
        mockLogger,
        mockErrorHandler,
        configService,
        mockChangeDetectionService as any,
        mockParserService as any,
        storageCoordinator, // Use the real StorageCoordinator
        mockFileSystemTraversal as any,
        mockAsyncPipeline as any,
        mockBatchProcessor as any,
        mockMemoryManager as any,
        mockSearchCoordinator as any,
        {} as any // LSPEnhancementPhase mock
      );
    });

    it('should create index with project isolation', async () => {
      const result = await indexCoordinator.createIndex(TEST_PROJECT_1_PATH, {});

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Project Isolation', () => {
    it('should isolate resources between different projects', async () => {
      // Generate project IDs for two different projects
      const projectId1 = await projectIdManager.generateProjectId(TEST_PROJECT_1_PATH);
      const projectId2 = await projectIdManager.generateProjectId(TEST_PROJECT_2_PATH);

      // Verify that the project IDs are different
      expect(projectId1).not.toBe(projectId2);

      // Verify that the collection names are different
      const collectionName1 = projectIdManager.getCollectionName(projectId1);
      const collectionName2 = projectIdManager.getCollectionName(projectId2);
      expect(collectionName1).not.toBe(collectionName2);

      // Verify that the space names are different
      const spaceName1 = projectIdManager.getSpaceName(projectId1);
      const spaceName2 = projectIdManager.getSpaceName(projectId2);
      expect(spaceName1).not.toBe(spaceName2);
    });

    it('should manage resources independently for each project', async () => {
      const projectId1 = await projectIdManager.generateProjectId(TEST_PROJECT_1_PATH);
      const projectId2 = await projectIdManager.generateProjectId(TEST_PROJECT_2_PATH);

      // Create collections for both projects
      const config = { vectorSize: 128, distance: 'Cosine' as const };
      await qdrantCollectionManager.createCollection(projectId1, config);
      await qdrantCollectionManager.createCollection(projectId2, config);

      // Verify both collections were created with correct names
      expect(mockQdrantClient.createCollection).toHaveBeenNthCalledWith(
        1,
        `project-${projectId1}`,
        config.vectorSize,
        config.distance,
        undefined
      );

      expect(mockQdrantClient.createCollection).toHaveBeenNthCalledWith(
        2,
        `project-${projectId2}`,
        config.vectorSize,
        config.distance,
        undefined
      );

      // Delete one collection
      await qdrantCollectionManager.deleteCollection(projectId1);

      // Verify only the first collection was deleted
      expect(mockQdrantClient.deleteCollection).toHaveBeenCalledWith(`project-${projectId1}`);
      expect(mockQdrantClient.deleteCollection).not.toHaveBeenCalledWith(`project-${projectId2}`);
    });
  });
});
