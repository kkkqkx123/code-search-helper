/**
 * 类型映射工具类
 * 提供各种类型之间的映射功能
 */

import { ChunkType } from '../../service/parser/processing/types/CodeChunk';
import { StandardizedQueryResult } from '../../service/parser/core/normalization/types';
import { TopLevelStructure, NestedStructure, InternalStructure } from './ContentAnalyzer';

/**
 * 结构类型枚举
 */
export enum StructureType {
  FUNCTION = 'function',
  METHOD = 'method',
  CLASS = 'class',
  INTERFACE = 'interface',
  STRUCT = 'struct',
  NAMESPACE = 'namespace',
  MODULE = 'module',
  IMPORT = 'import',
  EXPORT = 'export',
  VARIABLE = 'variable',
  TYPE = 'type',
  TEMPLATE = 'template',
  ENUM = 'enum',
  BLOCK = 'block',
  GENERIC = 'generic'
}

/**
 * 嵌套信息接口
 */
export interface NestingInfo {
  /** 嵌套级别 */
  level: number;
  /** 父类型 */
  parentType: string;
  /** 父名称 */
  parentName: string;
  /** 嵌套路径 */
  path: string[];
}

/**
 * 分层结构接口
 */
export interface HierarchicalStructure {
  /** 结构类型 */
  type: StructureType;
  /** 名称 */
  name: string;
  /** 内容 */
  content: string;
  /** 位置 */
  location: {
    startLine: number;
    endLine: number;
  };
  /** 嵌套信息 */
  nestingInfo?: NestingInfo;
  /** 子结构 */
  children?: HierarchicalStructure[];
  /** 元数据 */
  metadata: Record<string, any>;
}

/**
 * 类型映射配置接口
 */
export interface TypeMappingConfig {
  /** 自定义映射规则 */
  customMappings?: Record<string, ChunkType>;
  /** 是否启用严格模式 */
  strict?: boolean;
  /** 默认类型 */
  defaultType?: ChunkType;
}

/**
 * 类型映射工具类
 */
export class TypeMappingUtils {
  /**
   * 将标准化查询结果类型映射到代码块类型
   */
  static mapStandardizedTypeToChunkType(type: StandardizedQueryResult['type']): ChunkType {
    const mapping: Record<string, ChunkType> = {
      'function': ChunkType.FUNCTION,
      'method': ChunkType.METHOD,
      'class': ChunkType.CLASS,
      'interface': ChunkType.INTERFACE,
      'struct': ChunkType.CLASS,
      'namespace': ChunkType.MODULE,
      'module': ChunkType.MODULE,
      'import': ChunkType.IMPORT,
      'export': ChunkType.EXPORT,
      'variable': ChunkType.VARIABLE,
      'type': ChunkType.TYPE,
      'type-def': ChunkType.TYPE,
      'enum': ChunkType.ENUM,
      'template': ChunkType.GENERIC,
      'block': ChunkType.BLOCK,
      'generic': ChunkType.GENERIC
    };

    return mapping[type] || ChunkType.GENERIC;
  }

  /**
   * 获取实体键名
   */
  static getEntityKey(type: StandardizedQueryResult['type']): string {
    const keyMapping: Record<string, string> = {
      'function': 'functionName',
      'method': 'methodName',
      'class': 'className',
      'interface': 'interfaceName',
      'struct': 'structName',
      'namespace': 'namespaceName',
      'module': 'moduleName',
      'import': 'importName',
      'export': 'exportName',
      'variable': 'variableName',
      'type': 'typeName',
      'type-def': 'typeName',
      'enum': 'enumName',
      'template': 'templateName',
      'block': 'blockName',
      'generic': 'entityName'
    };

    return keyMapping[type] || 'entityName';
  }

  /**
   * 创建类型映射
   */
  static createTypeMapping(sourceType: string, targetType: ChunkType): Record<string, ChunkType> {
    return {
      [sourceType]: targetType
    };
  }

  /**
   * 将结构类型映射到代码块类型
   */
  static mapStructureTypeToChunkType(structureType: StructureType): ChunkType {
    const mapping: Record<StructureType, ChunkType> = {
      [StructureType.FUNCTION]: ChunkType.FUNCTION,
      [StructureType.METHOD]: ChunkType.METHOD,
      [StructureType.CLASS]: ChunkType.CLASS,
      [StructureType.INTERFACE]: ChunkType.INTERFACE,
      [StructureType.STRUCT]: ChunkType.CLASS,
      [StructureType.NAMESPACE]: ChunkType.MODULE,
      [StructureType.MODULE]: ChunkType.MODULE,
      [StructureType.IMPORT]: ChunkType.IMPORT,
      [StructureType.EXPORT]: ChunkType.EXPORT,
      [StructureType.VARIABLE]: ChunkType.VARIABLE,
      [StructureType.TYPE]: ChunkType.TYPE,
      [StructureType.TEMPLATE]: ChunkType.GENERIC,
      [StructureType.ENUM]: ChunkType.ENUM,
      [StructureType.BLOCK]: ChunkType.BLOCK,
      [StructureType.GENERIC]: ChunkType.GENERIC
    };

    return mapping[structureType] || ChunkType.GENERIC;
  }

  /**
   * 将嵌套级别映射到元数据
   */
  static mapNestingLevelToMetadata(level: number): any {
    return {
      nestingLevel: level,
      isNested: level > 1,
      depth: level,
      complexity: Math.min(level * 0.1, 1.0) // 嵌套越深复杂度越高
    };
  }

