import { TopLevelStructure, NestedStructure, InternalStructure } from '../../../../../utils/types/ContentTypes';
import { StandardizedQueryResult } from '../types';
import { LoggerService } from '../../../../../utils/LoggerService';

/**
 * 结构类型转换器
 * 负责将StandardizedQueryResult转换为现有的结构类型
 * 处理元信息映射，保持数据完整性
 */
export class StructureTypeConverter {
  private logger: LoggerService;

  constructor() {
    this.logger = new LoggerService();
  }

  /**
   * 将StandardizedQueryResult数组转换为TopLevelStructure数组
   * @param standardizedResults 标准化查询结果数组
   * @param content 源代码内容
   * @param language 编程语言
   * @returns 顶级结构数组
   */
  convertToTopLevelStructures(
    standardizedResults: StandardizedQueryResult[],
    content: string,
    language: string
  ): TopLevelStructure[] {
    const lines = content.split('\n');
    
    return standardizedResults.map(result => {
      try {
        return this.convertSingleToTopLevelStructure(result, lines, language);
      } catch (error) {
        this.logger.warn(`转换顶级结构失败: ${result.name}`, error);
        return this.createFallbackTopLevelStructure(result, lines, language);
      }
    });
  }

  /**
   * 将StandardizedQueryResult数组转换为NestedStructure数组
   * @param standardizedResults 标准化查询结果数组
   * @param content 源代码内容
   * @param level 嵌套层级
   * @returns 嵌套结构数组
   */
  convertToNestedStructures(
    standardizedResults: StandardizedQueryResult[],
    content: string,
    level: number
  ): NestedStructure[] {
    const lines = content.split('\n');
    
    return standardizedResults.map(result => {
      try {
        return this.convertSingleToNestedStructure(result, lines, level);
      } catch (error) {
        this.logger.warn(`转换嵌套结构失败: ${result.name}`, error);
        return this.createFallbackNestedStructure(result, lines, level);
      }
    });
  }

  /**
   * 将StandardizedQueryResult数组转换为InternalStructure数组
   * @param standardizedResults 标准化查询结果数组
   * @param content 源代码内容
   * @returns 内部结构数组
   */
  convertToInternalStructures(
    standardizedResults: StandardizedQueryResult[],
    content: string
  ): InternalStructure[] {
    const lines = content.split('\n');
    
    return standardizedResults.map(result => {
      try {
        return this.convertSingleToInternalStructure(result, lines);
      } catch (error) {
        this.logger.warn(`转换内部结构失败: ${result.name}`, error);
        return this.createFallbackInternalStructure(result, lines);
      }
    });
  }

  /**
   * 转换单个StandardizedQueryResult为TopLevelStructure
   * @param result 标准化查询结果
   * @param lines 代码行数组
   * @param language 编程语言
   * @returns 顶级结构
   */
  private convertSingleToTopLevelStructure(
    result: StandardizedQueryResult,
    lines: string[],
    language: string
  ): TopLevelStructure {
    return {
      type: result.type,
      name: result.name,
      content: result.content,
      location: {
        startLine: result.startLine,
        endLine: result.endLine
      },
      node: null, // 在新实现中，我们不直接存储AST节点
      metadata: this.convertMetadata(result.metadata, language, {
        confidence: this.calculateConfidence(result)
      })
    };
  }

  /**
   * 转换单个StandardizedQueryResult为NestedStructure
   * @param result 标准化查询结果
   * @param lines 代码行数组
   * @param level 嵌套层级
   * @returns 嵌套结构
   */
  private convertSingleToNestedStructure(
    result: StandardizedQueryResult,
    lines: string[],
    level: number
  ): NestedStructure {
    return {
      type: result.type,
      name: result.name,
      content: result.content,
      location: {
        startLine: result.startLine,
        endLine: result.endLine
      },
      parentNode: null, // 在新实现中，我们不直接存储AST节点
      level,
      metadata: this.convertMetadata(result.metadata, '', {
        nestingLevel: level,
        confidence: this.calculateConfidence(result)
      })
    };
  }

