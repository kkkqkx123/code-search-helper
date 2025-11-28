import Parser from 'tree-sitter';
import { LoggerService } from '../../../../utils/LoggerService';
import {
  EntityType,
  RelationshipType,
  RelationshipCategory,
  EntityQueryResult,
  RelationshipQueryResult,
  LocationInfo,
  RelationshipLocationInfo,
  EntityTypeRegistry,
  RelationshipTypeRegistry,
  EntityQueryBuilderFactory,
  RelationshipQueryBuilderFactory
} from './types';
import { queryConfigManager } from './query-config';

/**
 * 查询结果处理器
 * 负责将 Tree-sitter 查询匹配转换为类型化的实体和关系对象
 */
export class QueryResultProcessor {
  private logger: LoggerService;
  private entityRegistry: EntityTypeRegistry;
  private relationshipRegistry: RelationshipTypeRegistry;

  constructor() {
    this.logger = new LoggerService();
    this.entityRegistry = EntityTypeRegistry.getInstance();
    this.relationshipRegistry = RelationshipTypeRegistry.getInstance();
  }

  /**
   * 处理实体查询匹配
   * @param matches Tree-sitter 查询匹配
   * @param entityType 实体类型
   * @param language 语言
   * @param filePath 文件路径
   * @returns 类型化的实体查询结果数组
   */
  processEntityMatches(
    matches: QueryMatch[],
    entityType: EntityType,
    language: string,
    filePath: string
  ): EntityQueryResult[] {
    const entities: EntityQueryResult[] = [];

    for (const match of matches) {
      try {
        const entity = this.createEntityFromMatch(match, entityType, language, filePath);
        if (entity) {
          entities.push(entity);
        }
      } catch (error) {
        this.logger.warn(`创建实体失败 (${entityType}):`, error);
      }
    }

    return entities;
  }

  /**
   * 处理关系查询匹配
   * @param matches Tree-sitter 查询匹配
   * @param relationshipType 关系类型
   * @param language 语言
   * @param filePath 文件路径
   * @param entities 已识别的实体（用于建立关系）
   * @returns 类型化的关系查询结果数组
   */
  processRelationshipMatches(
    matches: QueryMatch[],
    relationshipType: RelationshipType,
    language: string,
    filePath: string,
    entities: EntityQueryResult[]
  ): RelationshipQueryResult[] {
    const relationships: RelationshipQueryResult[] = [];

    for (const match of matches) {
      try {
        const relationship = this.createRelationshipFromMatch(
          match,
          relationshipType,
          language,
          filePath,
          entities
        );
        if (relationship) {
          relationships.push(relationship);
        }
      } catch (error) {
        this.logger.warn(`创建关系失败 (${relationshipType}):`, error);
      }
    }

    return relationships;
  }

  /**
   * 识别实体间的关系
   * @param entities 已识别的实体
   * @param ast AST节点
   * @param language 语言
   * @param filePath 文件路径
   * @returns 识别出的关系数组
   */
  identifyRelationships(
    entities: EntityQueryResult[],
    ast: Parser.SyntaxNode,
    language: string,
    filePath: string
  ): RelationshipQueryResult[] {
    const relationships: RelationshipQueryResult[] = [];

    // 获取语言特定的关系类型配置
    const relationshipTypes = this.getLanguageSpecificRelationshipTypes(language);

    for (const relationshipType of relationshipTypes) {
      try {
        const queryPattern = this.getRelationshipQueryPattern(relationshipType, language);
        if (queryPattern) {
          const matches = this.executeRelationshipQuery(ast, queryPattern, relationshipType);
          const typeRelationships = this.processRelationshipMatches(
            matches,
            relationshipType,
            language,
            filePath,
            entities
          );
          relationships.push(...typeRelationships);
        }
      } catch (error) {
        this.logger.warn(`识别关系失败 (${relationshipType}):`, error);
      }
    }

    return relationships;
  }

  /**
   * 从查询匹配创建实体
   * @param match 查询匹配
   * @param entityType 实体类型
   * @param language 语言
   * @param filePath 文件路径
   * @returns 实体查询结果
   */
  private createEntityFromMatch(
    match: QueryMatch,
    entityType: EntityType,
    language: string,
    filePath: string
  ): EntityQueryResult | null {
    const node = match.node;
    const location = this.extractLocationInfo(node);
    const content = node.text || '';

    // 获取语言特定的实体工厂
    const factory = this.entityRegistry.getFactory(language);
    if (!factory) {
      this.logger.warn(`未找到语言 ${language} 的实体工厂`);
      return this.createGenericEntity(match, entityType, language, filePath);
    }

    // 确定语言特定的实体类型
    const languageType = this.determineLanguageSpecificEntityType(node, entityType, language);

    // 使用工厂创建语言特定的实体
    try {
      const entityData = this.extractEntityData(match, language);
      return factory.createLanguageSpecificEntity(entityType, languageType, entityData);
    } catch (error) {
      this.logger.warn(`使用语言特定工厂创建实体失败，回退到通用实体:`, error);
      return this.createGenericEntity(match, entityType, language, filePath);
    }
  }

