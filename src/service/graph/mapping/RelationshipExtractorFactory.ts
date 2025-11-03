import { ILanguageRelationshipExtractor } from './interfaces/IRelationshipExtractor';
import { JavaScriptRelationshipExtractor } from './extractors/JavaScriptRelationshipExtractor';
import { SymbolResolver } from '../symbol/SymbolResolver';
import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';

@injectable()
export class RelationshipExtractorFactory {
  private extractors: Map<string, ILanguageRelationshipExtractor> = new Map();

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.TreeSitterService) private treeSitterService: any,
    @inject(TYPES.JavaScriptRelationshipExtractor) private jsExtractor: JavaScriptRelationshipExtractor
  ) {
    this.initializeExtractors();
  }

  private initializeExtractors(): void {
    // 注册语言特定的关系提取器
    // 使用依赖注入容器来创建提取器实例，确保所有依赖都正确注入
    try {
      this.extractors.set('javascript', this.jsExtractor);
      // 注意：其他语言的提取器需要在后续实现并注册
      // this.extractors.set('typescript', this.container.get<TypeScriptRelationshipExtractor>(TYPES.TypeScriptRelationshipExtractor));
      // this.extractors.set('python', this.container.get<PythonRelationshipExtractor>(TYPES.PythonRelationshipExtractor));
      // this.extractors.set('java', this.container.get<JavaRelationshipExtractor>(TYPES.JavaRelationshipExtractor));

      this.logger.info(`Initialized ${this.extractors.size} language relationship extractors`);
    } catch (error) {
      this.logger.error('Failed to initialize relationship extractors', { error: (error as Error).message });
    }
  }

  getExtractor(language: string): ILanguageRelationshipExtractor | null {
    const normalizedLanguage = language.toLowerCase();
    return this.extractors.get(normalizedLanguage) || null;
  }

  getSupportedLanguages(): string[] {
    return Array.from(this.extractors.keys());
  }

  registerExtractor(language: string, extractor: ILanguageRelationshipExtractor): void {
    this.extractors.set(language.toLowerCase(), extractor);
    this.logger.info(`Registered relationship extractor for language: ${language}`);
  }

  // 新增：获取支持的关系类型
  getSupportedRelationshipTypes(language: string): string[] {
    const extractor = this.getExtractor(language);
    return extractor ? extractor.getSupportedRelationshipTypes() : [];
  }

  // 新增：检查是否支持某种关系类型
  supportsRelationshipType(language: string, relationshipType: string): boolean {
    const supportedTypes = this.getSupportedRelationshipTypes(language);
    return supportedTypes.includes(relationshipType);
  }

  // 新增：获取所有支持的关系类型
  getAllSupportedRelationshipTypes(): string[] {
    const allTypes = new Set<string>();
    for (const extractor of this.extractors.values()) {
      for (const type of extractor.getSupportedRelationshipTypes()) {
        allTypes.add(type);
      }
    }
    return Array.from(allTypes);
  }
}