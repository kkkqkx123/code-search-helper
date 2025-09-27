import { EventEmitter } from 'events';
import { LSPClient } from './LSPClient';
import { LSPClientPool } from './LSPClientPool';
import { LanguageServerRegistry } from './LanguageServerRegistry';
import { LSPErrorHandler, globalErrorHandler } from './LSPErrorHandler';

export interface LSPManagerConfig {
  enableLSP?: boolean;
  poolConfig?: {
    maxConnections?: number;
    initialConnections?: number;
    idleTimeout?: number;
  };
  errorConfig?: {
    maxRestarts?: number;
    fallbackToTreesitter?: boolean;
  };
}

export interface LSPDiagnosticsResult {
  filePath: string;
  diagnostics: Array<{
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    severity?: number;
    message: string;
    source?: string;
    code?: string | number;
  }>;
}

export interface LSPSymbolsResult {
  filePath: string;
  symbols: Array<{
    name: string;
    kind: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    detail?: string;
  }>;
}

export class LSPManager extends EventEmitter {
  private static instance: LSPManager;
  private pool: LSPClientPool;
  private registry: LanguageServerRegistry;
  private errorHandler: LSPErrorHandler;
  private isInitialized = false;
  private config: Required<LSPManagerConfig>;

  constructor(config: LSPManagerConfig = {}) {
    super();

    this.config = {
      enableLSP: config.enableLSP ?? true,
      poolConfig: {
        maxConnections: config.poolConfig?.maxConnections ?? 10,
        initialConnections: config.poolConfig?.initialConnections ?? 2,
        idleTimeout: config.poolConfig?.idleTimeout ?? 300000,
      },
      errorConfig: {
        maxRestarts: config.errorConfig?.maxRestarts ?? 5,
        fallbackToTreesitter: config.errorConfig?.fallbackToTreesitter ?? true,
      },
    };

    this.pool = new LSPClientPool(this.config.poolConfig);
    this.registry = LanguageServerRegistry.getInstance();
    this.errorHandler = globalErrorHandler;

    this.setupEventHandlers();
  }

  static getInstance(config?: LSPManagerConfig): LSPManager {
    if (!LSPManager.instance) {
      LSPManager.instance = new LSPManager(config);
    }
    return LSPManager.instance;
  }

  private setupEventHandlers(): void {
    this.pool.on('clientCreated', data => {
      this.emit('clientCreated', data);
    });

    this.pool.on('clientDestroyed', data => {
      this.emit('clientDestroyed', data);
    });

    this.pool.on('error', error => {
      this.emit('error', error);
    });

    this.errorHandler.on('errorHandled', data => {
      this.emit('errorHandled', data);
    });
  }

  async initialize(workspaceRoot: string): Promise<boolean> {
    if (!this.config.enableLSP) {
      this.emit('warning', 'LSP is disabled by configuration');
      return false;
    }

    try {
      const language = this.registry.detectProjectLanguage(workspaceRoot);

      if (!language) {
        this.emit('warning', `No supported language detected for ${workspaceRoot}`);
        return false;
      }

      if (!this.registry.isLanguageSupported(language.language)) {
        this.emit('warning', `Language ${language.language} is not enabled`);
        return false;
      }

      // 预加载连接池
      await this.pool.preload(workspaceRoot);

      this.isInitialized = true;
      this.emit('initialized', { workspaceRoot, language: language.language });

      return true;
    } catch (error) {
      const context = this.errorHandler.createErrorContext(
        error as Error,
        workspaceRoot,
        'unknown',
        'initialize'
      );

      await this.errorHandler.handleError(context);
      this.emit('error', error);

      return false;
    }
  }

  async getDiagnostics(
    filePath: string,
    projectPath?: string
  ): Promise<LSPDiagnosticsResult | null> {
    if (!this.isInitialized) {
      return null;
    }

    const workspaceRoot = projectPath || this.findWorkspaceRoot(filePath);
    if (!workspaceRoot) {
      return null;
    }

    let client: LSPClient | null = null;

    try {
      client = await this.pool.acquire(workspaceRoot);

      const diagnostics = await client.getDiagnostics(filePath);

      return {
        filePath,
        diagnostics: diagnostics.map(d => ({
          range: d.range,
          severity: d.severity,
          message: d.message,
          source: d.source,
          code: d.code,
        })),
      };
    } catch (error) {
      const language = this.registry.detectProjectLanguage(workspaceRoot);
      const context = this.errorHandler.createErrorContext(
        error as Error,
        workspaceRoot,
        language?.language || 'unknown',
        'getDiagnostics',
        filePath
      );

      await this.errorHandler.handleError(context);
      return null;
    } finally {
      if (client) {
        await this.pool.release(client);
      }
    }
  }