  /**
   * 从查询匹配创建关系
   * @param match 查询匹配
   * @param relationshipType 关系类型
   * @param language 语言
   * @param filePath 文件路径
   * @param entities 已识别的实体
   * @returns 关系查询结果
   */
  private createRelationshipFromMatch(
    match: QueryMatch,
    relationshipType: RelationshipType,
    language: string,
    filePath: string,
    entities: EntityQueryResult[]
  ): RelationshipQueryResult | null {
    const node = match.node;
    const location = this.extractRelationshipLocationInfo(node);

    // 识别源和目标实体
    const { fromNodeId, toNodeId } = this.identifyRelationshipEndpoints(match, entities);
    if (!fromNodeId || !toNodeId) {
      this.logger.warn(`无法识别关系的端点: ${relationshipType}`);
      return null;
    }

    // 获取语言特定的关系工厂
    const factory = this.relationshipRegistry.getFactory(language);
    if (!factory) {
      this.logger.warn(`未找到语言 ${language} 的关系工厂`);
      return this.createGenericRelationship(match, relationshipType, language, filePath, fromNodeId, toNodeId);
    }

    // 确定语言特定的关系类型
    const languageType = this.determineLanguageSpecificRelationshipType(node, relationshipType, language);

    try {
      const relationshipData = this.extractRelationshipData(match, language);
      return factory.createLanguageSpecificRelationship(relationshipType, languageType, relationshipData);
    } catch (error) {
      this.logger.warn(`使用语言特定工厂创建关系失败，回退到通用关系:`, error);
      return this.createGenericRelationship(match, relationshipType, language, filePath, fromNodeId, toNodeId);
    }
  }

  /**
   * 创建通用实体（当没有语言特定工厂时）
   */
  private createGenericEntity(
    match: QueryMatch,
    entityType: EntityType,
    language: string,
    filePath: string
  ): EntityQueryResult {
    const node = match.node;
    const location = this.extractLocationInfo(node);
    const content = node.text || '';
    const name = this.extractEntityName(node, entityType);

    const builder = EntityQueryBuilderFactory.createByEntityType(entityType);

    return builder
      .setId(this.generateEntityId(node, entityType, filePath))
      .setEntityType(entityType)
      .setName(name)
      .setPriority(this.getEntityPriority(entityType, language))
      .setLocation(location)
      .setContent(content)
      .setFilePath(filePath)
      .setLanguage(language)
      .addProperty('nodeType', node.type)
      .build();
  }

  /**
   * 创建通用关系（当没有语言特定工厂时）
   */
  private createGenericRelationship(
    match: QueryMatch,
    relationshipType: RelationshipType,
    language: string,
    filePath: string,
    fromNodeId: string,
    toNodeId: string
  ): RelationshipQueryResult {
    const node = match.node;
    const location = this.extractRelationshipLocationInfo(node);
    const category = RelationshipTypeMapping.getCategory(relationshipType);

    const builder = RelationshipQueryBuilderFactory.createByRelationshipType(relationshipType);

    return builder
      .setId(this.generateRelationshipId(node, relationshipType, filePath))
      .setType(relationshipType)
      .setCategory(category)
      .setFromNodeId(fromNodeId)
      .setToNodeId(toNodeId)
      .setLocation(location)
      .setLanguage(language)
      .addProperty('nodeType', node.type)
      .build();
  }

  /**
   * 提取位置信息
   */
  private extractLocationInfo(node: Parser.SyntaxNode): LocationInfo {
    return {
      startLine: node.startPosition.row + 1,
      startColumn: node.startPosition.column + 1,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column + 1
    };
  }

  /**
   * 提取关系位置信息
   */
  private extractRelationshipLocationInfo(node: Parser.SyntaxNode): RelationshipLocationInfo {
    return {
      filePath: '', // 将在调用处设置
      startLine: node.startPosition.row + 1,
      startColumn: node.startPosition.column + 1,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column + 1
    };
  }

