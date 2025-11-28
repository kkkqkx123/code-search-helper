/**
 * C语言专门的关系类型定义
 * 扩展通用关系类型，添加C语言特定的关系类型和属性
 */

import {
  RelationshipCategory,
  RelationshipType,
  RelationshipQueryResult,
  CallRelationship,
  DataFlowRelationship,
  ControlFlowRelationship,
  DependencyRelationship,
  InheritanceRelationship,
  LifecycleRelationship,
  SemanticRelationship,
  ReferenceRelationship,
  AnnotationRelationship,
  RelationshipTypeFactory,
  RelationshipLocationInfo
} from '../../RelationshipTypes';

/**
 * C语言特定的关系类型枚举
 */
export enum CRelationshipType {
  // 调用关系类型
  FUNCTION = 'function',
  METHOD = 'method',
  FUNCTION_POINTER = 'function_pointer',
  RECURSIVE = 'recursive',
  CHAINED = 'chained',
  CONDITIONAL = 'conditional',
  CALLBACK = 'callback',
  MACRO = 'macro',

  // 数据流关系类型
  ASSIGNMENT = 'assignment',
  COMPOUND_ASSIGNMENT = 'compound_assignment',
  PARAMETER_PASSING = 'parameter_passing',
  RETURN_VALUE = 'return_value',
  POINTER_OPERATION = 'pointer_operation',
  TYPE_CONVERSION = 'type_conversion',
  CONDITIONAL_OPERATION = 'conditional_operation',
  MEMORY_OPERATION = 'memory_operation',
  MACRO_ASSIGNMENT = 'macro_assignment',
  SIZEOF_OPERATION = 'sizeof_operation',

  // 控制流关系类型
  IF = 'if',
  IF_ELSE = 'if_else',
  NESTED_IF = 'nested_if',
  ELSE_IF = 'else_if',
  SWITCH = 'switch',
  SWITCH_CASE = 'switch_case',
  SWITCH_DEFAULT = 'switch_default',
  WHILE = 'while',
  DO_WHILE = 'do_while',
  FOR = 'for',
  LOOP_BREAK = 'loop_break',
  LOOP_CONTINUE = 'loop_continue',
  GOTO = 'goto',
  LABEL = 'label',
  RETURN = 'return',
  CONDITIONAL_EXPRESSION = 'conditional_expression',
  LOGICAL_OPERATOR = 'logical_operator',
  COMMA_EXPRESSION = 'comma_expression',

  // 依赖关系类型
  INCLUDE = 'include',
  SYSTEM_INCLUDE = 'system_include',
  MACRO_DEFINITION = 'macro_definition',
  MACRO_FUNCTION = 'macro_function',
  CONDITIONAL_COMPILATION = 'conditional_compilation',
  TYPE_REF = 'type_reference',
  STRUCT_REFERENCE = 'struct_reference',
  FUNCTION_DECLARATION = 'function_declaration',
  ENUM_REFERENCE = 'enum_reference',
  UNION_REFERENCE = 'union_reference',
  EXTERN_VARIABLE = 'extern_variable',
  STATIC_VARIABLE = 'static_variable',

  // 继承关系类型
  NESTED_STRUCT = 'nested_struct',
  COMPOSITION = 'composition',
  INTERFACE_IMPLEMENTATION = 'interface_implementation',
  FORWARD_DECLARATION = 'forward_declaration',
  UNION_NESTED = 'union_nested',
  ENUM_INHERITANCE = 'enum_inheritance',
  TYPE_ALIAS_INHERITANCE = 'type_alias_inheritance',
  POLYMORPHIC = 'polymorphic',
  VTABLE = 'vtable',
  CALLBACK_IMPLEMENTATION = 'callback_implementation',
  POINTER_INHERITANCE = 'pointer_inheritance',
  NESTED_ACCESS = 'nested_access',

