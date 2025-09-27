import { CustomRuleService } from '../CustomRuleService';
import { CustomRuleDefinition } from '../../../models/CustomRuleTypes';
import * as fs from 'fs';
import * as path from 'path';

describe('CustomRuleService', () => {
  let ruleService: CustomRuleService;
  const testStoragePath = './test-data/custom-rules';

  beforeEach(() => {
    // 创建测试存储目录
    if (!fs.existsSync(testStoragePath)) {
      fs.mkdirSync(testStoragePath, { recursive: true });
    }

    ruleService = new CustomRuleService(testStoragePath);
  });

  afterEach(() => {
    // 清理测试数据
    if (fs.existsSync(testStoragePath)) {
      fs.rmdirSync(testStoragePath, { recursive: true });
    }
  });

  it('should create a rule from DSL', () => {
    const dsl = `
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

    const rule = ruleService.createRuleFromDSL(dsl);

    expect(rule.name).toBe('TestRule');
    expect(rule.description).toBe('A test rule');
    expect(rule.targetType).toBe('function_declaration');
  });

  it('should save and load a rule', () => {
    const ruleDefinition: CustomRuleDefinition = {
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
          parameters: {},
        },
      ],
    };

    const rule = ruleService.createRule(ruleDefinition);
    ruleService.saveRule(rule);

    // 验证规则已保存到内存
    const loadedRule = ruleService.loadRule(rule.id);
    expect(loadedRule).toBeDefined();
    expect(loadedRule?.name).toBe('TestRule');

    // 验证规则已保存到文件系统
    const filePath = path.join(testStoragePath, `${rule.id}.json`);
    expect(fs.existsSync(filePath)).toBe(true);

    // 重新创建服务以测试从存储加载
    const newRuleService = new CustomRuleService(testStoragePath);
    const reloadedRule = newRuleService.loadRule(rule.id);
    expect(reloadedRule).toBeDefined();
    expect(reloadedRule?.name).toBe('TestRule');
  });

  it('should delete a rule', () => {
    const ruleDefinition: CustomRuleDefinition = {
      name: 'TestRule',
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

    const rule = ruleService.createRule(ruleDefinition);
    ruleService.saveRule(rule);

    // 验证规则存在
    expect(ruleService.loadRule(rule.id)).toBeDefined();

    // 删除规则
    ruleService.deleteRule(rule.id);

    // 验证规则已从内存删除
    expect(ruleService.loadRule(rule.id)).toBeUndefined();

    // 验证规则已从文件系统删除
    const filePath = path.join(testStoragePath, `${rule.id}.json`);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('should list all rules', () => {
    const rule1Definition: CustomRuleDefinition = {
      name: 'TestRule1',
      description: 'Test rule 1',
      targetType: 'function_declaration',
      pattern: '',
      conditions: [],
      actions: [{ type: 'extract', parameters: {} }],
    };

    const rule2Definition: CustomRuleDefinition = {
      name: 'TestRule2',
      description: 'Test rule 2',
      targetType: 'class_declaration',
      pattern: '',
      conditions: [],
      actions: [{ type: 'highlight', parameters: {} }],
    };

    const rule1 = ruleService.createRule(rule1Definition);
    const rule2 = ruleService.createRule(rule2Definition);

    ruleService.saveRule(rule1);
    ruleService.saveRule(rule2);

    const rules = ruleService.listRules();
    expect(rules.length).toBe(2);
    expect(rules.map(r => r.name)).toContain('TestRule1');
    expect(rules.map(r => r.name)).toContain('TestRule2');
  });
});
