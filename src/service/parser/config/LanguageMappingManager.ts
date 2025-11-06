import { LoggerService } from '../../../utils/LoggerService';
import {
  LANGUAGE_MAPPINGS,
  LanguageMapping,
  QUERY_TYPES,
  STRATEGY_TYPES,
  LANGUAGE_CATEGORIES
} from './LanguageMappingConfig';

/**
 * 统一语言映射管理器
 * 提供语言映射的集中管理和查询服务
 */
export class LanguageMappingManager {
  private static instance: LanguageMappingManager;
  private mappings: Map<string, LanguageMapping> = new Map();
  private extensionToLanguage: Map<string, string> = new Map();
  private aliasToLanguage: Map<string, string> = new Map();
  private logger: LoggerService;

  private constructor() {
    this.logger = new LoggerService();
    this.initializeMappings();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): LanguageMappingManager {
    if (!LanguageMappingManager.instance) {
      LanguageMappingManager.instance = new LanguageMappingManager();
    }
    return LanguageMappingManager.instance;
  }

  /**
   * 初始化映射关系
   */
  private initializeMappings(): void {
    this.mappings = new Map();
    this.extensionToLanguage = new Map();
    this.aliasToLanguage = new Map();

    // 初始化语言映射
    for (const [name, config] of Object.entries(LANGUAGE_MAPPINGS)) {
      this.mappings.set(name, config);

      // 设置别名映射
      this.aliasToLanguage.set(name, name);
      for (const alias of config.aliases) {
        this.aliasToLanguage.set(alias.toLowerCase(), name);
      }

      // 设置扩展名映射
      for (const ext of config.extensions) {
        this.extensionToLanguage.set(ext.toLowerCase(), name);
      }
    }

    this.logger.info(`LanguageMappingManager 初始化完成，支持 ${this.mappings.size} 种语言`);
  }

  /**
   * 标准化语言名称
   * @param language 原始语言名称
   * @returns 标准化的语言名称
   */
  normalizeLanguageName(language: string): string {
    if (!language) return '';

    const normalized = language.toLowerCase();
    return this.aliasToLanguage.get(normalized) || normalized;
  }

  /**
   * 获取语言映射配置
   * @param language 语言名称
   * @returns 语言映射配置
   */
  getLanguageMapping(language: string): LanguageMapping | undefined {
    const normalized = this.normalizeLanguageName(language);
    return this.mappings.get(normalized);
  }

  /**
   * 根据文件扩展名获取语言
   * @param ext 文件扩展名（包含点号，如 '.js'）
   * @returns 语言名称
   */
  getLanguageByExtension(ext: string): string | undefined {
    if (!ext) return undefined;

    const normalizedExt = ext.toLowerCase();
    return this.extensionToLanguage.get(normalizedExt);
  }

  /**
   * 根据文件路径获取语言
   * @param filePath 文件路径
   * @returns 语言名称
   */
  getLanguageByPath(filePath: string): string | undefined {
    if (!filePath) return undefined;

    // 提取文件扩展名
    const lastDotIndex = filePath.lastIndexOf('.');
    if (lastDotIndex === -1) return undefined;

    const ext = filePath.substring(lastDotIndex);
    return this.getLanguageByExtension(ext);
  }

  /**
   * 获取 Tree-sitter 加载器
   * @param language 语言名称
   * @returns Tree-sitter 加载器函数
   */
  getTreeSitterLoader(language: string): (() => Promise<any>) | undefined {
    const mapping = this.getLanguageMapping(language);
    if (!mapping || !mapping.supported) return undefined;

    return async () => {
      try {
        const module = await import(mapping.treeSitterModule);
        return mapping.treeSitterImport === 'default' ? module.default : module[mapping.treeSitterImport];
      } catch (error) {
        this.logger.error(`加载 ${language} 的 Tree-sitter 模块失败:`, error);
        throw error;
      }
    };
  }