  // 生命周期关系类型
  MEMORY_DEALLOCATION = 'memory_deallocation',
  MEMORY_REALLOCATION = 'memory_reallocation',
  RESOURCE_DESTRUCTOR = 'resource_destructor',
  RESOURCE_INIT = 'resource_init',
  RESOURCE_CLEANUP = 'resource_cleanup',
  SCOPE_LOCAL_BEGIN = 'scope_local_begin',
  SCOPE_LOCAL_END = 'scope_local_end',
  SCOPE_GLOBAL = 'scope_global',
  SCOPE_STATIC = 'scope_static',
  SCOPE_PARAMETER = 'scope_parameter',

  // 语义关系类型
  ERROR_RETURN = 'error_return',
  ERROR_CHECKING = 'error_checking',
  RESOURCE_INITIALIZATION = 'resource_initialization',
  CLEANUP_PATTERN = 'cleanup_pattern',
  CALLBACK_ASSIGNMENT = 'callback_assignment',
  CALLBACK_TYPE = 'callback_type',

  // 引用关系类型
  VARIABLE_REFERENCE = 'variable_reference',
  TYPE_REF_REFERENCE = 'reference_type',
  ENUM_CONSTANT_REFERENCE = 'enum_constant_reference',
  MACRO_REFERENCE = 'macro_reference',
  GLOBAL_VARIABLE_REFERENCE = 'global_variable_reference',
  STATIC_VARIABLE_REFERENCE = 'static_variable_reference',

  // 注解关系类型
  TYPE_ANNOTATION = 'type_annotation',
  VARIABLE_ANNOTATION = 'variable_annotation',
  FIELD_ANNOTATION = 'field_annotation'
}

/**
 * C语言调用关系接口
 */
export interface CCallRelationship extends CallRelationship {
  category: RelationshipCategory.CALL;

  // C语言调用关系特有属性
  properties: {
    /** C语言特定的调用类型 */
    cCallType?: CRelationshipType.FUNCTION | CRelationshipType.METHOD | CRelationshipType.FUNCTION_POINTER | CRelationshipType.RECURSIVE | CRelationshipType.CHAINED | CRelationshipType.CONDITIONAL | CRelationshipType.CALLBACK | CRelationshipType.MACRO;
    /** 函数名称 */
    functionName?: string;
    /** 参数列表 */
    arguments?: string[];
    /** 是否为链式调用 */
    isChained?: boolean;
    /** 链式调用深度 */
    chainDepth?: number;
    /** 是否为递归调用 */
    isRecursive?: boolean;
    /** 是否为宏调用 */
    isMacroCall?: boolean;
    /** 宏参数 */
    macroParams?: string[];
  };
}

/**
 * C语言数据流关系接口
 */
export interface CDataFlowRelationship extends DataFlowRelationship {
  category: RelationshipCategory.DATA_FLOW;

  // C语言数据流关系特有属性
  properties: {
    /** C语言特定的数据流类型 */
    cDataFlowType?: CRelationshipType.ASSIGNMENT | CRelationshipType.COMPOUND_ASSIGNMENT | CRelationshipType.PARAMETER_PASSING | CRelationshipType.RETURN_VALUE | CRelationshipType.POINTER_OPERATION | CRelationshipType.TYPE_CONVERSION | CRelationshipType.CONDITIONAL_OPERATION | CRelationshipType.MEMORY_OPERATION | CRelationshipType.MACRO_ASSIGNMENT | CRelationshipType.SIZEOF_OPERATION;
    /** 源变量 */
    sourceVariable?: string;
    /** 目标变量 */
    targetVariable?: string;
    /** 数据类型 */
    dataType?: string;
    /** 数据流路径 */
    flowPath?: string[];
    /** 操作符 */
    operator?: string;
    /** 指针层级 */
    pointerLevel?: number;
    /** 内存操作类型 */
    memoryOperationType?: 'malloc' | 'free' | 'realloc' | 'calloc';
  };
}

/**
 * C语言控制流关系接口
 */