  async getSymbols(filePath: string, projectPath?: string): Promise<LSPSymbolsResult | null> {
    if (!this.isInitialized) {
      return null;
    }

    const workspaceRoot = projectPath || this.findWorkspaceRoot(filePath);
    if (!workspaceRoot) {
      return null;
    }

    let client: LSPClient | null = null;

    try {
      client = await this.pool.acquire(workspaceRoot);

      const symbols = await client.getDocumentSymbols(filePath);

      return {
        filePath,
        symbols: symbols.map(s => ({
          name: s.name,
          kind: this.getSymbolKindName(s.kind),
          range: s.range,
          detail: s.detail,
        })),
      };
    } catch (error) {
      const language = this.registry.detectProjectLanguage(workspaceRoot);
      const context = this.errorHandler.createErrorContext(
        error as Error,
        workspaceRoot,
        language?.language || 'unknown',
        'getSymbols',
        filePath
      );

      await this.errorHandler.handleError(context);
      return null;
    } finally {
      if (client) {
        await this.pool.release(client);
      }
    }
  }

  async getWorkspaceSymbols(
    query: string,
    projectPath: string
  ): Promise<Array<{
    name: string;
    kind: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    detail?: string;
    filePath: string;
  }> | null> {
    if (!this.isInitialized) {
      return null;
    }

    let client: LSPClient | null = null;

    try {
      client = await this.pool.acquire(projectPath);

      const symbols = await client.getWorkspaceSymbols(query);

      return symbols.map(s => ({
        name: s.name,
        kind: this.getSymbolKindName(s.kind),
        range: s.location ? s.location.range : s.range,
        detail: s.detail,
        filePath: s.location ? s.location.uri.replace('file://', '') : projectPath,
      }));
    } catch (error) {
      const language = this.registry.detectProjectLanguage(projectPath);
      const context = this.errorHandler.createErrorContext(
        error as Error,
        projectPath,
        language?.language || 'unknown',
        'getWorkspaceSymbols',
        query
      );

      await this.errorHandler.handleError(context);
      return null;
    } finally {
      if (client) {
        await this.pool.release(client);
      }
    }
  }

  async getDefinition(
    filePath: string,
    position: { line: number; character: number },
    projectPath?: string
  ): Promise<Array<{
    targetUri: string;
    targetRange: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    targetSelectionRange?: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  }> | null> {
    if (!this.isInitialized) {
      return null;
    }

    const workspaceRoot = projectPath || this.findWorkspaceRoot(filePath);
    if (!workspaceRoot) {
      return null;
    }

    let client: LSPClient | null = null;

    try {
      client = await this.pool.acquire(workspaceRoot);

      const definitions = await client.getDefinition(filePath, position);

      return definitions.map(d => ({
        targetUri: filePath,
        targetRange: d.range,
        targetSelectionRange: d.selectionRange,
      }));
    } catch (error) {
      const language = this.registry.detectProjectLanguage(workspaceRoot);
      const context = this.errorHandler.createErrorContext(
        error as Error,
        workspaceRoot,
        language?.language || 'unknown',
        'getDefinition',
        filePath
      );

      await this.errorHandler.handleError(context);
      return null;
    } finally {
      if (client) {
        await this.pool.release(client);
      }
    }
  }

  async getReferences(
    filePath: string,
    position: { line: number; character: number },
    projectPath?: string
  ): Promise<Array<{
    uri: string;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  }> | null> {
    if (!this.isInitialized) {
      return null;
    }

    const workspaceRoot = projectPath || this.findWorkspaceRoot(filePath);
    if (!workspaceRoot) {
      return null;
    }

    let client: LSPClient | null = null;

    try {
      client = await this.pool.acquire(workspaceRoot);

      const references = await client.getReferences(filePath, position);

      return references.map(r => ({
        uri: filePath,
        range: r.range,
      }));
    } catch (error) {
      const language = this.registry.detectProjectLanguage(workspaceRoot);
      const context = this.errorHandler.createErrorContext(
        error as Error,
        workspaceRoot,
        language?.language || 'unknown',
        'getReferences',
        filePath
      );

      await this.errorHandler.handleError(context);
      return null;
    } finally {
      if (client) {
        await this.pool.release(client);
      }
    }
  }

  async getTypeDefinition(
    filePath: string,
    position: { line: number; character: number },
    projectPath?: string
  ): Promise<Array<{
    targetUri: string;
    targetRange: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    targetSelectionRange?: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  }> | null> {
    if (!this.isInitialized) {
      return null;
    }

    const workspaceRoot = projectPath || this.findWorkspaceRoot(filePath);
    if (!workspaceRoot) {
      return null;
    }

    let client: LSPClient | null = null;

    try {
      client = await this.pool.acquire(workspaceRoot);

      const typeDefinitions = await client.getTypeDefinition(filePath, position);

      return typeDefinitions.map(d => ({
        targetUri: filePath,
        targetRange: d.range,
        targetSelectionRange: d.selectionRange,
      }));
    } catch (error) {
      const language = this.registry.detectProjectLanguage(workspaceRoot);
      const context = this.errorHandler.createErrorContext(
        error as Error,
        workspaceRoot,
        language?.language || 'unknown',
        'getTypeDefinition',
        filePath
      );

      await this.errorHandler.handleError(context);
      return null;
    } finally {
      if (client) {
        await this.pool.release(client);
      }
    }
  }

