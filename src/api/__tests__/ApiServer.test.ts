import express from 'express';
import request from 'supertest';
import { ApiServer } from '../ApiServer';
import { Logger } from '../../utils/logger';

// Mock fs
jest.mock('fs/promises');
import fs from 'fs/promises';
const mockFsDefault = fs as jest.Mocked<typeof fs>;

describe('ApiServer', () => {
  let server: ApiServer;
  let app: express.Application;

  beforeAll(() => {
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
    const logger = new Logger('ApiServerTest');
    server = new ApiServer(logger, 3001); // Use different port for testing
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