export interface CControlFlowRelationship extends ControlFlowRelationship {
  category: RelationshipCategory.CONTROL_FLOW;

  // C语言控制流关系特有属性
  properties: {
    /** C语言特定的控制流类型 */
    cControlFlowType?: CRelationshipType.IF | CRelationshipType.IF_ELSE | CRelationshipType.NESTED_IF | CRelationshipType.ELSE_IF | CRelationshipType.SWITCH | CRelationshipType.SWITCH_CASE | CRelationshipType.SWITCH_DEFAULT | CRelationshipType.WHILE | CRelationshipType.DO_WHILE | CRelationshipType.FOR | CRelationshipType.LOOP_BREAK | CRelationshipType.LOOP_CONTINUE | CRelationshipType.GOTO | CRelationshipType.LABEL | CRelationshipType.RETURN | CRelationshipType.CONDITIONAL_EXPRESSION | CRelationshipType.LOGICAL_OPERATOR | CRelationshipType.COMMA_EXPRESSION;
    /** 条件表达式 */
    condition?: string;
    /** 循环变量 */
    loopVariable?: string;
    /** 控制流目标 */
    controlFlowTargets?: string[];
    /** 标签名称 */
    labelName?: string;
    /** 嵌套层级 */
    nestingLevel?: number;
    /** case值 */
    caseValue?: string;
  };
}

/**
 * C语言依赖关系接口
 */
export interface CDependencyRelationship extends DependencyRelationship {
  category: RelationshipCategory.DEPENDENCY;

  // C语言依赖关系特有属性
  properties: {
    /** C语言特定的依赖类型 */
    cDependencyType?: CRelationshipType.INCLUDE | CRelationshipType.SYSTEM_INCLUDE | CRelationshipType.MACRO_DEFINITION | CRelationshipType.MACRO_FUNCTION | CRelationshipType.CONDITIONAL_COMPILATION | CRelationshipType.TYPE_REF | CRelationshipType.STRUCT_REFERENCE | CRelationshipType.FUNCTION_DECLARATION | CRelationshipType.ENUM_REFERENCE | CRelationshipType.UNION_REFERENCE | CRelationshipType.EXTERN_VARIABLE | CRelationshipType.STATIC_VARIABLE;
    /** 依赖路径 */
    dependencyPath?: string;
    /** 是否为标准库 */
    isStandardLibrary?: boolean;
    /** 宏名称 */
    macroName?: string;
    /** 条件编译符号 */
    conditionSymbol?: string;
    /** 包含保护 */
    includeGuard?: string;
  };
}

/**
 * C语言继承关系接口
 */
export interface CInheritanceRelationship extends InheritanceRelationship {
  category: RelationshipCategory.INHERITANCE;

  // C语言继承关系特有属性
  properties: {
    /** C语言特定的继承类型 */
    cInheritanceType?: CRelationshipType.NESTED_STRUCT | CRelationshipType.COMPOSITION | CRelationshipType.INTERFACE_IMPLEMENTATION | CRelationshipType.FORWARD_DECLARATION | CRelationshipType.UNION_NESTED | CRelationshipType.ENUM_INHERITANCE | CRelationshipType.TYPE_ALIAS_INHERITANCE | CRelationshipType.POLYMORPHIC | CRelationshipType.VTABLE | CRelationshipType.CALLBACK_IMPLEMENTATION | CRelationshipType.POINTER_INHERITANCE | CRelationshipType.NESTED_ACCESS;
    /** 父类型 */
    parentType?: string;
    /** 子类型 */
    childType?: string;
    /** 继承深度 */
    inheritanceDepth?: number;
    /** 字段名称 */
    fieldName?: string;
    /** 访问路径 */
    accessPath?: string[];
  };
}

/**
 * C语言生命周期关系接口
 */
export interface CLifecycleRelationship extends LifecycleRelationship {
  category: RelationshipCategory.LIFECYCLE;