  /**
   * 获取 Tree-sitter 语言名称
   * @param language 语言名称
   * @returns Tree-sitter 语言名称
   */
  getTreeSitterLanguageName(language: string): string | undefined {
    const mapping = this.getLanguageMapping(language);
    return mapping?.treeSitterLanguageName || mapping?.name;
  }

  /**
   * 获取查询目录名
   * @param language 语言名称
   * @returns 查询目录名
   */
  getQueryDir(language: string): string | undefined {
    const mapping = this.getLanguageMapping(language);
    return mapping?.queryDir;
  }

  /**
   * 获取语言显示名称
   * @param language 语言名称
   * @returns 显示名称
   */
  getDisplayName(language: string): string {
    const mapping = this.getLanguageMapping(language);
    return mapping?.displayName || language;
  }

  /**
   * 获取语言支持的文件扩展名
   * @param language 语言名称
   * @returns 文件扩展名数组
   */
  getExtensions(language: string): string[] {
    const mapping = this.getLanguageMapping(language);
    return mapping?.extensions || [];
  }

  /**
   * 获取语言支持的查询类型
   * @param language 语言名称
   * @returns 查询类型数组
   */
  getSupportedQueryTypes(language: string): string[] {
    const mapping = this.getLanguageMapping(language);
    return mapping?.supportedQueryTypes || [];
  }

  /**
   * 检查语言是否支持特定查询类型
   * @param language 语言名称
   * @param queryType 查询类型
   * @returns 是否支持
   */
  isQueryTypeSupported(language: string, queryType: string): boolean {
    const supportedTypes = this.getSupportedQueryTypes(language);
    return supportedTypes.includes(queryType);
  }

  /**
   * 获取语言支持的策略
   * @param language 语言名称
   * @returns 策略数组
   */
  getSupportedStrategies(language: string): string[] {
    const mapping = this.getLanguageMapping(language);
    return mapping?.supportedStrategies || [];
  }

  /**
   * 检查语言是否支持特定策略
   * @param language 语言名称
   * @param strategy 策略类型
   * @returns 是否支持
   */
  isStrategySupported(language: string, strategy: string): boolean {
    const supportedStrategies = this.getSupportedStrategies(language);
    return supportedStrategies.includes(strategy);
  }

  /**
   * 获取语言配置
   * @param language 语言名称
   * @returns 语言配置对象
   */
  getLanguageConfig(language: string): Partial<LanguageMapping> {
    const mapping = this.getLanguageMapping(language);
    if (!mapping) return {};

    return {
      maxChunkSize: mapping.maxChunkSize,
      maxLinesPerChunk: mapping.maxLinesPerChunk,
      enableSemanticDetection: mapping.enableSemanticDetection,
      enableBracketBalance: mapping.enableBracketBalance,
    };
  }

  /**
   * 获取所有支持的语言
   * @returns 语言名称数组
   */
  getAllSupportedLanguages(): string[] {
    return Array.from(this.mappings.keys());
  }

  /**
   * 获取按分类分组的语言
   * @param category 分类
   * @returns 语言名称数组
   */
  getLanguagesByCategory(category: string): string[] {
    return Array.from(this.mappings.values())
      .filter(mapping => mapping.category === category)
      .map(mapping => mapping.name);
  }

  /**
   * 获取支持特定策略的语言
   * @param strategy 策略类型
   * @returns 语言名称数组
   */
  getLanguagesByStrategy(strategy: string): string[] {
    return Array.from(this.mappings.values())
      .filter(mapping => mapping.supportedStrategies.includes(strategy))
      .map(mapping => mapping.name);
  }

  /**
   * 获取常用语言列表（按优先级排序）
   * @returns 语言名称数组
   */
  getCommonLanguages(): string[] {
    return Array.from(this.mappings.values())
      .filter(mapping => mapping.priority <= 2)
      .sort((a, b) => a.priority - b.priority)
      .map(mapping => mapping.name);
  }

