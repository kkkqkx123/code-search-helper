// Mock the @qdrant/js-client-rest module before importing QdrantClientWrapper
jest.mock('@qdrant/js-client-rest', () => {
  // Mock QdrantClient
  class MockQdrantClient {
    private collections: string[] = [];
    private points: Map<string, any[]> = new Map();

    async getCollections() {
      return { collections: this.collections.map(name => ({ name })) };
    }

    async createCollection(collectionName: string, _config: any) {
      this.collections.push(collectionName);
      this.points.set(collectionName, []);
      return { result: true };
    }

    async deleteCollection(collectionName: string) {
      // Check if we should simulate an error
      if (collectionName === 'error-collection') {
        throw new Error('Deletion failed');
      }

      this.collections = this.collections.filter(name => name !== collectionName);
      this.points.delete(collectionName);
      return { result: true };
    }

    async getCollection(collectionName: string) {
      if (!this.collections.includes(collectionName)) {
        throw new Error('Collection not found');
      }
      const points = this.points.get(collectionName) || [];
      return {
        points_count: points.length,
        status: 'green',
        config: {
          params: {
            vectors: {
              size: 128,
              distance: 'Cosine',
            },
          },
        },
      };
    }

    async upsert(collectionName: string, data: any) {
      if (!this.collections.includes(collectionName)) {
        throw new Error('Collection not found');
      }

      const collectionPoints = this.points.get(collectionName) || [];
      data.points.forEach((point: any) => {
        const existingIndex = collectionPoints.findIndex((p: any) => p.id === point.id);
        if (existingIndex >= 0) {
          collectionPoints[existingIndex] = point;
        } else {
          collectionPoints.push(point);
        }
      });
      this.points.set(collectionName, collectionPoints);
      return { result: { operation_id: 1, status: 'completed' } };
    }

    async search(_collectionName: string, params: any) {
      // Return mock search results
      return [
        {
          id: 'test-point-1',
          score: 0.95,
          payload: {
            content: 'test content',
            filePath: '/test/file.ts',
            language: 'typescript',
            chunkType: 'function',
            startLine: 1,
            endLine: 10,
            timestamp: new Date().toISOString(),
          },
          // Only include vector if with_vector is true
          ...(params.with_vector === true && { vector: Array(128).fill(0.5) }),
        },
      ];
    }

    async delete(_collectionName: string, _params: any) {
      return { result: { operation_id: 2, status: 'completed' } };
    }

    async createPayloadIndex(_collectionName: string, _params: any) {
      return { result: { operation_id: 3, status: 'completed' } };
    }
  }

  return {
    QdrantClient: jest.fn().mockImplementation(() => new MockQdrantClient()),
  };
});

import { QdrantClientWrapper, VectorPoint, SearchOptions } from '../../qdrant/QdrantClientWrapper';
import { ConfigService } from '../../../config/ConfigService';
import { LoggerService } from '../../../core/LoggerService';
import { ErrorHandlerService } from '../../../core/ErrorHandlerService';

// Mock services
class MockConfigService {
  get(key: string) {
    if (key === 'qdrant') {
      return {
        host: 'localhost',
        port: 6333,
      };
    }
    return {};
  }
}

class MockLoggerService {
  error(_message: string, _meta?: any) {}
  info(_message: string, _meta?: any) {}
  warn(_message: string, _meta?: any) {}
}

class MockErrorHandlerService {
  handleError(_error: Error, _context?: any) {
    return { id: 'test-error-id' };
  }
}