  /**
   * 转换单个StandardizedQueryResult为InternalStructure
   * @param result 标准化查询结果
   * @param lines 代码行数组
   * @returns 内部结构
   */
  private convertSingleToInternalStructure(
    result: StandardizedQueryResult,
    lines: string[]
  ): InternalStructure {
    return {
      type: result.type,
      name: result.name,
      content: result.content,
      location: {
        startLine: result.startLine,
        endLine: result.endLine
      },
      parentNode: null, // 在新实现中，我们不直接存储AST节点
      importance: this.calculateImportance(result),
      metadata: this.convertMetadata(result.metadata, '', {
        confidence: this.calculateConfidence(result)
      })
    };
  }

  /**
   * 转换元数据
   * @param sourceMetadata 源元数据
   * @param language 编程语言
   * @param additionalMetadata 额外元数据
   * @returns 转换后的元数据
   */
  private convertMetadata(
    sourceMetadata: any,
    language: string,
    additionalMetadata: Record<string, any> = {}
  ): Record<string, any> {
    const converted: Record<string, any> = {
      language,
      ...additionalMetadata
    };

    // 转换标准元数据字段
    if (sourceMetadata) {
      // 复杂度
      if (typeof sourceMetadata.complexity === 'number') {
        converted.complexity = sourceMetadata.complexity;
      }

      // 依赖项
      if (Array.isArray(sourceMetadata.dependencies)) {
        converted.dependencies = sourceMetadata.dependencies;
      }

      // 修饰符
      if (Array.isArray(sourceMetadata.modifiers)) {
        converted.modifiers = sourceMetadata.modifiers;
      }

      // 位置信息
      if (sourceMetadata.location) {
        converted.location = sourceMetadata.location;
      }

      // 范围信息
      if (sourceMetadata.range) {
        converted.range = sourceMetadata.range;
      }

      // 代码片段
      if (sourceMetadata.codeSnippet) {
        converted.codeSnippet = sourceMetadata.codeSnippet;
      }

      // 复制其他自定义字段
      Object.keys(sourceMetadata).forEach(key => {
        if (!converted.hasOwnProperty(key)) {
          converted[key] = sourceMetadata[key];
        }
      });
    }

    return converted;
  }

  /**
   * 计算置信度
   * @param result 标准化查询结果
   * @returns 置信度 (0-1)
   */
  private calculateConfidence(result: StandardizedQueryResult): number {
    let confidence = 0.8; // 基础置信度

    // 根据元数据调整置信度
    if (result.metadata) {
      // 根据复杂度调整
      if (typeof result.metadata.complexity === 'number' && result.metadata.complexity > 0) {
        confidence += Math.min(0.1, result.metadata.complexity * 0.01);
      }

      // 根据内容长度调整
      if (result.content.length > 50) {
        confidence += 0.05;
      }

      // 根据是否有依赖项调整
      if (Array.isArray(result.metadata.dependencies) && result.metadata.dependencies.length > 0) {
        confidence += 0.05;
      }

      // 根据是否有修饰符调整
      if (Array.isArray(result.metadata.modifiers) && result.metadata.modifiers.length > 0) {
        confidence += 0.03;
      }
    }

    return Math.min(1.0, confidence);
  }