  /**
   * 获取编程语言列表
   * @returns 语言名称数组
   */
  getProgrammingLanguages(): string[] {
    return this.getLanguagesByCategory(LANGUAGE_CATEGORIES.PROGRAMMING);
  }

  /**
   * 获取标记语言列表
   * @returns 语言名称数组
   */
  getMarkupLanguages(): string[] {
    return this.getLanguagesByCategory(LANGUAGE_CATEGORIES.MARKUP);
  }

  /**
   * 获取数据格式语言列表
   * @returns 语言名称数组
   */
  getDataLanguages(): string[] {
    return this.getLanguagesByCategory(LANGUAGE_CATEGORIES.DATA);
  }

  /**
   * 检查语言是否受支持
   * @param language 语言名称
   * @returns 是否支持
   */
  isLanguageSupported(language: string): boolean {
    const mapping = this.getLanguageMapping(language);
    return !!mapping && mapping.supported;
  }

  /**
   * 检查扩展名是否受支持
   * @param ext 文件扩展名
   * @returns 是否支持
   */
  isExtensionSupported(ext: string): boolean {
    if (!ext) return false;
    return this.extensionToLanguage.has(ext.toLowerCase());
  }

  /**
   * 获取所有别名映射
   * @returns 别名到标准名称的映射
   */
  getAliasMappings(): Record<string, string> {
    const mappings: Record<string, string> = {};
    for (const [alias, name] of this.aliasToLanguage) {
      mappings[alias] = name;
    }
    return mappings;
  }

  /**
   * 获取扩展名到语言的映射
   * @returns 扩展名到语言的映射
   */
  getExtensionMappings(): Record<string, string> {
    const mappings: Record<string, string> = {};
    for (const [ext, language] of this.extensionToLanguage) {
      mappings[ext] = language;
    }
    return mappings;
  }

  /**
   * 获取语言统计信息
   * @returns 统计信息
   */
  getStats() {
    const categoryStats: Record<string, number> = {};
    const strategyStats: Record<string, number> = {};

    for (const mapping of this.mappings.values()) {
      // 分类统计
      categoryStats[mapping.category] = (categoryStats[mapping.category] || 0) + 1;

      // 策略统计
      for (const strategy of mapping.supportedStrategies) {
        strategyStats[strategy] = (strategyStats[strategy] || 0) + 1;
      }
    }

    return {
      totalLanguages: this.mappings.size,
      supportedLanguages: Array.from(this.mappings.values()).filter(m => m.supported).length,
      totalExtensions: this.extensionToLanguage.size,
      totalAliases: this.aliasToLanguage.size,
      categoryStats,
      strategyStats,
      commonLanguages: this.getCommonLanguages().length,
      programmingLanguages: this.getProgrammingLanguages().length
    };
  }

  /**
   * 验证配置完整性
   * @returns 验证结果
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [name, mapping] of Object.entries(LANGUAGE_MAPPINGS)) {
      // 检查必需字段
      if (!mapping.name) errors.push(`${name}: 缺少名称`);
      if (!mapping.displayName) errors.push(`${name}: 缺少显示名称`);
      if (!mapping.extensions || mapping.extensions.length === 0) errors.push(`${name}: 缺少文件扩展名`);
      if (!mapping.treeSitterModule) errors.push(`${name}: 缺少 Tree-sitter 模块`);
      if (!mapping.queryDir) errors.push(`${name}: 缺少查询目录`);

      // 检查扩展名格式
      for (const ext of mapping.extensions || []) {
        if (!ext.startsWith('.')) {
          errors.push(`${name}: 扩展名 ${ext} 应以点号开头`);
        }
      }

      // 检查别名冲突
      for (const alias of mapping.aliases || []) {
        const existing = this.aliasToLanguage.get(alias.toLowerCase());
        if (existing && existing !== name) {
          errors.push(`${name}: 别名 ${alias} 与 ${existing} 冲突`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * 导出单例实例
 */
export const languageMappingManager = LanguageMappingManager.getInstance();