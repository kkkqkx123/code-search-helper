/**
 * 验证工具类
 * 统一各种验证逻辑的入口点，支持ASTCodeSplitter增强需求
 */

import { BaseValidator, ValidationResult } from './BaseValidator';
import { CodeStructureValidator } from './CodeStructureValidator';
import { FileTypeValidator } from './FileTypeValidator';
import { LineLocation, FunctionValidationConfig, ClassValidationConfig, NamespaceValidationConfig, TemplateValidationConfig, ImportValidationConfig } from './index';

// 重新导出所有接口和枚举
export { LineLocation } from './index';
export { 
  FunctionValidationConfig, 
  ClassValidationConfig, 
  NamespaceValidationConfig, 
  TemplateValidationConfig, 
  ImportValidationConfig 
} from './CodeStructureValidator';
export { ValidationResult };

/**
 * 验证工具类
 * 作为所有验证器的统一入口点
 */
export class ValidationUtils {
  /**
   * 验证函数是否有效
   */
  static isValidFunction(
    content: string, 
    location: LineLocation, 
    config?: FunctionValidationConfig
  ): boolean {
    return CodeStructureValidator.isValidFunction(content, location, config);
  }

  /**
   * 验证类是否有效
   */
  static isValidClass(
    content: string, 
    location: LineLocation, 
    config?: ClassValidationConfig
  ): boolean {
    return CodeStructureValidator.isValidClass(content, location, config);
  }

  /**
   * 验证命名空间是否有效
   */
  static isValidNamespace(
    content: string, 
    location: LineLocation, 
    config?: NamespaceValidationConfig
  ): boolean {
    return CodeStructureValidator.isValidNamespace(content, location, config);
  }

  /**
   * 验证模板是否有效
   */
  static isValidTemplate(
    content: string, 
    location: LineLocation, 
    config?: TemplateValidationConfig
  ): boolean {
    return CodeStructureValidator.isValidTemplate(content, location, config);
  }

  /**
   * 验证导入是否有效
   */
  static isValidImport(
    content: string, 
    location: LineLocation, 
    config?: ImportValidationConfig
  ): boolean {
    return CodeStructureValidator.isValidImport(content, location, config);
  }

  /**
   * 验证嵌套级别
   */
  static validateNestingLevel(node: any, maxLevel: number): boolean {
    return CodeStructureValidator.validateNestingLevel(node, maxLevel);
  }


  /**
   * 验证是否为代码文件
   */
  static isCodeFile(language: string): boolean {
    return FileTypeValidator.isCodeFile(language);
  }

  /**
   * 验证是否具有Markdown结构
   */
  static hasMarkdownStructure(content: string): boolean {
    return FileTypeValidator.hasMarkdownStructure(content);
  }

  /**
   * 验证是否具有XML结构
   */
  static hasXmlStructure(content: string): boolean {
    return FileTypeValidator.hasXmlStructure(content);
  }

  /**
   * 验证是否具有JSON结构
   */
  static hasJsonStructure(content: string): boolean {
    return FileTypeValidator.hasJsonStructure(content);
  }

  /**
   * 验证是否具有YAML结构
   */
  static hasYamlStructure(content: string): boolean {
    return FileTypeValidator.hasYamlStructure(content);
  }


  /**
   * 验证结构是否有效（通用方法）
   */
  static isValidStructure(structure: any): boolean {
    return FileTypeValidator.isValidStructure(structure);
  }

  /**
   * 检测文件类型
   */
  static detectFileType(content: string, language?: string): string {
    return FileTypeValidator.detectFileType(content, language);
  }

  /**
   * 执行基础验证
   */
  static validateBase(
    content: string,
    location: LineLocation,
    config: { minLines?: number; maxChars?: number; minChars?: number }
  ): ValidationResult {
    return BaseValidator.validateBase(content, location, config);
  }

  /**
   * 验证位置信息
   */
  static validateLocation(location: LineLocation): ValidationResult {
    return BaseValidator.validateLocation(location);
  }

  /**
   * 验证字符串内容
   */
  static validateContent(content: string): ValidationResult {
    return BaseValidator.validateContent(content);
  }

  /**
   * 批量验证
   */
  static validateBatch(
    items: Array<{
      content: string;
      location: LineLocation;
      type: 'function' | 'class' | 'namespace' | 'template' | 'import';
      config?: any;
    }>
  ): Array<{ index: number; result: boolean; errors?: string[] }> {
    return items.map((item, index) => {
      let result = false;
      let errors: string[] = [];

      try {
        switch (item.type) {
          case 'function':
            result = this.isValidFunction(item.content, item.location, item.config);
            break;
          case 'class':
            result = this.isValidClass(item.content, item.location, item.config);
            break;
          case 'namespace':
            result = this.isValidNamespace(item.content, item.location, item.config);
            break;
          case 'template':
            result = this.isValidTemplate(item.content, item.location, item.config);
            break;
          case 'import':
            result = this.isValidImport(item.content, item.location, item.config);
            break;
          default:
            errors.push(`Unknown validation type: ${item.type}`);
        }
      } catch (error) {
        errors.push(`Validation error: ${error}`);
      }

      return { index, result, errors: errors.length > 0 ? errors : undefined };
    });
  }

  /**
   * 创建自定义验证器
   */
  static createCustomValidator(
    validatorFn: (content: string, location: LineLocation) => boolean,
    errorMessage?: string
  ): (content: string, location: LineLocation) => boolean {
    return (content: string, location: LineLocation) => {
      try {
        return validatorFn(content, location);
      } catch (error) {
        if (errorMessage) {
          console.error(errorMessage, error);
        }
        return false;
      }
    };
  }

  /**
   * 组合多个验证器
   */
  static combineValidators(
    validators: Array<(content: string, location: LineLocation) => boolean>,
    strategy: 'all' | 'any' = 'all'
  ): (content: string, location: LineLocation) => boolean {
    return (content: string, location: LineLocation) => {
      const results = validators.map(validator => {
        try {
          return validator(content, location);
        } catch (error) {
          return false;
        }
      });

      return strategy === 'all' ? results.every(r => r) : results.some(r => r);
    };
  }
}