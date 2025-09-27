import { DSLParser } from '../DSLParser';
import { CustomRuleDefinition } from '../../../models/CustomRuleTypes';

describe('DSLParser', () => {
  let parser: DSLParser;

  beforeEach(() => {
    parser = new DSLParser();
  });

  it('should parse a simple rule', () => {
    const dsl = `
      rule "AsyncFunctionRule" {
        description: "Matches async functions"
        target: "function_declaration"
        
        condition {
          contentPattern: "async"
          complexity: greaterThan(5)
        }
        
        action {
          type: extract
          parameters: {
            includeComments: true
            includeMetadata: true
          }
        }
      }
    `;

    const rule: CustomRuleDefinition = parser.parse(dsl);

    expect(rule.name).toBe('AsyncFunctionRule');
    expect(rule.description).toBe('Matches async functions');
    expect(rule.targetType).toBe('function_declaration');

    expect(rule.conditions.length).toBe(2);
    expect(rule.conditions[0].type).toBe('contentPattern');
    expect(rule.conditions[0].value).toBe('async');
    expect(rule.conditions[1].type).toBe('complexity');
    expect(rule.conditions[1].operator).toBe('greaterThan');
    expect(rule.conditions[1].value).toBe('5');

    expect(rule.actions.length).toBe(1);
    expect(rule.actions[0].type).toBe('extract');
    expect(rule.actions[0].parameters.includeComments).toBe(true);
    expect(rule.actions[0].parameters.includeMetadata).toBe(true);
  });

  it('should parse a rule with multiple conditions and actions', () => {
    const dsl = `
      rule "ComplexRule" {
        description: "A complex rule with multiple conditions"
        target: "class_declaration"
        
        condition {
          nodeType: "class_declaration"
          contentPattern: "extends"
          languageFeature: "async"
        }
        
        action {
          type: highlight
        }
        
        action {
          type: report
          parameters: {
            severity: "warning"
            category: "performance"
          }
        }
      }
    `;

    const rule: CustomRuleDefinition = parser.parse(dsl);

    expect(rule.name).toBe('ComplexRule');
    expect(rule.conditions.length).toBe(3);
    expect(rule.actions.length).toBe(2);

    expect(rule.actions[0].type).toBe('highlight');
    expect(rule.actions[1].type).toBe('report');
    expect(rule.actions[1].parameters.severity).toBe('warning');
    expect(rule.actions[1].parameters.category).toBe('performance');
  });

  it('should throw an error for invalid DSL', () => {
    const invalidDsl = `
      rule "InvalidRule" {
        // Missing description
        target: "function_declaration"
        
        condition {
          contentPattern: "async"
        }
        
        // Missing action
      }
    `;

    expect(() => parser.parse(invalidDsl)).toThrow();
  });
});
