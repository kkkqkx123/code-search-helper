/**
 * C语言专门的实体类型定义
 * 扩展通用实体类型，添加C语言特定的实体类型和属性
 */

import {
  EntityType,
  EntityQueryResult,
  PreprocessorEntity,
  TypeEntity,
  FunctionEntity,
  VariableEntity,
  AnnotationEntity,
  EntityTypeFactory,
  FieldInfo,
  EnumConstant,
  ParameterInfo
} from '../../EntityTypes';

/**
 * C语言特定的实体类型枚举
 */
export enum CEntityType {
  // 预处理器实体（优先级5）
  PREPROCESSOR = 'preprocessor',
  MACRO = 'macro',
  PREPROC_CONDITION = 'preproc_condition',
  INCLUDE = 'include',

  // 类型定义实体（优先级4）
  STRUCT = 'struct',
  UNION = 'union',
  ENUM = 'enum',
  TYPE_ALIAS = 'type_alias',

  // 函数实体（优先级3）
  FUNCTION = 'function',
  FUNCTION_PROTOTYPE = 'function_prototype',
  FUNCTION_POINTER = 'function_pointer',

  // 变量实体（优先级2）
  VARIABLE = 'variable',
  ARRAY = 'array',
  POINTER = 'pointer',

  // 注释和注解（优先级0）
  COMMENT = 'comment',
  ANNOTATION = 'annotation'
}

/**
 * C语言预处理器实体接口
 */
export interface CPreprocessorEntity extends PreprocessorEntity {
  entityType: EntityType.PREPROCESSOR;

  // C语言预处理器特有属性
  properties: {
    /** 预处理器类型 */
    preprocType?: 'def' | 'function_def' | 'ifdef' | 'if' | 'elif' | 'include';
    /** 宏值 */
    macroValue?: string;
    /** 包含路径 */
    includePath?: string;
    /** 条件表达式 */
    condition?: string;
    /** C语言特定的宏参数 */
    macroParams?: string[];
    /** 是否为函数式宏 */
    isFunctionLike?: boolean;
  };
}

/**
 * C语言类型定义实体接口
 */
export interface CTypeEntity extends TypeEntity {
  entityType: EntityType.TYPE_DEFINITION;

  // C语言类型定义特有属性
  properties: {
    /** C语言特定的类型 */
    cType?: CEntityType.STRUCT | CEntityType.UNION | CEntityType.ENUM | CEntityType.TYPE_ALIAS;
    /** 结构体字段 */
    fields?: FieldInfo[];
    /** 枚举常量 */
    enumConstants?: EnumConstant[];
    /** 基础类型 */
    baseType?: string;
    /** 是否为不完整类型 */
    isIncomplete?: boolean;
    /** 类型限定符 */
    qualifiers?: ('const' | 'volatile' | 'restrict')[];
    /** 存储类说明符 */
    storageClass?: ('typedef' | 'extern' | 'static' | 'auto' | 'register');
  };
}

/**
 * C语言函数实体接口
 */
export interface CFunctionEntity extends FunctionEntity {
  entityType: EntityType.FUNCTION;

  // C语言函数特有属性
  properties: {
    /** C语言特定的函数类型 */
    cFunctionType?: CEntityType.FUNCTION | CEntityType.FUNCTION_PROTOTYPE | CEntityType.FUNCTION_POINTER;
    /** 返回类型 */
    returnType?: string;
    /** 参数列表 */
    parameters?: ParameterInfo[];
    /** 是否为原型 */
    isPrototype?: boolean;
    /** 是否为函数指针 */
    isPointer?: boolean;
    /** 链接规范 */
    linkage?: 'external' | 'internal' | 'none';
    /** 存储类说明符 */
    storageClass?: ('extern' | 'static' | 'inline');
    /** 函数说明符 */
    functionSpecifiers?: ('inline' | '_Noreturn')[];
  };
}

/**
 * C语言变量实体接口
 */
export interface CVariableEntity extends VariableEntity {
  entityType: EntityType.VARIABLE;

  // C语言变量特有属性
  properties: {
    /** C语言特定的变量类型 */
    cVariableType?: CEntityType.VARIABLE | CEntityType.ARRAY | CEntityType.POINTER;
    /** 变量类型 */
    variableType?: string;
    /** 数组大小 */
    arraySize?: string;
    /** 是否为指针 */
    isPointer?: boolean;
    /** 是否为静态 */
    isStatic?: boolean;
    /** 是否为外部 */
    isExtern?: boolean;
    /** 存储类说明符 */
    storageClass?: ('typedef' | 'extern' | 'static' | 'auto' | 'register');
    /** 类型限定符 */
    qualifiers?: ('const' | 'volatile' | 'restrict')[];
    /** 初始值 */
    initialValue?: string;
    /** 指针层级 */
    pointerLevel?: number;
  };
}

