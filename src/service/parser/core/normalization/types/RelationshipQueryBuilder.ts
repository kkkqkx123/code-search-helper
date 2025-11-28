/**
 * 关系查询结果构建器
 * 提供便捷的构建方式，支持链式调用
 */

import {
  RelationshipQueryResult,
  RelationshipType,
  RelationshipCategory,
  RelationshipLocationInfo,
  GenericRelationshipQueryResult,
  RelationshipTypeRegistry,
  RelationshipTypeMapping
} from './RelationshipTypes';

/**
 * 关系查询结果构建器类
 */
export class RelationshipQueryBuilder {
  protected relationship: Partial<RelationshipQueryResult>;
  
  constructor() {
    this.relationship = {
      directed: true,
      language: 'unknown',
      properties: {}
    };
  }
  
  /**
   * 设置关系ID
   * @param id 唯一标识符
   * @returns 构建器实例
   */
  setId(id: string): this {
    this.relationship.id = id;
    return this;
  }
  
  /**
   * 设置关系类型
   * @param type 关系类型
   * @returns 构建器实例
   */
  setType(type: RelationshipType): this {
    this.relationship.type = type;
    this.relationship.category = RelationshipTypeMapping.getCategory(type);
    return this;
  }
  
  /**
   * 设置关系类别
   * @param category 关系类别
   * @returns 构建器实例
   */
  setCategory(category: RelationshipCategory): this {
    this.relationship.category = category;
    return this;
  }
  
  /**
   * 设置源节点ID
   * @param fromNodeId 源节点ID
   * @returns 构建器实例
   */
  setFromNodeId(fromNodeId: string): this {
    this.relationship.fromNodeId = fromNodeId;
    return this;
  }
  
  /**
   * 设置目标节点ID
   * @param toNodeId 目标节点ID
   * @returns 构建器实例
   */
  setToNodeId(toNodeId: string): this {
    this.relationship.toNodeId = toNodeId;
    return this;
  }
  
  /**
   * 设置关系方向
   * @param directed 是否为有向关系
   * @returns 构建器实例
   */
  setDirected(directed: boolean): this {
    this.relationship.directed = directed;
    return this;
  }
  
  /**
   * 设置关系强度
   * @param strength 关系强度（0-1）
   * @returns 构建器实例
   */
  setStrength(strength: number): this {
    this.relationship.strength = strength;
    return this;
  }
  
  /**
   * 设置关系权重
   * @param weight 关系权重
   * @returns 构建器实例
   */
  setWeight(weight: number): this {
    this.relationship.weight = weight;
    return this;
  }
  
  /**
   * 设置位置信息
   * @param location 位置信息
   * @returns 构建器实例
   */
  setLocation(location: RelationshipLocationInfo): this {
    this.relationship.location = location;
    return this;
  }
  
  /**
   * 设置位置信息（简化版本）
   * @param filePath 文件路径
   * @param startLine 开始行号
   * @param startColumn 开始列号
   * @param endLine 结束行号
   * @param endColumn 结束列号
   * @returns 构建器实例
   */
  setLocationSimple(
    filePath: string,
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number
  ): this {
    this.relationship.location = {
      filePath,
      startLine,
      startColumn,
      endLine,
      endColumn
    };
    return this;
  }
  
  /**
   * 设置语言类型
   * @param language 语言类型
   * @returns 构建器实例
   */
  setLanguage(language: string): this {
    this.relationship.language = language;
    return this;
  }
  
  /**
   * 添加扩展属性
   * @param key 属性键
   * @param value 属性值
   * @returns 构建器实例
   */
  addProperty(key: string, value: any): this {
    if (!this.relationship.properties) {
      this.relationship.properties = {};
    }
    this.relationship.properties[key] = value;
    return this;
  }
  
  /**
   * 设置扩展属性
   * @param properties 属性对象
   * @returns 构建器实例
   */
  setProperties(properties: Record<string, any>): this {
    this.relationship.properties = { ...properties };
    return this;
  }
  
