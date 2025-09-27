import { StorageCoordinator } from '../StorageCoordinator';
import { VectorStorageService } from '../vector/VectorStorageService';
import { GraphPersistenceService } from '../graph/GraphPersistenceService';
import { TransactionCoordinator } from '../../sync/TransactionCoordinator';
import { LoggerService } from '../../../core/LoggerService';
import { ErrorHandlerService } from '../../../core/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { QdrantClientWrapper } from '../../../database/qdrant/QdrantClientWrapper';

// Mock implementations for testing
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as LoggerService;

const mockErrorHandler = {
  handleError: jest.fn(),
} as unknown as ErrorHandlerService;

const mockConfigService = {
  get: jest.fn().mockReturnValue({ collection: 'test_collection' }),
} as unknown as ConfigService;

const mockQdrantClient = {
  getChunkIdsByFiles: jest.fn().mockResolvedValue([]),
} as unknown as QdrantClientWrapper;

const mockVectorStorage = {
  initialize: jest.fn().mockResolvedValue(true),
  storeChunks: jest.fn().mockResolvedValue({ success: true, chunksStored: 1, errors: [] }),
  search: jest.fn().mockResolvedValue([]),
  searchVectors: jest.fn().mockResolvedValue([]),
  getCollectionStats: jest.fn().mockResolvedValue({ totalPoints: 10 }),
} as unknown as VectorStorageService;

const mockGraphStorage = {
  initializeProjectSpace: jest.fn().mockResolvedValue(true),
  storeChunks: jest
    .fn()
    .mockResolvedValue({ success: true, nodesCreated: 1, edgesCreated: 0, errors: [] }),
  search: jest.fn().mockResolvedValue([]),
  getGraphStats: jest.fn().mockResolvedValue({ nodeCount: 5, edgeCount: 3 }),
} as unknown as GraphPersistenceService;

const mockTransactionCoordinator = {
  beginTransaction: jest.fn().mockResolvedValue(true),
  commitTransaction: jest.fn().mockResolvedValue(true),
  rollbackTransaction: jest.fn().mockResolvedValue(true),
  addVectorOperation: jest.fn().mockResolvedValue(true),
  addGraphOperation: jest.fn().mockResolvedValue(true),
} as unknown as TransactionCoordinator;

describe('StorageCoordinator', () => {
  let storageCoordinator: StorageCoordinator;

  beforeEach(() => {
    storageCoordinator = new StorageCoordinator(
      mockLogger,
      mockErrorHandler,
      mockConfigService,
      mockVectorStorage,
      mockGraphStorage,
      mockTransactionCoordinator,
      mockQdrantClient
    );

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('initializeProject', () => {
    it('should initialize project resources correctly', async () => {
      const projectId = 'test-project-id';

      await storageCoordinator.initializeProject(projectId);

      // Verify that the vector storage service was initialized with the project ID
      expect(mockVectorStorage.initialize).toHaveBeenCalledWith(projectId);

      // Verify that the graph storage service was initialized with the project ID
      expect(mockGraphStorage.initializeProjectSpace).toHaveBeenCalledWith(projectId);

      // Verify that project resources were stored
      const projectResources = (storageCoordinator as any).projectResources;
      expect(projectResources.has(projectId)).toBe(true);

      const resources = projectResources.get(projectId);
      expect(resources).toBeDefined();
      expect(resources!.vectorStorage).toBe(mockVectorStorage);
      expect(resources!.graphStorage).toBe(mockGraphStorage);
    });
  });

  describe('getProjectResources', () => {
    it('should return project resources when they exist', async () => {
      const projectId = 'test-project-id';

      // First initialize the project
      await storageCoordinator.initializeProject(projectId);

      // Then get the project resources
      const resources = await storageCoordinator.getProjectResources(projectId);

      expect(resources).toBeDefined();
      expect(resources.vectorStorage).toBe(mockVectorStorage);
      expect(resources.graphStorage).toBe(mockGraphStorage);
    });

    it('should initialize project resources if they do not exist', async () => {
      const projectId = 'new-project-id';

      // Get project resources without initializing first
      const resources = await storageCoordinator.getProjectResources(projectId);

      // Verify that initialization was called
      expect(mockVectorStorage.initialize).toHaveBeenCalledWith(projectId);
      expect(mockGraphStorage.initializeProjectSpace).toHaveBeenCalledWith(projectId);

      expect(resources).toBeDefined();
      expect(resources.vectorStorage).toBe(mockVectorStorage);
      expect(resources.graphStorage).toBe(mockGraphStorage);
    });
  });

  describe('store', () => {
    it('should use project-specific resources when projectId is provided', async () => {
      const projectId = 'test-project-id';
      const files = [
        {
          filePath: '/test/file.ts',
          chunks: [
            {
              id: 'chunk-1',
              content: 'test content',
              startLine: 1,
              endLine: 1,
              startByte: 0,
              endByte: 12,
              type: 'code',
              filePath: '/test/file.ts',
              language: 'typescript',
              chunkType: 'code',
              imports: [],
              exports: [],
              metadata: {},
            },
          ],
          language: 'typescript',
          metadata: {},
        },
      ];

      // Initialize the project first
      await storageCoordinator.initializeProject(projectId);

      // Store files with project ID
      const result = await storageCoordinator.store(files, projectId);

      // Verify that the operation was successful
      expect(result.success).toBe(true);
      expect(result.chunksStored).toBe(1);

      // Verify that the project-specific resources were used
      expect(mockVectorStorage.storeChunks).toHaveBeenCalled();
      expect(mockGraphStorage.storeChunks).toHaveBeenCalled();
    });
  });

  describe('searchVectors', () => {
    it('should use project-specific resources when projectId is provided in options', async () => {
      const projectId = 'test-project-id';
      const query = 'test query';
      const options = { projectId };

      // Initialize the project first
      await storageCoordinator.initializeProject(projectId);

      // Perform vector search with project ID
      const result = await storageCoordinator.searchVectors(query, options);

      // Verify that the project-specific vector storage was used
      expect(mockVectorStorage.search).toHaveBeenCalledWith(query, options);
    });
  });

  describe('searchGraph', () => {
    it('should use project-specific resources when projectId is provided in options', async () => {
      const projectId = 'test-project-id';
      const query = 'test query';
      const options = { projectId };

      // Initialize the project first
      await storageCoordinator.initializeProject(projectId);

      // Perform graph search with project ID
      const result = await storageCoordinator.searchGraph(query, options);

      // Verify that the project-specific graph storage was used
      expect(mockGraphStorage.search).toHaveBeenCalledWith(query, options);
    });
  });
});
