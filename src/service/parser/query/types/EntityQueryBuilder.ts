/**
 * 实体查询结果构建器
 * 提供便捷的构建方式，支持链式调用
 */

import {
  EntityQueryResult,
  EntityType,
  LocationInfo,
  GenericEntityQueryResult,
  EntityTypeRegistry
} from './EntityTypes';

/**
 * 实体查询结果构建器类
 */
export class EntityQueryBuilder {
  protected entity: Partial<EntityQueryResult>;
  
  constructor() {
    this.entity = {
      priority: 0,
      language: 'unknown',
      properties: {}
    };
  }
  
  /**
   * 设置实体ID
   * @param id 唯一标识符
   * @returns 构建器实例
   */
  setId(id: string): this {
    this.entity.id = id;
    return this;
  }
  
  /**
   * 设置实体类型
   * @param entityType 实体类型
   * @returns 构建器实例
   */
  setEntityType(entityType: EntityType): this {
    this.entity.entityType = entityType;
    return this;
  }
  
  /**
   * 设置实体名称
   * @param name 实体名称
   * @returns 构建器实例
   */
  setName(name: string): this {
    this.entity.name = name;
    return this;
  }
  
  /**
   * 设置优先级
   * @param priority 优先级数值
   * @returns 构建器实例
   */
  setPriority(priority: number): this {
    this.entity.priority = priority;
    return this;
  }
  
  /**
   * 设置位置信息
   * @param location 位置信息
   * @returns 构建器实例
   */
  setLocation(location: LocationInfo): this {
    this.entity.location = location;
    return this;
  }
  
  /**
   * 设置位置信息（简化版本）
   * @param startLine 开始行号
   * @param startColumn 开始列号
   * @param endLine 结束行号
   * @param endColumn 结束列号
   * @returns 构建器实例
   */
  setLocationSimple(
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number
  ): this {
    this.entity.location = {
      startLine,
      startColumn,
      endLine,
      endColumn
    };
    return this;
  }
  
  /**
   * 设置实体内容
   * @param content 实体内容
   * @returns 构建器实例
   */
  setContent(content: string): this {
    this.entity.content = content;
    return this;
  }
  
  /**
   * 设置文件路径
   * @param filePath 文件路径
   * @returns 构建器实例
   */
  setFilePath(filePath: string): this {
    this.entity.filePath = filePath;
    return this;
  }
  
  /**
   * 设置语言类型
   * @param language 语言类型
   * @returns 构建器实例
   */
  setLanguage(language: string): this {
    this.entity.language = language;
    return this;
  }
  
  /**
   * 添加扩展属性
   * @param key 属性键
   * @param value 属性值
   * @returns 构建器实例
   */
  addProperty(key: string, value: any): this {
    if (!this.entity.properties) {
      this.entity.properties = {};
    }
    this.entity.properties[key] = value;
    return this;
  }
  
  /**
   * 设置扩展属性
   * @param properties 属性对象
   * @returns 构建器实例
   */
  setProperties(properties: Record<string, any>): this {
    this.entity.properties = { ...properties };
    return this;
  }
  
  /**
   * 合并扩展属性
   * @param properties 属性对象
   * @returns 构建器实例
   */
  mergeProperties(properties: Record<string, any>): this {
    if (!this.entity.properties) {
      this.entity.properties = {};
    }
    this.entity.properties = { ...this.entity.properties, ...properties };
    return this;
  }
  
  /**
   * 从现有实体复制属性
   * @param existingEntity 现有实体
   * @returns 构建器实例
   */
  fromExisting(existingEntity: Partial<EntityQueryResult>): this {
    this.entity = { ...this.entity, ...existingEntity };
    return this;
  }
  
  /**
   * 构建实体查询结果
   * @returns 实体查询结果
   * @throws 如果缺少必需字段
   */
  build(): EntityQueryResult {
    if (!this.entity.id || !this.entity.entityType || !this.entity.name) {
      throw new Error('Missing required fields: id, entityType, name');
    }
    
    if (!this.entity.location) {
      throw new Error('Missing required field: location');
    }
    
    if (!this.entity.content) {
      throw new Error('Missing required field: content');
    }
    
    if (!this.entity.filePath) {
      throw new Error('Missing required field: filePath');
    }
    
    return this.entity as EntityQueryResult;
  }
  
  /**
   * 构建实体查询结果（可选验证）
   * @param validate 是否验证必需字段
   * @returns 实体查询结果
   */
  buildOptional(validate: boolean = true): EntityQueryResult {
    if (validate) {
      return this.build();
    }
    
    return this.entity as EntityQueryResult;
  }
  
  /**
   * 重置构建器
   * @returns 构建器实例
   */
  reset(): this {
    this.entity = {
      priority: 0,
      language: 'unknown',
      properties: {}
    };
    return this;
  }
  
  /**
   * 克隆构建器
   * @returns 新的构建器实例
   */
  clone(): EntityQueryBuilder {
    const newBuilder = new EntityQueryBuilder();
    newBuilder.entity = { ...this.entity };
    return newBuilder;
  }
}

/**
 * 预处理器实体构建器
 */
export class PreprocessorEntityBuilder extends EntityQueryBuilder {
  setPreprocType(preprocType: string): this {
    this.addProperty('preprocType', preprocType);
    return this;
  }
  
  setMacroValue(macroValue: string): this {
    this.addProperty('macroValue', macroValue);
    return this;
  }
  