  // C语言生命周期关系特有属性
  properties: {
    /** C语言特定的生命周期类型 */
    cLifecycleType?: CRelationshipType.MEMORY_DEALLOCATION | CRelationshipType.MEMORY_REALLOCATION | CRelationshipType.RESOURCE_DESTRUCTOR | CRelationshipType.RESOURCE_INIT | CRelationshipType.RESOURCE_CLEANUP | CRelationshipType.SCOPE_LOCAL_BEGIN | CRelationshipType.SCOPE_LOCAL_END | CRelationshipType.SCOPE_GLOBAL | CRelationshipType.SCOPE_STATIC | CRelationshipType.SCOPE_PARAMETER;
    /** 资源类型 */
    resourceType?: string;
    /** 清理机制 */
    cleanupMechanism?: string;
    /** 操作类型 */
    operation?: string;
    /** 作用域类型 */
    scopeType?: string;
    /** 内存大小 */
    memorySize?: string;
  };
}

/**
 * C语言语义关系接口
 */
export interface CSemanticRelationship extends SemanticRelationship {
  category: RelationshipCategory.SEMANTIC;

  // C语言语义关系特有属性
  properties: {
    /** C语言特定的语义类型 */
    cSemanticType?: CRelationshipType.ERROR_RETURN | CRelationshipType.ERROR_CHECKING | CRelationshipType.RESOURCE_INITIALIZATION | CRelationshipType.CLEANUP_PATTERN | CRelationshipType.CALLBACK_ASSIGNMENT | CRelationshipType.CALLBACK_TYPE;
    /** 错误代码 */
    errorCode?: string;
    /** 错误值 */
    errorValue?: string;
    /** 资源构造函数 */
    resourceConstructor?: string;
    /** 资源类型 */
    resourceType?: string;
    /** 回调函数 */
    callbackFunction?: string;
  };
}

/**
 * C语言引用关系接口
 */
export interface CReferenceRelationship extends ReferenceRelationship {
  category: RelationshipCategory.REFERENCE;

  // C语言引用关系特有属性
  properties: {
    /** C语言特定的引用类型 */
    cReferenceType?: CRelationshipType.VARIABLE_REFERENCE | CRelationshipType.TYPE_REF_REFERENCE | CRelationshipType.ENUM_CONSTANT_REFERENCE | CRelationshipType.MACRO_REFERENCE | CRelationshipType.GLOBAL_VARIABLE_REFERENCE | CRelationshipType.STATIC_VARIABLE_REFERENCE;
    /** 引用名称 */
    referenceName?: string;
    /** 引用上下文 */
    referenceContext?: string;
    /** 是否为定义 */
    isDefinition?: boolean;
    /** 引用类型 */
    referenceKind?: 'declaration' | 'definition' | 'usage';
  };
}

/**
 * C语言注解关系接口
 */
export interface CAnnotationRelationship extends AnnotationRelationship {
  category: RelationshipCategory.ANNOTATION;

  // C语言注解关系特有属性
  properties: {
    /** C语言特定的注解类型 */
    cAnnotationType?: CRelationshipType.TYPE_ANNOTATION | CRelationshipType.VARIABLE_ANNOTATION | CRelationshipType.FIELD_ANNOTATION;
    /** 注解名称 */
    annotationName?: string;
    /** 注解参数 */
    annotationArguments?: string[];
    /** 目标 */
    target?: string;
  };
}

/**
 * C语言关系查询结果联合类型
 */
export type CRelationshipQueryResult =
  | CCallRelationship
  | CDataFlowRelationship
  | CControlFlowRelationship
  | CDependencyRelationship
  | CInheritanceRelationship
  | CLifecycleRelationship
  | CSemanticRelationship
  | CReferenceRelationship
  | CAnnotationRelationship;

/**
 * C语言关系类型工厂实现
 */
