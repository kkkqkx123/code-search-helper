/**
 * 验证策略常量定义
 * 将验证逻辑与主代码分离，提高可维护性和可扩展性
 */

import { ChunkType } from '../processing/types/CodeChunk';
import { ValidationUtils } from '../../../utils/parser/validation/ValidationUtils';

/**
 * 验证策略接口
 */
export interface ValidationStrategy {
  /** 验证函数，为null时使用通用大小验证 */
  validator: null | ((
    content: string,
    location: { startLine: number; endLine: number },
    config?: any
  ) => boolean);
  /** 默认配置 */
  config?: {
    minChars?: number;
    maxChars?: number;
    minLines?: number;
    [key: string]: any;
  };
}

/**
 * 类型验证策略映射表
 * 定义了每种代码块类型的验证策略和默认配置
 */
export const VALIDATION_STRATEGIES: Record<ChunkType, ValidationStrategy> = {
  [ChunkType.FUNCTION]: {
    validator: ValidationUtils.isValidFunction,
    config: { minChars: 10, maxChars: 1000, minLines: 3 }
  },
  [ChunkType.CLASS]: {
    validator: ValidationUtils.isValidClass,
    config: { minChars: 20, maxChars: 2000, minLines: 5 }
  },
  [ChunkType.METHOD]: {
    validator: ValidationUtils.isValidFunction, // 方法使用函数验证器
    config: { minChars: 5, maxChars: 500, minLines: 2 }
  },
  [ChunkType.INTERFACE]: {
    validator: ValidationUtils.isValidClass, // 接口使用类验证器
    config: { minChars: 10, maxChars: 1000, minLines: 2 }
  },
  [ChunkType.ENUM]: {
    validator: ValidationUtils.isValidClass, // 枚举使用类验证器
    config: { minChars: 5, maxChars: 500, minLines: 2 }
  },
  [ChunkType.IMPORT]: {
    validator: ValidationUtils.isValidImport,
    config: { minChars: 5, maxChars: 200, minLines: 1 }
  },
  [ChunkType.EXPORT]: {
    validator: ValidationUtils.isValidImport, // 导出使用导入验证器
    config: { minChars: 5, maxChars: 200, minLines: 1 }
  },
  [ChunkType.TYPE]: {
    validator: ValidationUtils.isValidTemplate, // 类型定义使用模板验证器
    config: { minChars: 5, maxChars: 500, minLines: 1 }
  },
  [ChunkType.TYPE_DEF]: {
    validator: ValidationUtils.isValidTemplate, // 类型定义使用模板验证器
    config: { minChars: 5, maxChars: 500, minLines: 1 }
  },
  [ChunkType.MODULE]: {
    validator: ValidationUtils.isValidNamespace, // 模块使用命名空间验证器
    config: { minChars: 10, maxChars: 1000, minLines: 2 }
  },
  // 以下类型使用通用验证
  [ChunkType.GENERIC]: {
    validator: null, // 使用大小验证
    config: { minChars: 1, maxChars: 1000, minLines: 1 }
  },
  [ChunkType.VARIABLE]: {
    validator: null, // 使用大小验证
    config: { minChars: 1, maxChars: 200, minLines: 1 }
  },
  [ChunkType.BLOCK]: {
    validator: null, // 使用大小验证
    config: { minChars: 5, maxChars: 1000, minLines: 2 }
  },
  [ChunkType.LINE]: {
    validator: null, // 使用大小验证
    config: { minChars: 1, maxChars: 100, minLines: 1 }
  },
  [ChunkType.CONTROL_FLOW]: {
    validator: null, // 使用大小验证
    config: { minChars: 2, maxChars: 500, minLines: 1 }
  },
  [ChunkType.EXPRESSION]: {
    validator: null, // 使用大小验证
    config: { minChars: 1, maxChars: 200, minLines: 1 }
  },
  [ChunkType.CONFIG_ITEM]: {
    validator: null, // 使用大小验证
    config: { minChars: 1, maxChars: 100, minLines: 1 }
  },
  [ChunkType.SECTION]: {
    validator: null, // 使用大小验证
    config: { minChars: 5, maxChars: 500, minLines: 1 }
  },
  [ChunkType.KEY]: {
    validator: null, // 使用大小验证
    config: { minChars: 1, maxChars: 50, minLines: 1 }
  },
  [ChunkType.VALUE]: {
    validator: null, // 使用大小验证
    config: { minChars: 1, maxChars: 200, minLines: 1 }
  },
  [ChunkType.ARRAY]: {
    validator: null, // 使用大小验证
    config: { minChars: 2, maxChars: 500, minLines: 1 }
  },
  [ChunkType.TABLE]: {
    validator: null, // 使用大小验证
    config: { minChars: 2, maxChars: 1000, minLines: 1 }
  },
  [ChunkType.DEPENDENCY]: {
    validator: null, // 使用大小验证
    config: { minChars: 1, maxChars: 100, minLines: 1 }
  },
  [ChunkType.CALL]: {
    validator: null, // 使用大小验证
    config: { minChars: 1, maxChars: 100, minLines: 1 }
  },
  [ChunkType.DATA_FLOW]: {
    validator: null, // 使用大小验证
    config: { minChars: 2, maxChars: 200, minLines: 1 }
  },
  [ChunkType.PARAMETER_FLOW]: {
    validator: null, // 使用大小验证
    config: { minChars: 1, maxChars: 100, minLines: 1 }
  },
  [ChunkType.UNION]: {
    validator: null, // 使用大小验证
    config: { minChars: 2, maxChars: 200, minLines: 1 }
  },
  [ChunkType.ANNOTATION]: {
    validator: null, // 使用大小验证
    config: { minChars: 1, maxChars: 50, minLines: 1 }
  },
  [ChunkType.DOCUMENTATION]: {
    validator: null, // 使用大小验证
    config: { minChars: 5, maxChars: 1000, minLines: 1 }
  },
  [ChunkType.COMMENT]: {
    validator: null, // 使用大小验证
    config: { minChars: 1, maxChars: 500, minLines: 1 }
  }
};

/**
 * 获取指定类型的验证策略
 * @param chunkType 代码块类型
 * @returns 验证策略
 */
export function getValidationStrategy(chunkType: ChunkType): ValidationStrategy {
  return VALIDATION_STRATEGIES[chunkType] || VALIDATION_STRATEGIES[ChunkType.GENERIC];
}

/**
 * 检查是否有指定类型的验证策略
 * @param chunkType 代码块类型
 * @returns 是否有验证策略
 */
export function hasValidationStrategy(chunkType: ChunkType): boolean {
  return chunkType in VALIDATION_STRATEGIES;
}

/**
 * 获取所有支持的验证类型
 * @returns 支持的类型数组
 */
export function getSupportedValidationTypes(): ChunkType[] {
  return Object.keys(VALIDATION_STRATEGIES) as ChunkType[];
}