  /**
   * 提取实体名称
   */
  private extractEntityName(node: Parser.SyntaxNode, entityType: EntityType): string {
    // 根据实体类型和节点类型提取名称
    switch (entityType) {
      case EntityType.FUNCTION:
        return this.extractFunctionName(node);
      case EntityType.TYPE_DEFINITION:
        return this.extractTypeName(node);
      case EntityType.VARIABLE:
        return this.extractVariableName(node);
      case EntityType.PREPROCESSOR:
        return this.extractPreprocessorName(node);
      case EntityType.ANNOTATION:
        return this.extractAnnotationName(node);
      default:
        return node.type || 'unknown';
    }
  }

  /**
   * 提取函数名称
   */
  private extractFunctionName(node: Parser.SyntaxNode): string {
    // 查找函数名节点
    const functionNameNode = this.findChildByType(node, ['identifier', 'field_identifier', 'function_declarator']);
    return functionNameNode?.text || 'anonymous_function';
  }

  /**
   * 提取类型名称
   */
  private extractTypeName(node: Parser.SyntaxNode): string {
    const typeNameNode = this.findChildByType(node, ['type_identifier', 'identifier', 'field_identifier']);
    return typeNameNode?.text || 'anonymous_type';
  }

  /**
   * 提取变量名称
   */
  private extractVariableName(node: Parser.SyntaxNode): string {
    const variableNameNode = this.findChildByType(node, ['identifier', 'field_identifier']);
    return variableNameNode?.text || 'anonymous_variable';
  }

  /**
   * 提取预处理器名称
   */
  private extractPreprocessorName(node: Parser.SyntaxNode): string {
    const preprocNameNode = this.findChildByType(node, ['identifier', 'preproc_arg']);
    return preprocNameNode?.text || 'anonymous_preprocessor';
  }

  /**
   * 提取注解名称
   */
  private extractAnnotationName(node: Parser.SyntaxNode): string {
    const annotationNameNode = this.findChildByType(node, ['identifier', 'decorator', 'attribute']);
    return annotationNameNode?.text || 'anonymous_annotation';
  }

  /**
   * 根据类型查找子节点
   */
  private findChildByType(node: Parser.SyntaxNode, types: string[]): Parser.SyntaxNode | null {
    for (const child of node.children) {
      if (types.includes(child.type)) {
        return child;
      }
      // 递归查找
      const found = this.findChildByType(child, types);
      if (found) {
        return found;
      }
    }
    return null;
  }

  /**
   * 生成实体ID
   */
  private generateEntityId(node: Parser.SyntaxNode, entityType: EntityType, filePath: string): string {
    const name = this.extractEntityName(node, entityType);
    const location = this.extractLocationInfo(node);
    return `${filePath}:${entityType}:${name}:${location.startLine}:${location.startColumn}`;
  }

  /**
   * 生成关系ID
   */
  private generateRelationshipId(node: Parser.SyntaxNode, relationshipType: RelationshipType, filePath: string): string {
    const location = this.extractLocationInfo(node);
    return `${filePath}:${relationshipType}:${location.startLine}:${location.startColumn}`;
  }

  /**
   * 获取实体优先级
   */
  private getEntityPriority(entityType: EntityType, language: string): number {
    const factory = this.entityRegistry.getFactory(language);
    if (factory) {
      return factory.getEntityTypePriority(entityType.toString());
    }

    // 默认优先级
    const priorityMap: Record<EntityType, number> = {
      [EntityType.PREPROCESSOR]: 5,
      [EntityType.TYPE_DEFINITION]: 4,
      [EntityType.FUNCTION]: 3,
      [EntityType.VARIABLE]: 2,
      [EntityType.ANNOTATION]: 1
    };

    return priorityMap[entityType] || 0;
  }

  /**
   * 确定语言特定的实体类型
   */
  private determineLanguageSpecificEntityType(node: Parser.SyntaxNode, entityType: EntityType, language: string): string {
    // 这里可以根据语言和节点类型确定更具体的实体类型
    // 例如，对于C语言，FUNCTION 可能是 CEntityType.FUNCTION 或 CEntityType.FUNCTION_PROTOTYPE

    // 简化实现，直接返回基础类型
    return entityType.toString();
  }

  /**
   * 确定语言特定的关系类型
   */
  private determineLanguageSpecificRelationshipType(node: Parser.SyntaxNode, relationshipType: RelationshipType, language: string): string {
    // 类似于实体类型的确定逻辑
    return relationshipType.toString();
  }

  /**
   * 提取实体数据
   */
  private extractEntityData(match: QueryMatch, language: string): any {
    return {
      node: match.node,
      captures: match.captures,
      location: match.location,
      language
    };
  }

  /**
   * 提取关系数据
   */
  private extractRelationshipData(match: QueryMatch, language: string): any {
    return {
      node: match.node,
      captures: match.captures,
      location: match.location,
      language
    };
  }