export class CRelationshipTypeFactory implements RelationshipTypeFactory {
  /**
   * 获取C语言特定的关系类型
   */
  getLanguageSpecificTypes(): Record<string, RelationshipType> {
    return {
      // 调用关系
      [CRelationshipType.FUNCTION]: RelationshipType.CALL,
      [CRelationshipType.METHOD]: RelationshipType.METHOD_CALL,
      [CRelationshipType.FUNCTION_POINTER]: RelationshipType.FUNCTION_POINTER_CALL,
      [CRelationshipType.RECURSIVE]: RelationshipType.RECURSIVE_CALL,

      // 数据流关系
      [CRelationshipType.ASSIGNMENT]: RelationshipType.ASSIGNMENT,
      [CRelationshipType.PARAMETER_PASSING]: RelationshipType.PARAMETER_PASSING,
      [CRelationshipType.RETURN_VALUE]: RelationshipType.RETURN_VALUE,
      [CRelationshipType.TYPE_CONVERSION]: RelationshipType.TYPE_CONVERSION,

      // 控制流关系
      [CRelationshipType.IF]: RelationshipType.CONDITIONAL,
      [CRelationshipType.WHILE]: RelationshipType.LOOP,
      [CRelationshipType.FOR]: RelationshipType.LOOP,
      [CRelationshipType.GOTO]: RelationshipType.JUMP,

      // 依赖关系
      [CRelationshipType.INCLUDE]: RelationshipType.INCLUDE,
      [CRelationshipType.TYPE_REF]: RelationshipType.TYPE_REFERENCE,
      [CRelationshipType.FUNCTION_DECLARATION]: RelationshipType.FUNCTION_REFERENCE,
      [CRelationshipType.VARIABLE_REFERENCE]: RelationshipType.VARIABLE_REFERENCE,

      // 继承关系
      [CRelationshipType.COMPOSITION]: RelationshipType.COMPOSITION,

      // 生命周期关系
      [CRelationshipType.RESOURCE_INIT]: RelationshipType.INITIALIZATION,
      [CRelationshipType.RESOURCE_CLEANUP]: RelationshipType.CLEANUP,

      // 语义关系
      [CRelationshipType.ERROR_RETURN]: RelationshipType.ERROR_HANDLING,
      [CRelationshipType.RESOURCE_INITIALIZATION]: RelationshipType.RESOURCE_MANAGEMENT,

      // 引用关系
      [CRelationshipType.TYPE_REF_REFERENCE]: RelationshipType.REFERENCE,

      // 注解关系
      [CRelationshipType.TYPE_ANNOTATION]: RelationshipType.ANNOTATION
    };
  }

  /**
   * 创建C语言特定的关系
   */
  createLanguageSpecificRelationship(
    baseType: RelationshipType,
    languageType: string,
    data: any
  ): RelationshipQueryResult {
    const cType = languageType as CRelationshipType;

    switch (baseType) {
      case RelationshipType.CALL:
      case RelationshipType.METHOD_CALL:
      case RelationshipType.FUNCTION_POINTER_CALL:
      case RelationshipType.RECURSIVE_CALL:
        return this.createCallRelationship(cType, data);

      case RelationshipType.ASSIGNMENT:
      case RelationshipType.PARAMETER_PASSING:
      case RelationshipType.RETURN_VALUE:
      case RelationshipType.TYPE_CONVERSION:
        return this.createDataFlowRelationship(cType, data);

      case RelationshipType.CONDITIONAL:
      case RelationshipType.LOOP:
      case RelationshipType.JUMP:
        return this.createControlFlowRelationship(cType, data);

      case RelationshipType.INCLUDE:
      case RelationshipType.TYPE_REFERENCE:
      case RelationshipType.FUNCTION_REFERENCE:
      case RelationshipType.VARIABLE_REFERENCE:
        return this.createDependencyRelationship(cType, data);

      case RelationshipType.EXTENDS:
      case RelationshipType.IMPLEMENTS:
      case RelationshipType.COMPOSITION:
        return this.createInheritanceRelationship(cType, data);

      case RelationshipType.INITIALIZATION:
      case RelationshipType.CLEANUP:
        return this.createLifecycleRelationship(cType, data);

      case RelationshipType.ERROR_HANDLING:
      case RelationshipType.RESOURCE_MANAGEMENT:
        return this.createSemanticRelationship(cType, data);

      case RelationshipType.REFERENCE:
        return this.createReferenceRelationship(cType, data);

      case RelationshipType.ANNOTATION:
        return this.createAnnotationRelationship(cType, data);

      default:
        throw new Error(`Unsupported base relationship type: ${baseType}`);
    }
  }

