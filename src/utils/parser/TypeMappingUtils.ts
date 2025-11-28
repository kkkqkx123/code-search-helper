import {
  HierarchicalStructure,
  StructureType,
  NestingInfo,
  StructureMetadata
} from '../../service/parser/processing/types/HierarchicalTypes';
import { StandardizedQueryResult } from '../../service/parser/normalization/types';
import { TopLevelStructure, NestedStructure, InternalStructure } from '../types/ContentTypes';
import { ChunkType } from '../../service/parser/processing/types/CodeChunk';
import { ChunkTypeMapper } from './ChunkTypeMapper';

// 重新导出类型以便其他文件使用
export { HierarchicalStructure, StructureType, NestingInfo, StructureMetadata };

/**
 * 类型映射工具类
 * 负责在不同结构类型之间进行转换
 */
export class TypeMappingUtils {

  /**
   * 将TopLevelStructure转换为HierarchicalStructure
   */
  static convertTopLevelToHierarchical(structure: TopLevelStructure): HierarchicalStructure {
    return {
      type: this.mapStringToStructureType(structure.type),
      name: structure.name,
      content: structure.content,
      location: structure.location,
      metadata: {
        language: structure.metadata.language || 'unknown',
        confidence: structure.metadata.confidence,
        nestingLevel: structure.metadata.nestingLevel
      }
    };
  }

  /**
   * 将NestedStructure转换为HierarchicalStructure
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
      metadata: {
        language: structure.metadata.language || 'unknown',
        confidence: structure.metadata.confidence,
        nestingLevel: structure.metadata.nestingLevel
      }
    };
  }

  /**
   * 将InternalStructure转换为HierarchicalStructure
   */
  static convertInternalToHierarchical(structure: InternalStructure): HierarchicalStructure {
    return {
      type: this.mapStringToStructureType(structure.type),
      name: structure.name,
      content: structure.content,
      location: structure.location,
      nestingInfo: {
        level: 0, // 内部结构通常没有嵌套层级
        parentType: 'unknown',
        parentName: 'unknown',
        path: []
      },
      metadata: {
        language: structure.metadata.language || 'unknown',
        confidence: structure.metadata.confidence,
        importance: structure.importance
      }
    };
  }

  /**
   * 将字符串映射为StructureType枚举
   */
  static mapStringToStructureType(typeString: string): StructureType {
    const typeMap: Record<string, StructureType> = {
      'function': StructureType.FUNCTION,
      'method': StructureType.METHOD,
      'class': StructureType.CLASS,
      'interface': StructureType.INTERFACE,
      'struct': StructureType.STRUCT,
      'enum': StructureType.ENUM,
      'variable': StructureType.VARIABLE,
      'import': StructureType.IMPORT,
      'export': StructureType.EXPORT,
      'type': StructureType.TYPE,
      'trait': StructureType.TRAIT,
      'impl': StructureType.IMPLEMENTATION,
      'control-flow': StructureType.CONTROL_FLOW,
      'expression': StructureType.EXPRESSION,
      'return': StructureType.RETURN,
      'if': StructureType.IF,
      'for': StructureType.FOR,
      'while': StructureType.WHILE,
      'switch': StructureType.SWITCH,
      'case': StructureType.CASE,
      'try': StructureType.TRY,
      'catch': StructureType.CATCH,
      'document': StructureType.DOCUMENT,
      'key_value': StructureType.KEY_VALUE,
      'block': StructureType.BLOCK,
      'array': StructureType.ARRAY,
      'table': StructureType.TABLE,
      'section': StructureType.SECTION,
      'key': StructureType.KEY,
      'value': StructureType.VALUE,
      'dependency': StructureType.DEPENDENCY,
      'type-def': StructureType.TYPE_DEFINITION,
      'call': StructureType.CALL,
      'data-flow': StructureType.DATA_FLOW,
      'parameter-flow': StructureType.PARAMETER_FLOW,
      'union': StructureType.UNION,
      'annotation': StructureType.ANNOTATION,
      'config-item': StructureType.CONFIG_ITEM,
      'nested_class': StructureType.NESTED_CLASS,
      'nested_function': StructureType.NESTED_FUNCTION
    };

    return typeMap[typeString] || StructureType.UNKNOWN;
  }

