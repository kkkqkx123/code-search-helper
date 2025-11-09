import { LoggerService } from '../../../utils/LoggerService';
import { LanguageConfig } from './LanguageCore';
import { ADVANCED_PROGRAMMING_LANGUAGES } from './AdvancedProgrammingConfig';
import { BASIC_PROGRAMMING_LANGUAGES } from './BasicProgrammingConfig';
import { DATA_FORMAT_LANGUAGES } from './DataFormatConfig';
import { SPECIAL_PROCESSING_LANGUAGES } from './SpecialProcessingConfig';
import { HYBRID_PROCESSING_LANGUAGES } from './HybridProcessingConfig';
import { TEXT_FORMAT_LANGUAGES } from '../constants/language-constants';

/**
 * 基于查询规则目录的语言映射管理系统
 * 根据实际目录结构进行语言分类
 */
export class LanguageMappingManager {
  private static instance: LanguageMappingManager;
  private languageMap!: Map<string, LanguageConfig>;
  private extensionToLanguage!: Map<string, string>;
  private aliasToLanguage!: Map<string, string>;
  private logger: LoggerService;

  private constructor() {
    this.logger = new LoggerService();
    this.initializeLanguageMap();
    this.buildExtensionAndAliasMaps();
    this.logger.info(`LanguageMappingManager 初始化完成，支持 ${this.languageMap.size} 种语言`);
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
   * 初始化语言映射
   */
  private initializeLanguageMap(): void {
    this.languageMap = new Map<string, LanguageConfig>();

    // 合并所有语言配置
    const allLanguages = [
      ...ADVANCED_PROGRAMMING_LANGUAGES,
      ...BASIC_PROGRAMMING_LANGUAGES,
      ...DATA_FORMAT_LANGUAGES,
      ...SPECIAL_PROCESSING_LANGUAGES,
      ...HYBRID_PROCESSING_LANGUAGES,
      ...TEXT_FORMAT_LANGUAGES
    ];

    // 将所有语言添加到映射中
    for (const langConfig of allLanguages) {
      this.languageMap.set(langConfig.name, langConfig);
    }
  }

  /**
   * 构建扩展名和别名映射
   */
  private buildExtensionAndAliasMaps(): void {
    this.extensionToLanguage = new Map();
    this.aliasToLanguage = new Map();

    for (const [name, config] of this.languageMap) {
      // 建立扩展名到语言的映射
      for (const ext of config.extensions) {
        this.extensionToLanguage.set(ext.toLowerCase(), name);
      }

      // 建立别名到语言的映射
      this.aliasToLanguage.set(name.toLowerCase(), name);
      for (const alias of config.aliases) {
        this.aliasToLanguage.set(alias.toLowerCase(), name);
      }
    }
  }

  /**
   * 标准化语言名称
   */
  normalizeLanguageName(language: string): string {
    if (!language) return '';

    const lower = language.toLowerCase();
    return this.aliasToLanguage.get(lower) || lower;
  }

  /**
   * 根据语言名称获取配置
   */
  getLanguageConfig(language: string): LanguageConfig | undefined {
    const normalized = this.normalizeLanguageName(language);
    return this.languageMap.get(normalized);
  }

  /**
   * 根据文件扩展名获取语言
   */
  getLanguageByExtension(ext: string): string | undefined {
    if (!ext) return undefined;
    const normalizedExt = ext.toLowerCase();
    return this.extensionToLanguage.get(normalizedExt);
  }

  /**
   * 根据文件路径获取语言
   */
  getLanguageByPath(filePath: string): string | undefined {
    if (!filePath) return undefined;

    const lastDotIndex = filePath.lastIndexOf('.');
    if (lastDotIndex === -1) return undefined;

    const ext = filePath.substring(lastDotIndex);
    return this.getLanguageByExtension(ext);
  }

  /**
   * 获取 Tree-sitter 加载器
   */
  getTreeSitterLoader(language: string): (() => Promise<any>) | undefined {
    const config = this.getLanguageConfig(language);
    if (!config || !config.strategy || config.strategy.skipASTParsing) return undefined;

    // 检查语言是否有对应的 tree-sitter 模块
    const treeSitterModules: Record<string, string> = {
      javascript: 'tree-sitter-javascript',
      typescript: 'tree-sitter-typescript',
      python: 'tree-sitter-python',
      java: 'tree-sitter-java',
      go: 'tree-sitter-go',
      rust: 'tree-sitter-rust',
      cpp: 'tree-sitter-cpp',
      c: 'tree-sitter-c',
      csharp: 'tree-sitter-c-sharp',
      swift: 'tree-sitter-swift',
      kotlin: 'tree-sitter-kotlin',
      ruby: 'tree-sitter-ruby',
      php: 'tree-sitter-php',
      scala: 'tree-sitter-scala',
      html: 'tree-sitter-html',
      css: 'tree-sitter-css',
      vue: 'tree-sitter-vue',
      json: 'tree-sitter-json',
      yaml: 'tree-sitter-yaml',
      toml: 'tree-sitter-toml',
      xml: 'tree-sitter-xml',
      markdown: 'tree-sitter-markdown',
      shell: 'tree-sitter-bash',
      sql: 'tree-sitter-sql'
    };

    const modulePath = treeSitterModules[config.name];
    if (!modulePath) return undefined;

    return async () => {
      try {
        const module = await import(modulePath);
        // 默认导入
        return module.default || module;
      } catch (error) {
        this.logger.error(`加载 ${config.name} 的 Tree-sitter 模块失败:`, error);
        throw error;
      }
    };
  }

  /**
   * 获取 Tree-sitter 语言名称
   */
  getTreeSitterLanguageName(language: string): string | undefined {
    const config = this.getLanguageConfig(language);
    if (!config) return undefined;

    // 特殊处理 C#，Tree-sitter 中使用 c_sharp
    if (config.name === 'csharp') return 'c_sharp';

    return config.name;
  }

  /**
   * 获取查询目录名
   */
  getQueryDir(language: string): string | undefined {
    const config = this.getLanguageConfig(language);
    return config?.queryDir;
  }

  /**
   * 获取语言显示名称
   */
  getDisplayName(language: string): string {
    const config = this.getLanguageConfig(language);
    return config?.displayName || language;
  }

  /**
   * 获取语言支持的文件扩展名
   */
  getExtensions(language: string): string[] {
    const config = this.getLanguageConfig(language);
    return config?.extensions || [];
  }

  /**
   * 获取语言支持的查询类型
   */
  getSupportedQueryTypes(language: string): string[] {
    const config = this.getLanguageConfig(language);
    return config?.strategy.supportedQueryTypes || [];
  }

  /**
   * 检查语言是否支持特定查询类型
   */
  isQueryTypeSupported(language: string, queryType: string): boolean {
    const supportedTypes = this.getSupportedQueryTypes(language);
    return supportedTypes.includes(queryType);
  }

  /**
   * 获取语言支持的策略
   */
  getSupportedStrategies(language: string): string[] {
    const config = this.getLanguageConfig(language);
    if (!config?.strategy) return [];

    const strategies = [config.strategy.primary];
    if (config.strategy.fallback) {
      strategies.push(...config.strategy.fallback);
    }
    return strategies;
  }

  /**
   * 检查语言是否支持特定策略
   */
  isStrategySupported(language: string, strategy: string): boolean {
    const supportedStrategies = this.getSupportedStrategies(language);
    return supportedStrategies.includes(strategy);
  }

  /**
   * 获取语言分类
   */
  getCategory(language: string): string | undefined {
    const config = this.getLanguageConfig(language);
    return config?.category;
  }

  /**
   * 检查是否为高级编程语言
   */
  isAdvancedProgrammingLanguage(language: string): boolean {
    return this.getCategory(language) === 'advanced_programming';
  }

  /**
   * 检查是否为基本编程语言
   */
  isBasicProgrammingLanguage(language: string): boolean {
    return this.getCategory(language) === 'basic_programming';
  }

  /**
   * 检查是否为数据格式语言
   */
  isDataFormatLanguage(language: string): boolean {
    return this.getCategory(language) === 'data_format';
  }

  /**
   * 检查是否为特殊处理语言
   */
  isSpecialProcessingLanguage(language: string): boolean {
    return this.getCategory(language) === 'special_processing';
  }

  /**
  * 检查是否为混合处理语言
  */
  isHybridProcessingLanguage(language: string): boolean {
  return this.getCategory(language) === 'hybrid_processing';
  }

   /**
    * 检查是否为配置文件语言
    */
   isConfigLanguage(language: string): boolean {
     const normalized = this.normalizeLanguageName(language);
     const configLanguages = ['json', 'yaml', 'toml', 'xml'];
     return configLanguages.includes(normalized);
   }

   /**
    * 检查是否为前端语言
    */
   isFrontendLanguage(language: string): boolean {
     const normalized = this.normalizeLanguageName(language);
     const frontendLanguages = ['vue', 'jsx', 'tsx', 'html'];
     return frontendLanguages.includes(normalized);
   }

   /**
    * 检查是否为嵌入式模板语言
    */
   isEmbeddedTemplateLanguage(language: string): boolean {
     const normalized = this.normalizeLanguageName(language);
     const embeddedLanguages = ['embedded_template', 'html', 'vue', 'jsx', 'tsx'];
     return embeddedLanguages.includes(normalized);
   }

  /**
   * 检查语言是否具有子目录（高级规则语言）
   */
  hasSubdir(language: string): boolean {
    const config = this.getLanguageConfig(language);
    return config?.hasSubdir || false;
  }

  /**
   * 获取所有支持的语言名称
   */
  getAllSupportedLanguages(): string[] {
    return Array.from(this.languageMap.keys());
  }

  /**
   * 获取特定分类的语言列表
   */
  getLanguagesByCategory(category: string): string[] {
    return Array.from(this.languageMap.values())
      .filter(config => config.category === category)
      .map(config => config.name);
  }

  /**
   * 获取高级编程语言列表
   */
  getAdvancedProgrammingLanguages(): string[] {
    return this.getLanguagesByCategory('advanced_programming');
  }

  /**
   * 获取基本编程语言列表
   */
  getBasicProgrammingLanguages(): string[] {
    return this.getLanguagesByCategory('basic_programming');
  }

  /**
   * 获取数据格式语言列表
   */
  getDataFormatLanguages(): string[] {
    return this.getLanguagesByCategory('data_format');
  }

  /**
   * 获取特殊处理语言列表
   */
  getSpecialProcessingLanguages(): string[] {
    return this.getLanguagesByCategory('special_processing');
  }

  /**
   * 获取混合处理语言列表
   */
  getHybridProcessingLanguages(): string[] {
    return this.getLanguagesByCategory('hybrid_processing');
  }

  /**
   * 检查语言是否受支持
   */
  isLanguageSupported(language: string): boolean {
    return this.getLanguageConfig(language) !== undefined;
  }

  /**
   * 检查扩展名是否受支持
   */
  isExtensionSupported(ext: string): boolean {
    if (!ext) return false;
    return this.extensionToLanguage.has(ext.toLowerCase());
  }

  /**
   * 获取所有别名映射
   */
  getAliasMappings(): Record<string, string> {
    const mappings: Record<string, string> = {};
    for (const [alias, language] of this.aliasToLanguage) {
      mappings[alias] = language;
    }
    return mappings;
  }

  /**
   * 获取扩展名到语言的映射
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
   */
  getStats() {
    const categoryStats: Record<string, number> = {};

    for (const config of this.languageMap.values()) {
      categoryStats[config.category] = (categoryStats[config.category] || 0) + 1;
    }

    return {
      totalLanguages: this.languageMap.size,
      categoryStats,
      advancedProgramming: this.getAdvancedProgrammingLanguages().length,
      basicProgramming: this.getBasicProgrammingLanguages().length,
      dataFormat: this.getDataFormatLanguages().length,
      specialProcessing: this.getSpecialProcessingLanguages().length,
      hybridProcessing: this.getHybridProcessingLanguages().length,
      totalExtensions: this.extensionToLanguage.size,
      totalAliases: this.aliasToLanguage.size
    };
  }

  /**
   * 获取语言策略配置
   */
  getLanguageStrategy(language: string): any | undefined {
    const config = this.getLanguageConfig(language);
    return config?.strategy;
  }

  /**
   * 检查语言是否使用完整AST
   */
  usesFullAST(language: string): boolean {
    const strategy = this.getLanguageStrategy(language);
    return strategy?.useFullAST === true;
  }

  /**
   * 检查语言是否使用简化AST
   */
  usesSimplifiedAST(language: string): boolean {
    const strategy = this.getLanguageStrategy(language);
    return strategy?.useSimplifiedAST === true;
  }

  /**
   * 获取语言最大查询深度
   */
  getMaxQueryDepth(language: string): number {
    const strategy = this.getLanguageStrategy(language);
    return strategy?.maxQueryDepth || 1;
  }

  /**
   * 检查语言是否跳过复杂查询
   */
  skipsComplexQueries(language: string): boolean {
    const strategy = this.getLanguageStrategy(language);
    return strategy?.skipComplexQueries === true;
  }
}

/**
 * 导出单例实例
 */
export const languageMappingManager = LanguageMappingManager.getInstance();