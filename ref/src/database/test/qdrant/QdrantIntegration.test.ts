import { QdrantClientWrapper } from '../../qdrant/QdrantClientWrapper';
import { ConfigService } from '../../../config/ConfigService';
import { LoggerService } from '../../../core/LoggerService';
import { ErrorHandlerService } from '../../../core/ErrorHandlerService';
import { spawn } from 'child_process';
import { join } from 'path';

// Mock services for integration test
class MockLoggerService {
  info(message: string, meta?: any) {
    // Silent during tests to reduce noise
  }

  error(message: string, error?: any) {
    // Only show errors during tests
    console.error(`[ERROR] ${message}`, error);
  }

  warn(message: string, meta?: any) {
    // Silent during tests to reduce noise
  }

  debug(message: string, meta?: any) {
    // Silent during tests to reduce noise
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

// Function to run PowerShell script
async function runPowerShellScript(scriptName: string): Promise<boolean> {
  return new Promise(resolve => {
    const scriptPath = join(__dirname, scriptName);
    const child = spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
      cwd: __dirname,
    });

    child.on('close', code => {
      resolve(code === 0);
    });

    child.on('error', () => {
      resolve(false);
    });
  });
}

// Create database before running tests
beforeAll(async () => {
  // Skip database setup for now to avoid timeout issues
  console.log('Skipping test database setup...');
  // const result = await runPowerShellScript('setup-test-database.ps1');
  // console.log('Test database setup result:', result);
  // if (!result) {
  //   throw new Error('Failed to create test database');
  // }
  console.log('Test database setup skipped');
}, 30000); // Increase timeout to 30 seconds

// Drop database after running tests
afterAll(async () => {
  // Skip database cleanup for now to avoid timeout issues
  console.log('Skipping test database cleanup...');
  // const result = await runPowerShellScript('drop-test-database.ps1');
  // console.log('Test database cleanup result:', result);
  console.log('Test database cleanup skipped');
}, 30000); // Increase timeout to 30 seconds