  /**
   * 识别关系的端点（源和目标实体）
   */
  private identifyRelationshipEndpoints(match: QueryMatch, entities: EntityQueryResult[]): { fromNodeId?: string; toNodeId?: string } {
    // 这里需要根据具体的查询匹配来识别关系的源和目标
    // 这是一个简化的实现，实际需要更复杂的逻辑

    const node = match.node;
    const location = this.extractLocationInfo(node);

    // 查找位置最近的实体作为端点
    const nearbyEntities = entities.filter(entity =>
      this.isLocationNearby(location, entity.location)
    );

    if (nearbyEntities.length >= 2) {
      return {
        fromNodeId: nearbyEntities[0].id,
        toNodeId: nearbyEntities[1].id
      };
    }

    return {};
  }

  /**
   * 检查位置是否相近
   */
  private isLocationNearby(loc1: LocationInfo, loc2: LocationInfo, threshold: number = 10): boolean {
    return Math.abs(loc1.startLine - loc2.startLine) <= threshold;
  }

  /**
   * 获取语言特定的关系类型
   */
  private getLanguageSpecificRelationshipTypes(language: string): RelationshipType[] {
    const relationshipQueryTypes = queryConfigManager.getRelationshipQueryTypes();
    const types: RelationshipType[] = [];

    for (const queryType of relationshipQueryTypes) {
      const config = queryConfigManager.getQueryTypeConfig(queryType);
      if (config && this.isQueryTypeSupportedForLanguage(config, language)) {
        types.push(...(config.relationshipTypes || []));
      }
    }

    return [...new Set(types)]; // 去重
  }

  /**
   * 检查查询类型是否支持指定语言
   */
  private isQueryTypeSupportedForLanguage(config: any, language: string): boolean {
    if (!config.supportedLanguages || config.supportedLanguages.length === 0) {
      return true;
    }
    return config.supportedLanguages.includes(language.toLowerCase());
  }

  /**
   * 获取关系查询模式
   */
  private getRelationshipQueryPattern(relationshipType: RelationshipType, language: string): string | null {
    // 这里应该从查询配置中获取对应的查询模式
    // 简化实现，返回null
    return null;
  }

  /**
   * 执行关系查询
   */
  private executeRelationshipQuery(ast: Parser.SyntaxNode, pattern: string, relationshipType: RelationshipType): QueryMatch[] {
    // 这里应该执行实际的Tree-sitter查询
    // 简化实现，返回空数组
    return [];
  }
}

// 导出 QueryMatch 接口以保持兼容性
export interface QueryMatch {
  node: Parser.SyntaxNode;
  captures: Record<string, Parser.SyntaxNode>;
  location: {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  };
}

// 导出 RelationshipTypeMapping 工具类
class RelationshipTypeMapping {
  static getCategory(type: RelationshipType): RelationshipCategory {
    // 这里应该实现关系类型到类别的映射
    // 简化实现
    switch (type) {
      case RelationshipType.CALL:
      case RelationshipType.METHOD_CALL:
      case RelationshipType.FUNCTION_POINTER_CALL:
      case RelationshipType.RECURSIVE_CALL:
        return RelationshipCategory.CALL;
      case RelationshipType.ASSIGNMENT:
      case RelationshipType.PARAMETER_PASSING:
      case RelationshipType.RETURN_VALUE:
      case RelationshipType.TYPE_CONVERSION:
        return RelationshipCategory.DATA_FLOW;
      case RelationshipType.CONDITIONAL:
      case RelationshipType.LOOP:
      case RelationshipType.JUMP:
        return RelationshipCategory.CONTROL_FLOW;
      case RelationshipType.INCLUDE:
      case RelationshipType.TYPE_REFERENCE:
      case RelationshipType.FUNCTION_REFERENCE:
      case RelationshipType.VARIABLE_REFERENCE:
        return RelationshipCategory.DEPENDENCY;
      case RelationshipType.EXTENDS:
      case RelationshipType.IMPLEMENTS:
      case RelationshipType.COMPOSITION:
        return RelationshipCategory.INHERITANCE;
      case RelationshipType.INITIALIZATION:
      case RelationshipType.CLEANUP:
        return RelationshipCategory.LIFECYCLE;
      case RelationshipType.ERROR_HANDLING:
      case RelationshipType.RESOURCE_MANAGEMENT:
        return RelationshipCategory.SEMANTIC;
      case RelationshipType.REFERENCE:
        return RelationshipCategory.REFERENCE;
      case RelationshipType.ANNOTATION:
        return RelationshipCategory.ANNOTATION;
      default:
        throw new Error(`Unknown relationship type: ${type}`);
    }
  }
}