  /**
   * 获取C语言关系类型的优先级
   */
  getRelationshipTypePriority(relationshipType: string, languageType?: string): number {
    // C语言关系类型优先级可以根据需要定义
    const priorityMap: Record<string, number> = {
      // 调用关系优先级较高
      [CRelationshipType.FUNCTION]: 5,
      [CRelationshipType.METHOD]: 5,
      [CRelationshipType.FUNCTION_POINTER]: 4,
      [CRelationshipType.RECURSIVE]: 4,

      // 数据流关系中等优先级
      [CRelationshipType.ASSIGNMENT]: 3,
      [CRelationshipType.PARAMETER_PASSING]: 3,
      [CRelationshipType.RETURN_VALUE]: 3,

      // 控制流关系中等优先级
      [CRelationshipType.IF]: 3,
      [CRelationshipType.WHILE]: 3,
      [CRelationshipType.FOR]: 3,

      // 依赖关系较低优先级
      [CRelationshipType.INCLUDE]: 2,
      [CRelationshipType.TYPE_REF]: 2,

      // 其他关系默认优先级
    };

    return priorityMap[relationshipType] || 1;
  }

  private createCallRelationship(cType: CRelationshipType, data: any): CCallRelationship {
    return {
      ...data,
      category: RelationshipCategory.CALL,
      type: this.mapToBaseCallType(cType),
      properties: {
        ...data.properties,
        cCallType: cType,
        functionName: data.functionName,
        arguments: data.arguments,
        isChained: data.isChained,
        chainDepth: data.chainDepth,
        isRecursive: data.isRecursive,
        isMacroCall: data.isMacroCall,
        macroParams: data.macroParams
      }
    };
  }

  private createDataFlowRelationship(cType: CRelationshipType, data: any): CDataFlowRelationship {
    return {
      ...data,
      category: RelationshipCategory.DATA_FLOW,
      type: this.mapToBaseDataFlowType(cType),
      properties: {
        ...data.properties,
        cDataFlowType: cType,
        sourceVariable: data.sourceVariable,
        targetVariable: data.targetVariable,
        dataType: data.dataType,
        flowPath: data.flowPath,
        operator: data.operator,
        pointerLevel: data.pointerLevel,
        memoryOperationType: data.memoryOperationType
      }
    };
  }

  private createControlFlowRelationship(cType: CRelationshipType, data: any): CControlFlowRelationship {
    return {
      ...data,
      category: RelationshipCategory.CONTROL_FLOW,
      type: this.mapToBaseControlFlowType(cType),
      properties: {
        ...data.properties,
        cControlFlowType: cType,
        condition: data.condition,
        loopVariable: data.loopVariable,
        controlFlowTargets: data.controlFlowTargets,
        labelName: data.labelName,
        nestingLevel: data.nestingLevel,
        caseValue: data.caseValue
      }
    };
  }

  private createDependencyRelationship(cType: CRelationshipType, data: any): CDependencyRelationship {
    return {
      ...data,
      category: RelationshipCategory.DEPENDENCY,
      type: this.mapToBaseDependencyType(cType),
      properties: {
        ...data.properties,
        cDependencyType: cType,
        dependencyPath: data.dependencyPath,
        isStandardLibrary: data.isStandardLibrary,
        macroName: data.macroName,
        conditionSymbol: data.conditionSymbol,
        includeGuard: data.includeGuard
      }
    };
  }

