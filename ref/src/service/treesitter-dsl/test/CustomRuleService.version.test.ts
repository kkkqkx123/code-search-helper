import { CustomRuleService } from '../CustomRuleService';
import { CustomRuleDefinition } from '../../../models/CustomRuleTypes';
import * as fs from 'fs';
import * as path from 'path';

describe('CustomRuleService - Version Management', () => {
  let ruleService: CustomRuleService;
  const testStoragePath = './test-data/custom-rules-version';

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

  it('should update a rule and increment version', () => {
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

    // 更新规则
    const updatedRuleDefinition: CustomRuleDefinition = {
      ...ruleDefinition,
      description: 'An updated test rule',
      conditions: [
        {
          type: 'contentPattern',
          value: 'await',
          operator: 'contains',
        },
      ],
    };

    const updatedRule = ruleService.updateRule(rule.id, updatedRuleDefinition);

    expect(updatedRule.version).toBe('1.0.1');
    expect(updatedRule.description).toBe('An updated test rule');
    expect(updatedRule.updatedAt).not.toEqual(updatedRule.createdAt);
  });

  it('should get rule versions', () => {
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

    // 更新规则两次以创建多个版本
    const updatedRuleDefinition1: CustomRuleDefinition = {
      ...ruleDefinition,
      description: 'Updated test rule v1',
    };

    const updatedRule1 = ruleService.updateRule(rule.id, updatedRuleDefinition1);

    const updatedRuleDefinition2: CustomRuleDefinition = {
      ...ruleDefinition,
      description: 'Updated test rule v2',
    };

    const updatedRule2 = ruleService.updateRule(rule.id, updatedRuleDefinition2);

    // 获取规则版本
    const versions = ruleService.getRuleVersions(rule.id);

    // 应该至少包含当前版本
    expect(versions.length).toBeGreaterThanOrEqual(1);
    expect(versions.map(v => v.id)).toContain(rule.id);
  });

  it('should export and import a rule', () => {
    const ruleDefinition: CustomRuleDefinition = {
      name: 'TestRule',
      description: 'A test rule for export/import',
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

    const rule = ruleService.createRule(ruleDefinition);
    ruleService.saveRule(rule);

    // 导出规则
    const exportedRule = ruleService.exportRule(rule.id);

    // 删除原始规则
    ruleService.deleteRule(rule.id);
    expect(ruleService.loadRule(rule.id)).toBeUndefined();

    // 导入规则
    const importedRule = ruleService.importRule(exportedRule);

    expect(importedRule.name).toBe('TestRule');
    expect(importedRule.description).toBe('A test rule for export/import');
    expect(importedRule.conditions.length).toBe(1);
    expect(importedRule.actions.length).toBe(1);
    expect(importedRule.actions[0].parameters.includeComments).toBe(true);
  });

  it('should toggle rule enabled status', () => {
    const ruleDefinition: CustomRuleDefinition = {
      name: 'TestRule',
      description: 'A test rule for toggling',
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

    // 初始状态应该是启用的
    expect(rule.enabled).toBe(true);

    // 切换状态
    const isEnabled = ruleService.toggleRule(rule.id);
    expect(isEnabled).toBe(false);

    // 再次切换
    const isEnabled2 = ruleService.toggleRule(rule.id);
    expect(isEnabled2).toBe(true);
  });
});
