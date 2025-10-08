import express from 'express';
import request from 'supertest';
import { FileSearchRoutes } from '../FileSearchRoutes';
import { FileSearchService } from '../../../service/filesearch/FileSearchService';
import { LoggerService } from '../../../utils/LoggerService';
import { FileSearchRequest, FileSearchResponse } from '../../../service/filesearch/types';

// Mock implementations
const createMockFileSearchService = () => ({
  search: jest.fn(),
  getCacheStats: jest.fn(),
  clearCache: jest.fn(),
  indexFile: jest.fn(),
  indexFiles: jest.fn(),
  deleteFileIndex: jest.fn()
});

const createMockLoggerService = () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
});

describe('FileSearchRoutes', () => {
  let app: express.Application;
  let fileSearchRoutes: FileSearchRoutes;
  let mockFileSearchService: any;
  let mockLoggerService: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockFileSearchService = createMockFileSearchService();
    mockLoggerService = createMockLoggerService();

    // Create FileSearchRoutes instance (using constructor injection)
    fileSearchRoutes = new FileSearchRoutes(
      mockFileSearchService as FileSearchService,
      mockLoggerService as LoggerService
    );

    // Create express app and use the router
    app = express();
    app.use(express.json());
    app.use('/api/v1/filesearch', fileSearchRoutes.getRouter());
  });

  describe('POST /api/v1/filesearch/search', () => {
    it('should search files successfully', async () => {
      const mockRequest: FileSearchRequest = {
        query: 'test query',
        projectId: 'test-project',
        options: { maxResults: 10 }
      };

      const mockResponse: FileSearchResponse = {
        results: [
          {
            filePath: '/path/to/file1.ts',
            fileName: 'file1.ts',
            directory: '/path/to',
            relevanceScore: 0.95,
            semanticDescription: 'test description'
          }
        ],
        total: 1,
        queryType: 'SEMANTIC_DESCRIPTION',
        processingTime: 100,
        hasMore: false
      };

      mockFileSearchService.search.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/v1/filesearch/search')
        .send(mockRequest);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResponse);
      expect(mockFileSearchService.search).toHaveBeenCalledWith(mockRequest);
    });

    it('should return 400 when query is missing', async () => {
      const response = await request(app)
        .post('/api/v1/filesearch/search')
        .send({
          projectId: 'test-project',
          options: {}
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('查询参数不能为空');
    });

    it('should handle search errors', async () => {
      mockFileSearchService.search.mockRejectedValue(new Error('Search failed'));

      const response = await request(app)
        .post('/api/v1/filesearch/search')
        .send({
          query: 'test query',
          projectId: 'test-project'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('文件搜索失败');
    });
  });

  describe('POST /api/v1/filesearch/smart-search', () => {
    it('should perform smart search successfully', async () => {
      const mockRequest = {
        query: 'smart query',
        projectId: 'test-project',
        options: { maxResults: 20 }
      };

      const mockSearchResponse: FileSearchResponse = {
        results: [
          {
            filePath: '/path/to/smart-file.ts',
            fileName: 'smart-file.ts',
            directory: '/path/to',
            relevanceScore: 0.92,
            semanticDescription: 'smart description'
          }
        ],
        total: 1,
        queryType: 'SEMANTIC_DESCRIPTION',
        processingTime: 150,
        hasMore: false
      };

      mockFileSearchService.search.mockResolvedValue(mockSearchResponse);

      const response = await request(app)
        .post('/api/v1/filesearch/smart-search')
        .send(mockRequest);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.smartSearch).toBe(true);
      expect(response.body.data.recommendations).toBeDefined();
    });

    it('should return 400 when query is missing in smart search', async () => {
      const response = await request(app)
        .post('/api/v1/filesearch/smart-search')
        .send({
          projectId: 'test-project'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/filesearch/suggestions', () => {
    it('should return search suggestions', async () => {
      const query = 'test';
      const limit = 5;

      const response = await request(app)
        .get('/api/v1/filesearch/suggestions')
        .query({ q: query, limit: limit });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions).toBeDefined();
      expect(response.body.data.query).toBe(query);
    });

    it('should return 400 when query parameter is missing', async () => {
      const response = await request(app)
        .get('/api/v1/filesearch/suggestions')
        .query({ limit: 5 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/filesearch/cache-stats', () => {
    it('should return cache statistics', async () => {
      const mockStats = {
        hits: 100,
        misses: 20,
        size: 1024,
        hitRate: 0.83
      };

      mockFileSearchService.getCacheStats.mockReturnValue(mockStats);

      const response = await request(app)
        .get('/api/v1/filesearch/cache-stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
    });
  });

  describe('DELETE /api/v1/filesearch/cache', () => {
    it('should clear cache successfully', async () => {
      mockFileSearchService.clearCache.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/v1/filesearch/cache');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('缓存已清空');
    });

    it('should handle cache clearing errors', async () => {
      mockFileSearchService.clearCache.mockRejectedValue(new Error('Cache clear failed'));

      const response = await request(app)
        .delete('/api/v1/filesearch/cache');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/filesearch/index', () => {
    it('should index file successfully', async () => {
      const fileData = {
        filePath: '/path/to/file.ts',
        content: 'file content',
        projectId: 'test-project'
      };

      mockFileSearchService.indexFile.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/v1/filesearch/index')
        .send(fileData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('文件索引创建成功');
    });

    it('should return 400 when filePath is missing', async () => {
      const response = await request(app)
        .post('/api/v1/filesearch/index')
        .send({
          content: 'file content',
          projectId: 'test-project'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/filesearch/index-batch', () => {
    it('should batch index files successfully', async () => {
      const filesData = {
        files: [
          { path: '/path/to/file1.ts', content: 'content1' },
          { path: '/path/to/file2.ts', content: 'content2' }
        ],
        projectId: 'test-project'
      };

      mockFileSearchService.indexFiles.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/v1/filesearch/index-batch')
        .send(filesData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('批量索引成功，共 2 个文件');
    });

    it('should return 400 when files array is invalid', async () => {
      const response = await request(app)
        .post('/api/v1/filesearch/index-batch')
        .send({
          files: [],
          projectId: 'test-project'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/filesearch/index/:filePath', () => {
    it('should delete file index successfully', async () => {
      const filePath = '/path/to/file.ts';
      
      mockFileSearchService.deleteFileIndex.mockResolvedValue(undefined);

      const response = await request(app)
        .delete(`/api/v1/filesearch/index/${encodeURIComponent(filePath)}`)
        .send({ projectId: 'test-project' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('文件索引删除成功');
    });

    it('should return 404 when filePath is missing', async () => {
      const response = await request(app)
        .delete('/api/v1/filesearch/index/')
        .send({ projectId: 'test-project' });

      expect(response.status).toBe(404); // Express cannot match route without filePath parameter
    });
  });
});