  /**
   * 将StandardizedQueryResult转换为HierarchicalStructure数组
   */
  static convertQueryResultsToHierarchical(
    results: StandardizedQueryResult[]
  ): HierarchicalStructure[] {
    return results.map(result => ({
      type: this.mapStringToStructureType(result.type),
      name: result.name || 'unknown',
      content: result.content || '',
      location: {
        startLine: result.startLine || 1,
        endLine: result.endLine || 1
      },
      nestingInfo: {
        level: 0,
        parentType: 'unknown',
        parentName: 'unknown',
        path: []
      },
      metadata: {
        confidence: 0.5,
        ...result.metadata
      }
    }));
  }

  /**
   * 批量转换TopLevelStructure数组
   */
  static convertTopLevelStructures(
    structures: TopLevelStructure[]
  ): HierarchicalStructure[] {
    return structures.map(structure => this.convertTopLevelToHierarchical(structure));
  }

  /**
   * 批量转换NestedStructure数组
   */
  static convertNestedStructures(
    structures: NestedStructure[]
  ): HierarchicalStructure[] {
    return structures.map(structure => this.convertNestedToHierarchical(structure));
  }

  /**
   * 批量转换InternalStructure数组
   */
  static convertInternalStructures(
    structures: InternalStructure[]
  ): HierarchicalStructure[] {
    return structures.map(structure => this.convertInternalToHierarchical(structure));
  }

  /**
   * 将StructureType映射为代码块类型
   */
  static mapStructureTypeToChunkType(structureType: StructureType): string {
    const chunkTypeMap: Record<StructureType, string> = {
      [StructureType.FUNCTION]: 'function',
      [StructureType.METHOD]: 'method',
      [StructureType.CLASS]: 'class',
      [StructureType.INTERFACE]: 'interface',
      [StructureType.STRUCT]: 'struct',
      [StructureType.ENUM]: 'enum',
      [StructureType.VARIABLE]: 'variable',
      [StructureType.IMPORT]: 'import',
      [StructureType.EXPORT]: 'export',
      [StructureType.TYPE]: 'type',
      [StructureType.TRAIT]: 'trait',
      [StructureType.IMPLEMENTATION]: 'implementation',
      [StructureType.CONTROL_FLOW]: 'control-flow',
      [StructureType.EXPRESSION]: 'expression',
      [StructureType.RETURN]: 'return',
      [StructureType.IF]: 'if',
      [StructureType.FOR]: 'for',
      [StructureType.WHILE]: 'while',
      [StructureType.SWITCH]: 'switch',
      [StructureType.CASE]: 'case',
      [StructureType.TRY]: 'try',
      [StructureType.CATCH]: 'catch',
      [StructureType.DOCUMENT]: 'document',
      [StructureType.KEY_VALUE]: 'key-value',
      [StructureType.BLOCK]: 'block',
      [StructureType.ARRAY]: 'array',
      [StructureType.TABLE]: 'table',
      [StructureType.SECTION]: 'section',
      [StructureType.KEY]: 'key',
      [StructureType.VALUE]: 'value',
      [StructureType.DEPENDENCY]: 'dependency',
      [StructureType.TYPE_DEFINITION]: 'type-definition',
      [StructureType.CALL]: 'call',
      [StructureType.DATA_FLOW]: 'data-flow',
      [StructureType.PARAMETER_FLOW]: 'parameter-flow',
      [StructureType.UNION]: 'union',
      [StructureType.ANNOTATION]: 'annotation',
      [StructureType.CONFIG_ITEM]: 'config-item',
      [StructureType.NESTED_CLASS]: 'nested-class',
      [StructureType.NESTED_FUNCTION]: 'nested-function',
      [StructureType.UNKNOWN]: 'unknown'
    };

    return chunkTypeMap[structureType] || 'unknown';
  }

