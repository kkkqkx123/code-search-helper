/**
 * 验证工具类 - 向后兼容入口
 * @deprecated 建议使用 ./validation/ValidationUtils 中的新实现
 */

// 重新导出新的验证工具类以保持向后兼容性
export {
  ValidationUtils,
  LineLocation,
  FunctionValidationConfig,
  ClassValidationConfig,
  NamespaceValidationConfig,
  TemplateValidationConfig,
  ImportValidationConfig,
  ValidationRequirements,
  IProcessingContext,
  SemanticBoundaryType,
  ValidationResult
} from './validation/ValidationUtils';