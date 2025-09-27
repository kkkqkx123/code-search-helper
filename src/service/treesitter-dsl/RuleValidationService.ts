import {
  CustomRuleDefinition,
  ValidationResult,
  RuleCondition,
  RuleAction,
} from '../../models/CustomRuleTypes';
import { DSLParser } from './DSLParser';

/**
 * 规则验证服务
 * 确保自定义规则的有效性
 */
export class RuleValidationService {
  validateRule(ruleDefinition: CustomRuleDefinition): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 验证规则名称
    if (!ruleDefinition.name || ruleDefinition.name.trim().length === 0) {
      errors.push('Rule name is required');
    }

    // 验证规则描述
    if (!ruleDefinition.description || ruleDefinition.description.trim().length === 0) {
      warnings.push('Rule description is recommended');
    }

    // 验证目标类型
    if (!ruleDefinition.targetType || ruleDefinition.targetType.trim().length === 0) {
      errors.push('Target type is required');
    }

    // 验证条件
    if (!ruleDefinition.conditions || ruleDefinition.conditions.length === 0) {
      warnings.push('At least one condition is recommended');
    } else {
      for (let i = 0; i < ruleDefinition.conditions.length; i++) {
        const condition = ruleDefinition.conditions[i];
        const conditionErrors = this.validateCondition(condition, i);
        errors.push(...conditionErrors);
      }
    }

    // 验证动作
    if (!ruleDefinition.actions || ruleDefinition.actions.length === 0) {
      errors.push('At least one action is required');
    } else {
      for (let i = 0; i < ruleDefinition.actions.length; i++) {
        const action = ruleDefinition.actions[i];
        const actionErrors = this.validateAction(action, i);
        errors.push(...actionErrors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateCondition(condition: RuleCondition, index: number): string[] {
    const errors: string[] = [];

    if (!condition.type) {
      errors.push(`Condition ${index + 1}: Condition type is required`);
    } else if (!this.isValidConditionType(condition.type)) {
      errors.push(`Condition ${index + 1}: Invalid condition type '${condition.type}'`);
    }

    if (!condition.value) {
      errors.push(`Condition ${index + 1}: Condition value is required`);
    }

    if (!condition.operator) {
      errors.push(`Condition ${index + 1}: Condition operator is required`);
    } else if (!this.isValidOperator(condition.operator)) {
      errors.push(`Condition ${index + 1}: Invalid operator '${condition.operator}'`);
    }

    return errors;
  }

  private validateAction(action: RuleAction, index: number): string[] {
    const errors: string[] = [];

    if (!action.type) {
      errors.push(`Action ${index + 1}: Action type is required`);
    } else if (!this.isValidActionType(action.type)) {
      errors.push(`Action ${index + 1}: Invalid action type '${action.type}'`);
    }

    // 验证参数（如果存在）
    if (action.parameters) {
      for (const [key, value] of Object.entries(action.parameters)) {
        if (value === undefined || value === null) {
          errors.push(`Action ${index + 1}: Parameter '${key}' cannot be null or undefined`);
        }
      }
    }

    return errors;
  }

  private isValidConditionType(type: string): boolean {
    const validTypes = ['nodeType', 'contentPattern', 'complexity', 'languageFeature'];
    return validTypes.includes(type);
  }

  private isValidOperator(operator: string): boolean {
    const validOperators = ['equals', 'contains', 'matches', 'greaterThan', 'lessThan'];
    return validOperators.includes(operator);
  }

  private isValidActionType(type: string): boolean {
    const validTypes = ['extract', 'highlight', 'report'];
    return validTypes.includes(type);
  }

  validateDSL(dslText: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const parser = new DSLParser();
      const ruleDefinition = parser.parse(dslText);
      const validationResult = this.validateRule(ruleDefinition);

      errors.push(...validationResult.errors);
      warnings.push(...validationResult.warnings);
    } catch (error: any) {
      errors.push(`DSL parsing error: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateSyntax(dslText: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const parser = new DSLParser();
      parser.parse(dslText);
    } catch (error: any) {
      errors.push(`Syntax error: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
