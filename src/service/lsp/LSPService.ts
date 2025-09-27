import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { LSPSymbol, LSPDiagnostic, SymbolKind, DiagnosticSeverity } from './types';

export interface LSPClient {
  initialize(rootPath: string): Promise<void>;
  getDocumentSymbols(filePath: string): Promise<LSPSymbol[]>;
  getDiagnostics(filePath: string): Promise<LSPDiagnostic[]>;
  getTypeDefinition(
    filePath: string,
    position: { line: number; character: number }
  ): Promise<LSPSymbol[]>;
  getReferences(
    filePath: string,
    position: { line: number; character: number }
  ): Promise<LSPSymbol[]>;
  shutdown(): Promise<void>;
  isHealthy(): boolean;
}

export interface LSPServiceOptions {
  timeout?: number;
  maxRetries?: number;
  enableCaching?: boolean;
  supportedLanguages?: string[];
}

@injectable()
export class LSPService {
  private logger: LoggerService;
  private configService: ConfigService;
  private clients: Map<string, LSPClient> = new Map();
  private cache: Map<string, any> = new Map();
  private options: LSPServiceOptions;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ConfigService) configService: ConfigService
  ) {
    this.logger = logger;
    this.configService = configService;

    const lspConfig = configService.get('lsp') || {};
    this.options = {
      timeout: lspConfig.timeout ?? 30000,
      maxRetries: lspConfig.retryAttempts ?? 3,
      enableCaching: lspConfig.cacheEnabled ?? true,
      supportedLanguages: lspConfig.supportedLanguages ?? [
        'typescript',
        'javascript',
        'python',
        'java',
        'c',
        'cpp',
        'csharp',
        'go',
        'rust',
      ],
    };
  }

  async initialize(rootPath: string, language: string): Promise<boolean> {
    try {
      if (!this.options.supportedLanguages?.includes(language)) {
        this.logger.warn(`Language ${language} not supported by LSP`);
        return false;
      }

      if (this.clients.has(language)) {
        this.logger.debug(`LSP client for ${language} already initialized`);
        return true;
      }

      const client = await this.createLSPClient(language, rootPath);
      await client.initialize(rootPath);

      this.clients.set(language, client);
      this.logger.info(`LSP client for ${language} initialized successfully`);

      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize LSP client for ${language}`, error);
      return false;
    }
  }

  async getDocumentSymbols(filePath: string, language: string): Promise<LSPSymbol[]> {
    try {
      const client = this.clients.get(language);
      if (!client || !client.isHealthy()) {
        return [];
      }

      const cacheKey = `symbols:${filePath}`;
      if (this.options.enableCaching && this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      const symbols = await this.withTimeout(
        client.getDocumentSymbols(filePath),
        this.options.timeout || 30000
      );

      if (this.options.enableCaching) {
        this.cache.set(cacheKey, symbols);
      }

      return symbols;
    } catch (error) {
      this.logger.error(`Failed to get document symbols for ${filePath}`, error);
      return [];
    }
  }

  async getDiagnostics(filePath: string, language: string): Promise<LSPDiagnostic[]> {
    try {
      const client = this.clients.get(language);
      if (!client || !client.isHealthy()) {
        return [];
      }

      const cacheKey = `diagnostics:${filePath}`;
      if (this.options.enableCaching && this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      const diagnostics = await this.withTimeout(
        client.getDiagnostics(filePath),
        this.options.timeout || 30000
      );

      if (this.options.enableCaching) {
        this.cache.set(cacheKey, diagnostics);
      }

      return diagnostics;
    } catch (error) {
      this.logger.error(`Failed to get diagnostics for ${filePath}`, error);
      return [];
    }
  }

  async getTypeDefinition(
    filePath: string,
    language: string,
    position: { line: number; character: number }
  ): Promise<LSPSymbol[]> {
    try {
      const client = this.clients.get(language);
      if (!client || !client.isHealthy()) {
        return [];
      }

      const cacheKey = `typeDef:${filePath}:${position.line}:${position.character}`;
      if (this.options.enableCaching && this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      const typeDefs = await this.withTimeout(
        client.getTypeDefinition(filePath, position),
        this.options.timeout || 30000
      );

      if (this.options.enableCaching) {
        this.cache.set(cacheKey, typeDefs);
      }

      return typeDefs;
    } catch (error) {
      this.logger.error(`Failed to get type definition for ${filePath}`, error);
      return [];
    }
  }

  async getReferences(
    filePath: string,
    language: string,
    position: { line: number; character: number }
  ): Promise<LSPSymbol[]> {
    try {
      const client = this.clients.get(language);
      if (!client || !client.isHealthy()) {
        return [];
      }

      const cacheKey = `refs:${filePath}:${position.line}:${position.character}`;
      if (this.options.enableCaching && this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      const references = await this.withTimeout(
        client.getReferences(filePath, position),
        this.options.timeout || 30000
      );

      if (this.options.enableCaching) {
        this.cache.set(cacheKey, references);
      }

      return references;
    } catch (error) {
      this.logger.error(`Failed to get references for ${filePath}`, error);
      return [];
    }
  }

  async shutdown(): Promise<void> {
    for (const [language, client] of this.clients) {
      try {
        await client.shutdown();
        this.logger.info(`LSP client for ${language} shutdown successfully`);
      } catch (error) {
        this.logger.error(`Failed to shutdown LSP client for ${language}`, error);
      }
    }
    this.clients.clear();
    this.cache.clear();
  }

  isLanguageSupported(language: string): boolean {
    return this.options.supportedLanguages?.includes(language) || false;
  }

  getClient(language: string): LSPClient | undefined {
    return this.clients.get(language);
  }

  isHealthy(language: string): boolean {
    const client = this.clients.get(language);
    return client ? client.isHealthy() : false;
  }

  clearCache(): void {
    this.cache.clear();
    this.logger.debug('LSP cache cleared');
  }

  private async createLSPClient(language: string, rootPath: string): Promise<LSPClient> {
    // 这里应该根据语言创建具体的LSP客户端
    // 这是一个基础实现，实际项目中需要根据具体语言实现对应的LSP客户端

    const MockLSPClient = class implements LSPClient {
      private healthy = true;

      async initialize(rootPath: string): Promise<void> {
        // Mock initialization
        this.healthy = true;
      }

      async getDocumentSymbols(filePath: string): Promise<LSPSymbol[]> {
        // Mock symbols
        return [
          {
            name: 'mockFunction',
            kind: SymbolKind.Function,
            range: {
              start: { line: 0, character: 0 },
              end: { line: 10, character: 0 },
            },
            containerName: 'mockContainer',
          },
        ];
      }

      async getDiagnostics(filePath: string): Promise<LSPDiagnostic[]> {
        // Mock diagnostics
        return [
          {
            range: {
              start: { line: 5, character: 0 },
              end: { line: 5, character: 10 },
            },
            severity: DiagnosticSeverity.Warning,
            message: 'Mock warning',
            source: 'mock-lsp',
          },
        ];
      }

      async getTypeDefinition(
        filePath: string,
        position: { line: number; character: number }
      ): Promise<LSPSymbol[]> {
        return [];
      }

      async getReferences(
        filePath: string,
        position: { line: number; character: number }
      ): Promise<LSPSymbol[]> {
        return [];
      }

      async shutdown(): Promise<void> {
        this.healthy = false;
      }

      isHealthy(): boolean {
        return this.healthy;
      }
    };

    return new MockLSPClient();
  }

  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('LSP operation timeout')), timeout)
      ),
    ]);
  }
}
