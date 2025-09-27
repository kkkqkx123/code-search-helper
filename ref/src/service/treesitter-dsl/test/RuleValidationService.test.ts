import { RuleValidationService } from '../RuleValidationService';
import { CustomRuleDefinition } from '../../../models/CustomRuleTypes';

describe('RuleValidationService', () => {
  let validator: RuleValidationService;

  beforeEach(() => {
    validator = new RuleValidationService();
  });

  it('should validate a correct rule definition', () => {
    const rule: CustomRuleDefinition = {
      name: 'TestRule',
      description: 'A test rule',
      targetType: 'function_declaration',
      pattern: '',
      conditions: [
        {
          type: 'contentPattern',
          value: 'async',
          operator: 'contains',
        },
      ],
      actions: [
        {
          type: 'extract',
          parameters: {
            includeComments: true,
          },
        },
      ],
    };

    const result = validator.validateRule(rule);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('should reject a rule without a name', () => {
    const rule: CustomRuleDefinition = {
      name: '',
      description: 'A test rule',
      targetType: 'function_declaration',
      pattern: '',
      conditions: [],
      actions: [
        {
          type: 'extract',
          parameters: {},
        },
      ],
    };

    const result = validator.validateRule(rule);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Rule name is required');
  });

  it('should warn about a rule without a description', () => {
    const rule: CustomRuleDefinition = {
      name: 'TestRule',
      description: '',
      targetType: 'function_declaration',
      pattern: '',
      conditions: [],
      actions: [
        {
          type: 'extract',
          parameters: {},
        },
      ],
    };

    const result = validator.validateRule(rule);
    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain('Rule description is recommended');
  });

  it('should reject a rule without a target type', () => {
    const rule: CustomRuleDefinition = {
      name: 'TestRule',
      description: 'A test rule',
      targetType: '',
      pattern: '',
      conditions: [],
      actions: [
        {
          type: 'extract',
          parameters: {},
        },
      ],
    };

    const result = validator.validateRule(rule);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Target type is required');
  });

  it('should reject a rule without actions', () => {
    const rule: CustomRuleDefinition = {
      name: 'TestRule',
      description: 'A test rule',
      targetType: 'function_declaration',
      pattern: '',
      conditions: [
        {
          type: 'contentPattern',
          value: 'async',
          operator: 'contains',
        },
      ],
      actions: [],
    };

    const result = validator.validateRule(rule);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('At least one action is required');
  });

  it('should reject a rule with invalid condition type', () => {
    const rule: CustomRuleDefinition = {
      name: 'TestRule',
      description: 'A test rule',
      targetType: 'function_declaration',
      pattern: '',
      conditions: [
        {
          type: 'nodeType' as any, // 强制类型转换以测试无效类型
          value: 'async',
          operator: 'contains',
        },
      ],
      actions: [
        {
          type: 'extract',
          parameters: {},
        },
      ],
    };

    // 手动修改条件类型为无效值
    (rule.conditions[0] as any).type = 'invalidType';

    const result = validator.validateRule(rule);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Condition 1: Invalid condition type 'invalidType'");
  });

  it('should reject a rule with invalid operator', () => {
    const rule: CustomRuleDefinition = {
      name: 'TestRule',
      description: 'A test rule',
      targetType: 'function_declaration',
      pattern: '',
      conditions: [
        {
          type: 'contentPattern',
          value: 'async',
          operator: 'contains', // 先使用有效操作符
        },
      ],
      actions: [
        {
          type: 'extract',
          parameters: {},
        },
      ],
    };

    // 手动修改操作符为无效值
    (rule.conditions[0] as any).operator = 'invalidOperator';

    const result = validator.validateRule(rule);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Condition 1: Invalid operator 'invalidOperator'");
  });

  it('should reject a rule with invalid action type', () => {
    const rule: CustomRuleDefinition = {
      name: 'TestRule',
      description: 'A test rule',
      targetType: 'function_declaration',
      pattern: '',
      conditions: [
        {
          type: 'contentPattern',
          value: 'async',
          operator: 'contains',
        },
      ],
      actions: [
        {
          type: 'extract', // 先使用有效类型
          parameters: {},
        },
      ],
    };

    // 手动修改动作类型为无效值
    (rule.actions[0] as any).type = 'invalidAction';

    const result = validator.validateRule(rule);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Action 1: Invalid action type 'invalidAction'");
  });

  it('should validate DSL syntax', () => {
    const validDSL = `
      rule "TestRule" {
        description: "A test rule"
        target: "function_declaration"
        
        condition {
          contentPattern: "async"
        }
        
        action {
          type: extract
        }
      }
    `;

    const result = validator.validateSyntax(validDSL);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid DSL syntax', () => {
    const invalidDSL = `
      rule "TestRule" {
        description: "A test rule"
        target: "function_declaration"
        
        condition {
          contentPattern: "async"
        }
        
        // Missing action
      }
    `;

    const result = validator.validateSyntax(invalidDSL);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it('should validate complete DSL', () => {
    const validDSL = `
      rule "TestRule" {
        description: "A test rule"
        target: "function_declaration"
        
        condition {
          contentPattern: "async"
          complexity: greaterThan(5)
        }
        
        action {
          type: extract
          parameters: {
            includeComments: true
          }
        }
      }
    `;

    const result = validator.validateDSL(validDSL);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