  /**
   * 合并扩展属性
   * @param properties 属性对象
   * @returns 构建器实例
   */
  mergeProperties(properties: Record<string, any>): this {
    if (!this.relationship.properties) {
      this.relationship.properties = {};
    }
    this.relationship.properties = { ...this.relationship.properties, ...properties };
    return this;
  }
  
  /**
   * 从现有关系复制属性
   * @param existingRelationship 现有关系
   * @returns 构建器实例
   */
  fromExisting(existingRelationship: Partial<RelationshipQueryResult>): this {
    this.relationship = { ...this.relationship, ...existingRelationship };
    return this;
  }
  
  /**
   * 构建关系查询结果
   * @returns 关系查询结果
   * @throws 如果缺少必需字段
   */
  build(): RelationshipQueryResult {
    if (!this.relationship.id || !this.relationship.type || 
        !this.relationship.fromNodeId || !this.relationship.toNodeId) {
      throw new Error('Missing required fields: id, type, fromNodeId, toNodeId');
    }
    
    if (!this.relationship.category) {
      throw new Error('Missing required field: category');
    }
    
    if (!this.relationship.location) {
      throw new Error('Missing required field: location');
    }
    
    return this.relationship as RelationshipQueryResult;
  }
  
  /**
   * 构建关系查询结果（可选验证）
   * @param validate 是否验证必需字段
   * @returns 关系查询结果
   */
  buildOptional(validate: boolean = true): RelationshipQueryResult {
    if (validate) {
      return this.build();
    }
    
    return this.relationship as RelationshipQueryResult;
  }
  
  /**
   * 重置构建器
   * @returns 构建器实例
   */
  reset(): this {
    this.relationship = {
      directed: true,
      language: 'unknown',
      properties: {}
    };
    return this;
  }
  
  /**
   * 克隆构建器
   * @returns 新的构建器实例
   */
  clone(): RelationshipQueryBuilder {
    const newBuilder = new RelationshipQueryBuilder();
    newBuilder.relationship = { ...this.relationship };
    return newBuilder;
  }
}

/**
 * 调用关系构建器
 */
export class CallRelationshipBuilder extends RelationshipQueryBuilder {
  setFunctionName(functionName: string): this {
    this.addProperty('functionName', functionName);
    return this;
  }
  
  setArguments(args: string[]): this {
    this.addProperty('arguments', args);
    return this;
  }
  
  setIsChained(isChained: boolean): this {
    this.addProperty('isChained', isChained);
    return this;
  }
  
  setChainDepth(chainDepth: number): this {
    this.addProperty('chainDepth', chainDepth);
    return this;
  }
  
  setIsRecursive(isRecursive: boolean): this {
    this.addProperty('isRecursive', isRecursive);
    return this;
  }
}

/**
 * 数据流关系构建器
 */
export class DataFlowRelationshipBuilder extends RelationshipQueryBuilder {
  setSourceVariable(sourceVariable: string): this {
    this.addProperty('sourceVariable', sourceVariable);
    return this;
  }
  
  setTargetVariable(targetVariable: string): this {
    this.addProperty('targetVariable', targetVariable);
    return this;
  }
  
  setDataType(dataType: string): this {
    this.addProperty('dataType', dataType);
    return this;
  }
  
  setFlowPath(flowPath: string[]): this {
    this.addProperty('flowPath', flowPath);
    return this;
  }
  
  setOperator(operator: string): this {
    this.addProperty('operator', operator);
    return this;
  }
}

/**
 * 控制流关系构建器
 */
export class ControlFlowRelationshipBuilder extends RelationshipQueryBuilder {
  setCondition(condition: string): this {
    this.addProperty('condition', condition);
    return this;
  }
  
  setLoopVariable(loopVariable: string): this {
    this.addProperty('loopVariable', loopVariable);
    return this;
  }
  