  /**
   * 计算重要性
   * @param result 标准化查询结果
   * @returns 重要性级别
   */
  private calculateImportance(result: StandardizedQueryResult): 'low' | 'medium' | 'high' {
    // 根据类型确定基础重要性
    const highImportanceTypes = ['function', 'class', 'method', 'interface'];
    const mediumImportanceTypes = ['variable', 'import', 'export', 'type'];

    if (highImportanceTypes.includes(result.type)) {
      return 'high';
    }

    if (mediumImportanceTypes.includes(result.type)) {
      return 'medium';
    }

    // 根据复杂度调整重要性
    if (result.metadata && typeof result.metadata.complexity === 'number') {
      if (result.metadata.complexity > 5) {
        return 'high';
      }
      if (result.metadata.complexity > 2) {
        return 'medium';
      }
    }

    // 根据内容长度调整重要性
    if (result.content.length > 200) {
      return 'high';
    }
    if (result.content.length > 50) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * 创建降级顶级结构
   * @param result 标准化查询结果
   * @param lines 代码行数组
   * @param language 编程语言
   * @returns 降级顶级结构
   */
  private createFallbackTopLevelStructure(
    result: StandardizedQueryResult,
    lines: string[],
    language: string
  ): TopLevelStructure {
    return {
      type: result.type,
      name: result.name || 'unknown',
      content: result.content || '',
      location: {
        startLine: result.startLine || 1,
        endLine: result.endLine || result.startLine || 1
      },
      node: null,
      metadata: {
        language,
        confidence: 0.3, // 降级结构的置信度较低
        isFallback: true
      }
    };
  }

  /**
   * 创建降级嵌套结构
   * @param result 标准化查询结果
   * @param lines 代码行数组
   * @param level 嵌套层级
   * @returns 降级嵌套结构
   */
  private createFallbackNestedStructure(
    result: StandardizedQueryResult,
    lines: string[],
    level: number
  ): NestedStructure {
    return {
      type: result.type,
      name: result.name || 'unknown',
      content: result.content || '',
      location: {
        startLine: result.startLine || 1,
        endLine: result.endLine || result.startLine || 1
      },
      parentNode: null,
      level,
      metadata: {
        nestingLevel: level,
        confidence: 0.3, // 降级结构的置信度较低
        isFallback: true
      }
    };
  }

  /**
   * 创建降级内部结构
   * @param result 标准化查询结果
   * @param lines 代码行数组
   * @returns 降级内部结构
   */
  private createFallbackInternalStructure(
    result: StandardizedQueryResult,
    lines: string[]
  ): InternalStructure {
    return {
      type: result.type,
      name: result.name || 'unknown',
      content: result.content || '',
      location: {
        startLine: result.startLine || 1,
        endLine: result.endLine || result.startLine || 1
      },
      parentNode: null,
      importance: 'low', // 降级结构的重要性较低
      metadata: {
        confidence: 0.3, // 降级结构的置信度较低
        isFallback: true
      }
    };
  }

  /**
   * 批量转换结构
   * @param standardizedResults 标准化查询结果数组
   * @param content 源代码内容
   * @param language 编程语言
   * @param options 转换选项
   * @returns 转换结果
   */
  batchConvert(
    standardizedResults: StandardizedQueryResult[],
    content: string,
    language: string,
    options: {
      includeTopLevel?: boolean;
      includeNested?: boolean;
      includeInternal?: boolean;
      nestingLevel?: number;
    } = {}
  ): {
    topLevelStructures: TopLevelStructure[];
    nestedStructures: NestedStructure[];
    internalStructures: InternalStructure[];
  } {
    const {
      includeTopLevel = true,
      includeNested = true,
      includeInternal = true,
      nestingLevel = 1
    } = options;

    const result = {
      topLevelStructures: [] as TopLevelStructure[],
      nestedStructures: [] as NestedStructure[],
      internalStructures: [] as InternalStructure[]
    };

    if (includeTopLevel) {
      result.topLevelStructures = this.convertToTopLevelStructures(
        standardizedResults,
        content,
        language
      );
    }

    if (includeNested) {
      result.nestedStructures = this.convertToNestedStructures(
        standardizedResults,
        content,
        nestingLevel
      );
    }

    if (includeInternal) {
      result.internalStructures = this.convertToInternalStructures(
        standardizedResults,
        content
      );
    }

    return result;
  }

  /**
   * 验证转换结果
   * @param structures 结构数组
   * @returns 验证结果
   */
  validateConversion(structures: any[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    structures.forEach((structure, index) => {
      // 检查必需字段
      if (!structure.type) {
        errors.push(`结构 ${index}: 缺少类型字段`);
      }
      if (!structure.name) {
        errors.push(`结构 ${index}: 缺少名称字段`);
      }
      if (!structure.content) {
        warnings.push(`结构 ${index}: 内容为空`);
      }
      if (!structure.location) {
        errors.push(`结构 ${index}: 缺少位置信息`);
      } else {
        if (!structure.location.startLine || !structure.location.endLine) {
          errors.push(`结构 ${index}: 位置信息不完整`);
        }
        if (structure.location.startLine > structure.location.endLine) {
          errors.push(`结构 ${index}: 起始行号大于结束行号`);
        }
      }
      if (!structure.metadata) {
        warnings.push(`结构 ${index}: 缺少元数据`);
      } else if (typeof structure.metadata.confidence !== 'number') {
        warnings.push(`结构 ${index}: 置信度不是数字`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}