  async getImplementation(
    filePath: string,
    position: { line: number; character: number },
    projectPath?: string
  ): Promise<Array<{
    targetUri: string;
    targetRange: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    targetSelectionRange?: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  }> | null> {
    if (!this.isInitialized) {
      return null;
    }

    const workspaceRoot = projectPath || this.findWorkspaceRoot(filePath);
    if (!workspaceRoot) {
      return null;
    }

    let client: LSPClient | null = null;

    try {
      client = await this.pool.acquire(workspaceRoot);

      const implementations = await client.getImplementation(filePath, position);

      return implementations.map(d => ({
        targetUri: filePath,
        targetRange: d.range,
        targetSelectionRange: d.selectionRange,
      }));
    } catch (error) {
      const language = this.registry.detectProjectLanguage(workspaceRoot);
      const context = this.errorHandler.createErrorContext(
        error as Error,
        workspaceRoot,
        language?.language || 'unknown',
        'getImplementation',
        filePath
      );

      await this.errorHandler.handleError(context);
      return null;
    } finally {
      if (client) {
        await this.pool.release(client);
      }
    }
  }

  getActiveLanguageServer(filePath: string): string | undefined {
    const workspaceRoot = this.findWorkspaceRoot(filePath);
    if (!workspaceRoot) {
      return undefined;
    }

    const language = this.registry.detectProjectLanguage(workspaceRoot);
    return language?.language;
  }

  private getSymbolKindName(kind: number): string {
    const symbolKinds: Record<number, string> = {
      1: 'File',
      2: 'Module',
      3: 'Namespace',
      4: 'Package',
      5: 'Class',
      6: 'Method',
      7: 'Property',
      8: 'Field',
      9: 'Constructor',
      10: 'Enum',
      11: 'Interface',
      12: 'Function',
      13: 'Variable',
      14: 'Constant',
      15: 'String',
      16: 'Number',
      17: 'Boolean',
      18: 'Array',
      19: 'Object',
      20: 'Key',
      21: 'Null',
      22: 'EnumMember',
      23: 'Struct',
      24: 'Event',
      25: 'Operator',
      26: 'TypeParameter',
    };

    return symbolKinds[kind] || 'Unknown';
  }

  private findWorkspaceRoot(filePath: string): string | null {
    // 简化的工作空间检测
    const parts = filePath.split(path.sep);
    for (let i = parts.length - 1; i >= 0; i--) {
      const dirPath = parts.slice(0, i + 1).join(path.sep);
      if (
        fs.existsSync(path.join(dirPath, 'package.json')) ||
        fs.existsSync(path.join(dirPath, 'tsconfig.json')) ||
        fs.existsSync(path.join(dirPath, 'pyproject.toml')) ||
        fs.existsSync(path.join(dirPath, 'setup.py'))
      ) {
        return dirPath;
      }
    }
    return path.dirname(filePath);
  }

  getStats() {
    return {
      isInitialized: this.isInitialized,
      poolStats: this.pool.getStats(),
      errorMetrics: this.errorHandler.getMetrics(),
      supportedLanguages: this.registry.getSupportedLanguages(),
    };
  }

  getHealthStatus() {
    const errorHealth = this.errorHandler.getHealthStatus();
    const poolStats = this.pool.getStats();

    return {
      healthy: errorHealth.healthy && this.isInitialized,
      lspEnabled: this.config.enableLSP,
      errorRate: errorHealth.errorRate,
      restartRate: errorHealth.restartRate,
      activeConnections: poolStats.activeConnections,
      totalConnections: poolStats.totalConnections,
      supportedLanguages: this.registry.getSupportedLanguages().length,
    };
  }

  getSupportedLanguages(): string[] {
    return this.registry.getSupportedLanguages();
  }

  async healthCheck(): Promise<{ healthy: boolean; error: string }> {
    try {
      const healthStatus = this.getHealthStatus();
      return {
        healthy: healthStatus.healthy,
        error: healthStatus.healthy ? '' : 'LSP health check failed',
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async shutdown(): Promise<void> {
    if (this.isInitialized) {
      await this.pool.shutdown();
      this.isInitialized = false;
      this.emit('shutdown');
    }
  }

  updateConfig(config: LSPManagerConfig): void {
    this.config = { ...this.config, ...config };
    this.emit('configUpdated', this.config);
  }

  isLSPAvailable(filePath: string): boolean {
    if (!this.isInitialized || !this.config.enableLSP) {
      return false;
    }

    const workspaceRoot = this.findWorkspaceRoot(filePath);
    if (!workspaceRoot) {
      return false;
    }

    const language = this.registry.detectProjectLanguage(workspaceRoot);
    return language !== null && this.registry.isLanguageSupported(language.language);
  }
}

// 导入需要的模块
import * as path from 'path';
import * as fs from 'fs';