/**
 * C语言注解实体接口
 */
export interface CAnnotationEntity extends AnnotationEntity {
  entityType: EntityType.ANNOTATION;

  // C语言注解特有属性
  properties: {
    /** C语言特定的注解类型 */
    cAnnotationType?: CEntityType.COMMENT | CEntityType.ANNOTATION;
    /** 注解类型 */
    annotationType?: 'struct_tag' | 'comment' | 'directive' | 'documentation';
    /** 注解值 */
    annotationValue?: string;
    /** 目标 */
    target?: string;
    /** 是否为多行 */
    isMultiline?: boolean;
  };
}

/**
 * C语言实体查询结果联合类型
 */
export type CEntityQueryResult =
  | CPreprocessorEntity
  | CTypeEntity
  | CFunctionEntity
  | CVariableEntity
  | CAnnotationEntity;

/**
 * C语言实体类型优先级映射
 */
export const C_ENTITY_TYPE_PRIORITIES: Record<CEntityType, number> = {
  // 预处理器实体（优先级5）
  [CEntityType.PREPROCESSOR]: 5,
  [CEntityType.MACRO]: 5,
  [CEntityType.PREPROC_CONDITION]: 5,
  [CEntityType.INCLUDE]: 5,

  // 类型定义实体（优先级4）
  [CEntityType.STRUCT]: 4,
  [CEntityType.UNION]: 4,
  [CEntityType.ENUM]: 4,
  [CEntityType.TYPE_ALIAS]: 4,

  // 函数实体（优先级3）
  [CEntityType.FUNCTION]: 3,
  [CEntityType.FUNCTION_PROTOTYPE]: 3,
  [CEntityType.FUNCTION_POINTER]: 3,

  // 变量实体（优先级2）
  [CEntityType.VARIABLE]: 2,
  [CEntityType.ARRAY]: 2,
  [CEntityType.POINTER]: 2,

  // 注释和注解（优先级0）
  [CEntityType.COMMENT]: 0,
  [CEntityType.ANNOTATION]: 0
};

/**
 * C语言实体类型工厂实现
 */
export class CEntityTypeFactory implements EntityTypeFactory {
  /**
   * 获取C语言特定的实体类型
   */
  getLanguageSpecificTypes(): Record<string, string> {
    return {
      [CEntityType.PREPROCESSOR]: EntityType.PREPROCESSOR,
      [CEntityType.MACRO]: EntityType.PREPROCESSOR,
      [CEntityType.PREPROC_CONDITION]: EntityType.PREPROCESSOR,
      [CEntityType.INCLUDE]: EntityType.PREPROCESSOR,

      [CEntityType.STRUCT]: EntityType.TYPE_DEFINITION,
      [CEntityType.UNION]: EntityType.TYPE_DEFINITION,
      [CEntityType.ENUM]: EntityType.TYPE_DEFINITION,
      [CEntityType.TYPE_ALIAS]: EntityType.TYPE_DEFINITION,

      [CEntityType.FUNCTION]: EntityType.FUNCTION,
      [CEntityType.FUNCTION_PROTOTYPE]: EntityType.FUNCTION,
      [CEntityType.FUNCTION_POINTER]: EntityType.FUNCTION,

      [CEntityType.VARIABLE]: EntityType.VARIABLE,
      [CEntityType.ARRAY]: EntityType.VARIABLE,
      [CEntityType.POINTER]: EntityType.VARIABLE,

      [CEntityType.COMMENT]: EntityType.ANNOTATION,
      [CEntityType.ANNOTATION]: EntityType.ANNOTATION
    };
  }

  /**
   * 创建C语言特定的实体
   */
  createLanguageSpecificEntity(
    baseType: EntityType,
    languageType: string,
    data: any
  ): EntityQueryResult {
    const cType = languageType as CEntityType;

    switch (baseType) {
      case EntityType.PREPROCESSOR:
        return this.createPreprocessorEntity(cType, data);
      case EntityType.TYPE_DEFINITION:
        return this.createTypeEntity(cType, data);
      case EntityType.FUNCTION:
        return this.createFunctionEntity(cType, data);
      case EntityType.VARIABLE:
        return this.createVariableEntity(cType, data);
      case EntityType.ANNOTATION:
        return this.createAnnotationEntity(cType, data);
      default:
        throw new Error(`Unsupported base entity type: ${baseType}`);
    }
  }