  setIncludePath(includePath: string): this {
    this.addProperty('includePath', includePath);
    return this;
  }
  
  setCondition(condition: string): this {
    this.addProperty('condition', condition);
    return this;
  }
}

/**
 * 类型定义实体构建器
 */
export class TypeEntityBuilder extends EntityQueryBuilder {
  setFields(fields: any[]): this {
    this.addProperty('fields', fields);
    return this;
  }
  
  setEnumConstants(enumConstants: any[]): this {
    this.addProperty('enumConstants', enumConstants);
    return this;
  }
  
  setBaseType(baseType: string): this {
    this.addProperty('baseType', baseType);
    return this;
  }
}

/**
 * 函数实体构建器
 */
export class FunctionEntityBuilder extends EntityQueryBuilder {
  setReturnType(returnType: string): this {
    this.addProperty('returnType', returnType);
    return this;
  }
  
  setParameters(parameters: any[]): this {
    this.addProperty('parameters', parameters);
    return this;
  }
  
  setIsPrototype(isPrototype: boolean): this {
    this.addProperty('isPrototype', isPrototype);
    return this;
  }
  
  setIsPointer(isPointer: boolean): this {
    this.addProperty('isPointer', isPointer);
    return this;
  }
}

/**
 * 变量实体构建器
 */
export class VariableEntityBuilder extends EntityQueryBuilder {
  setVariableType(variableType: string): this {
    this.addProperty('variableType', variableType);
    return this;
  }
  
  setArraySize(arraySize: string): this {
    this.addProperty('arraySize', arraySize);
    return this;
  }
  
  setIsPointer(isPointer: boolean): this {
    this.addProperty('isPointer', isPointer);
    return this;
  }
  
  setIsStatic(isStatic: boolean): this {
    this.addProperty('isStatic', isStatic);
    return this;
  }
  
  setIsExtern(isExtern: boolean): this {
    this.addProperty('isExtern', isExtern);
    return this;
  }
  
  setInitialValue(initialValue: string): this {
    this.addProperty('initialValue', initialValue);
    return this;
  }
}

/**
 * 注解实体构建器
 */
export class AnnotationEntityBuilder extends EntityQueryBuilder {
  setAnnotationType(annotationType: string): this {
    this.addProperty('annotationType', annotationType);
    return this;
  }
  
  setAnnotationValue(annotationValue: string): this {
    this.addProperty('annotationValue', annotationValue);
    return this;
  }
  
  setTarget(target: string): this {
    this.addProperty('target', target);
    return this;
  }
  
  setIsMultiline(isMultiline: boolean): this {
    this.addProperty('isMultiline', isMultiline);
    return this;
  }
}

/**
 * 构建器工厂类
 */
export class EntityQueryBuilderFactory {
  /**
   * 创建通用实体构建器
   * @returns 通用实体构建器
   */
  static createGeneric(): EntityQueryBuilder {
    return new EntityQueryBuilder();
  }
  
  /**
   * 创建预处理器实体构建器
   * @returns 预处理器实体构建器
   */
  static createPreprocessor(): PreprocessorEntityBuilder {
    return new PreprocessorEntityBuilder();
  }
  
  /**
   * 创建类型定义实体构建器
   * @returns 类型定义实体构建器
   */
  static createType(): TypeEntityBuilder {
    return new TypeEntityBuilder();
  }
  
  /**
   * 创建函数实体构建器
   * @returns 函数实体构建器
   */
  static createFunction(): FunctionEntityBuilder {
    return new FunctionEntityBuilder();
  }
  
  /**
   * 创建变量实体构建器
   * @returns 变量实体构建器
   */
  static createVariable(): VariableEntityBuilder {
    return new VariableEntityBuilder();
  }
  
  /**
   * 创建注解实体构建器
   * @returns 注解实体构建器
   */
  static createAnnotation(): AnnotationEntityBuilder {
    return new AnnotationEntityBuilder();
  }
  
  /**
   * 根据实体类型创建对应的构建器
   * @param entityType 实体类型
   * @returns 对应的构建器
   */
  static createByEntityType(entityType: EntityType): EntityQueryBuilder {
    switch (entityType) {
      case EntityType.PREPROCESSOR:
        return this.createPreprocessor();
        
      case EntityType.TYPE_DEFINITION:
        return this.createType();
        
      case EntityType.FUNCTION:
        return this.createFunction();
        
      case EntityType.VARIABLE:
        return this.createVariable();
        
      case EntityType.ANNOTATION:
        return this.createAnnotation();
        
      default:
        return this.createGeneric();
    }
  }
  
  /**
   * 根据语言和语言特定类型创建实体
   * @param language 语言类型
   * @param languageType 语言特定的实体类型
   * @param data 实体数据
   * @returns 实体查询结果
   */
  static createLanguageSpecificEntity(
    language: string,
    languageType: string,
    data: any
  ): EntityQueryResult {
    const registry = EntityTypeRegistry.getInstance();
    const factory = registry.getFactory(language);
    
    if (!factory) {
      throw new Error(`No entity type factory registered for language: ${language}`);
    }
    
    // 确定基础实体类型
    const languageTypes = factory.getLanguageSpecificTypes();
    const baseTypeStr = languageTypes[languageType];
    
    if (!baseTypeStr) {
      throw new Error(`Unknown language type: ${languageType} for language: ${language}`);
    }
    
    const baseType = baseTypeStr as EntityType;
    return factory.createLanguageSpecificEntity(baseType, languageType, data);
  }
}