# 代码库索引MCP服务 - 项目结构文档

## 📁 项目概述

本文档详细描述了独立的代码库索引MCP服务的项目结构，该服务与Kode CLI分离，通过MCP协议提供代码索引和结构分析功能。服务采用现代化的架构设计，集成了多种先进技术以提供高效的代码分析能力。

**🚀 架构增强**: 集成智能语法解析（Tree-sitter）、多嵌入器提供商支持（OpenAI、Ollama、Gemini、Mistral等）、路径段索引、增量实时索引、全方位监控体系、LSP增强、Semgrep集成、图数据库分析等。

## 🏗️ 项目结构

```
codebase-index/
├── 📁 src/                    # 源代码目录
│   ├── 📁 api/               # API路由和中间件
│   ├── 📁 config/            # 配置管理
│   ├── 📁 controllers/       # 控制器层
│   ├── 📁 core/              # 核心模块
│   ├── 📁 database/          # 数据库客户端和服务
│   ├── 📁 embedders/        # 嵌入器提供商
│   ├── 📁 mcp/              # MCP协议处理
│   ├── 📁 models/           # 数据模型
│   ├── 📁 services/         # 服务层
│   ├── 📁 types/            # TypeScript类型定义
│   ├── 📁 utils/            # 工具函数
│   └── main.ts              # 应用入口
├── 📁 test/                 # 测试目录
│   ├── 📁 unit/             # 单元测试
│   ├── 📁 integration/      # 集成测试
│   └── 📁 e2e/              # 端到端测试
├── 📁 dist/                 # 编译输出目录
├── 📁 docs/                 # 项目文档
├── 📁 scripts/              # 脚本文件
├── .env                     # 环境变量配置
├── .env.example             # 环境变量示例
├── package.json             # 项目配置
├── tsconfig.json            # TypeScript配置
├── jest.config.js           # Jest测试配置
├── Dockerfile               # Docker镜像配置
├── Dockerfile.dev          # Docker开发环境配置
└── README.md                # 项目说明文档
```

## 🔧 核心模块说明

### 1. 核心模块 (core/)

**DIContainer.ts** - 依赖注入容器
```typescript
import 'reflect-metadata';
import { Container, ContainerModule } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
// ... 其他导入

export const TYPES = {
  ConfigService: Symbol.for('ConfigService'),
  LoggerService: Symbol.for('LoggerService'),
  ErrorHandlerService: Symbol.for('ErrorHandlerService'),
  // ... 其他类型定义
};

const coreModule = new ContainerModule(({ bind, unbind, isBound, rebind }) => {
  bind(TYPES.ConfigService).to(ConfigService).inSingletonScope();
  bind(TYPES.LoggerService).to(LoggerService).inSingletonScope();
  bind(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
});

// ... 其他模块定义

export class DIContainer {
  private static instance: Container | null = null;

  static getInstance(): Container {
    if (!DIContainer.instance) {
      DIContainer.instance = new Container();
      DIContainer.instance.load(coreModule, databaseModule, embedderModule, serviceModule, queueModule, syncModule, monitoringModule, controllerModule);
    }
    return DIContainer.instance;
  }
}
```

**LoggerService.ts** - 日志服务
```typescript
import { injectable } from 'inversify';
import * as winston from 'winston';
import * as path from 'path';

@injectable()
export class LoggerService {
  private logger: winston.Logger;

  constructor() {
    const isTestEnvironment = process.env.NODE_ENV === 'test';
    const transports: winston.transport[] = [
      new winston.transports.Console()
    ];
    
    // 在测试环境中不创建文件传输，避免文件句柄泄漏
    if (!isTestEnvironment) {
      transports.push(
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'error.log'),
          level: 'error'
        } as any),
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'combined.log')
        } as any)
      );
    }

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: process.env.LOG_FORMAT === 'json'
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              return `${timestamp} [${level}]: ${message} ${
                Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
              }`;
            })
          ),
      transports
    });
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  error(message: string, error?: any): void {
    this.logger.error(message, error);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  verbose(message: string, meta?: any): void {
    this.logger.verbose(message, meta);
  }
}
```

**ErrorHandlerService.ts** - 错误处理服务
```typescript
import { injectable, inject } from 'inversify';
import { LoggerService } from './LoggerService';
import { TYPES } from '../types';

export interface ErrorContext {
  component: string;
  operation: string;
  input?: any;
  metadata?: Record<string, any>;
}

export class CodebaseIndexError extends Error {
  public readonly context: ErrorContext;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';

  constructor(
    message: string,
    context: ErrorContext,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) {
    super(message);
    this.name = 'CodebaseIndexError';
    this.context = context;
    this.severity = severity;
  }
}

@injectable()
export class ErrorHandlerService {
  private logger: LoggerService;
  private errorReports: Map<string, ErrorReport> = new Map();
  private errorCallbacks: Array<(error: ErrorReport) => void> = [];

  constructor(@inject(TYPES.LoggerService) logger: LoggerService) {
    this.logger = logger;
  }

  handleError(error: Error, context: ErrorContext): ErrorReport {
    // 错误处理逻辑
  }

  // 其他方法...
}
```

### 2. 服务层 (services/)

