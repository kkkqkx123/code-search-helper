/**
 * ChunkType 映射器
 * 提供 StructureType 与 ChunkType 之间的直接映射
 * 使用分离的常量定义，便于维护和控制代码规模
 */

import { StructureType } from '../../service/parser/processing/types/HierarchicalTypes';
import { ChunkType } from '../../service/parser/processing/types/CodeChunk';
import {
  STRUCTURE_TO_CHUNK_MAP,
  CHUNK_TO_STRUCTURE_MAP,
  NESTED_STRUCTURE_PRESERVE_STRATEGIES,
  COMPLEXITY_THRESHOLDS,
  DEFAULT_COMPLEXITY_THRESHOLDS
} from '../../service/parser/constants/ChunkTypeMappings';

/**
 * ChunkType 映射器类
 * 提供类型安全的类型映射和验证功能
 */
export class ChunkTypeMapper {
  /**
   * 将 StructureType 映射为 ChunkType
   * @param structureType 结构类型
   * @returns 对应的代码块类型
   */
  static mapStructureToChunk(structureType: StructureType): ChunkType {
    return STRUCTURE_TO_CHUNK_MAP[structureType] || ChunkType.GENERIC;
  }

  /**
   * 将 ChunkType 映射为 StructureType
   * @param chunkType 代码块类型
   * @returns 对应的结构类型
   */
  static mapChunkToStructure(chunkType: ChunkType): StructureType {
    return CHUNK_TO_STRUCTURE_MAP[chunkType] || StructureType.UNKNOWN;
  }

  /**
   * 验证 ChunkType 是否有效
   * @param chunkType 代码块类型
   * @returns 是否有效
   */
  static isValidChunkType(chunkType: string): chunkType is ChunkType {
    return Object.values(ChunkType).includes(chunkType as ChunkType);
  }

  /**
   * 验证 StructureType 是否有效
   * @param structureType 结构类型
   * @returns 是否有效
   */
  static isValidStructureType(structureType: string): structureType is StructureType {
    return Object.values(StructureType).includes(structureType as StructureType);
  }

  /**
   * 获取所有支持的 ChunkType
   * @returns ChunkType 数组
   */
  static getAllSupportedChunkTypes(): ChunkType[] {
    return Object.values(ChunkType);
  }

  /**
   * 获取所有支持的 StructureType
   * @returns StructureType 数组
   */
  static getAllSupportedStructureTypes(): StructureType[] {
    return Object.values(StructureType);
  }

  /**
   * 检查两个类型是否兼容
   * @param structureType 结构类型
   * @param chunkType 代码块类型
   * @returns 是否兼容
   */
  static areTypesCompatible(structureType: StructureType, chunkType: ChunkType): boolean {
    return this.mapStructureToChunk(structureType) === chunkType;
  }

  /**
   * 检查是否应该保留嵌套结构的完整实现
   * @param chunkType 代码块类型
   * @returns 是否保留完整实现
   */
  static shouldPreserveNestedStructure(chunkType: ChunkType): boolean {
    return NESTED_STRUCTURE_PRESERVE_STRATEGIES[chunkType] !== undefined
      ? NESTED_STRUCTURE_PRESERVE_STRATEGIES[chunkType]
      : false;
  }

  /**
   * 获取指定 ChunkType 的复杂度阈值
   * @param chunkType 代码块类型
   * @returns 复杂度阈值对象
   */
  static getComplexityThresholds(chunkType: ChunkType): { min: number; max: number } {
    return COMPLEXITY_THRESHOLDS[chunkType] || {
      min: DEFAULT_COMPLEXITY_THRESHOLDS.minComplexity,
      max: DEFAULT_COMPLEXITY_THRESHOLDS.maxComplexity
    };
  }

  /**
   * 获取所有复杂度阈值配置
   * @returns 复杂度阈值配置对象
   */
  static getAllComplexityThresholds(): {
    typeSpecific: Record<ChunkType, { min: number; max: number }>;
    default: { minComplexity: number; maxComplexity: number };
  } {
    return {
      typeSpecific: COMPLEXITY_THRESHOLDS,
      default: DEFAULT_COMPLEXITY_THRESHOLDS
    };
  }

  /**
   * 批量转换 StructureType 数组为 ChunkType 数组
   * @param structureTypes 结构类型数组
   * @returns ChunkType 数组
   */
  static batchMapStructureToChunk(structureTypes: StructureType[]): ChunkType[] {
    return structureTypes.map(type => this.mapStructureToChunk(type));
  }

  /**
   * 批量转换 ChunkType 数组为 StructureType 数组
   * @param chunkTypes 代码块类型数组
   * @returns StructureType 数组
   */
  static batchMapChunkToStructure(chunkTypes: ChunkType[]): StructureType[] {
    return chunkTypes.map(type => this.mapChunkToStructure(type));
  }

  /**
   * 过滤出有效的 ChunkType
   * @param chunkTypes 待过滤的类型数组
   * @returns 有效的 ChunkType 数组
   */
  static filterValidChunkTypes(chunkTypes: string[]): ChunkType[] {
    return chunkTypes.filter(type => this.isValidChunkType(type)) as ChunkType[];
  }

  /**
   * 过滤出有效的 StructureType
   * @param structureTypes 待过滤的类型数组
   * @returns 有效的 StructureType 数组
   */
  static filterValidStructureTypes(structureTypes: string[]): StructureType[] {
    return structureTypes.filter(type => this.isValidStructureType(type)) as StructureType[];
  }

  /**
   * 获取类型映射统计信息
   * @returns 类型映射统计信息
   */
  static getMappingStatistics(): {
    totalStructureTypes: number;
    totalChunkTypes: number;
    mappedStructureTypes: number;
    mappedChunkTypes: number;
    preserveStrategiesCount: number;
    complexityThresholdsCount: number;
  } {
    return {
      totalStructureTypes: Object.keys(StructureType).length,
      totalChunkTypes: Object.keys(ChunkType).length,
      mappedStructureTypes: Object.keys(STRUCTURE_TO_CHUNK_MAP).length,
      mappedChunkTypes: Object.keys(CHUNK_TO_STRUCTURE_MAP).length,
      preserveStrategiesCount: Object.keys(NESTED_STRUCTURE_PRESERVE_STRATEGIES).length,
      complexityThresholdsCount: Object.keys(COMPLEXITY_THRESHOLDS).length
    };
  }
}