import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { IRelationshipMetadataProcessor } from './interfaces/IRelationshipMetadataProcessor';
import {
  CallRelationshipProcessor,
  InheritanceRelationshipProcessor,
  DependencyRelationshipProcessor,
  ReferenceRelationshipProcessor,
  CreationRelationshipProcessor,
  AnnotationRelationshipProcessor,
  DataFlowRelationshipProcessor,
  ControlFlowRelationshipProcessor,
  SemanticRelationshipProcessor,
  LifecycleRelationshipProcessor,
  ConcurrencyRelationshipProcessor,
  ImplementsRelationshipProcessor
} from './interfaces/IRelationshipMetadataProcessor';

/**
 * @deprecated 此类已废弃，关系提取现在通过标准化模块和关系元数据处理器处理
 * 保留此类以确保向后兼容性，但所有功能已迁移到新的架构
 */
@injectable()
export class RelationshipExtractorFactory {
  private logger: LoggerService;
  
  // 关系元数据处理器映射
  private relationshipProcessors: Map<string, IRelationshipMetadataProcessor> = new Map();

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    this.logger = logger;
    this.initializeProcessors();
    this.logger.warn('RelationshipExtractorFactory is deprecated. All relationship extraction is now handled by standardized modules and metadata processors.');
  }

  private initializeProcessors(): void {
    // 初始化关系元数据处理器
    this.relationshipProcessors.set('call', new CallRelationshipProcessor());
    this.relationshipProcessors.set('inheritance', new InheritanceRelationshipProcessor());
    this.relationshipProcessors.set('dependency', new DependencyRelationshipProcessor());
    this.relationshipProcessors.set('reference', new ReferenceRelationshipProcessor());
    this.relationshipProcessors.set('creation', new CreationRelationshipProcessor());
    this.relationshipProcessors.set('annotation', new AnnotationRelationshipProcessor());
    this.relationshipProcessors.set('data-flow', new DataFlowRelationshipProcessor());
    this.relationshipProcessors.set('control-flow', new ControlFlowRelationshipProcessor());
    this.relationshipProcessors.set('semantic', new SemanticRelationshipProcessor());
    this.relationshipProcessors.set('lifecycle', new LifecycleRelationshipProcessor());
    this.relationshipProcessors.set('concurrency', new ConcurrencyRelationshipProcessor());
    this.relationshipProcessors.set('implements', new ImplementsRelationshipProcessor());
  }

  /**
   * @deprecated 此方法已废弃，请使用GraphDataMappingService中的关系处理器
   */
  getExtractor(language: string): null {
    this.logger.warn('getExtractor is deprecated. Relationship extraction is now handled by standardized modules.');
    return null;
  }

  /**
   * @deprecated 此方法已废弃
   */
  getSupportedLanguages(): string[] {
    this.logger.warn('getSupportedLanguages is deprecated.');
    return [];
  }

  /**
   * @deprecated 此方法已废弃
   */
  registerExtractor(language: string, extractor: any): void {
    this.logger.warn('registerExtractor is deprecated. All relationship extraction is now handled by standardized modules.');
  }

  /**
   * 获取关系元数据处理器
   * @param relationshipType 关系类型
   * @returns 关系元数据处理器
   */
  getRelationshipProcessor(relationshipType: string): IRelationshipMetadataProcessor | null {
    return this.relationshipProcessors.get(relationshipType) || null;
  }

  /**
   * 获取支持的关系类型
   */
  getSupportedRelationshipTypes(): string[] {
    return Array.from(this.relationshipProcessors.keys());
  }

  /**
   * 检查是否支持某种关系类型
   */
  supportsRelationshipType(relationshipType: string): boolean {
    return this.relationshipProcessors.has(relationshipType);
  }

  /**
   * 获取所有支持的关系类型（包括遗留方法兼容性）
   * @deprecated 使用 getSupportedRelationshipTypes() 替代
   */
  getAllSupportedRelationshipTypes(): string[] {
    return this.getSupportedRelationshipTypes();
  }
}