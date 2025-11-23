import Parser from 'tree-sitter';
import { SymbolTable } from '../../types';

/**
 * 关系提取器管理器
 * 统一管理所有关系提取器的实例化和调用
 * 支持动态加载语言特定的关系提取器
 */
export class RelationshipExtractorManager {
  private extractors: Map<string, any> = new Map();
  private language: string;
  private extractorModules: Map<string, any> = new Map();

  constructor(language: string) {
    this.language = language;
    this.initializeExtractorModules();
  }

  /**
   * 初始化关系提取器模块映射
   */
  private initializeExtractorModules(): void {
    // 根据语言映射到相应的工具模块
    const languageModuleMap: Record<string, string> = {
      'javascript': 'js-utils',
      'typescript': 'js-utils',
      'python': 'python-utils',
      'java': 'java-utils',
      'c': 'c-utils',
      'cpp': 'cpp-utils',
      'csharp': 'csharp-utils',
      'go': 'go-utils',
      'rust': 'rust-utils'
    };

    const modulePath = languageModuleMap[this.language];
    if (modulePath) {
      this.extractorModules.set('modulePath', `../${modulePath}`);
    }
  }

  /**
   * 动态加载关系提取器
   */
  private async loadExtractor(extractorType: string): Promise<any> {
    const modulePath = this.extractorModules.get('modulePath');
    if (!modulePath) {
      return null;
    }

    try {
      // 动态导入语言特定的关系提取器
      const module = await import(modulePath);
      const extractorClassName = this.getExtractorClassName(extractorType);
      const ExtractorClass = module[extractorClassName];

      if (ExtractorClass) {
        return new ExtractorClass();
      }
    } catch (error) {
      console.warn(`Failed to load ${extractorType} extractor for ${this.language}:`, error);
    }

    return null;
  }

  /**
   * 获取提取器类名
   */
  private getExtractorClassName(extractorType: string): string {
    const nameMapping: Record<string, string> = {
      'annotation': 'AnnotationRelationshipExtractor',
      'call': 'CallRelationshipExtractor',
      'creation': 'CreationRelationshipExtractor',
      'dataFlow': 'DataFlowRelationshipExtractor',
      'dependency': 'DependencyRelationshipExtractor',
      'inheritance': 'InheritanceRelationshipExtractor',
      'reference': 'ReferenceRelationshipExtractor',
      'concurrency': 'ConcurrencyRelationshipExtractor',
      'lifecycle': 'LifecycleRelationshipExtractor',
      'semantic': 'SemanticRelationshipExtractor',
      'controlFlow': 'ControlFlowRelationshipExtractor'
    };
    return nameMapping[extractorType] || extractorType;
  }

  /**
   * 提取关系元数据
   */
  async extractMetadata(
    result: any,
    standardType: string,
    astNode: Parser.SyntaxNode,
    symbolTable: SymbolTable | null
  ): Promise<any> {
    const extractorKey = this.getExtractorKey(standardType);
    let extractor = this.extractors.get(extractorKey);

    // 如果提取器未加载，尝试动态加载
    if (!extractor) {
      extractor = await this.loadExtractor(extractorKey);
      if (extractor) {
        this.extractors.set(extractorKey, extractor);
      }
    }

    if (!extractor) {
      return null;
    }

    try {
      const methodName = this.getExtractorMethodName(standardType);
      if (typeof extractor[methodName] === 'function') {
        return extractor[methodName](result, astNode, symbolTable);
      }
    } catch (error) {
      console.error(`Error extracting ${standardType} relationship metadata:`, error);
      return null;
    }

    return null;
  }

  /**
   * 获取提取器键名
   */
  private getExtractorKey(standardType: string): string {
    const keyMapping: Record<string, string> = {
      'annotation': 'annotation',
      'call': 'call',
      'creation': 'creation',
      'data-flow': 'dataFlow',
      'dependency': 'dependency',
      'inheritance': 'inheritance',
      'reference': 'reference',
      'concurrency': 'concurrency',
      'lifecycle': 'lifecycle',
      'semantic': 'semantic',
      'control-flow': 'controlFlow'
    };
    return keyMapping[standardType] || standardType;
  }

  /**
   * 获取提取器方法名
   */
  private getExtractorMethodName(standardType: string): string {
    const methodMapping: Record<string, string> = {
      'annotation': 'extractAnnotationMetadata',
      'call': 'extractCallMetadata',
      'creation': 'extractCreationMetadata',
      'data-flow': 'extractDataFlowMetadata',
      'dependency': 'extractDependencyMetadata',
      'inheritance': 'extractInheritanceMetadata',
      'reference': 'extractReferenceMetadata',
      'concurrency': 'extractConcurrencyMetadata',
      'lifecycle': 'extractLifecycleMetadata',
      'semantic': 'extractSemanticMetadata',
      'control-flow': 'extractControlFlowMetadata'
    };
    return methodMapping[standardType] || `extract${standardType}Metadata`;
  }

  /**
   * 高级关系提取方法
   */
  async extractDataFlowRelationships(result: any): Promise<Array<any>> {
    const extractor = await this.getExtractor('dataFlow');
    return extractor?.extractDataFlowRelationships?.(result) || [];
  }

  async extractControlFlowRelationships(result: any): Promise<Array<any>> {
    const extractor = await this.getExtractor('controlFlow');
    return extractor?.extractControlFlowRelationships?.(result) || [];
  }

  async extractSemanticRelationships(result: any): Promise<Array<any>> {
    const extractor = await this.getExtractor('semantic');
    return extractor?.extractSemanticRelationships?.(result) || [];
  }

  async extractLifecycleRelationships(result: any): Promise<Array<any>> {
    const extractor = await this.getExtractor('lifecycle');
    return extractor?.extractLifecycleRelationships?.(result) || [];
  }

  async extractConcurrencyRelationships(result: any): Promise<Array<any>> {
    const extractor = await this.getExtractor('concurrency');
    return extractor?.extractConcurrencyRelationships?.(result) || [];
  }

  async extractCallRelationships(result: any): Promise<Array<any>> {
    const extractor = await this.getExtractor('call');
    return extractor?.extractCallRelationships?.(result) || [];
  }

  async extractAnnotationRelationships(result: any): Promise<Array<any>> {
    const extractor = await this.getExtractor('annotation');
    return extractor?.extractAnnotationRelationships?.(result) || [];
  }

  async extractCreationRelationships(result: any): Promise<Array<any>> {
    const extractor = await this.getExtractor('creation');
    return extractor?.extractCreationRelationships?.(result) || [];
  }

  async extractDependencyRelationships(result: any): Promise<Array<any>> {
    const extractor = await this.getExtractor('dependency');
    return extractor?.extractDependencyRelationships?.(result) || [];
  }

  async extractInheritanceRelationships(result: any): Promise<Array<any>> {
    const extractor = await this.getExtractor('inheritance');
    return extractor?.extractInheritanceRelationships?.(result) || [];
  }

  async extractReferenceRelationships(result: any): Promise<Array<any>> {
    const extractor = await this.getExtractor('reference');
    return extractor?.extractReferenceRelationships?.(result) || [];
  }

  /**
   * 获取或加载提取器
   */
  private async getExtractor(extractorKey: string): Promise<any> {
    let extractor = this.extractors.get(extractorKey);

    if (!extractor) {
      extractor = await this.loadExtractor(extractorKey);
      if (extractor) {
        this.extractors.set(extractorKey, extractor);
      }
    }

    return extractor;
  }
}