  setControlFlowTargets(controlFlowTargets: string[]): this {
    this.addProperty('controlFlowTargets', controlFlowTargets);
    return this;
  }
  
  setLabelName(labelName: string): this {
    this.addProperty('labelName', labelName);
    return this;
  }
}

/**
 * 依赖关系构建器
 */
export class DependencyRelationshipBuilder extends RelationshipQueryBuilder {
  setDependencyPath(dependencyPath: string): this {
    this.addProperty('dependencyPath', dependencyPath);
    return this;
  }
  
  setIsStandardLibrary(isStandardLibrary: boolean): this {
    this.addProperty('isStandardLibrary', isStandardLibrary);
    return this;
  }
  
  setMacroName(macroName: string): this {
    this.addProperty('macroName', macroName);
    return this;
  }
  
  setConditionSymbol(conditionSymbol: string): this {
    this.addProperty('conditionSymbol', conditionSymbol);
    return this;
  }
}

/**
 * 继承关系构建器
 */
export class InheritanceRelationshipBuilder extends RelationshipQueryBuilder {
  setParentType(parentType: string): this {
    this.addProperty('parentType', parentType);
    return this;
  }
  
  setChildType(childType: string): this {
    this.addProperty('childType', childType);
    return this;
  }
  
  setInheritanceDepth(inheritanceDepth: number): this {
    this.addProperty('inheritanceDepth', inheritanceDepth);
    return this;
  }
  
  setFieldName(fieldName: string): this {
    this.addProperty('fieldName', fieldName);
    return this;
  }
}

/**
 * 生命周期关系构建器
 */
export class LifecycleRelationshipBuilder extends RelationshipQueryBuilder {
  setResourceType(resourceType: string): this {
    this.addProperty('resourceType', resourceType);
    return this;
  }
  
  setCleanupMechanism(cleanupMechanism: string): this {
    this.addProperty('cleanupMechanism', cleanupMechanism);
    return this;
  }
  
  setOperation(operation: string): this {
    this.addProperty('operation', operation);
    return this;
  }
  
  setScopeType(scopeType: string): this {
    this.addProperty('scopeType', scopeType);
    return this;
  }
}

/**
 * 语义关系构建器
 */
export class SemanticRelationshipBuilder extends RelationshipQueryBuilder {
  setErrorCode(errorCode: string): this {
    this.addProperty('errorCode', errorCode);
    return this;
  }
  
  setErrorValue(errorValue: string): this {
    this.addProperty('errorValue', errorValue);
    return this;
  }
  
  setResourceConstructor(resourceConstructor: string): this {
    this.addProperty('resourceConstructor', resourceConstructor);
    return this;
  }
  
  setCallbackFunction(callbackFunction: string): this {
    this.addProperty('callbackFunction', callbackFunction);
    return this;
  }
}

/**
 * 引用关系构建器
 */
export class ReferenceRelationshipBuilder extends RelationshipQueryBuilder {
  setReferenceName(referenceName: string): this {
    this.addProperty('referenceName', referenceName);
    return this;
  }
  
  setReferenceContext(referenceContext: string): this {
    this.addProperty('referenceContext', referenceContext);
    return this;
  }
  
  setIsDefinition(isDefinition: boolean): this {
    this.addProperty('isDefinition', isDefinition);
    return this;
  }
}

/**
 * 注解关系构建器
 */
export class AnnotationRelationshipBuilder extends RelationshipQueryBuilder {
  setAnnotationName(annotationName: string): this {
    this.addProperty('annotationName', annotationName);
    return this;
  }
  
  setAnnotationArguments(annotationArguments: string[]): this {
    this.addProperty('annotationArguments', annotationArguments);
    return this;
  }
  
  setTarget(target: string): this {
    this.addProperty('target', target);
    return this;
  }
}

/**
 * 构建器工厂类
 */
export class RelationshipQueryBuilderFactory {
  /**
   * 创建通用关系构建器
   * @returns 通用关系构建器
   */
  static createGeneric(): RelationshipQueryBuilder {
    return new RelationshipQueryBuilder();
  }
  
