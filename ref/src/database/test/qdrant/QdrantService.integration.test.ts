import { QdrantService } from '../../QdrantService';
import { QdrantClientWrapper } from '../../qdrant/QdrantClientWrapper';
import { ConfigService } from '../../../config/ConfigService';
import { LoggerService } from '../../../core/LoggerService';
import { ErrorHandlerService } from '../../../core/ErrorHandlerService';
import { Container } from 'inversify';
import { TYPES } from '../../../types';

// Note: We are using real instances for integration testing to test actual Qdrant functionality

describe('QdrantService Integration Tests', () => {
  let qdrantService: QdrantService;
  let container: Container;
  let loggerService: LoggerService;
  let errorHandlerService: ErrorHandlerService;
  let configService: ConfigService;
  let qdrantClient: QdrantClientWrapper;

  // Skip these tests if Qdrant is not available
  const describeIfQdrantAvailable = process.env.QDRANT_HOST ? describe : describe.skip;

  beforeAll(() => {
    // Create DI container
    container = new Container();
    
    // Create real instances
    loggerService = new LoggerService();
    errorHandlerService = new ErrorHandlerService(loggerService);
    configService = ConfigService.getInstance();
    
    // Bind services to container
    container.bind(TYPES.LoggerService).toConstantValue(loggerService);
    container.bind(TYPES.ErrorHandlerService).toConstantValue(errorHandlerService);
    container.bind(TYPES.ConfigService).toConstantValue(configService);
    
    // Create QdrantClientWrapper instance
    qdrantClient = new QdrantClientWrapper(configService, loggerService, errorHandlerService);
    container.bind(TYPES.QdrantClientWrapper).toConstantValue(qdrantClient);
    
    // Create QdrantService instance
    qdrantService = new QdrantService(
      configService,
      loggerService,
      errorHandlerService,
      qdrantClient
    );
  });

  describeIfQdrantAvailable('QdrantService Basic Operations', () => {
    it('should initialize Qdrant service successfully', async () => {
      const result = await qdrantService.initialize();
      expect(result).toBe(true);
      expect(qdrantService.isConnected()).toBe(true);
    });

    it('should create and manage collections through service', async () => {
      // This test requires initialization
      if (!qdrantService.isConnected()) {
        const initialized = await qdrantService.initialize();
        expect(initialized).toBe(true);
      }

      const collectionName = 'test-service-collection-' + Date.now();
      let collectionCreated = false;

      try {
        const result = await qdrantService.createCollection(collectionName, 128);
        expect(result).toBe(true);
        collectionCreated = true;

        // Get collection info
        const info = await qdrantService.getCollectionInfo(collectionName);
        expect(info).toBeDefined();
        expect(info?.name).toBe(collectionName);
        expect(info?.vectors.size).toBe(128);
      } catch (error) {
        // Fail the test if Qdrant operations fail
        fail(`Collection test failed: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        // Clean up
        if (collectionCreated) {
          try {
            await qdrantService.deleteCollection(collectionName);
          } catch (cleanupError) {
            console.error('Failed to cleanup collection after test:', cleanupError);
          }
        }
      }
    });
  });

  describeIfQdrantAvailable('QdrantService Vector Operations', () => {
    const testCollectionName = 'test-service-vectors-' + Date.now();
    let collectionCreated = false;

    beforeAll(async () => {
      // Initialize service if not already done
      if (!qdrantService.isConnected()) {
        const initialized = await qdrantService.initialize();
        expect(initialized).toBe(true);
      }

      // Create test collection
      try {
        const result = await qdrantService.createCollection(testCollectionName, 128);
        collectionCreated = result;
        expect(collectionCreated).toBe(true);
      } catch (error) {
        throw new Error(`Failed to create test collection: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    it('should upsert and search vectors through service', async () => {
      expect(collectionCreated).toBe(true);

      try {
        // Upsert points - use numeric IDs as required by Qdrant
        const vectors = [
          {
            id: 1,
            vector: Array(128).fill(0.5),
            payload: {
              content: 'This is test content for vector search through service',
              filePath: '/test/service-file1.ts',
              language: 'typescript',
              chunkType: 'function',
              startLine: 1,
              endLine: 10,
              metadata: { category: 'test-service' },
              timestamp: new Date(),
            },
          },
          {
            id: 2,
            vector: Array(128).fill(0.8),
            payload: {
              content: 'Another test content for vector search through service',
              filePath: '/test/service-file2.ts',
              language: 'typescript',
              chunkType: 'class',
              startLine: 15,
              endLine: 25,
              metadata: { category: 'test-service' },
              timestamp: new Date(),
            },
          },
        ];

        const upsertResult = await qdrantService.upsertVectors(testCollectionName, vectors);
        expect(upsertResult).toBe(true);

        // Search vectors
        const queryVector = Array(128).fill(0.6);
        const results = await qdrantService.searchVectors(testCollectionName, queryVector, {
          limit: 5,
          scoreThreshold: 0.1,
        });

        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
        // Should have at least one result
        expect(results.length).toBeGreaterThan(0);
      } catch (error) {
        throw new Error(`Vector operations test failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    afterAll(async () => {
      // Clean up test collection
      if (collectionCreated) {
        try {
          await qdrantService.deleteCollection(testCollectionName);
        } catch (error) {
          console.error('Failed to cleanup test collection:', error);
        }
      }
      
      // Close connection
      try {
        await qdrantService.close();
      } catch (error) {
        // Ignore disconnect errors in cleanup
      }
    });
  });

  afterAll(async () => {
    try {
      if (qdrantService.isConnected()) {
        await qdrantService.close();
      }
    } catch (error) {
      // Ignore disconnect errors in cleanup
    }
  });
});