import { Container } from 'inversify';
import { MCPServer } from './MCPServer';
import { IndexService } from '../services/indexing/IndexService';
import { GraphService } from '../services/graph/GraphService';
import { LoggerService } from '../core/LoggerService';
import { ConfigService } from '../config/ConfigService';
import { TYPES } from '../core/DIContainer';

describe('MCPServer', () => {
  let container: Container;
  let mcpServer: MCPServer;
  let mockIndexService: jest.Mocked<IndexService>;
  let mockGraphService: jest.Mocked<GraphService>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    container = new Container();

    // Create mocks
    mockIndexService = {
      createIndex: jest.fn(),
      search: jest.fn(),
      getStatus: jest.fn(),
      updateIndex: jest.fn(),
      deleteIndex: jest.fn(),
      getActiveIndexing: jest.fn(),
    } as any;

    mockGraphService = {
      analyzeCodebase: jest.fn(),
      findDependencies: jest.fn(),
      findImpact: jest.fn(),
      getGraphStats: jest.fn(),
      exportGraph: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
    } as any;

    // Bind mocks to container
    container.bind(TYPES.IndexService).toConstantValue(mockIndexService);
    container.bind(TYPES.GraphService).toConstantValue(mockGraphService);
    container.bind(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind(TYPES.ConfigService).toConstantValue(mockConfigService);

    // Create MCPServer instance directly since it's not bound to the container in the actual implementation
    const MCPServerConstructor = jest.requireActual('./MCPServer').MCPServer;
    mcpServer = new MCPServerConstructor();

    // Manually inject mocks into the server instance
    (mcpServer as any).indexService = mockIndexService;
    (mcpServer as any).graphService = mockGraphService;
    (mcpServer as any).logger = mockLoggerService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Server Initialization', () => {
    it('should create MCP server instance', () => {
      expect(mcpServer).toBeDefined();
    });
  });

  describe('Search Tools', () => {
    it('should handle codebase.index.search tool requests', async () => {
      const searchResults = [
        {
          id: '1',
          score: 0.95,
          finalScore: 0.95,
          filePath: '/src/auth.ts',
          content:
            'function authenticate(user, password) { return bcrypt.compare(password, user.hash); }',
          startLine: 10,
          endLine: 15,
          language: 'typescript',
          chunkType: 'function',
          metadata: { projectId: 'test-project' },
        },
      ];

      mockIndexService.search.mockResolvedValue(searchResults);

      const args = {
        query: 'authentication function',
        options: {
          limit: 10,
          threshold: 0.7,
          includeGraph: true,
        },
      };

      const response = await (mcpServer as any).handleSearch(args);

      expect(response.results).toEqual(searchResults);
      expect(response.total).toBe(1);
      expect(mockIndexService.search).toHaveBeenCalledWith('authentication function', 'default', {
        limit: 10,
        threshold: 0.7,
        includeGraph: true,
      });
    });
  });

  describe('Indexing Tools', () => {
    it('should handle codebase.index.create tool requests', async () => {
      const indexResult = {
        success: true,
        filesProcessed: 50,
        filesSkipped: 2,
        chunksCreated: 250,
        processingTime: 5000,
        errors: [],
      };

      mockIndexService.createIndex.mockResolvedValue(indexResult);

      const args = {
        projectPath: '/src/project',
        options: {
          recursive: true,
          includePatterns: [],
          excludePatterns: [],
        },
      };

      const response = await (mcpServer as any).handleCreateIndex(args);

      expect(response.success).toBe(true);
      expect(response.message).toContain('Index created successfully');
      expect(mockIndexService.createIndex).toHaveBeenCalledWith('/src/project', {
        recursive: true,
        includePatterns: [],
        excludePatterns: [],
      });
    });

    it('should handle codebase.status.get tool requests', async () => {
      const statusResult = {
        projectId: 'test-project-hash',
        isIndexing: false,
        lastIndexed: new Date(),
        fileCount: 150,
        chunkCount: 450,
        status: 'completed' as const,
      };

      mockIndexService.getStatus.mockResolvedValue(statusResult);

      const args = {
        projectPath: '/src/project',
      };

      const response = await (mcpServer as any).handleGetStatus(args);

      expect(response.status).toEqual(statusResult);
      expect(mockIndexService.getStatus).toHaveBeenCalledWith('/src/project');
    });
  });

  describe('Graph Analysis Tools', () => {
    it('should handle codebase.graph.analyze tool requests', async () => {
      const analysisResult = {
        nodes: [
          {
            id: 'file_1',
            label: 'Button.tsx',
            properties: { path: 'src/components/Button.tsx', type: 'file', language: 'typescript' },
            type: 'file' as const,
          },
        ],
        edges: [
          {
            id: 'edge_1',
            source: 'file_1',
            target: 'function_1',
            type: 'CONTAINS',
            properties: { relationship: 'contains' },
          },
        ],
        metrics: {
          totalNodes: 45,
          totalEdges: 67,
          averageDegree: 2.5,
          maxDepth: 3,
          componentCount: 5,
        },
        summary: {
          projectFiles: 45,
          functions: 67,
          classes: 23,
          imports: 89,
          externalDependencies: 2,
        },
      };

      mockGraphService.analyzeCodebase.mockResolvedValue({
        result: analysisResult,
        formattedResult: {},
      });

      const args = {
        projectPath: '/src/project',
        options: {
          depth: 3,
          focus: 'dependencies' as const,
        },
      };

      const response = await (mcpServer as any).handleGraphAnalyze(args);

      expect(response.success).toBe(true);
      expect(response.nodes).toEqual(analysisResult.nodes);
      expect(response.metrics).toEqual(analysisResult.metrics);
      expect(mockGraphService.analyzeCodebase).toHaveBeenCalledWith('/src/project', {
        depth: 3,
        focus: 'dependencies',
      });
    });
  });

  describe('Server Lifecycle', () => {
    it('should start MCP server', async () => {
      // Mock the server connection
      const mockServer = {
        connect: jest.fn().mockResolvedValue(undefined),
      };
      (mcpServer as any).server = mockServer;

      await mcpServer.start();

      expect(mockServer.connect).toHaveBeenCalled();
      expect(mockLoggerService.info).toHaveBeenCalledWith('MCP Server started successfully');
    });

    it('should stop MCP server gracefully', async () => {
      // Mock the server close method
      const mockServer = {
        close: jest.fn(),
      };
      (mcpServer as any).server = mockServer;

      await mcpServer.stop();

      expect(mockServer.close).toHaveBeenCalled();
      expect(mockLoggerService.info).toHaveBeenCalledWith('MCP Server stopped successfully');
    });
  });

  describe('Error Handling', () => {
    it('should handle search errors', async () => {
      mockIndexService.search.mockRejectedValue(new Error('Search service unavailable'));

      const args = {
        query: 'test query',
        options: {},
      };

      await expect((mcpServer as any).handleSearch(args)).rejects.toThrow(
        'Search service unavailable'
      );
      expect(mockLoggerService.error).toHaveBeenCalled();
    });

    it('should handle indexing errors', async () => {
      mockIndexService.createIndex.mockRejectedValue(new Error('Index service unavailable'));

      const args = {
        projectPath: '/src/project',
        options: {},
      };

      await expect((mcpServer as any).handleCreateIndex(args)).rejects.toThrow(
        'Index service unavailable'
      );
      expect(mockLoggerService.error).toHaveBeenCalled();
    });

    it('should handle graph analysis errors', async () => {
      mockGraphService.analyzeCodebase.mockRejectedValue(new Error('Graph service unavailable'));

      const args = {
        projectPath: '/src/project',
        options: {},
      };

      await expect((mcpServer as any).handleGraphAnalyze(args)).rejects.toThrow(
        'Graph service unavailable'
      );
      expect(mockLoggerService.error).toHaveBeenCalled();
    });
  });
});