  /**
   * 创建调用关系构建器
   * @returns 调用关系构建器
   */
  static createCall(): CallRelationshipBuilder {
    return new CallRelationshipBuilder();
  }
  
  /**
   * 创建数据流关系构建器
   * @returns 数据流关系构建器
   */
  static createDataFlow(): DataFlowRelationshipBuilder {
    return new DataFlowRelationshipBuilder();
  }
  
  /**
   * 创建控制流关系构建器
   * @returns 控制流关系构建器
   */
  static createControlFlow(): ControlFlowRelationshipBuilder {
    return new ControlFlowRelationshipBuilder();
  }
  
  /**
   * 创建依赖关系构建器
   * @returns 依赖关系构建器
   */
  static createDependency(): DependencyRelationshipBuilder {
    return new DependencyRelationshipBuilder();
  }
  
  /**
   * 创建继承关系构建器
   * @returns 继承关系构建器
   */
  static createInheritance(): InheritanceRelationshipBuilder {
    return new InheritanceRelationshipBuilder();
  }
  
  /**
   * 创建生命周期关系构建器
   * @returns 生命周期关系构建器
   */
  static createLifecycle(): LifecycleRelationshipBuilder {
    return new LifecycleRelationshipBuilder();
  }
  
  /**
   * 创建语义关系构建器
   * @returns 语义关系构建器
   */
  static createSemantic(): SemanticRelationshipBuilder {
    return new SemanticRelationshipBuilder();
  }
  
  /**
   * 创建引用关系构建器
   * @returns 引用关系构建器
   */
  static createReference(): ReferenceRelationshipBuilder {
    return new ReferenceRelationshipBuilder();
  }
  
  /**
   * 创建注解关系构建器
   * @returns 注解关系构建器
   */
  static createAnnotation(): AnnotationRelationshipBuilder {
    return new AnnotationRelationshipBuilder();
  }
  
  /**
   * 根据关系类型创建对应的构建器
   * @param relationshipType 关系类型
   * @returns 对应的构建器
   */
  static createByRelationshipType(relationshipType: RelationshipType): RelationshipQueryBuilder {
    const category = RelationshipTypeMapping.getCategory(relationshipType);
    
    switch (category) {
      case RelationshipCategory.CALL:
        return this.createCall();
        
      case RelationshipCategory.DATA_FLOW:
        return this.createDataFlow();
        
      case RelationshipCategory.CONTROL_FLOW:
        return this.createControlFlow();
        
      case RelationshipCategory.DEPENDENCY:
        return this.createDependency();
        
      case RelationshipCategory.INHERITANCE:
        return this.createInheritance();
        
      case RelationshipCategory.LIFECYCLE:
        return this.createLifecycle();
        
      case RelationshipCategory.SEMANTIC:
        return this.createSemantic();
        
      case RelationshipCategory.REFERENCE:
        return this.createReference();
        
      case RelationshipCategory.ANNOTATION:
        return this.createAnnotation();
        
      default:
        return this.createGeneric();
    }
  }
  
  /**
   * 根据语言和语言特定类型创建关系
   * @param language 语言类型
   * @param languageType 语言特定的关系类型
   * @param data 关系数据
   * @returns 关系查询结果
   */
  static createLanguageSpecificRelationship(
    language: string,
    languageType: string,
    data: any
  ): RelationshipQueryResult {
    const registry = RelationshipTypeRegistry.getInstance();
    const factory = registry.getFactory(language);
    
    if (!factory) {
      throw new Error(`No relationship type factory registered for language: ${language}`);
    }
    
    // 确定基础关系类型
    const languageTypes = factory.getLanguageSpecificTypes();
    const baseType = languageTypes[languageType];
    
    if (!baseType) {
      throw new Error(`Unknown language type: ${languageType} for language: ${language}`);
    }
    
    return factory.createLanguageSpecificRelationship(baseType, languageType, data);
  }
}