  private createInheritanceRelationship(cType: CRelationshipType, data: any): CInheritanceRelationship {
    return {
      ...data,
      category: RelationshipCategory.INHERITANCE,
      type: this.mapToBaseInheritanceType(cType),
      properties: {
        ...data.properties,
        cInheritanceType: cType,
        parentType: data.parentType,
        childType: data.childType,
        inheritanceDepth: data.inheritanceDepth,
        fieldName: data.fieldName,
        accessPath: data.accessPath
      }
    };
  }

  private createLifecycleRelationship(cType: CRelationshipType, data: any): CLifecycleRelationship {
    return {
      ...data,
      category: RelationshipCategory.LIFECYCLE,
      type: this.mapToBaseLifecycleType(cType),
      properties: {
        ...data.properties,
        cLifecycleType: cType,
        resourceType: data.resourceType,
        cleanupMechanism: data.cleanupMechanism,
        operation: data.operation,
        scopeType: data.scopeType,
        memorySize: data.memorySize
      }
    };
  }

  private createSemanticRelationship(cType: CRelationshipType, data: any): CSemanticRelationship {
    return {
      ...data,
      category: RelationshipCategory.SEMANTIC,
      type: this.mapToBaseSemanticType(cType),
      properties: {
        ...data.properties,
        cSemanticType: cType,
        errorCode: data.errorCode,
        errorValue: data.errorValue,
        resourceConstructor: data.resourceConstructor,
        resourceType: data.resourceType,
        callbackFunction: data.callbackFunction
      }
    };
  }

  private createReferenceRelationship(cType: CRelationshipType, data: any): CReferenceRelationship {
    return {
      ...data,
      category: RelationshipCategory.REFERENCE,
      type: RelationshipType.REFERENCE,
      properties: {
        ...data.properties,
        cReferenceType: cType,
        referenceName: data.referenceName,
        referenceContext: data.referenceContext,
        isDefinition: data.isDefinition,
        referenceKind: data.referenceKind
      }
    };
  }

  private createAnnotationRelationship(cType: CRelationshipType, data: any): CAnnotationRelationship {
    return {
      ...data,
      category: RelationshipCategory.ANNOTATION,
      type: RelationshipType.ANNOTATION,
      properties: {
        ...data.properties,
        cAnnotationType: cType,
        annotationName: data.annotationName,
        annotationArguments: data.annotationArguments,
        target: data.target
      }
    };
  }

  private mapToBaseCallType(cType: CRelationshipType): RelationshipType {
    switch (cType) {
      case CRelationshipType.FUNCTION:
      case CRelationshipType.MACRO:
        return RelationshipType.CALL;
      case CRelationshipType.METHOD:
        return RelationshipType.METHOD_CALL;
      case CRelationshipType.FUNCTION_POINTER:
        return RelationshipType.FUNCTION_POINTER_CALL;
      case CRelationshipType.RECURSIVE:
        return RelationshipType.RECURSIVE_CALL;
      default:
        return RelationshipType.CALL;
    }
  }

  private mapToBaseDataFlowType(cType: CRelationshipType): RelationshipType {
    switch (cType) {
      case CRelationshipType.ASSIGNMENT:
      case CRelationshipType.COMPOUND_ASSIGNMENT:
      case CRelationshipType.MACRO_ASSIGNMENT:
        return RelationshipType.ASSIGNMENT;
      case CRelationshipType.PARAMETER_PASSING:
        return RelationshipType.PARAMETER_PASSING;
      case CRelationshipType.RETURN_VALUE:
        return RelationshipType.RETURN_VALUE;
      case CRelationshipType.TYPE_CONVERSION:
      case CRelationshipType.CONDITIONAL_OPERATION:
      case CRelationshipType.SIZEOF_OPERATION:
        return RelationshipType.TYPE_CONVERSION;
      default:
        return RelationshipType.ASSIGNMENT;
    }
  }

