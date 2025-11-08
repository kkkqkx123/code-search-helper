/**
 * 验证模块索引文件
 * 统一导出所有验证相关的类和接口
 */

export { BaseValidator } from './BaseValidator';
export { CodeStructureValidator } from './CodeStructureValidator';
export { FileTypeValidator } from './FileTypeValidator';
export { ValidationUtils } from './ValidationUtils';

// 导出所有类型和接口
export type { 
  ValidationResult,
  BaseValidationConfig 
} from './BaseValidator';

export type { 
  FunctionValidationConfig,
  ClassValidationConfig,
  NamespaceValidationConfig,
  TemplateValidationConfig,
  ImportValidationConfig
} from './CodeStructureValidator';

export type { 
  SemanticBoundaryType,
  IProcessingContext,
  ValidationRequirements
} from './FileTypeValidator';

// 导出行位置接口
export interface LineLocation {
  startLine: number;
  endLine: number;
}