  /**
   * 获取C语言实体类型的优先级
   */
  getEntityTypePriority(entityType: string, languageType?: string): number {
    if (languageType) {
      const cType = languageType as CEntityType;
      return C_ENTITY_TYPE_PRIORITIES[cType] || 0;
    }
    return 0;
  }

  private createPreprocessorEntity(cType: CEntityType, data: any): CPreprocessorEntity {
    return {
      ...data,
      entityType: EntityType.PREPROCESSOR,
      properties: {
        ...data.properties,
        cType,
        preprocType: data.preprocType,
        macroValue: data.macroValue,
        includePath: data.includePath,
        condition: data.condition,
        macroParams: data.macroParams,
        isFunctionLike: data.isFunctionLike
      }
    };
  }

  private createTypeEntity(cType: CEntityType, data: any): CTypeEntity {
    return {
      ...data,
      entityType: EntityType.TYPE_DEFINITION,
      properties: {
        ...data.properties,
        cType,
        fields: data.fields,
        enumConstants: data.enumConstants,
        baseType: data.baseType,
        isIncomplete: data.isIncomplete,
        qualifiers: data.qualifiers,
        storageClass: data.storageClass
      }
    };
  }

  private createFunctionEntity(cType: CEntityType, data: any): CFunctionEntity {
    return {
      ...data,
      entityType: EntityType.FUNCTION,
      properties: {
        ...data.properties,
        cFunctionType: cType,
        returnType: data.returnType,
        parameters: data.parameters,
        isPrototype: data.isPrototype,
        isPointer: data.isPointer,
        linkage: data.linkage,
        storageClass: data.storageClass,
        functionSpecifiers: data.functionSpecifiers
      }
    };
  }

  private createVariableEntity(cType: CEntityType, data: any): CVariableEntity {
    return {
      ...data,
      entityType: EntityType.VARIABLE,
      properties: {
        ...data.properties,
        cVariableType: cType,
        variableType: data.variableType,
        arraySize: data.arraySize,
        isPointer: data.isPointer,
        isStatic: data.isStatic,
        isExtern: data.isExtern,
        storageClass: data.storageClass,
        qualifiers: data.qualifiers,
        initialValue: data.initialValue,
        pointerLevel: data.pointerLevel
      }
    };
  }

  private createAnnotationEntity(cType: CEntityType, data: any): CAnnotationEntity {
    return {
      ...data,
      entityType: EntityType.ANNOTATION,
      properties: {
        ...data.properties,
        cAnnotationType: cType,
        annotationType: data.annotationType,
        annotationValue: data.annotationValue,
        target: data.target,
        isMultiline: data.isMultiline
      }
    };
  }
}

/**
 * 获取C语言实体类型的优先级
 * @param entityType C语言实体类型
 * @returns 优先级数值
 */
export function getCEntityTypePriority(entityType: CEntityType): number {
  return C_ENTITY_TYPE_PRIORITIES[entityType] || 0;
}

/**
 * 检查C语言实体类型是否为预处理器类型
 * @param entityType C语言实体类型
 * @returns 是否为预处理器类型
 */
export function isCPreprocessorType(entityType: CEntityType): boolean {
  return [
    CEntityType.PREPROCESSOR,
    CEntityType.MACRO,
    CEntityType.PREPROC_CONDITION,
    CEntityType.INCLUDE
  ].includes(entityType);
}

/**
 * 检查C语言实体类型是否为类型定义类型
 * @param entityType C语言实体类型
 * @returns 是否为类型定义类型
 */
export function isCTypeDefinitionType(entityType: CEntityType): boolean {
  return [
    CEntityType.STRUCT,
    CEntityType.UNION,
    CEntityType.ENUM,
    CEntityType.TYPE_ALIAS
  ].includes(entityType);
}

/**
 * 检查C语言实体类型是否为函数类型
 * @param entityType C语言实体类型
 * @returns 是否为函数类型
 */
export function isCFunctionType(entityType: CEntityType): boolean {
  return [
    CEntityType.FUNCTION,
    CEntityType.FUNCTION_PROTOTYPE,
    CEntityType.FUNCTION_POINTER
  ].includes(entityType);
}

/**
 * 检查C语言实体类型是否为变量类型
 * @param entityType C语言实体类型
 * @returns 是否为变量类型
 */
export function isCVariableType(entityType: CEntityType): boolean {
  return [
    CEntityType.VARIABLE,
    CEntityType.ARRAY,
    CEntityType.POINTER
  ].includes(entityType);
}

/**
 * 检查C语言实体类型是否为注解类型
 * @param entityType C语言实体类型
 * @returns 是否为注解类型
 */
export function isCAnnotationType(entityType: CEntityType): boolean {
  return [
    CEntityType.COMMENT,
    CEntityType.ANNOTATION
  ].includes(entityType);
}