import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { LoggerService } from '../core/LoggerService';
import { IndexService } from '../services/indexing/IndexService';
import { GraphService } from '../services/graph/GraphService';

export class MCPServer {
  private server: McpServer;
  private transport: StdioServerTransport;
  private logger: LoggerService;
  private indexService: IndexService;
  private graphService: GraphService;

  constructor(
    logger: LoggerService,
    indexService: IndexService,
    graphService: GraphService
  ) {
    this.logger = logger;
    this.indexService = indexService;
    this.graphService = graphService;

    // Initialize the server with basic configuration
    this.server = new McpServer({
      name: 'codebase-index-mcp',
      version: '1.0.0',
      description: 'Intelligent codebase indexing and analysis service',
    });

    // Initialize the stdio transport
    this.transport = new StdioServerTransport();

    // Register all available tools
    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    this.server.tool(
      'codebase.index.create',
      {
        projectPath: z.string().describe('Path to the project directory'),
        options: z
          .object({
            recursive: z.boolean().optional().default(true),
            includePatterns: z.array(z.string()).optional(),
            excludePatterns: z.array(z.string()).optional(),
          })
          .optional(),
      },
      async args => {
        const result = await this.handleCreateIndex(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      }
    );

    this.server.tool(
      'codebase.index.search',
      {
        query: z.string().describe('Search query'),
        options: z
          .object({
            limit: z.number().optional().default(10),
            threshold: z.number().optional().default(0.7),
            includeGraph: z.boolean().optional().default(false),
          })
          .optional(),
      },
      async args => {
        const result = await this.handleSearch(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      }
    );

    this.server.tool(
      'codebase.graph.analyze',
      {
        projectPath: z.string().describe('Path to the project directory'),
        options: z
          .object({
            depth: z.number().optional().default(3),
            focus: z.enum(['dependencies', 'imports', 'classes', 'functions']).optional(),
          })
          .optional(),
      },
      async args => {
        const result = await this.handleGraphAnalyze(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      }
    );

    this.server.tool(
      'codebase.status.get',
      {
        projectPath: z.string().describe('Path to the project directory'),
      },
      async args => {
        const result = await this.handleGetStatus(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      }
    );
  }

  private async handleCreateIndex(args: any): Promise<any> {
    const { projectPath, options = {} } = args;

    this.logger.info(`Creating index for project: ${projectPath}`);

    try {
      await this.indexService.createIndex(projectPath, options);

      return {
        success: true,
        message: `Index created successfully for ${projectPath}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to create index for project: ${projectPath}`, error);
      throw error;
    }
  }

  private async handleSearch(args: any): Promise<any> {
    const { query, options = {} } = args;

    this.logger.info(`Searching for: ${query}`);

    // For now, we'll use a default projectId
    // In a real implementation, this should be derived from context or passed as a parameter
    const projectId = 'default';
    
    try {
      const results = await this.indexService.search(query, projectId, options);

      return {
        results,
        total: results.length,
        query,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to search for query: ${query}`, error);
      throw error;
    }
  }

  private async handleGraphAnalyze(args: any): Promise<any> {
    const { projectPath, options = {} } = args;

    this.logger.info(`Analyzing graph for project: ${projectPath}`);

    try {
      const analysis = await this.graphService.analyzeCodebase(projectPath, options);

      return {
        success: true,
        nodes: analysis.result.nodes,
        relationships: analysis.result.edges,
        metrics: analysis.result.metrics,
        formattedResult: analysis.formattedResult,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to analyze graph for project: ${projectPath}`, error);
      throw error;
    }
  }

  private async handleGetStatus(args: any): Promise<any> {
    const { projectPath } = args;

    try {
      const status = await this.indexService.getStatus(projectPath);

      return {
        status,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to get status for project: ${projectPath}`, error);
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      await this.server.connect(this.transport);
      this.logger.info('MCP Server started successfully');
    } catch (error) {
      this.logger.error('Failed to start MCP Server', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.server.close();
      this.logger.info('MCP Server stopped successfully');
    } catch (error) {
      this.logger.error('Failed to stop MCP Server', error);
      throw error;
    }
  }
}
