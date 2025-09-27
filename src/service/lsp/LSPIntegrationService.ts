import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { ParserService, ParseResult, ParseOptions } from '../parser/core/parse/ParserService';
import { LSPManager } from './LSPManager';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import {
  LSPEnhancedParseResult,
  LSPParseOptions,
  SymbolKind,
  LSPTypeDefinition,
  LSPReference,
} from './types';

@injectable()
export class EnhancedParserService {
  private parserService: ParserService;
  private lspManager: LSPManager;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;

  constructor(
    @inject(TYPES.ParserService) parserService: ParserService,
    @inject(TYPES.LSPManager) lspManager: LSPManager,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService
  ) {
    this.parserService = parserService;
    this.lspManager = lspManager;
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
  }

  async parseFile(
    filePath: string,
    options: LSPParseOptions & ParseOptions = {}
  ): Promise<LSPEnhancedParseResult> {
    const startTime = Date.now();

    try {
      // 首先使用基础ParserService进行语法解析
      const baseResult = await this.parserService.parseFile(filePath, options);

      // 创建增强结果的基础结构
      const enhancedResult: LSPEnhancedParseResult = {
        ...baseResult,
        lspSymbols: [],
        lspDiagnostics: [],
        typeDefinitions: [],
        references: [],
        lspMetadata: {
          languageServer: undefined,
          processingTime: 0,
          hasErrors: false,
          symbolCount: 0,
          diagnosticCount: 0,
        },
      };

      // 如果启用了LSP增强
      if (options.enableLSP && this.isLSPEnabled()) {
        try {
          const lspStartTime = Date.now();

          // 检查文件是否支持LSP
          const supportedLanguages = this.lspManager.getSupportedLanguages();
          if (supportedLanguages.includes(baseResult.language)) {
            // 获取符号信息
            if (options.includeTypes !== false) {
              try {
                const symbols = await this.lspManager.getSymbols(filePath);
                if (symbols && symbols.symbols) {
                  enhancedResult.lspSymbols = symbols.symbols.map(s => ({
                    name: s.name,
                    kind: typeof s.kind === 'number' ? s.kind : SymbolKind.Function,
                    range: s.range,
                    detail: s.detail || '',
                    documentation: (s as any).documentation || '',
                    containerName: (s as any).containerName || '',
                  }));
                  if (enhancedResult.lspMetadata) {
                    enhancedResult.lspMetadata.symbolCount = symbols.symbols.length;
                  }
                }
              } catch (error) {
                this.logger.warn('Failed to get LSP symbols', {
                  filePath,
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }

            // 获取诊断信息
            if (options.includeDiagnostics !== false) {
              try {
                const diagnostics = await this.lspManager.getDiagnostics(filePath);
                if (diagnostics && diagnostics.diagnostics) {
                  enhancedResult.lspDiagnostics = diagnostics.diagnostics.map(d => ({
                    range: d.range,
                    severity: d.severity || 1,
                    message: d.message,
                    source: d.source,
                    code: d.code,
                  }));
                  if (enhancedResult.lspMetadata) {
                    enhancedResult.lspMetadata.diagnosticCount = diagnostics.diagnostics.length;
                    enhancedResult.lspMetadata.hasErrors = diagnostics.diagnostics.some(
                      d => d.severity === 1
                    ); // Error
                  }
                }
              } catch (error) {
                this.logger.warn('Failed to get LSP diagnostics', {
                  filePath,
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }

            // 获取类型定义
            if (options.includeTypes !== false) {
              try {
                const typeDefs = await this.lspManager.getTypeDefinition(filePath, {
                  line: 0,
                  character: 0,
                });
                enhancedResult.typeDefinitions = (typeDefs || []).map(def => ({
                  name: 'unknown',
                  type: 'unknown',
                  range: def.targetRange,
                  filePath: def.targetUri,
                })) as LSPTypeDefinition[];
              } catch (error) {
                this.logger.warn('Failed to get type definitions', {
                  filePath,
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }

            // 获取引用信息
            if (options.includeReferences !== false) {
              try {
                const references = await this.lspManager.getReferences(filePath, {
                  line: 0,
                  character: 0,
                });
                enhancedResult.references = (references || []) as LSPReference[];
              } catch (error) {
                this.logger.warn('Failed to get references', {
                  filePath,
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }

            if (enhancedResult.lspMetadata) {
              enhancedResult.lspMetadata.languageServer =
                this.lspManager.getActiveLanguageServer(filePath);
              enhancedResult.lspMetadata.processingTime = Date.now() - lspStartTime;
            }
          }
        } catch (error) {
          this.logger.warn('LSP enhancement failed, falling back to basic parsing', {
            filePath,
            error: error instanceof Error ? error.message : String(error),
          });
          // 降级处理：保持基础结果，不中断流程
        }
      }

      this.logger.debug('Enhanced parsing completed', {
        filePath,
        language: baseResult.language,
        hasLSP: options.enableLSP && this.isLSPEnabled(),
        symbolCount: enhancedResult.lspSymbols?.length || 0,
        diagnosticCount: enhancedResult.lspDiagnostics?.length || 0,
        processingTime: Date.now() - startTime,
      });

      return enhancedResult;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Enhanced parsing failed for ${filePath}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'EnhancedParserService', operation: 'parseFile' }
      );
      throw error;
    }
  }

  async parseFiles(
    filePaths: string[],
    options: LSPParseOptions & ParseOptions = {}
  ): Promise<LSPEnhancedParseResult[]> {
    const startTime = Date.now();

    this.logger.info('Starting enhanced parsing for multiple files', {
      fileCount: filePaths.length,
      enableLSP: options.enableLSP && this.isLSPEnabled(),
      includeTypes: options.includeTypes,
      includeDiagnostics: options.includeDiagnostics,
      includeReferences: options.includeReferences,
    });

    const results: LSPEnhancedParseResult[] = [];
    const errors: string[] = [];

    // 批量处理，避免内存问题
    const batchSize = this.configService.get('lsp')?.batchSize ?? 20;

    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);

      const batchPromises = batch.map(async filePath => {
        try {
          return await this.parseFile(filePath, options);
        } catch (error) {
          const errorMsg = `Failed to parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          this.logger.warn(errorMsg);

          // 降级到基础解析
          try {
            const baseResult = await this.parserService.parseFile(filePath, options);
            return {
              ...baseResult,
              lspSymbols: [],
              lspDiagnostics: [],
              typeDefinitions: [],
              references: [],
              lspMetadata: {
                languageServer: undefined,
                processingTime: 0,
                hasErrors: true,
                symbolCount: 0,
                diagnosticCount: 0,
              },
            } as LSPEnhancedParseResult;
          } catch (fallbackError) {
            return null;
          }
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      const successfulResults = batchResults
        .filter(
          (result): result is PromiseFulfilledResult<LSPEnhancedParseResult> =>
            result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value);

      results.push(...successfulResults);
    }

    if (errors.length > 0) {
      this.logger.warn('Some files failed enhanced parsing', {
        totalFiles: filePaths.length,
        successCount: results.length,
        errorCount: errors.length,
        firstFewErrors: errors.slice(0, 5),
      });
    }

    this.logger.info('Enhanced parsing completed', {
      totalFiles: filePaths.length,
      successfulFiles: results.length,
      processingTime: Date.now() - startTime,
      averageProcessingTime: (Date.now() - startTime) / results.length,
    });

    return results;
  }

  isLSPEnabled(): boolean {
    return this.configService.get('lsp')?.enabled ?? false;
  }

  getSupportedLanguages(): string[] {
    const baseLanguages = this.parserService.getSupportedLanguages();
    if (this.isLSPEnabled()) {
      const lspLanguages = this.lspManager.getSupportedLanguages();
      return [...new Set([...baseLanguages, ...lspLanguages])];
    }
    return baseLanguages;
  }

  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, any> }> {
    const baseHealth = {
      healthy: true,
      details: {
        parserService: 'ok',
        lspManager: 'ok',
        lspEnabled: this.isLSPEnabled(),
        lspHealth: { healthy: false, error: 'LSP not enabled' },
      },
    };

    try {
      if (this.isLSPEnabled()) {
        const lspHealth = await this.lspManager.healthCheck();
        baseHealth.details.lspHealth = lspHealth;
        baseHealth.healthy = baseHealth.healthy && lspHealth.healthy;
      }
    } catch (error) {
      baseHealth.details.lspHealth = {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
      };
      baseHealth.healthy = false;
    }

    return baseHealth;
  }
}