  /**
   * 合并多个HierarchicalStructure数组
   */
  static mergeHierarchicalStructures(
    ...structureArrays: HierarchicalStructure[][]
  ): HierarchicalStructure[] {
    return structureArrays.flat();
  }

  /**
   * 按类型过滤HierarchicalStructure
   */
  static filterByType(
    structures: HierarchicalStructure[],
    type: StructureType
  ): HierarchicalStructure[] {
    return structures.filter(structure => structure.type === type);
  }

  /**
   * 按名称过滤HierarchicalStructure
   */
  static filterByName(
    structures: HierarchicalStructure[],
    name: string
  ): HierarchicalStructure[] {
    return structures.filter(structure =>
      structure.name.toLowerCase().includes(name.toLowerCase())
    );
  }

  /**
   * 按位置范围过滤HierarchicalStructure
   */
  static filterByLocation(
    structures: HierarchicalStructure[],
    startLine: number,
    endLine: number
  ): HierarchicalStructure[] {
    return structures.filter(structure =>
      structure.location.startLine >= startLine &&
      structure.location.endLine <= endLine
    );
  }

  /**
   * 按嵌套层级过滤HierarchicalStructure
   */
  static filterByNestingLevel(
    structures: HierarchicalStructure[],
    level: number
  ): HierarchicalStructure[] {
    return structures.filter(structure =>
      structure.nestingInfo && structure.nestingInfo.level === level
    );
  }

  /**
   * 按置信度过滤HierarchicalStructure
   */
  static filterByConfidence(
    structures: HierarchicalStructure[],
    minConfidence: number
  ): HierarchicalStructure[] {
    return structures.filter(structure =>
      structure.metadata.confidence >= minConfidence
    );
  }

  /**
   * 按重要性过滤HierarchicalStructure
   */
  static filterByImportance(
    structures: HierarchicalStructure[],
    importance: 'low' | 'medium' | 'high'
  ): HierarchicalStructure[] {
    return structures.filter(structure =>
      structure.metadata.importance === importance
    );
  }

  /**
   * 按语言过滤HierarchicalStructure
   */
  static filterByLanguage(
    structures: HierarchicalStructure[],
    language: string
  ): HierarchicalStructure[] {
    return structures.filter(structure =>
      structure.metadata.language === language
    );
  }

  /**
   * 对HierarchicalStructure进行排序
   */
  static sortByLocation(structures: HierarchicalStructure[]): HierarchicalStructure[] {
    return structures.sort((a, b) => a.location.startLine - b.location.startLine);
  }