**indexing/** - 索引相关服务
- IndexService.ts - 索引服务
- IndexCoordinator.ts - 索引协调器

**graph/** - 图分析相关服务
- GraphService.ts - 图分析服务

**parser/** - 代码解析相关服务
- ParserService.ts - 代码解析服务
- TreeSitterService.ts - Tree-sitter解析服务
- SmartCodeParser.ts - 智能代码解析器

**search/** - 搜索相关服务
- SemanticSearchService.ts - 语义搜索服务
- SearchCoordinator.ts - 搜索协调器
- HybridSearchService.ts - 混合搜索服务

**reranking/** - 重排相关服务
- RerankingService.ts - 重排服务

**storage/** - 存储相关服务
- VectorStorageService.ts - 向量存储服务
- GraphPersistenceService.ts - 图持久化服务

**embedders/** - 嵌入器相关服务
- EmbedderFactory.ts - 嵌入器工厂
- BaseEmbedder.ts - 基础嵌入器类
- OpenAIEmbedder.ts - OpenAI嵌入器
- OllamaEmbedder.ts - Ollama嵌入器
- GeminiEmbedder.ts - Gemini嵌入器
- MistralEmbedder.ts - Mistral嵌入器
- SiliconFlowEmbedder.ts - SiliconFlow嵌入器
- Custom1Embedder.ts - 自定义嵌入器1
- Custom2Embedder.ts - 自定义嵌入器2
- Custom3Embedder.ts - 自定义嵌入器3

**monitoring/** - 监控相关服务
- HealthCheckService.ts - 健康检查服务
- PrometheusMetricsService.ts - Prometheus指标服务

**lsp/** - LSP相关服务
- LSPService.ts - LSP服务
- LSPManager.ts - LSP管理器

**semgrep/** - Semgrep相关服务
- SemgrepScanService.ts - Semgrep扫描服务

**filesystem/** - 文件系统相关服务
- FileSystemTraversal.ts - 文件系统遍历
- FileWatcherService.ts - 文件监视服务

**cache/** - 缓存相关服务
- CacheManager.ts - 缓存管理器

**query/** - 查询相关服务
- QueryCoordinationService.ts - 查询协调服务
- ResultFusionEngine.ts - 结果融合引擎

**processing/** - 处理相关服务
- BatchProcessor.ts - 批处理服务

**deduplication/** - 去重相关服务
- HashBasedDeduplicator.ts - 基于哈希的去重器

**controllers/** - 控制器相关服务
- MonitoringController.ts - 监控控制器
- SnippetController.ts - 代码片段控制器

**其他服务文件**:
- EventQueueService.ts - 事件队列服务
- SemanticAnalysisOrchestrator.ts - 语义分析协调器

### 3. MCP协议处理 (mcp/)

**MCPServer.ts** - MCP服务器
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { DIContainer, TYPES } from '../core/DIContainer';
import { LoggerService } from '../core/LoggerService';
import { IndexService } from '../services/indexing/IndexService';
import { GraphService } from '../services/graph/GraphService';

export class MCPServer {
  private server: McpServer;
  private transport: StdioServerTransport;
  private logger: LoggerService;
  private indexService: IndexService;
  private graphService: GraphService;

  constructor() {
    const container = DIContainer.getInstance();
    this.logger = container.get<LoggerService>(TYPES.LoggerService);
    this.indexService = container.get<IndexService>(TYPES.IndexService);
    this.graphService = container.get<GraphService>(TYPES.GraphService);

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
        options: z.object({
          recursive: z.boolean().optional().default(true),
          includePatterns: z.array(z.string()).optional(),
          excludePatterns: z.array(z.string()).optional()
        }).optional()
      },
      async (args) => {
        const result = await this.handleCreateIndex(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }]
        };
      }
    );

    this.server.tool(
      'codebase.index.search',
      {
        query: z.string().describe('Search query'),
        options: z.object({
          limit: z.number().optional().default(10),
          threshold: z.number().optional().default(0.7),
          includeGraph: z.boolean().optional().default(false)
        }).optional()
      },
      async (args) => {
        const result = await this.handleSearch(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }]
        };
      }
    );

    this.server.tool(
      'codebase.graph.analyze',
      {
        projectPath: z.string().describe('Path to the project directory'),
        options: z.object({
          depth: z.number().optional().default(3),
          focus: z.enum(['dependencies', 'imports', 'classes', 'functions']).optional()
        }).optional()
      },
      async (args) => {
        const result = await this.handleGraphAnalyze(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }]
        };
      }
    );

    this.server.tool(
      'codebase.status.get',
      {
        projectPath: z.string().describe('Path to the project directory')
      },
      async (args) => {
        const result = await this.handleGetStatus(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }]
        };
      }
    );
  }

  private async handleCreateIndex(args: any): Promise<any> {
    const { projectPath, options = {} } = args;
    
    this.logger.info(`Creating index for project: ${projectPath}`);
    
    await this.indexService.createIndex(projectPath, options);
    
    return {
      success: true,
      message: `Index created successfully for ${projectPath}`,
      timestamp: new Date().toISOString()
    };
  }

  private async handleSearch(args: any): Promise<any> {
    const { query, options = {} } = args;
    
    this.logger.info(`Searching for: ${query}`);
    
    // For now, we'll use a default projectId
    // In a real implementation, this should be derived from context or passed as a parameter
    const projectId = 'default';
    const results = await this.indexService.search(query, projectId, options);
    
    return {
      results,
      total: results.length,
      query,
      timestamp: new Date().toISOString()
    };
  }

  private async handleGraphAnalyze(args: any): Promise<any> {
    const { projectPath, options = {} } = args;
    
    this.logger.info(`Analyzing graph for project: ${projectPath}`);
    
    const analysis = await this.graphService.analyzeCodebase(projectPath, options);
    
    return {
      success: true,
      nodes: analysis.nodes,
      relationships: analysis.edges,
      metrics: analysis.metrics,
      timestamp: new Date().toISOString()
    };
  }

  private async handleGetStatus(args: any): Promise<any> {
    const { projectPath } = args;
    
    const status = await this.indexService.getStatus(projectPath);
    
    return {
      status,
      timestamp: new Date().toISOString()
    };
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
```

### 4. 数据库客户端 (database/)

**QdrantService.ts** - Qdrant服务
```typescript
import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { QdrantClientWrapper } from '../database/qdrant/QdrantClientWrapper';

@injectable()
export class QdrantService {
  private qdrantClient: QdrantClientWrapper;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(QdrantClientWrapper) qdrantClient: QdrantClientWrapper
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.qdrantClient = qdrantClient;
  }

  async initialize(): Promise<boolean> {
    try {
      const connected = await this.qdrantClient.connect();
      if (connected) {
        this.logger.info('Qdrant service initialized successfully');
        return true;
      }
      return false;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to initialize Qdrant service: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'QdrantService', operation: 'initialize' }
      );
      return false;
    }
  }

  async createCollection(name: string, vectorSize: number): Promise<boolean> {
    return this.qdrantClient.createCollection(name, vectorSize);
  }

  async upsertVectors(collectionName: string, vectors: any[]): Promise<boolean> {
    return this.qdrantClient.upsertPoints(collectionName, vectors);
  }

  async searchVectors(collectionName: string, query: number[], options?: any): Promise<any[]> {
    return this.qdrantClient.searchVectors(collectionName, query, options);
  }

  async getCollectionInfo(collectionName: string): Promise<any> {
    return this.qdrantClient.getCollectionInfo(collectionName);
  }

  isConnected(): boolean {
    return this.qdrantClient.isConnectedToDatabase();
  }

  async close(): Promise<void> {
    await this.qdrantClient.close();
  }
}
```

**NebulaService.ts** - Nebula Graph服务
```typescript
import { injectable, inject } from 'inversify';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { NebulaConnectionManager } from './nebula/NebulaConnectionManager';

@injectable()
export class NebulaService {
  private nebulaConnection: NebulaConnectionManager;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;

  constructor(
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(NebulaConnectionManager) nebulaConnection: NebulaConnectionManager
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.nebulaConnection = nebulaConnection;
  }

  async initialize(): Promise<boolean> {
    try {
      const connected = await this.nebulaConnection.connect();
      if (connected) {
        this.logger.info('NebulaGraph service initialized successfully');
        return true;
      }
      return false;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to initialize NebulaGraph service: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'NebulaService', operation: 'initialize' }
      );
      return false;
    }
  }

  async executeReadQuery(nGQL: string, parameters?: Record<string, any>): Promise<any> {
    return this.nebulaConnection.executeQuery(nGQL, parameters);
  }

  async executeWriteQuery(nGQL: string, parameters?: Record<string, any>): Promise<any> {
    return this.nebulaConnection.executeQuery(nGQL, parameters);
  }

  async useSpace(spaceName: string): Promise<void> {
    // 切换到指定的空间
    await this.nebulaConnection.executeQuery(`USE ${spaceName}`);
  }

  async getCurrentSpace(): Promise<string> {
    // 获取当前空间名称
    const result = await this.nebulaConnection.executeQuery('SHOW SPACES');
    // 这里需要根据实际返回结果解析当前空间
    // 由于NebulaGraph的特性，可能需要通过其他方式获取当前空间
    return '';
  }

  async executeTransaction(queries: Array<{ nGQL: string; parameters?: Record<string, any> }>): Promise<any[]> {
    // 使用NebulaConnectionManager执行事务
    const formattedQueries = queries.map(q => ({
      query: q.nGQL,
      params: q.parameters
    }));

    return this.nebulaConnection.executeTransaction(
      formattedQueries.map(q => ({
        query: q.query,
        params: q.params ?? {}
      }))
    );
  }

  async createNode(node: { label: string; properties: Record<string, any> }): Promise<string> {
    // 使用NebulaConnectionManager创建节点
    return this.nebulaConnection.createNode(node);
  }

  async createRelationship(relationship: { type: string; sourceId: string; targetId: string; properties?: Record<string, any> }): Promise<void> {
    // 使用NebulaConnectionManager创建关系
    await this.nebulaConnection.createRelationship(relationship);
  }

  async findNodes(label?: string, properties?: Record<string, any>): Promise<any[]> {
    // 使用NebulaConnectionManager查找节点
    if (label) {
      return this.nebulaConnection.findNodesByLabel(label, properties);
    } else {
      // 如果没有指定标签，需要实现一个通用的节点查找方法
      // 这里暂时抛出未实现错误，因为NebulaGraph的实现可能与Neo4j不同
      throw new Error('General node finding not implemented for NebulaGraph');
    }
  }

  async findRelationships(type?: string, properties?: Record<string, any>): Promise<any[]> {
    // 使用NebulaConnectionManager查找关系
    return this.nebulaConnection.findRelationships(type, properties);
  }

  async getDatabaseStats(): Promise<any> {
    // 使用NebulaConnectionManager获取数据库统计信息
    return this.nebulaConnection.getDatabaseStats();
  }

  isConnected(): boolean {
    return this.nebulaConnection.isConnectedToDatabase();
  }

  async close(): Promise<void> {
    await this.nebulaConnection.disconnect();
  }
}
```

### 5. 嵌入器提供商 (embedders/)

**EmbedderFactory.ts** - 嵌入器工厂
```typescript
import { injectable, inject } from 'inversify';
import { TYPES } from '../types';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { OpenAIEmbedder } from './OpenAIEmbedder';
import { OllamaEmbedder } from './OllamaEmbedder';
import { GeminiEmbedder } from './GeminiEmbedder';
import { MistralEmbedder } from './MistralEmbedder';
import { SiliconFlowEmbedder } from './SiliconFlowEmbedder';
import { Custom1Embedder } from './Custom1Embedder';
import { Custom2Embedder } from './Custom2Embedder';
import { Custom3Embedder } from './Custom3Embedder';
import { Embedder, EmbeddingInput, EmbeddingResult } from './BaseEmbedder';

@injectable()
export class EmbedderFactory {
  private configService: ConfigService;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private embedders: Map<string, Embedder> = new Map();

  constructor(
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.OpenAIEmbedder) openAIEmbedder: OpenAIEmbedder,
    @inject(TYPES.OllamaEmbedder) ollamaEmbedder: OllamaEmbedder,
    @inject(TYPES.GeminiEmbedder) geminiEmbedder: GeminiEmbedder,
    @inject(TYPES.MistralEmbedder) mistralEmbedder: MistralEmbedder,
    @inject(TYPES.SiliconFlowEmbedder) siliconFlowEmbedder: SiliconFlowEmbedder,
    @inject(TYPES.Custom1Embedder) custom1Embedder: Custom1Embedder,
    @inject(TYPES.Custom2Embedder) custom2Embedder: Custom2Embedder,
    @inject(TYPES.Custom3Embedder) custom3Embedder: Custom3Embedder
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;

    // Register embedders
    this.embedders.set('openai', openAIEmbedder);
    this.embedders.set('ollama', ollamaEmbedder);
    this.embedders.set('gemini', geminiEmbedder);
    this.embedders.set('mistral', mistralEmbedder);
    this.embedders.set('siliconflow', siliconFlowEmbedder);
    this.embedders.set('custom1', custom1Embedder);
    this.embedders.set('custom2', custom2Embedder);
    this.embedders.set('custom3', custom3Embedder);
  }

  async getEmbedder(provider?: string): Promise<Embedder> {
    const config = this.configService.get('embedding');
    const selectedProvider = provider || config.provider;

    const embedder = this.embedders.get(selectedProvider);
    if (!embedder) {
      throw new Error(`Unsupported embedder provider: ${selectedProvider}`);
    }

    // Check if the embedder is available
    const isAvailable = await embedder.isAvailable();
    if (!isAvailable) {
      throw new Error(`Embedder provider ${selectedProvider} is not available`);
    }

    return embedder;
  }

  async embed(input: EmbeddingInput | EmbeddingInput[], provider?: string): Promise<EmbeddingResult | EmbeddingResult[]> {
    const embedder = await this.getEmbedder(provider);
    return embedder.embed(input);
  }

  async getAvailableProviders(): Promise<string[]> {
    const available: string[] = [];

    for (const [name, embedder] of this.embedders.entries()) {
      try {
        const isAvailable = await embedder.isAvailable();
        if (isAvailable) {
          available.push(name);
        }
      } catch (error) {
        this.logger.warn(`Failed to check availability for embedder ${name}`, { error });
      }
    }

    return available;
  }

  async getProviderInfo(provider?: string): Promise<{
    name: string;
    model: string;
    dimensions: number;
    available: boolean;
  }> {
    const embedder = await this.getEmbedder(provider);
    const available = await embedder.isAvailable();

    return {
      name: provider || this.configService.get('embedding').provider,
      model: embedder.getModelName(),
      dimensions: embedder.getDimensions(),
      available
    };
  }

  async autoSelectProvider(): Promise<string> {
    const available = await this.getAvailableProviders();
    
    if (available.length === 0) {
      throw new Error('No embedder providers available');
    }

    const config = this.configService.get('embedding');
    const preferredProvider = config.provider;

    // Return preferred provider if available
    if (available.includes(preferredProvider)) {
      return preferredProvider;
    }

    // Otherwise return first available provider
    return available[0];
  }

  registerProvider(name: string, embedder: Embedder): void {
    this.embedders.set(name, embedder);
    this.logger.info(`Registered embedder provider: ${name}`);
  }

  getRegisteredProviders(): string[] {
    return Array.from(this.embedders.keys());
  }
}
```

### 6. 数据模型 (models/)

**IndexTypes.ts** - 索引相关数据模型
```typescript
export interface IndexOptions {
  recursive?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
  chunkSize?: number;
  overlapSize?: number;
  batchSize?: number;
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  includeGraph?: boolean;
  filters?: SearchFilter[];
}

export interface SearchFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  value: any;
}

export interface SearchResult {
  id: string;
  filePath: string;
  content: string;
  score: number;
  metadata: CodeMetadata;
  graphData?: GraphData;
}

export interface CodeMetadata {
  id: string;
  filePath: string;
  language: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'import' | 'export';
  name?: string;
  lineStart: number;
  lineEnd: number;
  dependencies?: string[];
  exports?: string[];
  imports?: string[];
  content: string;
  astPath: string;
  nodeType: string;
  parentType: string;
  children: string[];
  metadata: Record<string, any>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, any>;
}

export interface IndexStatus {
  isIndexing: boolean;
  lastIndexed: Date | null;
  fileCount: number;
  totalFiles: number;
  errorCount: number;
  lastError?: string;
}
```

**StaticAnalysisTypes.ts** - 静态分析相关数据模型
```typescript
// 静态分析相关的数据模型
```

### 7. 工具函数 (utils/)

**HashUtils.ts** - 哈希工具
```typescript
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export interface FileHash {
  path: string;
  hash: string;
  size: number;
  lastModified: Date;
}

export interface DirectoryHash {
  path: string;
  hash: string;
  fileCount: number;
  files: FileHash[];
}

export class HashUtils {
  static async calculateFileHash(filePath: string): Promise<string> {
    try {
      const fileBuffer = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (error) {
      throw new Error(`Failed to calculate hash for ${filePath}: ${error}`);
    }
  }

  static async calculateDirectoryHash(dirPath: string): Promise<DirectoryHash> {
    const files: FileHash[] = [];
    const hash = crypto.createHash('sha256');

    const processFile = async (filePath: string) => {
      try {
        const stats = await fs.stat(filePath);
        const fileHash = await this.calculateFileHash(filePath);
        
        const fileHashInfo: FileHash = {
          path: path.relative(dirPath, filePath),
          hash: fileHash,
          size: stats.size,
          lastModified: stats.mtime
        };
        
        files.push(fileHashInfo);
        hash.update(fileHashInfo.path + fileHashInfo.hash);
      } catch (error) {
        // Skip files that can't be read
      }
    };

    const processDirectory = async (currentPath: string) => {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        if (entry.isDirectory()) {
          await processDirectory(fullPath);
        } else if (entry.isFile()) {
          await processFile(fullPath);
        }
      }
    };

    await processDirectory(dirPath);

    return {
      path: dirPath,
      hash: hash.digest('hex'),
      fileCount: files.length,
      files
    };
  }

  static calculateStringHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  static generateId(prefix: string = 'id'): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `${prefix}_${timestamp}_${random}`;
  }

  static normalizePath(filePath: string): string {
    return path.normalize(filePath).replace(/\\/g, '/');
  }

  static getFileExtension(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return ext.startsWith('.') ? ext.substr(1) : ext;
  }

  static isValidCodeFile(filePath: string, allowedExtensions: string[] = []): boolean {
    const extension = this.getFileExtension(filePath);
    const defaultExtensions = ['ts', 'js', 'py', 'java', 'go', 'rs', 'cpp', 'c', 'h', 'cs', 'php', 'rb', 'swift', 'kt'];
    const extensions = allowedExtensions.length > 0 ? allowedExtensions : defaultExtensions;
    
    return extensions.includes(extension);
  }
}
```

**PathUtils.ts** - 路径工具
```typescript
import fs from 'fs/promises';
import path from 'path';

export interface FileSystemStats {
  totalFiles: number;
  totalSize: number;
  fileTypes: Record<string, number>;
  largestFiles: Array<{ path: string; size: number }>;
}

export class PathUtils {
  static async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  static async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  static async isDirectory(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  static async isFile(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  static async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    const processDirectory = async (currentPath: string) => {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        if (entry.isDirectory()) {
          await processDirectory(fullPath);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    };

    await processDirectory(dirPath);
    return totalSize;
  }

  static async getFileSystemStats(dirPath: string): Promise<FileSystemStats> {
    const stats: FileSystemStats = {
      totalFiles: 0,
      totalSize: 0,
      fileTypes: {},
      largestFiles: []
    };

    const processDirectory = async (currentPath: string) => {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        if (entry.isDirectory()) {
          await processDirectory(fullPath);
        } else if (entry.isFile()) {
          const fileStats = await fs.stat(fullPath);
          const extension = path.extname(fullPath).toLowerCase();
          
          stats.totalFiles++;
          stats.totalSize += fileStats.size;
          stats.fileTypes[extension] = (stats.fileTypes[extension] || 0) + 1;
          
          stats.largestFiles.push({
            path: path.relative(dirPath, fullPath),
            size: fileStats.size
          });
        }
      }
    };

    await processDirectory(dirPath);
    
    // Keep only top 10 largest files
    stats.largestFiles.sort((a, b) => b.size - a.size);
    stats.largestFiles = stats.largestFiles.slice(0, 10);
    
    return stats;
  }

  static async cleanPath(filePath: string): Promise<string> {
    const normalized = path.normalize(filePath);
    const resolved = path.resolve(normalized);
    return resolved.replace(/\\/g, '/');
  }

  static async getRelativePath(fromPath: string, toPath: string): Promise<string> {
    const relative = path.relative(fromPath, toPath);
    return relative.replace(/\\/g, '/');
  }

  static async joinPaths(...paths: string[]): Promise<string> {
    const joined = path.join(...paths);
    return joined.replace(/\\/g, '/');
  }

  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  static async deleteFile(filePath: string): Promise<boolean> {
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  static async deleteDirectory(dirPath: string): Promise<boolean> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  static async copyFile(sourcePath: string, targetPath: string): Promise<boolean> {
    try {
      await this.ensureDirectoryExists(path.dirname(targetPath));
      await fs.copyFile(sourcePath, targetPath);
      return true;
    } catch {
      return false;
    }
  }

  static async moveFile(sourcePath: string, targetPath: string): Promise<boolean> {
    try {
      await this.ensureDirectoryExists(path.dirname(targetPath));
      await fs.rename(sourcePath, targetPath);
      return true;
    } catch {
      return false;
    }
  }
}
```

### 8. 配置管理 (config/)

**ConfigService.ts** - 配置服务
```typescript
import { injectable } from 'inversify';
import * as dotenv from 'dotenv';
import * as Joi from 'joi';

dotenv.config();

const configSchema = Joi.object({
  nodeEnv: Joi.string().trim().valid('development', 'production', 'test').default('development'),
  port: Joi.number().port().default(3000),
  
  qdrant: Joi.object({
    host: Joi.string().hostname().default('localhost'),
    port: Joi.number().port().default(6333),
    collection: Joi.string().default('code-snippets')
  }),
  
  nebula: Joi.object({
    host: Joi.string().hostname().default('localhost'),
    port: Joi.number().port().default(9669),
    username: Joi.string().default('root'),
    password: Joi.string().default('nebula'),
    space: Joi.string().default('codegraph')
  }),
  
  embedding: Joi.object({
    provider: Joi.string().valid('openai', 'ollama', 'gemini', 'mistral', 'siliconflow', 'custom1', 'custom2', 'custom3').default('openai'),
    openai: Joi.object({
      apiKey: Joi.string().when('$..provider', { is: 'openai', then: Joi.required() }),
      baseUrl: Joi.string().uri().optional(),
      model: Joi.string().default('text-embedding-ada-002'),
      dimensions: Joi.number().positive().default(1536)
    }),
    ollama: Joi.object({
      baseUrl: Joi.string().uri().default('http://localhost:11434'),
      model: Joi.string().default('nomic-embed-text'),
      dimensions: Joi.number().positive().default(768)
    }),
    gemini: Joi.object({
      apiKey: Joi.string().when('$..provider', { is: 'gemini', then: Joi.required() }),
      baseUrl: Joi.string().uri().optional(),
      model: Joi.string().default('embedding-001'),
      dimensions: Joi.number().positive().default(768)
    }),
    mistral: Joi.object({
      apiKey: Joi.string().when('$..provider', { is: 'mistral', then: Joi.required() }),
      baseUrl: Joi.string().uri().optional(),
      model: Joi.string().default('mistral-embed'),
      dimensions: Joi.number().positive().default(1024)
    }),
    siliconflow: Joi.object({
      apiKey: Joi.string().when('$..provider', { is: 'siliconflow', then: Joi.required() }),
      baseUrl: Joi.string().uri().optional(),
      model: Joi.string().default('BAAI/bge-large-en-v1.5'),
      dimensions: Joi.number().positive().default(1024)
    }),
    custom: Joi.object({
      custom1: Joi.object({
        apiKey: Joi.string().allow('').optional(),
        baseUrl: Joi.string().uri().allow('').optional(),
        model: Joi.string().allow('').optional(),
        dimensions: Joi.number().positive().default(768)
      }),
      custom2: Joi.object({
        apiKey: Joi.string().allow('').optional(),
        baseUrl: Joi.string().uri().allow('').optional(),
        model: Joi.string().allow('').optional(),
        dimensions: Joi.number().positive().default(768)
      }),
      custom3: Joi.object({
        apiKey: Joi.string().allow('').optional(),
        baseUrl: Joi.string().uri().allow('').optional(),
        model: Joi.string().allow('').optional(),
        dimensions: Joi.number().positive().default(768)
      })
    }).optional(),
    dimensionRules: Joi.object().pattern(Joi.string(), Joi.number()).optional(),
    qualityWeight: Joi.number().min(0).max(1).default(0.7),
    performanceWeight: Joi.number().min(0).max(1).default(0.3)
  }),
  
  logging: Joi.object({
    level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
    format: Joi.string().valid('json', 'text').default('json')
  }),
  
  monitoring: Joi.object({
    enabled: Joi.boolean().default(true),
    port: Joi.number().port().default(9090)
  }),
  
  fileProcessing: Joi.object({
    maxFileSize: Joi.number().positive().default(10485760),
    supportedExtensions: Joi.string().default('.ts,.js,.py,.java,.go,.rs,.cpp,.c,.h'),
    indexBatchSize: Joi.number().positive().default(100),
    chunkSize: Joi.number().positive().default(1000),
    overlapSize: Joi.number().positive().default(200)
  }),
  
  batchProcessing: Joi.object({
    enabled: Joi.boolean().default(true),
    maxConcurrentOperations: Joi.number().positive().default(5),
    defaultBatchSize: Joi.number().positive().default(50),
    maxBatchSize: Joi.number().positive().default(500),
    memoryThreshold: Joi.number().positive().default(80), // percentage
    processingTimeout: Joi.number().positive().default(300000), // 5 minutes
    retryAttempts: Joi.number().positive().default(3),
    retryDelay: Joi.number().positive().default(1000), // 1 second
    continueOnError: Joi.boolean().default(true),
    adaptiveBatching: Joi.object({
      enabled: Joi.boolean().default(true),
      minBatchSize: Joi.number().positive().default(10),
      maxBatchSize: Joi.number().positive().default(200),
      performanceThreshold: Joi.number().positive().default(1000), // ms
      adjustmentFactor: Joi.number().positive().default(1.2)
    }),
    monitoring: Joi.object({
      enabled: Joi.boolean().default(true),
      metricsInterval: Joi.number().positive().default(60000), // 1 minute
      alertThresholds: Joi.object({
        highLatency: Joi.number().positive().default(5000), // ms
        lowThroughput: Joi.number().positive().default(10), // operations/sec
        highErrorRate: Joi.number().positive().default(0.1), // 10%
        highMemoryUsage: Joi.number().positive().default(80), // percentage
        criticalMemoryUsage: Joi.number().positive().default(90), // percentage
        highCpuUsage: Joi.number().positive().default(70), // percentage
        criticalCpuUsage: Joi.number().positive().default(85) // percentage
      })
    })
  }),
  mlReranking: Joi.object({
    modelPath: Joi.string().optional(),
    modelType: Joi.string().valid('linear', 'neural', 'ensemble').default('linear'),
    features: Joi.array().items(Joi.string()).default([
      'semanticScore',
      'graphScore',
      'contextualScore',
      'recencyScore',
      'popularityScore',
      'originalScore'
    ]),
    trainingEnabled: Joi.boolean().default(true)
  }).optional(),
  
  caching: Joi.object({
    defaultTTL: Joi.number().positive().default(300), // 5 minutes
    maxSize: Joi.number().positive().default(1000)
  }).optional(),
  
  redis: Joi.object({
    enabled: Joi.boolean().default(false),
    url: Joi.string().uri().default('redis://localhost:6379'),
    maxmemory: Joi.string().default('256mb'),
    useMultiLevel: Joi.boolean().default(true),
    ttl: Joi.object({
      embedding: Joi.number().default(86400),
      search: Joi.number().default(3600),
      graph: Joi.number().default(1800),
      progress: Joi.number().default(300)
    }),
    retry: Joi.object({
      attempts: Joi.number().default(3),
      delay: Joi.number().default(1000)
    }),
    pool: Joi.object({
      min: Joi.number().default(1),
      max: Joi.number().default(10)
    })
  }),
  
  indexing: Joi.object({
    batchSize: Joi.number().positive().default(50),
    maxConcurrency: Joi.number().positive().default(3)
  }),
  lsp: Joi.object({
    enabled: Joi.boolean().default(true),
    timeout: Joi.number().positive().default(30000),
    retryAttempts: Joi.number().positive().default(3),
    retryDelay: Joi.number().positive().default(1000),
    cacheEnabled: Joi.boolean().default(true),
    cacheTTL: Joi.number().positive().default(300),
    batchSize: Joi.number().positive().default(20),
    maxConcurrency: Joi.number().positive().default(5),
    supportedLanguages: Joi.array().items(Joi.string()).default([
      'typescript',
      'javascript',
      'python',
      'java',
      'go',
      'rust',
      'cpp',
      'c',
      'csharp',
      'php',
      'ruby'
    ]),
    languageServers: Joi.object().pattern(
      Joi.string(),
      Joi.object({
        command: Joi.string().required(),
        args: Joi.array().items(Joi.string()).default([]),
        enabled: Joi.boolean().default(true),
        workspaceRequired: Joi.boolean().default(true),
        initializationOptions: Joi.object().optional(),
        settings: Joi.object().optional()
      })
    ).default({})
  }),

  semgrep: Joi.object({
    binaryPath: Joi.string().default('semgrep'),
    timeout: Joi.number().positive().default(30000),
    maxMemory: Joi.number().positive().default(512),
    maxTargetBytes: Joi.number().positive().default(1000000),
    jobs: Joi.number().positive().default(4),
    noGitIgnore: Joi.boolean().default(false),
    noRewriteRuleIds: Joi.boolean().default(false),
    strict: Joi.boolean().default(false),
    configPaths: Joi.array().items(Joi.string()).default([
      'auto',
      'p/security-audit',
      'p/secrets',
      'p/owasp-top-ten',
      'p/javascript',
      'p/python',
      'p/java',
      'p/go',
      'p/typescript'
    ]),
    customRulesPath: Joi.string().default('./rules/semgrep'),
    enhancedRulesPath: Joi.string().default('./enhanced-rules'),
    enableControlFlow: Joi.boolean().default(false),
    enableDataFlow: Joi.boolean().default(false),
    enableTaintAnalysis: Joi.boolean().default(false),
    securitySeverity: Joi.array().items(Joi.string()).default(['HIGH', 'MEDIUM']),
    outputFormat: Joi.string().valid('json', 'sarif', 'text').default('json'),
    excludePatterns: Joi.array().items(Joi.string()).default([
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      '*.min.js',
      '*.min.css',
      'vendor',
      'test/fixtures',
      'tests/fixtures'
    ]),
    includePatterns: Joi.array().items(Joi.string()).default([
      '*.js',
      '*.ts',
      '*.jsx',
      '*.tsx',
      '*.py',
      '*.java',
      '*.go',
      '*.php',
      '*.rb',
      '*.cs'
    ]),
    severityLevels: Joi.array().items(Joi.string()).default(['ERROR', 'WARNING', 'INFO'])
  })
});

export interface Config {
  nodeEnv: string;
  port: number;
  qdrant: {
    host: string;
    port: number;
    collection: string;
  };
  nebula: {
    host: string;
    port: number;
    username: string;
    password: string;
    space: string;
  };
  embedding: {
    provider: string;
    openai: {
      apiKey: string;
      baseUrl?: string;
      model: string;
      dimensions: number;
    };
    ollama: {
      baseUrl: string;
      model: string;
      dimensions: number;
    };
    gemini: {
      apiKey: string;
      baseUrl?: string;
      model: string;
      dimensions: number;
    };
    mistral: {
      apiKey: string;
      baseUrl?: string;
      model: string;
      dimensions: number;
    };
    siliconflow: {
      apiKey: string;
      baseUrl?: string;
      model: string;
      dimensions: number;
    };
    custom?: {
      custom1?: {
        apiKey?: string;
        baseUrl?: string;
        model?: string;
        dimensions?: number;
      };
      custom2?: {
        apiKey?: string;
        baseUrl?: string;
        model?: string;
        dimensions?: number;
      };
      custom3?: {
        apiKey?: string;
        baseUrl?: string;
        model?: string;
        dimensions?: number;
      };
    };
    dimensionRules?: { [key: string]: number };
    qualityWeight?: number;
    performanceWeight?: number;
  };
  logging: {
    level: string;
    format: string;
  };
  monitoring: {
    enabled: boolean;
    port: number;
  };
  fileProcessing: {
    maxFileSize: number;
    supportedExtensions: string;
    indexBatchSize: number;
    chunkSize: number;
    overlapSize: number;
  };
  batchProcessing: {
    enabled: boolean;
    maxConcurrentOperations: number;
    defaultBatchSize: number;
    maxBatchSize: number;
    memoryThreshold: number;
    processingTimeout: number;
    retryAttempts: number;
    retryDelay: number;
    continueOnError: boolean;
    adaptiveBatching: {
      enabled: boolean;
      minBatchSize: number;
      maxBatchSize: number;
      performanceThreshold: number;
      adjustmentFactor: number;
    };
    monitoring: {
      enabled: boolean;
      metricsInterval: number;
      alertThresholds: {
        highLatency: number;
        lowThroughput: number;
        highErrorRate: number;
        highMemoryUsage: number;
        criticalMemoryUsage: number;
        highCpuUsage: number;
        criticalCpuUsage: number;
      };
    };
  };
  mlReranking?: {
    modelPath?: string;
    modelType: 'linear' | 'neural' | 'ensemble';
    features: string[];
    trainingEnabled: boolean;
  };
  caching: {
    defaultTTL: number;
    maxSize: number;
  };
  indexing: {
    batchSize: number;
    maxConcurrency: number;
  };
  lsp: {
    enabled: boolean;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
    cacheEnabled: boolean;
    cacheTTL: number;
    batchSize: number;
    maxConcurrency: number;
    supportedLanguages: string[];
    languageServers: {
      [key: string]: {
        command: string;
        args: string[];
        enabled: boolean;
        workspaceRequired: boolean;
        initializationOptions?: any;
        settings?: any;
      };
    };
  };
  semgrep: {
    binaryPath: string;
    timeout: number;
    maxMemory: number;
    maxTargetBytes: number;
    jobs: number;
    noGitIgnore: boolean;
    noRewriteRuleIds: boolean;
    strict: boolean;
    configPaths: string[];
    customRulesPath: string;
    enhancedRulesPath: string;
    outputFormat: 'json' | 'sarif' | 'text';
    excludePatterns: string[];
    includePatterns: string[];
    severityLevels: string[];
  };
  redis: {
    enabled: boolean;
    url: string;
    maxmemory?: string;
    useMultiLevel: boolean;
    ttl: {
      embedding: number;
      search: number;
      graph: number;
      progress: number;
    };
    retry: {
      attempts: number;
      delay: number;
    };
    pool: {
      min: number;
      max: number;
    };
  };
  performance?: {
    cleanupInterval?: number;
    retentionPeriod?: number;
  };
  cache?: {
    ttl?: number;
    maxEntries?: number;
    cleanupInterval?: number;
  };
  fusion?: {
    vectorWeight?: number;
    graphWeight?: number;
    contextualWeight?: number;
    recencyWeight?: number;
    popularityWeight?: number;
  };
}

@injectable()
export class ConfigService {
  private static instance: ConfigService;
  private config: Config;

  constructor() {
    const rawConfig = {
      nodeEnv: process.env.NODE_ENV,
      port: parseInt(process.env.PORT || '3000'),
      qdrant: {
        host: process.env.QDRANT_HOST,
        port: parseInt(process.env.QDRANT_PORT || '6333'),
        collection: process.env.QDRANT_COLLECTION
      },
      nebula: {
        host: process.env.NEBULA_HOST,
        port: parseInt(process.env.NEBULA_PORT || '9669'),
        username: process.env.NEBULA_USERNAME,
        password: process.env.NEBULA_PASSWORD,
        space: process.env.NEBULA_SPACE
      },
      embedding: {
        provider: process.env.EMBEDDING_PROVIDER,
        openai: {
          apiKey: process.env.OPENAI_API_KEY,
          baseUrl: process.env.OPENAI_BASE_URL,
          model: process.env.OPENAI_MODEL,
          dimensions: parseInt(process.env.OPENAI_DIMENSIONS || '1536')
        },
        ollama: {
          baseUrl: process.env.OLLAMA_BASE_URL,
          model: process.env.OLLAMA_MODEL,
          dimensions: parseInt(process.env.OLLAMA_DIMENSIONS || '768')
        },
        gemini: {
          apiKey: process.env.GEMINI_API_KEY,
          baseUrl: process.env.GEMINI_BASE_URL,
          model: process.env.GEMINI_MODEL,
          dimensions: parseInt(process.env.GEMINI_DIMENSIONS || '768')
        },
        mistral: {
          apiKey: process.env.MISTRAL_API_KEY,
          baseUrl: process.env.MISTRAL_BASE_URL,
          model: process.env.MISTRAL_MODEL,
          dimensions: parseInt(process.env.MISTRAL_DIMENSIONS || '1024')
        },
        siliconflow: {
          apiKey: process.env.SILICONFLOW_API_KEY,
          baseUrl: process.env.SILICONFLOW_BASE_URL,
          model: process.env.SILICONFLOW_MODEL,
          dimensions: parseInt(process.env.SILICONFLOW_DIMENSIONS || '1024')
        },
        custom: {
          custom1: {
            apiKey: process.env.CUSTOM_CUSTOM1_API_KEY,
            baseUrl: process.env.CUSTOM_CUSTOM1_BASE_URL,
            model: process.env.CUSTOM_CUSTOM1_MODEL,
            dimensions: process.env.CUSTOM_CUSTOM1_DIMENSIONS ? parseInt(process.env.CUSTOM_CUSTOM1_DIMENSIONS) : undefined
          },
          custom2: {
            apiKey: process.env.CUSTOM_CUSTOM2_API_KEY,
            baseUrl: process.env.CUSTOM_CUSTOM2_BASE_URL,
            model: process.env.CUSTOM_CUSTOM2_MODEL,
            dimensions: process.env.CUSTOM_CUSTOM2_DIMENSIONS ? parseInt(process.env.CUSTOM_CUSTOM2_DIMENSIONS) : undefined
          },
          custom3: {
            apiKey: process.env.CUSTOM_CUSTOM3_API_KEY,
            baseUrl: process.env.CUSTOM_CUSTOM3_BASE_URL,
            model: process.env.CUSTOM_CUSTOM3_MODEL,
            dimensions: process.env.CUSTOM_CUSTOM3_DIMENSIONS ? parseInt(process.env.CUSTOM_CUSTOM3_DIMENSIONS) : undefined
          }
        },
        qualityWeight: process.env.QUALITY_WEIGHT ? parseFloat(process.env.QUALITY_WEIGHT) : undefined,
        performanceWeight: process.env.PERFORMANCE_WEIGHT ? parseFloat(process.env.PERFORMANCE_WEIGHT) : undefined
      },
      logging: {
        level: process.env.LOG_LEVEL,
        format: process.env.LOG_FORMAT
      },
      monitoring: {
        enabled: process.env.ENABLE_METRICS === 'true',
        port: parseInt(process.env.METRICS_PORT || '9090')
      },
      fileProcessing: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
        supportedExtensions: process.env.SUPPORTED_EXTENSIONS,
        indexBatchSize: parseInt(process.env.INDEX_BATCH_SIZE || '100'),
        chunkSize: parseInt(process.env.CHUNK_SIZE || '1000'),
        overlapSize: parseInt(process.env.OVERLAP_SIZE || '200')
      },
      batchProcessing: {
        enabled: process.env.BATCH_PROCESSING_ENABLED !== 'false',
        maxConcurrentOperations: parseInt(process.env.MAX_CONCURRENT_OPERATIONS || '5'),
        defaultBatchSize: parseInt(process.env.DEFAULT_BATCH_SIZE || '50'),
        maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || '500'),
        memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD || '80'),
        processingTimeout: parseInt(process.env.PROCESSING_TIMEOUT || '300000'),
        retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
        retryDelay: parseInt(process.env.RETRY_DELAY || '1000'),
        continueOnError: process.env.CONTINUE_ON_ERROR !== 'false',
        adaptiveBatching: {
          enabled: process.env.ADAPTIVE_BATCHING_ENABLED !== 'false',
          minBatchSize: parseInt(process.env.MIN_BATCH_SIZE || '10'),
          maxBatchSize: parseInt(process.env.ADAPTIVE_MAX_BATCH_SIZE || '200'),
          performanceThreshold: parseInt(process.env.PERFORMANCE_THRESHOLD || '1000'),
          adjustmentFactor: parseFloat(process.env.ADJUSTMENT_FACTOR || '1.2')
        },
        monitoring: {
          enabled: process.env.BATCH_MONITORING_ENABLED !== 'false',
          metricsInterval: parseInt(process.env.METRICS_INTERVAL || '60000'),
          alertThresholds: {
            highLatency: parseInt(process.env.HIGH_LATENCY_THRESHOLD || '5000'),
            lowThroughput: parseInt(process.env.LOW_THROUGHPUT_THRESHOLD || '10'),
            highErrorRate: parseFloat(process.env.HIGH_ERROR_RATE_THRESHOLD || '0.1'),
            highMemoryUsage: parseInt(process.env.HIGH_MEMORY_USAGE_THRESHOLD || '80'),
            criticalMemoryUsage: parseInt(process.env.CRITICAL_MEMORY_USAGE_THRESHOLD || '90'),
            highCpuUsage: parseInt(process.env.HIGH_CPU_USAGE_THRESHOLD || '70'),
            criticalCpuUsage: parseInt(process.env.CRITICAL_CPU_USAGE_THRESHOLD || '85')
          }
        }
      },
      caching: process.env.CACHE_DEFAULT_TTL || process.env.CACHE_MAX_SIZE ? {
        defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '300'),
        maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000')
      } : undefined,
      indexing: {
        batchSize: parseInt(process.env.INDEXING_BATCH_SIZE || '50'),
        maxConcurrency: parseInt(process.env.INDEXING_MAX_CONCURRENCY || '3')
      },
      semgrep: {
        binaryPath: process.env.SEMGREP_BINARY_PATH || 'semgrep',
        timeout: parseInt(process.env.SEMGREP_TIMEOUT || '30000'),
        maxMemory: parseInt(process.env.SEMGREP_MAX_MEMORY || '512'),
        maxTargetBytes: parseInt(process.env.SEMGREP_MAX_TARGET_BYTES || '1000000'),
        jobs: parseInt(process.env.SEMGREP_JOBS || '4'),
        noGitIgnore: process.env.SEMGREP_NO_GIT_IGNORE === 'true',
        noRewriteRuleIds: process.env.SEMGREP_NO_REWRITE_RULE_IDS === 'true',
        strict: process.env.SEMGREP_STRICT === 'true',
        configPaths: process.env.SEMGREP_CONFIG_PATHS ? process.env.SEMGREP_CONFIG_PATHS.split(',') : [
          'auto',
          'p/security-audit',
          'p/secrets',
          'p/owasp-top-ten',
          'p/javascript',
          'p/python',
          'p/java',
          'p/go',
          'p/typescript'
        ],
        customRulesPath: process.env.SEMGREP_CUSTOM_RULES_PATH || './rules/semgrep',
        enableControlFlow: process.env.SEMGREP_ENABLE_CONTROL_FLOW !== 'false',
        enableDataFlow: process.env.SEMGREP_ENABLE_DATA_FLOW !== 'false',
        enableTaintAnalysis: process.env.SEMGREP_ENABLE_TAINT_ANALYSIS !== 'false',
        securitySeverity: process.env.SEMGREP_SECURITY_SEVERITY ?
          process.env.SEMGREP_SECURITY_SEVERITY.split(',') : ['HIGH', 'MEDIUM'],
        outputFormat: (process.env.SEMGREP_OUTPUT_FORMAT as 'json' | 'sarif' | 'text') || 'json',
        excludePatterns: process.env.SEMGREP_EXCLUDE_PATTERNS ? process.env.SEMGREP_EXCLUDE_PATTERNS.split(',') : [
          'node_modules',
          '.git',
          'dist',
          'build',
          'coverage',
          '*.min.js',
          '*.min.css',
          'vendor',
          'test/fixtures',
          'tests/fixtures'
        ],
        includePatterns: process.env.SEMGREP_INCLUDE_PATTERNS ? process.env.SEMGREP_INCLUDE_PATTERNS.split(',') : [
          '*.js',
          '*.ts',
          '*.jsx',
          '*.tsx',
          '*.py',
          '*.java',
          '*.go',
          '*.php',
          '*.rb',
          '*.cs'
        ],
        severityLevels: process.env.SEMGREP_SEVERITY_LEVELS ? process.env.SEMGREP_SEVERITY_LEVELS.split(',') : ['ERROR', 'WARNING', 'INFO'],
        enhancedRulesPath: process.env.SEMGREP_ENHANCED_RULES_PATH || './enhanced-rules'
      },
      mlReranking: process.env.ML_RERANKING_MODEL_PATH || process.env.ML_RERANKING_MODEL_TYPE || process.env.ML_RERANKING_FEATURES || process.env.ML_RERANKING_TRAINING_ENABLED ? {
      modelPath: process.env.ML_RERANKING_MODEL_PATH || undefined,
      modelType: (process.env.ML_RERANKING_MODEL_TYPE as 'linear' | 'neural' | 'ensemble') || 'linear',
      features: process.env.ML_RERANKING_FEATURES ? process.env.ML_RERANKING_FEATURES.split(',') : [
        'semanticScore',
        'graphScore',
        'contextualScore',
        'recencyScore',
        'popularityScore',
        'originalScore'
      ],
      trainingEnabled: process.env.ML_RERANKING_TRAINING_ENABLED !== 'false'
    } : undefined
    };

    const { error, value } = configSchema.validate(rawConfig, { allowUnknown: false });
    
    if (error) {
      throw new Error(`Configuration validation error: ${error.message}`);
    }

    this.config = value;
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  getAll(): Config {
    return { ...this.config };
  }
}
```

### 9. 控制器 (controllers/)

**MonitoringController.ts** - 监控控制器
```typescript
import { injectable, inject } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { PrometheusMetricsService } from '../services/monitoring/PrometheusMetricsService';
import { HealthCheckService } from '../services/monitoring/HealthCheckService';
import { PerformanceAnalysisService } from '../services/monitoring/PerformanceAnalysisService';

@injectable()
export class MonitoringController {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private prometheusMetricsService: PrometheusMetricsService;
  private healthCheckService: HealthCheckService;
  private performanceAnalysisService: PerformanceAnalysisService;

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(PrometheusMetricsService) prometheusMetricsService: PrometheusMetricsService,
    @inject(HealthCheckService) healthCheckService: HealthCheckService,
    @inject(PerformanceAnalysisService) performanceAnalysisService: PerformanceAnalysisService
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.prometheusMetricsService = prometheusMetricsService;
    this.healthCheckService = healthCheckService;
    this.performanceAnalysisService = performanceAnalysisService;

    this.logger.info('Monitoring controller initialized');
  }

  async getHealthStatus(): Promise<any> {
    try {
      const healthStatus = await this.healthCheckService.performHealthCheck();
      return {
        success: true,
        data: healthStatus
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get health status: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'MonitoringController', operation: 'getHealthStatus' }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getMetrics(): Promise<any> {
    try {
      const metrics = await this.prometheusMetricsService.collectAllMetrics();
      return {
        success: true,
        data: metrics
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get metrics: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'MonitoringController', operation: 'getMetrics' }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getPerformanceReport(period?: { start: string; end: string }): Promise<any> {
    try {
      // Default to last 24 hours if no period specified
      const endDate = new Date();
      const startDate = period
        ? new Date(period.start)
        : new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
      
      const endDateObj = period
        ? new Date(period.end)
        : endDate;

      const report = await this.performanceAnalysisService.generatePerformanceReport({
        start: startDate,
        end: endDateObj
      });

      return {
        success: true,
        data: report
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get performance report: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'MonitoringController', operation: 'getPerformanceReport' }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getBottlenecks(): Promise<any> {
    try {
      const bottlenecks = await this.performanceAnalysisService.identifyBottlenecksInRealTime();
      return {
        success: true,
        data: bottlenecks
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get bottlenecks: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'MonitoringController', operation: 'getBottlenecks' }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getCapacityPlan(): Promise<any> {
    try {
      const capacityPlan = await this.performanceAnalysisService.generateCapacityPlan();
      return {
        success: true,
        data: capacityPlan
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get capacity plan: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'MonitoringController', operation: 'getCapacityPlan' }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getDependencies(): Promise<any> {
    try {
      const dependencies = await this.healthCheckService.checkDependencies();
      return {
        success: true,
        data: dependencies
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get dependencies: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'MonitoringController', operation: 'getDependencies' }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getBenchmark(): Promise<any> {
    try {
      const benchmark = await this.performanceAnalysisService.benchmarkPerformance();
      return {
        success: true,
        data: benchmark
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get benchmark: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'MonitoringController', operation: 'getBenchmark' }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  getMetricsEndpoint(): string {
    return this.prometheusMetricsService.getMetricsEndpoint();
  }
}
```

**SnippetController.ts** - 代码片段控制器
```typescript
import { injectable, inject } from 'inversify';
import { IndexService } from '../services/indexing/IndexService';
import { IndexCoordinator } from '../services/indexing/IndexCoordinator';
import { StorageCoordinator } from '../services/storage/StorageCoordinator';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { ConfigService } from '../config/ConfigService';
import { HashUtils } from '../utils/HashUtils';

@injectable()
export class SnippetController {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private indexService: IndexService;
  private indexCoordinator: IndexCoordinator;
  private storageCoordinator: StorageCoordinator;

  constructor(
    @inject(ConfigService) configService: ConfigService,
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(IndexService) indexService: IndexService,
    @inject(IndexCoordinator) indexCoordinator: IndexCoordinator,
    @inject(StorageCoordinator) storageCoordinator: StorageCoordinator
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.indexService = indexService;
    this.indexCoordinator = indexCoordinator;
    this.storageCoordinator = storageCoordinator;

    this.logger.info('Snippet controller initialized');
  }

  /**
   * Search for snippets using vector and graph search
   */
  async searchSnippets(query: string, options: {
    projectId?: string;
    limit?: number;
    offset?: number;
    filters?: Record<string, any>;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<any> {
    try {
      this.logger.info('Searching snippets', { query, options });
      
      // Extract projectId from options or use default
      const projectId = options.projectId || 'default';
      
      // Use the index service to perform the search
      const results = await this.indexService.search(query, projectId, { ...options, searchType: 'snippet' });
      
      return {
        success: true,
        data: results
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to search snippets: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'SnippetController', operation: 'searchSnippets', metadata: { query, options } }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get snippet by ID
   */
  async getSnippetById(snippetId: string, projectId: string): Promise<any> {
    try {
      this.logger.info('Getting snippet by ID', { snippetId, projectId });
      
      // In a real implementation, this would query the storage for the snippet
      // For now, we'll return mock data
      const mockSnippet = {
        id: snippetId,
        content: `// Mock content for snippet ${snippetId}`,
        filePath: `/mock/path/to/file_${snippetId}.ts`,
        startLine: 1,
        endLine: 10,
        language: 'typescript',
        metadata: {
          projectId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };
      
      return {
        success: true,
        data: mockSnippet
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get snippet by ID: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'SnippetController', operation: 'getSnippetById', metadata: { snippetId, projectId } }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get snippet processing status
   */
  async getSnippetProcessingStatus(projectId: string): Promise<any> {
    try {
      this.logger.info('Getting snippet processing status', { projectId });
      
      // Delegate to index coordinator
      const status = await this.indexCoordinator.getSnippetProcessingStatus(projectId);
      
      return {
        success: true,
        data: status
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get snippet processing status: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'SnippetController', operation: 'getSnippetProcessingStatus', metadata: { projectId } }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Check for duplicate snippets
   */
  async checkForDuplicates(snippetContent: string, projectId: string): Promise<any> {
    try {
      this.logger.info('Checking for duplicate snippets', { projectId });
      
      // Calculate content hash
      const contentHash = HashUtils.calculateStringHash(snippetContent);
      
      // Delegate to index coordinator
      const isDuplicate = await this.indexCoordinator.checkForDuplicates(snippetContent, projectId);
      
      return {
        success: true,
        data: {
          isDuplicate,
          contentHash
        }
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to check for duplicates: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'SnippetController', operation: 'checkForDuplicates', metadata: { projectId } }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Detect cross-references between snippets
   */
  async detectCrossReferences(snippetId: string, projectId: string): Promise<any> {
    try {
      this.logger.info('Detecting cross-references', { snippetId, projectId });
      
      // Delegate to index coordinator
      const references = await this.indexCoordinator.detectCrossReferences(projectId);
      
      return {
        success: true,
        data: references
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to detect cross-references: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'SnippetController', operation: 'detectCrossReferences', metadata: { snippetId, projectId } }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Analyze snippet dependencies
   */
  async analyzeDependencies(snippetId: string, projectId: string): Promise<any> {
    try {
      this.logger.info('Analyzing dependencies', { snippetId, projectId });
      
      // Delegate to index coordinator
      const dependencies = await this.indexCoordinator.analyzeDependencies(projectId);
      
      return {
        success: true,
        data: dependencies
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to analyze dependencies: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'SnippetController', operation: 'analyzeDependencies', metadata: { snippetId, projectId } }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Detect overlapping snippets
   */
  async detectOverlaps(snippetId: string, projectId: string): Promise<any> {
    try {
      this.logger.info('Detecting overlaps', { snippetId, projectId });
      
      // Delegate to index coordinator
      const overlaps = await this.indexCoordinator.detectOverlaps(projectId);
      
      return {
        success: true,
        data: overlaps
      };
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to detect overlaps: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'SnippetController', operation: 'detectOverlaps', metadata: { snippetId, projectId } }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
```

## 📋 配置文件

### package.json 配置
```json
{
  "name": "codebase-index-mcp",
  "version": "1.0.0",
  "description": "Intelligent codebase indexing and analysis MCP service",
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/main.js",
    "dev": "ts-node src/main.ts",
    "dev:memory": "node --max-old-space-size=2048 node_modules/ts-node/dist/bin.js src/main.ts",
    "start:memory": "node --max-old-space-size=4096 dist/main.js",
    "start:memory-optimized": "dotenv -e .env.memory-optimized node --max-old-space-size=4096 dist/main.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:lsp": "tsx scripts/test-lsp-simple.ts",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write \"src/**/*.{ts,js}\"",
    "format:check": "prettier --check \"src/**/*.{ts,js}\"",
    "prepare": "husky install",
    "clean": "rimraf dist coverage",
    "docker:build": "docker build -t codebase-index-mcp .",
    "docker:dev": "docker-compose -f docker-compose.dev.yml up",
    "docker:prod": "docker-compose up"
  },
  "keywords": [
    "mcp",
    "code-indexing",
    "semantic-search",
    "code-analysis",
    "vector-database",
    "graph-database"
  ],
  "author": "Codebase Index Team",
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.17.4",
    "@nebula-contrib/nebula-nodejs": "^3.0.3",
    "@qdrant/js-client-rest": "^1.15.1",
    "cache-manager": "^7.2.0",
    "cache-manager-ioredis": "^2.1.0",
    "chokidar": "^4.0.3",
    "dotenv": "^17.2.1",
    "express": "^5.1.0",
    "inversify": "^7.9.1",
    "ioredis": "^5.7.0",
    "joi": "^18.0.1",
    "neo4j-driver": "^5.28.1",
    "openai": "^5.16.0",
    "prom-client": "^15.1.3",
    "redis": "^5.8.2",
    "reflect-metadata": "~0.2.2",
    "tree-sitter": "^0.25.0",
    "tree-sitter-cpp": "^0.23.4",
    "tree-sitter-go": "^0.25.0",
    "tree-sitter-java": "^0.23.5",
    "tree-sitter-javascript": "^0.23.1",
    "tree-sitter-python": "^0.23.6",
    "tree-sitter-rust": "^0.24.0",
    "tree-sitter-typescript": "^0.23.2",
    "typescript-language-server": "^4.3.3",
    "vscode-langservers-extracted": "^4.10.0",
    "vscode-languageclient": "^9.0.1",
    "vscode-languageserver-protocol": "^3.17.5",
    "winston": "^3.17.0"
  },
  "devDependencies": {
    "@types/cache-manager": "^4.0.6",
    "@types/express": "^5.0.3",
    "@types/jest": "^30.0.0",
    "@types/node": "^24.3.0",
    "@types/redis": "^4.0.10",
    "@types/supertest": "^6.0.3",
    "@typescript-eslint/eslint-plugin": "^8.41.0",
    "@typescript-eslint/parser": "^8.41.0",
    "eslint": "^9.34.0",
    "husky": "^9.1.7",
    "jest": "^30.1.1",
    "lint-staged": "^16.1.5",
    "prettier": "^3.6.2",
    "rimraf": "^6.0.1",
    "supertest": "^7.1.4",
    "ts-jest": "^29.4.1",
    "ts-node": "^10.9.2",
    "tsx": "^4.20.5",
    "typescript": "^5.9.2",
    "ws": "^8.18.3"
  },
  "engines": {
    "node": ">=18.0"
  }
}
```

### Docker 配置

**Dockerfile** - 生产环境Docker镜像配置
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S codebase -u 1001

# Change ownership
USER codebase

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]
```

**Dockerfile.dev** - 开发环境Docker镜像配置
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S codebase -u 1001

# Change ownership
USER codebase

# Expose port
EXPOSE 3000

# Start the application in development mode
CMD ["npm", "run", "dev"]
```

## 🚀 部署和运行

### 本地开发
```bash
# 克隆项目
git clone <repository-url>
cd codebase-index-mcp

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑.env文件配置必要的参数

# 启动依赖服务
docker-compose up -d qdrant nebula-graph nebula-metad nebula-storaged

# 开发模式运行
npm run dev

# 或者构建后运行
npm run build
npm start
```

### 生产部署
```bash
# 构建生产版本
npm run build

# 使用Docker部署
docker-compose up -d

# 或者使用PM2进程管理
npm install -g pm2
pm2 start dist/main.js --name "codebase-index-mcp"
```

## 🔌 Kode CLI集成

### Kode配置
在Kode CLI的配置文件中添加MCP服务器连接：

```json
{
  "mcpServers": {
    "codebase-index": {
      "command": "node",
      "args": ["/path/to/codebase-index-mcp/dist/main.js"],
      "env": {
        "MCP_PORT": "8000",
        "QDRANT_URL": "http://localhost:6333",
        "NEBULA_HOST": "localhost",
        "NEBULA_PORT": "9669",
        "NEBULA_USERNAME": "root",
        "NEBULA_PASSWORD": "nebula",
        "NEBULA_SPACE": "codebase_index",
        "OPENAI_API_KEY": "your-api-key"
      }
    }
  }
}
```

### 使用示例
Kode CLI通过MCP协议调用服务：

```bash
# 搜索代码
kode search "function definition"

# 索引代码库
kode index /path/to/project

# 分析代码结构  
kode analyze /path/to/project

# 导入自定义规则
kode import-rule javascript ./custom-rules/js-rules.json
```

## 📊 监控和日志

### 日志配置
```typescript
// src/core/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

### 跨数据库健康检查
```typescript
// 添加增强型健康检查端点
server.setResourceHandler('health', async () => {
  const status = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      qdrant: await this.checkQdrantHealth(),
      nebulaGraph: await this.checkNebulaGraphHealth(),
      openai: await this.checkOpenAIHealth(),
      sync: await this.checkCrossDatabaseSync()
    },
    metrics: {
      qdrantLatency: await this.getQdrantLatency(),
      nebulaGraphLatency: await this.getNebulaGraphLatency(),
      syncDelay: await this.getSyncDelay()
    }
  };
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(status, null, 2)
    }]
  };
});
```

### 综合监控仪表板
```typescript
// src/services/monitoring/MonitoringDashboard.ts
export class MonitoringDashboard {
  private prometheusClient: PrometheusClient;
  private grafanaClient: GrafanaClient;
  
  async initialize(): Promise<void> {
    // 初始化跨数据库监控指标
    this.setupCrossDatabaseMetrics();
    this.setupQueryCoordinationMetrics();
    this.setupSyncMetrics();
  }
  
  private setupCrossDatabaseMetrics(): void {
    // Qdrant性能指标
    new Prometheus.Gauge({
      name: 'qdrant_search_latency_seconds',
      help: 'Qdrant search latency in seconds',
      labelNames: ['operation', 'status']
    });
    
    // NebulaGraph性能指标
    new Prometheus.Gauge({
      name: 'nebula_graph_query_latency_seconds',
      help: 'NebulaGraph query latency in seconds',
      labelNames: ['query_type', 'status']
    });
    
    // 跨数据库协调指标
    new Prometheus.Gauge({
      name: 'cross_database_sync_delay_seconds',
      help: 'Cross-database synchronization delay in seconds'
    });
  }
  
  private setupQueryCoordinationMetrics(): void {
    // 查询融合性能
    new Prometheus.Histogram({
      name: 'query_fusion_duration_seconds',
      help: 'Query fusion processing time in seconds',
      buckets: [0.1, 0.5, 1.0, 2.0, 5.0]
    });
    
    // 结果缓存命中率
    new Prometheus.Gauge({
      name: 'query_cache_hit_rate',
      help: 'Query cache hit rate percentage'
    });
  }
  
  private setupSyncMetrics(): void {
    // 同步操作计数
    new Prometheus.Counter({
      name: 'sync_operations_total',
      help: 'Total number of sync operations',
      labelNames: ['operation_type', 'status']
    });
    
    // 一致性检查结果
    new Prometheus.Gauge({
      name: 'consistency_check_status',
      help: 'Consistency check status (1=consistent, 0=inconsistent)'
    });
  }
}
```

### 智能警报系统
```typescript
// src/services/monitoring/AlertManager.ts
export class AlertManager {
  private alertRules: AlertRule[] = [
    {
      name: 'qdrant_latency_high',
      condition: 'qdrant_search_latency_seconds > 1.0',
      severity: 'warning',
      message: 'Qdrant search latency is high'
    },
    {
      name: 'nebula_graph_latency_high',
      condition: 'nebula_graph_query_latency_seconds > 2.0',
      severity: 'warning',
      message: 'NebulaGraph query latency is high'
    },
    {
      name: 'sync_delay_critical',
      condition: 'cross_database_sync_delay_seconds > 30',
      severity: 'critical',
      message: 'Cross-database sync delay is critical'
    },
    {
      name: 'consistency_failed',
      condition: 'consistency_check_status == 0',
      severity: 'critical',
      message: 'Database consistency check failed'
    }
  ];
  
  async evaluateAlerts(metrics: MetricsData): Promise<Alert[]> {
    const alerts: Alert[] = [];
    
    for (const rule of this.alertRules) {
      if (this.evaluateCondition(rule.condition, metrics)) {
        alerts.push({
          ...rule,
          timestamp: new Date().toISOString(),
          metrics: this.extractRelevantMetrics(rule.condition, metrics)
        });
      }
    }
    
    return alerts;
  }
}
```

这个项目结构提供了完整的MCP服务实现，与Kode CLI完全分离，通过标准MCP协议进行通信，支持代码索引、搜索、结构分析和规则导入等功能。