  /**
   * 创建分层元数据
   */
  static createHierarchicalMetadata(structure: HierarchicalStructure): any {
    const metadata: any = {
      type: structure.type,
      name: structure.name,
      size: structure.content.length,
      lineCount: structure.location.endLine - structure.location.startLine + 1
    };

    // 添加嵌套信息
    if (structure.nestingInfo) {
      metadata.nesting = {
        level: structure.nestingInfo.level,
        parentType: structure.nestingInfo.parentType,
        parentName: structure.nestingInfo.parentName,
        path: structure.nestingInfo.path.join('.'),
        isNested: structure.nestingInfo.level > 1
      };
    }

    // 添加子结构信息
    if (structure.children && structure.children.length > 0) {
      metadata.children = {
        count: structure.children.length,
        types: [...new Set(structure.children.map(child => child.type))],
        totalSize: structure.children.reduce((sum, child) => sum + child.content.length, 0)
      };
    }

    // 合并原有元数据
    return { ...metadata, ...structure.metadata };
  }

  /**
   * 将顶级结构转换为分层结构
   */
  static convertTopLevelToHierarchical(structure: TopLevelStructure): HierarchicalStructure {
    return {
      type: this.mapStringToStructureType(structure.type),
      name: structure.name,
      content: structure.content,
      location: structure.location,
      metadata: structure.metadata
    };
  }

  /**
   * 将嵌套结构转换为分层结构
   */
  static convertNestedToHierarchical(structure: NestedStructure): HierarchicalStructure {
    return {
      type: this.mapStringToStructureType(structure.type),
      name: structure.name,
      content: structure.content,
      location: structure.location,
      nestingInfo: {
        level: structure.level,
        parentType: 'unknown', // 需要从parentNode获取
        parentName: 'unknown',
        path: []
      },
      metadata: structure.metadata
    };
  }

  /**
   * 将内部结构转换为分层结构
   */
  static convertInternalToHierarchical(structure: InternalStructure): HierarchicalStructure {
    return {
      type: this.mapStringToStructureType(structure.type),
      name: structure.name || 'unnamed',
      content: structure.content,
      location: structure.location,
      metadata: {
        ...structure.metadata,
        importance: structure.importance,
        isInternal: true
      }
    };
  }

  /**
   * 批量映射类型
   */
  static batchMapTypes(
    items: Array<{ type: string; config?: TypeMappingConfig }>
  ): ChunkType[] {
    return items.map(item => {
      if (item.config?.customMappings && item.config.customMappings[item.type]) {
        return item.config.customMappings[item.type];
      }
      
      const chunkType = this.mapStandardizedTypeToChunkType(item.type as StandardizedQueryResult['type']);
      
      if (item.config?.strict && chunkType === ChunkType.GENERIC && item.config.defaultType) {
        return item.config.defaultType;
      }
      
      return chunkType;
    });
  }

  /**
   * 创建类型映射规则
   */
  static createMappingRule(
    sourcePattern: RegExp,
    targetType: ChunkType,
    priority: number = 0
  ): {
    pattern: RegExp;
    targetType: ChunkType;
    priority: number;
  } {
    return {
      pattern: sourcePattern,
      targetType,
      priority
    };
  }

  /**
   * 应用映射规则
   */
  static applyMappingRules(
    type: string,
    rules: Array<{ pattern: RegExp; targetType: ChunkType; priority: number }>
  ): ChunkType {
    // 按优先级排序
    const sortedRules = rules.sort((a, b) => b.priority - a.priority);
    
    for (const rule of sortedRules) {
      if (rule.pattern.test(type)) {
        return rule.targetType;
      }
    }
    
    return this.mapStandardizedTypeToChunkType(type as StandardizedQueryResult['type']);
  }

  /**
   * 验证类型映射
   */
  static validateTypeMapping(mapping: Record<string, ChunkType>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const validChunkTypes = Object.values(ChunkType);
    
    for (const [sourceType, targetType] of Object.entries(mapping)) {
      if (!sourceType || typeof sourceType !== 'string') {
        errors.push(`Invalid source type: ${sourceType}`);
      }
      
      if (!validChunkTypes.includes(targetType)) {
        errors.push(`Invalid target type: ${targetType} for source: ${sourceType}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 合并类型映射
   */
  static mergeTypeMappings(
    ...mappings: Record<string, ChunkType>[]
  ): Record<string, ChunkType> {
    return mappings.reduce((merged, mapping) => {
      return { ...merged, ...mapping };
    }, {});
  }

  /**
   * 创建反向映射
   */
  static createReverseMapping(mapping: Record<string, ChunkType>): Record<ChunkType, string[]> {
    const reverse: Record<ChunkType, string[]> = {} as any;
    
    for (const [sourceType, targetType] of Object.entries(mapping)) {
      if (!reverse[targetType]) {
        reverse[targetType] = [];
      }
      reverse[targetType].push(sourceType);
    }
    
    return reverse;
  }

  // 私有辅助方法

  /**
   * 将字符串映射到结构类型
   */
  private static mapStringToStructureType(type: string): StructureType {
    const mapping: Record<string, StructureType> = {
      'function': StructureType.FUNCTION,
      'method': StructureType.METHOD,
      'class': StructureType.CLASS,
      'interface': StructureType.INTERFACE,
      'struct': StructureType.STRUCT,
      'namespace': StructureType.NAMESPACE,
      'module': StructureType.MODULE,
      'import': StructureType.IMPORT,
      'export': StructureType.EXPORT,
      'variable': StructureType.VARIABLE,
      'type': StructureType.TYPE,
      'template': StructureType.TEMPLATE,
      'enum': StructureType.ENUM,
      'block': StructureType.BLOCK,
      'generic': StructureType.GENERIC
    };

    return mapping[type] || StructureType.GENERIC;
  }
}