/**
 * ChunkType 映射常量定义
 * 将类型映射配置与主逻辑分离，便于维护和控制代码规模
 */

import { StructureType } from '../processing/types/HierarchicalTypes';
import { ChunkType } from '../processing/types/CodeChunk';

/**
 * StructureType 到 ChunkType 的映射表
 * 定义了所有结构类型到代码块类型的映射关系
 */
export const STRUCTURE_TO_CHUNK_MAP: Record<StructureType, ChunkType> = {
  [StructureType.UNKNOWN]: ChunkType.GENERIC,
  [StructureType.FUNCTION]: ChunkType.FUNCTION,
  [StructureType.METHOD]: ChunkType.METHOD,
  [StructureType.CLASS]: ChunkType.CLASS,
  [StructureType.INTERFACE]: ChunkType.INTERFACE,
  [StructureType.STRUCT]: ChunkType.CLASS, // 将 struct 映射为 class
  [StructureType.ENUM]: ChunkType.ENUM,
  [StructureType.VARIABLE]: ChunkType.VARIABLE,
  [StructureType.IMPORT]: ChunkType.IMPORT,
  [StructureType.EXPORT]: ChunkType.EXPORT,
  [StructureType.TYPE]: ChunkType.TYPE,
  [StructureType.TRAIT]: ChunkType.INTERFACE, // 将 trait 映射为 interface
  [StructureType.IMPLEMENTATION]: ChunkType.CLASS, // 将 implementation 映射为 class
  [StructureType.CONTROL_FLOW]: ChunkType.CONTROL_FLOW,
  [StructureType.EXPRESSION]: ChunkType.EXPRESSION,
  [StructureType.RETURN]: ChunkType.EXPRESSION, // 将 return 映射为 expression
  [StructureType.IF]: ChunkType.CONTROL_FLOW, // 将 if 映射为 control-flow
  [StructureType.FOR]: ChunkType.CONTROL_FLOW, // 将 for 映射为 control-flow
  [StructureType.WHILE]: ChunkType.CONTROL_FLOW, // 将 while 映射为 control-flow
  [StructureType.SWITCH]: ChunkType.CONTROL_FLOW, // 将 switch 映射为 control-flow
  [StructureType.CASE]: ChunkType.CONTROL_FLOW, // 将 case 映射为 control-flow
  [StructureType.TRY]: ChunkType.CONTROL_FLOW, // 将 try 映射为 control-flow
  [StructureType.CATCH]: ChunkType.CONTROL_FLOW, // 将 catch 映射为 control-flow
  [StructureType.DOCUMENT]: ChunkType.DOCUMENTATION, // 将 document 映射为 documentation
  [StructureType.KEY_VALUE]: ChunkType.GENERIC, // 将 key-value 映射为 generic
  [StructureType.BLOCK]: ChunkType.BLOCK,
  [StructureType.ARRAY]: ChunkType.ARRAY,
  [StructureType.TABLE]: ChunkType.TABLE,
  [StructureType.SECTION]: ChunkType.SECTION,
  [StructureType.KEY]: ChunkType.KEY,
  [StructureType.VALUE]: ChunkType.VALUE,
  [StructureType.DEPENDENCY]: ChunkType.DEPENDENCY,
  [StructureType.TYPE_DEFINITION]: ChunkType.TYPE_DEF, // 修正映射
  [StructureType.CALL]: ChunkType.CALL,
  [StructureType.DATA_FLOW]: ChunkType.DATA_FLOW,
  [StructureType.PARAMETER_FLOW]: ChunkType.PARAMETER_FLOW,
  [StructureType.UNION]: ChunkType.UNION,
  [StructureType.ANNOTATION]: ChunkType.ANNOTATION,
  [StructureType.CONFIG_ITEM]: ChunkType.CONFIG_ITEM,
  [StructureType.NESTED_CLASS]: ChunkType.CLASS, // 将 nested-class 映射为 class
  [StructureType.NESTED_FUNCTION]: ChunkType.FUNCTION // 将 nested-function 映射为 function
};

/**
 * ChunkType 到 StructureType 的反向映射表
 * 通过反转 STRUCTURE_TO_CHUNK_MAP 生成
 */
export const CHUNK_TO_STRUCTURE_MAP: Record<ChunkType, StructureType> =
  Object.fromEntries(
    Object.entries(STRUCTURE_TO_CHUNK_MAP).map(([key, value]) => [value, key as StructureType])
  ) as Record<ChunkType, StructureType>;

/**
 * 嵌套结构保留策略配置
 * 定义了每种代码块类型在嵌套时是否保留完整实现
 */