describe('QdrantClientWrapper', () => {
  let qdrantClient: QdrantClientWrapper;
  let mockQdrantClient: any;

  beforeEach(() => {
    // Reset modules to ensure fresh mocks
    jest.resetModules();

    // Re-import the module to get fresh mock
    const configService = new MockConfigService() as unknown as ConfigService;
    const loggerService = new MockLoggerService() as unknown as LoggerService;
    const errorHandlerService = new MockErrorHandlerService() as unknown as ErrorHandlerService;

    qdrantClient = new QdrantClientWrapper(configService, loggerService, errorHandlerService);

    // Get the mock client instance
    mockQdrantClient = (qdrantClient as any).client;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('connect', () => {
    it('should connect successfully', async () => {
      console.log('Testing QdrantClientWrapper connection');
      const result = await qdrantClient.connect();
      console.log('Connection result:', result);
      expect(result).toBe(true);
      expect(qdrantClient.isConnectedToDatabase()).toBe(true);
    });

    it('should handle connection failure', async () => {
      console.log('Testing QdrantClientWrapper connection failure handling');
      // Mock the client to throw an error
      jest
        .spyOn(mockQdrantClient, 'getCollections')
        .mockRejectedValue(new Error('Connection failed'));

      const result = await qdrantClient.connect();
      console.log('Connection failure result:', result);
      expect(result).toBe(false);
      expect(qdrantClient.isConnectedToDatabase()).toBe(false);
    });
  });

  describe('createCollection', () => {
    it('should create a new collection', async () => {
      const result = await qdrantClient.createCollection('test-collection', 128);
      expect(result).toBe(true);
    });

    it('should handle collection creation failure', async () => {
      // Mock the client to throw an error
      jest
        .spyOn(mockQdrantClient, 'createCollection')
        .mockRejectedValue(new Error('Creation failed'));

      const result = await qdrantClient.createCollection('test-collection', 128);
      expect(result).toBe(false);
    });
  });

  describe('collectionExists', () => {
    it('should return true for existing collection', async () => {
      await qdrantClient.createCollection('test-collection', 128);
      const exists = await qdrantClient.collectionExists('test-collection');
      expect(exists).toBe(true);
    });

    it('should return false for non-existing collection', async () => {
      const exists = await qdrantClient.collectionExists('non-existent-collection');
      expect(exists).toBe(false);
    });
  });

  describe('deleteCollection', () => {
    it('should delete an existing collection', async () => {
      await qdrantClient.createCollection('test-collection', 128);
      const result = await qdrantClient.deleteCollection('test-collection');
      expect(result).toBe(true);
    });

    it('should handle collection deletion failure', async () => {
      // Mock the client to throw an error
      jest.spyOn(mockQdrantClient, 'deleteCollection').mockImplementation(() => {
        throw new Error('Deletion failed');
      });

      const result = await qdrantClient.deleteCollection('error-collection');
      expect(result).toBe(false);
    });
  });

  describe('getCollectionInfo', () => {
    it('should return collection info', async () => {
      await qdrantClient.createCollection('test-collection', 128);
      const info = await qdrantClient.getCollectionInfo('test-collection');
      expect(info).toBeDefined();
      expect(info?.name).toBe('test-collection');
      expect(info?.vectors.size).toBe(128);
      expect(info?.vectors.distance).toBe('Cosine');
    });

    it('should return null for non-existing collection', async () => {
      const info = await qdrantClient.getCollectionInfo('non-existent-collection');
      expect(info).toBeNull();
    });
  });

  describe('upsertPoints', () => {
    it('should upsert points successfully', async () => {
      await qdrantClient.createCollection('test-collection', 128);

      const points: VectorPoint[] = [
        {
          id: 'point-1',
          vector: Array(128).fill(0.5),
          payload: {
            content: 'test content',
            filePath: '/test/file.ts',
            language: 'typescript',
            chunkType: 'function',
            startLine: 1,
            endLine: 10,
            metadata: {},
            timestamp: new Date(),
          },
        },
      ];

      const result = await qdrantClient.upsertPoints('test-collection', points);
      expect(result).toBe(true);
    });

    it('should handle upsert failure', async () => {
      // We need to simulate an error in the upsert method
      // This can be done by creating a special collection that causes errors
      jest.spyOn(mockQdrantClient, 'upsert').mockRejectedValueOnce(new Error('Upsert failed'));

      const points: VectorPoint[] = [
        {
          id: 'point-1',
          vector: Array(128).fill(0.5),
          payload: {
            content: 'test content',
            filePath: '/test/file.ts',
            language: 'typescript',
            chunkType: 'function',
            startLine: 1,
            endLine: 10,
            metadata: {},
            timestamp: new Date(),
          },
        },
      ];

      const result = await qdrantClient.upsertPoints('test-collection', points);
      expect(result).toBe(false);
    });
  });

  describe('searchVectors', () => {
    it('should search vectors successfully', async () => {
      await qdrantClient.createCollection('test-collection', 128);

      // First, insert a test point
      const points: VectorPoint[] = [
        {
          id: 'test-point-1',
          vector: Array(128).fill(0.5),
          payload: {
            content: 'test content',
            filePath: '/test/file.ts',
            language: 'typescript',
            chunkType: 'function',
            startLine: 1,
            endLine: 10,
            metadata: {},
            timestamp: new Date(),
          },
        },
      ];

      // Insert the test point
      await qdrantClient.upsertPoints('test-collection', points);

      const queryVector = Array(128).fill(0.5);
      const options: SearchOptions = {
        limit: 5,
        scoreThreshold: 0.8,
      };

      const results = await qdrantClient.searchVectors('test-collection', queryVector, options);
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('test-point-1');
      expect(results[0].score).toBe(0.95);
    });

    it('should handle search failure', async () => {
      // Mock the client to throw an error
      jest.spyOn(mockQdrantClient, 'search').mockRejectedValue(new Error('Search failed'));

      const queryVector = Array(128).fill(0.5);
      const results = await qdrantClient.searchVectors('test-collection', queryVector);
      expect(results).toEqual([]);
    });
  });

  describe('deletePoints', () => {
    it('should delete points successfully', async () => {
      await qdrantClient.createCollection('test-collection', 128);

      const result = await qdrantClient.deletePoints('test-collection', ['point-1']);
      expect(result).toBe(true);
    });

    it('should handle delete points failure', async () => {
      // Mock the client to throw an error
      jest.spyOn(mockQdrantClient, 'delete').mockRejectedValue(new Error('Delete failed'));

      const result = await qdrantClient.deletePoints('test-collection', ['point-1']);
      expect(result).toBe(false); // Should return false when delete operation fails
    });
  });

  describe('close', () => {
    it('should close the connection', async () => {
      await qdrantClient.connect();
      expect(qdrantClient.isConnectedToDatabase()).toBe(true);

      await qdrantClient.close();
      expect(qdrantClient.isConnectedToDatabase()).toBe(false);
    });
  });
});
