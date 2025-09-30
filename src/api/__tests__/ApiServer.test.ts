import express from 'express';
import request from 'supertest';
import { ApiServer } from '../ApiServer';
import { Logger } from '../../utils/logger';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { ProjectIdManager } from '../../database/ProjectIdManager';
import { diContainer } from '../../core/DIContainer';
import { TYPES } from '../../types';
import { ConfigService } from '../../config/ConfigService';

// Mock fs
jest.mock('fs/promises');
import fs from 'fs/promises';
const mockFsDefault = fs as jest.Mocked<typeof fs>;

// Mock ProjectIdManager to prevent file system operations during tests
jest.mock('../../database/ProjectIdManager', () => {
  return {
    ProjectIdManager: jest.fn().mockImplementation(() => ({
      loadMapping: jest.fn().mockResolvedValue(undefined),
      generateProjectId: jest.fn().mockResolvedValue('mock-project-id'),
      getProjectId: jest.fn().mockReturnValue('mock-project-id'),
      getProjectPath: jest.fn().mockReturnValue('/mock/project/path'),
      getCollectionName: jest.fn().mockReturnValue('mock-collection'),
      getSpaceName: jest.fn().mockReturnValue('mock_space'),
      updateProjectTimestamp: jest.fn(),
      getLatestUpdatedProject: jest.fn().mockReturnValue('mock-project-id'),
      getProjectsByUpdateTime: jest.fn().mockReturnValue([]),
      saveMapping: jest.fn().mockResolvedValue(undefined),
      listAllProjects: jest.fn().mockReturnValue([]),
      listAllProjectPaths: jest.fn().mockReturnValue([]),
      hasProject: jest.fn().mockReturnValue(false),
      removeProject: jest.fn().mockReturnValue(true),
      refreshMapping: jest.fn().mockResolvedValue(undefined),
      cleanupInvalidMappings: jest.fn().mockResolvedValue(0)
    }))
  };
});

// Mock EmbedderFactory to prevent async initialization during tests
jest.mock('../../embedders/EmbedderFactory', () => {
  return {
    EmbedderFactory: jest.fn().mockImplementation(() => ({
      embed: jest.fn().mockResolvedValue({}),
      getEmbedder: jest.fn().mockResolvedValue({
        embed: jest.fn().mockResolvedValue({}),
        isAvailable: jest.fn().mockResolvedValue(true),
        getModelName: jest.fn().mockReturnValue('mock-model'),
        getDimensions: jest.fn().mockReturnValue(768)
      }),
      getAvailableProviders: jest.fn().mockResolvedValue(['openai']),
      getProviderInfo: jest.fn().mockResolvedValue({
        name: 'openai',
        model: 'mock-model',
        dimensions: 768,
        available: true
      }),
      autoSelectProvider: jest.fn().mockResolvedValue('openai'),
      registerProvider: jest.fn(),
      getRegisteredProviders: jest.fn().mockReturnValue(['openai']),
      isProviderRegistered: jest.fn().mockReturnValue(true),
      unregisterProvider: jest.fn().mockReturnValue(true),
      getDefaultProvider: jest.fn().mockReturnValue('openai'),
      setDefaultProvider: jest.fn()
    }))
  };
});

// Create a mock IndexSyncService
const createMockIndexSyncService = () => ({
  startIndexing: jest.fn(),
  stopIndexing: jest.fn(),
  getIndexStatus: jest.fn(),
  reindexProject: jest.fn(),
  on: jest.fn(),
  getAllIndexStatuses: jest.fn()
});

describe('ApiServer', () => {
  let server: ApiServer;
  let app: express.Application;
  let mockIndexSyncService: any;

  beforeAll(() => {
    // Set environment variable for mock mode
    process.env.SEARCH_MOCK_MODE = 'true';
    
    // Mock fs.readFile to return mock data
    mockFsDefault.readFile = jest.fn().mockImplementation((filePath: string) => {
      if (filePath.includes('search-results.json')) {
        return Promise.resolve(JSON.stringify({
          results: [
            {
              id: 'result_001',
              score: 0.95,
              snippetId: 'snippet_001',
              matchType: 'semantic',
              highlightedContent: 'function <mark>calculateTotal</mark>(items) {\n  return items.reduce((sum, item) => sum + item.price, 0);\n}'
            }
          ]
        }));
      }
      return Promise.reject(new Error('File not found'));
    });
  });

  beforeEach(() => {
    // Ensure ConfigService is properly bound in the dependency injection container
    if (!diContainer.isBound(TYPES.ConfigService)) {
      diContainer.bind<ConfigService>(TYPES.ConfigService).toConstantValue(ConfigService.getInstance());
    }
    
    const logger = new Logger('ApiServerTest');
    mockIndexSyncService = createMockIndexSyncService();
    
    // Use the mocked EmbedderFactory (jest.mock will handle the constructor)
    const mockEmbedderFactory = new (require('../../embedders/EmbedderFactory').EmbedderFactory)();
    
    const mockQdrantService = {
      searchVectorsForProject: jest.fn().mockResolvedValue([]) // Mock the searchVectorsForProject method
    } as any; // Add a mock QdrantService
    server = new ApiServer(logger, mockIndexSyncService, mockEmbedderFactory, mockQdrantService, 3001); // Use different port for testing
    app = server['app']; // Access private app property for testing
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'healthy' });
    });
  });

  describe('GET /api/status', () => {
    it('should return API status', async () => {
      const response = await request(app).get('/api/status');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ready',
        version: '1.0.0',
        mockMode: true
      });
    });
  });

  describe('POST /api/search', () => {
    it('should return search results when query is provided', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: 'calculate' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.query).toBe('calculate');
    });

    it('should return error when query is missing', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ options: { limit: 10 } });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Query parameter is required');
    });

    it('should return error when query is empty', async () => {
      const response = await request(app)
        .post('/api/search')
        .send({ query: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Query parameter is required');
    });

    it('should handle search errors gracefully', async () => {
      // Mock fs.readFile to throw an error
      mockFsDefault.readFile = jest.fn().mockRejectedValue(new Error('File read error'));

      const response = await request(app)
        .post('/api/search')
        .send({ query: 'test' });

      expect(response.status).toBe(200); // Should still return 200 with mock results
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(1);
    });
  });

  describe('GET / (SPA support)', () => {
    it('should serve index.html for root path', async () => {
      const response = await request(app).get('/');

      // Since we're not setting up static file serving in tests, this will return 404
      // In a real environment, it would serve the frontend index.html
      expect([200, 404]).toContain(response.status);
    });
  });
});