export const NESTED_STRUCTURE_PRESERVE_STRATEGIES: Record<ChunkType, boolean> = {
  [ChunkType.METHOD]: true, // 方法通常保留完整实现
  [ChunkType.FUNCTION]: false, // 嵌套函数通常只保留签名
  [ChunkType.CLASS]: false, // 嵌套类通常只保留签名
  [ChunkType.INTERFACE]: false, // 嵌套接口通常只保留签名
  [ChunkType.CONTROL_FLOW]: true, // 控制流结构保留完整实现
  [ChunkType.EXPRESSION]: false, // 表达式通常只保留签名
  [ChunkType.CONFIG_ITEM]: true, // 配置项保留完整实现
  [ChunkType.SECTION]: true, // 配置节保留完整实现
  [ChunkType.KEY]: false, // 键通常只保留签名
  [ChunkType.VALUE]: false, // 值通常只保留签名
  [ChunkType.ARRAY]: true, // 数组保留完整实现
  [ChunkType.TABLE]: true, // 表/对象保留完整实现
  [ChunkType.DEPENDENCY]: true, // 依赖项保留完整实现
  [ChunkType.TYPE_DEF]: true, // 类型定义保留完整实现
  [ChunkType.CALL]: false, // 函数调用通常只保留签名
  [ChunkType.DATA_FLOW]: true, // 数据流保留完整实现
  [ChunkType.PARAMETER_FLOW]: false, // 参数流通常只保留签名
  [ChunkType.UNION]: true, // 联合类型保留完整实现
  [ChunkType.ANNOTATION]: true, // 注解保留完整实现
  [ChunkType.IMPORT]: true, // 导入保留完整实现
  [ChunkType.EXPORT]: true, // 导出保留完整实现
  [ChunkType.VARIABLE]: false, // 变量通常只保留签名
  [ChunkType.ENUM]: false, // 嵌套枚举通常只保留签名
  [ChunkType.BLOCK]: true, // 块保留完整实现
  [ChunkType.LINE]: false, // 行通常只保留签名
  [ChunkType.DOCUMENTATION]: true, // 文档保留完整实现
  [ChunkType.COMMENT]: false, // 注释通常只保留签名
  [ChunkType.MODULE]: true, // 模块保留完整实现
  [ChunkType.TYPE]: true, // 类型保留完整实现
  [ChunkType.GENERIC]: true // 通用类型保留完整实现
};

/**
 * 复杂度计算阈值配置
 * 定义了每种代码块类型的复杂度计算范围
 */
export const COMPLEXITY_THRESHOLDS: Record<ChunkType, { min: number; max: number }> = {
  [ChunkType.FUNCTION]: { min: 5, max: 300 },
  [ChunkType.CLASS]: { min: 10, max: 400 },
  [ChunkType.METHOD]: { min: 3, max: 200 },
  [ChunkType.INTERFACE]: { min: 5, max: 250 },
  [ChunkType.ENUM]: { min: 3, max: 150 },
  [ChunkType.CONTROL_FLOW]: { min: 2, max: 100 },
  [ChunkType.EXPRESSION]: { min: 1, max: 50 },
  [ChunkType.TYPE_DEF]: { min: 3, max: 200 },
  [ChunkType.DOCUMENTATION]: { min: 1, max: 100 },
  [ChunkType.CONFIG_ITEM]: { min: 1, max: 50 },
  [ChunkType.SECTION]: { min: 1, max: 100 },
  [ChunkType.ARRAY]: { min: 2, max: 150 },
  [ChunkType.TABLE]: { min: 2, max: 200 },
  [ChunkType.DEPENDENCY]: { min: 1, max: 30 },
  [ChunkType.CALL]: { min: 1, max: 20 },
  [ChunkType.DATA_FLOW]: { min: 2, max: 100 },
  [ChunkType.PARAMETER_FLOW]: { min: 1, max: 50 },
  [ChunkType.UNION]: { min: 2, max: 100 },
  [ChunkType.ANNOTATION]: { min: 1, max: 20 },
  [ChunkType.BLOCK]: { min: 2, max: 200 },
  [ChunkType.MODULE]: { min: 5, max: 500 },
  [ChunkType.TYPE]: { min: 2, max: 100 },
  [ChunkType.GENERIC]: { min: 1, max: 300 },
  // 为其他类型提供默认值
  [ChunkType.IMPORT]: { min: 1, max: 20 },
  [ChunkType.EXPORT]: { min: 1, max: 20 },
  [ChunkType.VARIABLE]: { min: 1, max: 30 },
  [ChunkType.KEY]: { min: 1, max: 10 },
  [ChunkType.VALUE]: { min: 1, max: 10 },
  [ChunkType.LINE]: { min: 1, max: 5 },
  [ChunkType.COMMENT]: { min: 1, max: 50 }
};

/**
 * 默认复杂度阈值
 * 用于没有特定配置的类型
 */
export const DEFAULT_COMPLEXITY_THRESHOLDS = {
  minComplexity: 2,
  maxComplexity: 500
};