describe('Qdrant Integration', () => {
  let qdrantClient: QdrantClientWrapper;

  beforeEach(() => {
    // Reset modules to ensure clean test environment
    jest.resetModules();

    // Create real instances with mocked services
    const configService = ConfigService.getInstance();
    const loggerService = new MockLoggerService() as unknown as LoggerService;
    const errorHandlerService = new MockErrorHandlerService() as unknown as ErrorHandlerService;

    qdrantClient = new QdrantClientWrapper(configService, loggerService, errorHandlerService);
  });

  afterEach(async () => {
    try {
      // Clean up any connections
      if (qdrantClient && typeof qdrantClient.close === 'function') {
        await qdrantClient.close();
      }
    } catch (error) {
      console.error('Error during test cleanup:', error);
    }
  });

  it('should initialize Qdrant client successfully', async () => {
    console.log('Testing Qdrant client initialization');
    const result = await qdrantClient.connect();
    console.log('Client initialization result:', result);
    expect(result).toBe(true);
  });

  it('should handle connection status correctly', async () => {
    // Initially not connected
    expect(qdrantClient.isConnectedToDatabase()).toBe(false);

    // After connection, should be connected
    await qdrantClient.connect();
    expect(qdrantClient.isConnectedToDatabase()).toBe(true);
  });

  it('should create and manage collections', async () => {
    await qdrantClient.connect();

    // Create a collection with test prefix
    const collectionName = 'test-collection-integration-' + Date.now();
    let collectionCreated = false;

    try {
      const result = await qdrantClient.createCollection(collectionName, 128);
      expect(result).toBe(true);
      collectionCreated = true;

      // Check if collection exists
      const exists = await qdrantClient.collectionExists(collectionName);
      expect(exists).toBe(true);

      // Get collection info
      const info = await qdrantClient.getCollectionInfo(collectionName);
      expect(info).toBeDefined();
      expect(info?.name).toBe(collectionName);
      expect(info?.vectors.size).toBe(128);

      // Delete collection
      const deleteResult = await qdrantClient.deleteCollection(collectionName);
      expect(deleteResult).toBe(true);

      // Verify collection is deleted
      const existsAfterDelete = await qdrantClient.collectionExists(collectionName);
      expect(existsAfterDelete).toBe(false);
    } catch (error) {
      // Clean up collection if test fails
      if (collectionCreated) {
        try {
          await qdrantClient.deleteCollection(collectionName);
        } catch (cleanupError) {
          console.error('Failed to cleanup collection after test failure:', cleanupError);
        }
      }
      throw error;
    }
  });

  it('should upsert and search vectors', async () => {
    await qdrantClient.connect();

    const collectionName = 'test-search-collection-' + Date.now();
    let collectionCreated = false;

    try {
      await qdrantClient.createCollection(collectionName, 128);
      collectionCreated = true;

      // Upsert points
      const points = [
        {
          id: 1,
          vector: Array(128).fill(0.5),
          payload: {
            content: 'This is test content for vector search',
            filePath: '/test/file1.ts',
            language: 'typescript',
            chunkType: 'function',
            startLine: 1,
            endLine: 10,
            metadata: { category: 'test' },
            timestamp: new Date(),
          },
        },
        {
          id: 2,
          vector: Array(128).fill(0.8),
          payload: {
            content: 'Another test content for vector search',
            filePath: '/test/file2.ts',
            language: 'typescript',
            chunkType: 'class',
            startLine: 15,
            endLine: 25,
            metadata: { category: 'test' },
            timestamp: new Date(),
          },
        },
      ];

      const upsertResult = await qdrantClient.upsertPoints(collectionName, points);
      expect(upsertResult).toBe(true);

      // Search vectors
      const queryVector = Array(128).fill(0.6);
      const results = await qdrantClient.searchVectors(collectionName, queryVector, {
        limit: 5,
        scoreThreshold: 0.1,
        filter: {
          language: ['typescript'],
        },
      });

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);

      // Clean up
      await qdrantClient.deleteCollection(collectionName);
    } catch (error) {
      // Clean up collection if test fails
      if (collectionCreated) {
        try {
          await qdrantClient.deleteCollection(collectionName);
        } catch (cleanupError) {
          console.error('Failed to cleanup collection after test failure:', cleanupError);
        }
      }
      throw error;
    }
  });

  it('should delete points', async () => {
    await qdrantClient.connect();

    const collectionName = 'test-delete-collection-' + Date.now();
    let collectionCreated = false;

    try {
      await qdrantClient.createCollection(collectionName, 128);
      collectionCreated = true;

      // Upsert points
      const points = [
        {
          id: 3,
          vector: Array(128).fill(0.5),
          payload: {
            content: 'Content to be deleted',
            filePath: '/test/file3.ts',
            language: 'typescript',
            chunkType: 'function',
            startLine: 1,
            endLine: 10,
            metadata: {},
            timestamp: new Date(),
          },
        },
      ];

      await qdrantClient.upsertPoints(collectionName, points);

      // Delete points
      const deleteResult = await qdrantClient.deletePoints(collectionName, ['3']);
      expect(deleteResult).toBe(true);

      // Clean up
      await qdrantClient.deleteCollection(collectionName);
    } catch (error) {
      // Clean up collection if test fails
      if (collectionCreated) {
        try {
          await qdrantClient.deleteCollection(collectionName);
        } catch (cleanupError) {
          console.error('Failed to cleanup collection after test failure:', cleanupError);
        }
      }
      throw error;
    }
  });

  it('should get point count', async () => {
    await qdrantClient.connect();

    const collectionName = 'test-count-collection-' + Date.now();
    let collectionCreated = false;

    try {
      await qdrantClient.createCollection(collectionName, 128);
      collectionCreated = true;

      // Initially should have 0 points
      const initialCount = await qdrantClient.getPointCount(collectionName);
      expect(initialCount).toBe(0);

      // Upsert points
      const points = [
        {
          id: 4,
          vector: Array(128).fill(0.5),
          payload: {
            content: 'Test content',
            filePath: '/test/file4.ts',
            language: 'typescript',
            chunkType: 'function',
            startLine: 1,
            endLine: 10,
            metadata: {},
            timestamp: new Date(),
          },
        },
      ];

      await qdrantClient.upsertPoints(collectionName, points);

      // Should have 1 point now
      const count = await qdrantClient.getPointCount(collectionName);
      expect(count).toBe(1);

      // Clean up
      await qdrantClient.deleteCollection(collectionName);
    } catch (error) {
      // Clean up collection if test fails
      if (collectionCreated) {
        try {
          await qdrantClient.deleteCollection(collectionName);
        } catch (cleanupError) {
          console.error('Failed to cleanup collection after test failure:', cleanupError);
        }
      }
      throw error;
    }
  });
});
