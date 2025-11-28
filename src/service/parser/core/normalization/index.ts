/**
 * 解析器规范化模块
 * 
 * 职责：
 * - 提供规范化的实体、关系、查询结果类型定义
 * - 提供代码转文本转换器接口和C语言实现
 * 
 * 不包含：
 * - 嵌入处理（属于post-processing层）
 * - 向量/图类型定义（属于service/vector或graph层）
 * - 服务实现（应在processing层）
 */

// 导出实体和关系类型定义
export * from './types';

// 导出代码转文本转换器
export * from './converters';