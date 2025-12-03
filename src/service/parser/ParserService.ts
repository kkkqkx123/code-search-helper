import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { TYPES } from '../../types';
import { LanguageDetector, DetectionResult } from './detection/LanguageDetector';
import { DynamicParserManager, DynamicParseResult } from './parsing/DynamicParserManager';
import { TreeSitterQueryEngine } from './parsing/TreeSitterQueryExecutor';
import { CodeStructureService } from './structure/CodeStructureService';
import { ICacheService } from '../../infrastructure/caching/types';

/**
 * 解析结果接口
 */
export interface ParseResult {
  ast: any;
  language: string;
  parseTime: number;
  success: boolean;
  error?: string;
  fromCache?: boolean;
  structure?: any;
}

/**
 * 统一的解析服务
 * 整合语言检测、解析、查询和结构提取功能
 */
@injectable()
export class ParserService {
  private languageDetector: LanguageDetector;
  private parserManager: DynamicParserManager;
  private queryEngine: TreeSitterQueryEngine;
  private structureService: CodeStructureService;
  private cacheService: ICacheService;
  private logger: LoggerService;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.CacheService) cacheService: ICacheService
  ) {
    this.logger = logger;
    this.cacheService = cacheService;
    this.languageDetector = new LanguageDetector(logger);
    this.parserManager = new DynamicParserManager(cacheService);
    this.queryEngine = new TreeSitterQueryEngine();
    this.structureService = new CodeStructureService();
    
    this.logger.debug('ParserService 初始化完成');
  }

  /**
   * 完整的解析流程
   * @param filePath 文件路径
   * @param content 文件内容
   * @returns 完整的解析结果
   */
  async parseFile(filePath: string, content: string): Promise<ParseResult> {
    const startTime = Date.now();
    
    try {
      // 1. 语言检测
      const languageResult = await this.languageDetector.detectFile(filePath, content);
      
      // 2. 解析代码
      const parseResult = await this.parserManager.parseCode(content, languageResult.language);
      
      // 3. 提取结构
      const structure = await this.structureService.extractStructure(parseResult.ast, languageResult.language);
      
      const totalTime = Date.now() - startTime;
      
      return {
        ast: parseResult.ast,
        language: languageResult.language,
        parseTime: totalTime,
        success: parseResult.success,
        fromCache: parseResult.fromCache,
        structure,
        error: parseResult.error
      };
    } catch (error) {
      this.logger.error(`解析文件失败: ${filePath}`, error);
      
      return {
        ast: {},
        language: 'unknown',
        parseTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 单独的语言检测功能
   * @param filePath 文件路径
   * @param content 文件内容
   * @returns 语言检测结果
   */
  async detectLanguage(filePath: string, content?: string): Promise<DetectionResult> {
    return this.languageDetector.detectFile(filePath, content || '');
  }

  /**
   * 单独的代码解析功能
   * @param code 代码内容
   * @param language 编程语言
   * @returns 解析结果
   */
  async parseCode(code: string, language: string): Promise<DynamicParseResult> {
    return this.parserManager.parseCode(code, language);
  }

  /**
   * 单独的结构提取功能
   * @param ast AST节点
   * @param language 编程语言
   * @returns 结构提取结果
   */
  async extractStructure(ast: any, language: string): Promise<any> {
    return this.structureService.extractStructure(ast, language);
  }

  /**
   * 执行实体查询
   * @param ast AST节点
   * @param entityType 实体类型
   * @param language 编程语言
   * @param options 查询选项
   * @returns 实体查询结果
   */
  async executeEntityQuery(
    ast: any,
    entityType: string,
    language: string,
    options: any = {}
  ): Promise<any[]> {
    return this.queryEngine.executeEntityQuery(ast, entityType, language, options);
  }

  /**
   * 执行关系查询
   * @param ast AST节点
   * @param relationshipType 关系类型
   * @param language 编程语言
   * @param options 查询选项
   * @returns 关系查询结果
   */
  async executeRelationshipQuery(
    ast: any,
    relationshipType: string,
    language: string,
    options: any = {}
  ): Promise<any[]> {
    return this.queryEngine.executeRelationshipQuery(ast, relationshipType, language, options);
  }

  /**
   * 获取支持的语言列表
   * @returns 支持的语言列表
   */
  getSupportedLanguages(): string[] {
    return this.languageDetector.getSupportedLanguages();
  }

  /**
   * 检查语言是否支持AST解析
   * @param language 编程语言
   * @returns 是否支持AST解析
   */
  isLanguageSupportedForAST(language: string): boolean {
    return this.languageDetector.isLanguageSupportedForAST(language);
  }

  /**
   * 获取性能统计信息
   * @returns 性能统计信息
   */
  getPerformanceStats(): any {
    const parserStats = this.parserManager.getPerformanceStats();
    const queryStats = this.queryEngine.getPerformanceStats();
    
    return {
      parser: parserStats,
      query: queryStats,
      cache: this.cacheService.getCacheStats()
    };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.parserManager.clearCache();
    this.queryEngine.clearCache();
    this.cacheService.clearAllCache();
    this.logger.info('ParserService 缓存已清除');
  }
}