  private mapToBaseControlFlowType(cType: CRelationshipType): RelationshipType {
    switch (cType) {
      case CRelationshipType.IF:
      case CRelationshipType.IF_ELSE:
      case CRelationshipType.NESTED_IF:
      case CRelationshipType.ELSE_IF:
      case CRelationshipType.SWITCH:
      case CRelationshipType.SWITCH_CASE:
      case CRelationshipType.SWITCH_DEFAULT:
      case CRelationshipType.CONDITIONAL_EXPRESSION:
      case CRelationshipType.LOGICAL_OPERATOR:
        return RelationshipType.CONDITIONAL;
      case CRelationshipType.WHILE:
      case CRelationshipType.DO_WHILE:
      case CRelationshipType.FOR:
        return RelationshipType.LOOP;
      case CRelationshipType.GOTO:
      case CRelationshipType.LABEL:
      case CRelationshipType.LOOP_BREAK:
      case CRelationshipType.LOOP_CONTINUE:
      case CRelationshipType.RETURN:
      case CRelationshipType.COMMA_EXPRESSION:
        return RelationshipType.JUMP;
      default:
        return RelationshipType.CONDITIONAL;
    }
  }

  private mapToBaseDependencyType(cType: CRelationshipType): RelationshipType {
    switch (cType) {
      case CRelationshipType.INCLUDE:
      case CRelationshipType.SYSTEM_INCLUDE:
        return RelationshipType.INCLUDE;
      case CRelationshipType.TYPE_REF:
      case CRelationshipType.STRUCT_REFERENCE:
      case CRelationshipType.ENUM_REFERENCE:
      case CRelationshipType.UNION_REFERENCE:
        return RelationshipType.TYPE_REFERENCE;
      case CRelationshipType.FUNCTION_DECLARATION:
        return RelationshipType.FUNCTION_REFERENCE;
      case CRelationshipType.EXTERN_VARIABLE:
      case CRelationshipType.STATIC_VARIABLE:
      case CRelationshipType.GLOBAL_VARIABLE_REFERENCE:
      case CRelationshipType.STATIC_VARIABLE_REFERENCE:
        return RelationshipType.VARIABLE_REFERENCE;
      default:
        return RelationshipType.INCLUDE;
    }
  }

  private mapToBaseInheritanceType(cType: CRelationshipType): RelationshipType {
    switch (cType) {
      case CRelationshipType.COMPOSITION:
        return RelationshipType.COMPOSITION;
      case CRelationshipType.INTERFACE_IMPLEMENTATION:
        return RelationshipType.IMPLEMENTS;
      default:
        return RelationshipType.EXTENDS;
    }
  }

  private mapToBaseLifecycleType(cType: CRelationshipType): RelationshipType {
    switch (cType) {
      case CRelationshipType.RESOURCE_INIT:
      case CRelationshipType.RESOURCE_INITIALIZATION:
        return RelationshipType.INITIALIZATION;
      case CRelationshipType.RESOURCE_CLEANUP:
      case CRelationshipType.RESOURCE_DESTRUCTOR:
      case CRelationshipType.MEMORY_DEALLOCATION:
        return RelationshipType.CLEANUP;
      default:
        return RelationshipType.INITIALIZATION;
    }
  }

  private mapToBaseSemanticType(cType: CRelationshipType): RelationshipType {
    switch (cType) {
      case CRelationshipType.ERROR_RETURN:
      case CRelationshipType.ERROR_CHECKING:
        return RelationshipType.ERROR_HANDLING;
      case CRelationshipType.RESOURCE_INITIALIZATION:
      case CRelationshipType.CLEANUP_PATTERN:
        return RelationshipType.RESOURCE_MANAGEMENT;
      default:
        return RelationshipType.ERROR_HANDLING;
    }
  }
}