  /**
   * 按名称对HierarchicalStructure进行排序
   */
  static sortByName(structures: HierarchicalStructure[]): HierarchicalStructure[] {
    return structures.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * 按置信度对HierarchicalStructure进行排序
   */
  static sortByConfidence(structures: HierarchicalStructure[]): HierarchicalStructure[] {
    return structures.sort((a, b) => b.metadata.confidence - a.metadata.confidence);
  }

  /**
   * 获取HierarchicalStructure的统计信息
   */
  static getStatistics(structures: HierarchicalStructure[]): {
    total: number;
    byType: Record<StructureType, number>;
    byLanguage: Record<string, number>;
    averageConfidence: number;
  } {
    const stats = {
      total: structures.length,
      byType: {} as Record<StructureType, number>,
      byLanguage: {} as Record<string, number>,
      averageConfidence: 0
    };

    let totalConfidence = 0;

    for (const structure of structures) {
      // 按类型统计
      const type = structure.type;
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // 按语言统计
      const language = structure.metadata.language || 'unknown';
      stats.byLanguage[language] = (stats.byLanguage[language] || 0) + 1;

      // 累计置信度
      totalConfidence += structure.metadata.confidence || 0;
    }

    stats.averageConfidence = structures.length > 0 ? totalConfidence / structures.length : 0;

    return stats;
  }

  /**
   * 验证HierarchicalStructure的有效性
   */
  static validateStructure(structure: HierarchicalStructure): boolean {
    return !!(
      structure.name &&
      structure.content &&
      structure.location &&
      structure.location.startLine > 0 &&
      structure.location.endLine >= structure.location.startLine
    );
  }

  /**
   * 清理和标准化HierarchicalStructure
   */
  static normalizeStructure(structure: HierarchicalStructure): HierarchicalStructure {
    return {
      ...structure,
      name: structure.name.trim(),
      content: structure.content.trim(),
      metadata: {
        ...structure.metadata,
        confidence: Math.max(0, Math.min(1, structure.metadata.confidence || 0))
      }
    };
  }

  /**
   * 将StructureType直接映射为ChunkType枚举
   * @param structureType 结构类型
   * @returns 对应的ChunkType枚举
   */
  static mapStructureTypeToChunkTypeDirect(structureType: StructureType): ChunkType {
    return ChunkTypeMapper.mapStructureToChunk(structureType);
  }

  /**
   * 批量转换StructureType数组为ChunkType数组
   * @param structureTypes 结构类型数组
   * @returns ChunkType数组
   */
  static mapStructureTypesToChunkTypes(structureTypes: StructureType[]): ChunkType[] {
    return ChunkTypeMapper.batchMapStructureToChunk(structureTypes);
  }

  /**
   * 将ChunkType直接映射为StructureType枚举
   * @param chunkType 代码块类型
   * @returns 对应的StructureType枚举
   */
  static mapChunkTypeToStructureTypeDirect(chunkType: ChunkType): StructureType {
    return ChunkTypeMapper.mapChunkToStructure(chunkType);
  }

  /**
   * 批量转换ChunkType数组为StructureType数组
   * @param chunkTypes 代码块类型数组
   * @returns StructureType数组
   */
  static mapChunkTypesToStructureTypes(chunkTypes: ChunkType[]): StructureType[] {
    return ChunkTypeMapper.batchMapChunkToStructure(chunkTypes);
  }

  /**
   * 验证ChunkType是否有效
   * @param chunkType 代码块类型
   * @returns 是否有效
   */
  static isValidChunkType(chunkType: string): chunkType is ChunkType {
    return ChunkTypeMapper.isValidChunkType(chunkType);
  }

  /**
   * 验证StructureType是否有效
   * @param structureType 结构类型
   * @returns 是否有效
   */
  static isValidStructureType(structureType: string): structureType is StructureType {
    return ChunkTypeMapper.isValidStructureType(structureType);
  }

  /**
   * 检查两个类型是否兼容
   * @param structureType 结构类型
   * @param chunkType 代码块类型
   * @returns 是否兼容
   */
  static areTypesCompatible(structureType: StructureType, chunkType: ChunkType): boolean {
    return ChunkTypeMapper.areTypesCompatible(structureType, chunkType);
  }

  /**
   * 获取指定ChunkType的复杂度阈值
   * @param chunkType 代码块类型
   * @returns 复杂度阈值对象
   */
  static getComplexityThresholds(chunkType: ChunkType): { min: number; max: number } {
    return ChunkTypeMapper.getComplexityThresholds(chunkType);
  }

  /**
   * 获取所有复杂度阈值配置
   * @returns 复杂度阈值配置对象
   */
  static getAllComplexityThresholds(): {
    typeSpecific: Record<ChunkType, { min: number; max: number }>;
    default: { minComplexity: number; maxComplexity: number };
  } {
    return ChunkTypeMapper.getAllComplexityThresholds();
  }
}