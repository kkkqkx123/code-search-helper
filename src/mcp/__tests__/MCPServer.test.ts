import { MCPServer } from '../MCPServer';
import fs from 'fs/promises';
import { Logger } from '../../utils/logger';

// Mock MCP SDK
jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('@modelcontextprotocol/sdk/server/stdio.js');

// Mock fs
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('MCPServer', () => {
  let server: MCPServer;
  let logger: Logger;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = new Logger('MCPServerTest');
    server = new MCPServer(logger);
  });

  describe('constructor', () => {
    it('should create MCP server instance', () => {
      expect(server).toBeInstanceOf(MCPServer);
    });
  });

  describe('handleSearch', () => {
    it('should return search results when mock data is loaded', async () => {
      // Mock fs.readFile to return mock data
      mockFs.readFile = jest.fn().mockResolvedValue(JSON.stringify({
        snippets: [
          {
            id: "snippet_001",
            content: "function calculateTotal(items) {\n  return items.reduce((sum, item) => sum + item.price, 0);\n}",
            filePath: "src/utils/math.js",
            language: "javascript",
            type: "function",
            name: "calculateTotal"
          }
        ]
      }));

      const args = { query: 'calculate', options: { limit: 10 } };
      const result = await (server as any).handleSearch(args);

      expect(result).toBeDefined();
      expect(result.results).toHaveLength(1);
      expect(result.query).toBe('calculate');
      expect(mockFs.readFile).toHaveBeenCalledWith(expect.stringContaining('code-snippets.json'), 'utf-8');
    });

    it('should return default mock data when file reading fails', async () => {
      mockFs.readFile = jest.fn().mockRejectedValue(new Error('File not found'));

      const args = { query: 'calculate', options: { limit: 5 } };
      const result = await (server as any).handleSearch(args);

      expect(result).toBeDefined();
      expect(result.results).toHaveLength(1);
      expect(result.query).toBe('calculate');
    });

    it('should filter results based on query', async () => {
      mockFs.readFile = jest.fn().mockResolvedValue(JSON.stringify({
        snippets: [
          {
            id: "snippet_001",
            content: "function calculateTotal(items) {\n  return items.reduce((sum, item) => sum + item.price, 0);\n}",
            filePath: "src/utils/math.js",
            language: "javascript",
            type: "function",
            name: "calculateTotal"
          },
          {
            id: "snippet_002",
            content: "class UserService {}",
            filePath: "src/services/user.js",
            language: "javascript",
            type: "class",
            name: "UserService"
          }
        ]
      }));

      const args = { query: 'calculate', options: { limit: 10 } };
      const result = await (server as any).handleSearch(args);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].snippet.name).toBe('calculateTotal');
    });
  });

  describe('getStatus', () => {
    it('should return server status', async () => {
      const status = await (server as any).getStatus();

      expect(status).toEqual({
        status: 'ready',
        version: '1.0.0',
        features: ['search'],
        mockMode: true
      });
    });
  });

  describe('loadMockData', () => {
    it('should load mock data from file', async () => {
      const mockData = { snippets: [] };
      mockFs.readFile = jest.fn().mockResolvedValue(JSON.stringify(mockData));

      const data = await (server as any).loadMockData();

      expect(data).toEqual(mockData);
      expect(mockFs.readFile).toHaveBeenCalledWith(expect.stringContaining('code-snippets.json'), 'utf-8');
    });

    it('should return default mock data when file reading fails', async () => {
      mockFs.readFile = jest.fn().mockRejectedValue(new Error('File not found'));

      const data = await (server as any).loadMockData();

      expect(data).toBeDefined();
      expect(data.snippets).toHaveLength(1);
    });
  });
});