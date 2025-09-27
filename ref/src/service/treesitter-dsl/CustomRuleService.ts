import { CustomRule, CustomRuleDefinition, ValidationResult } from '../../models/CustomRuleTypes';
import { DSLParser } from './DSLParser';
import { DSLCompiler } from './DSLCompiler';
import { RuleValidationService } from './RuleValidationService';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 自定义规则服务
 * 管理规则的创建、存储和加载
 */
export class CustomRuleService {
  private rules: Map<string, CustomRule> = new Map();
  private parser: DSLParser;
  private compiler: DSLCompiler;
  private validator: RuleValidationService;
  private storagePath: string;

  constructor(storagePath: string = './data/custom-rules') {
    this.parser = new DSLParser();
    this.compiler = new DSLCompiler();
    this.validator = new RuleValidationService();
    this.storagePath = storagePath;

    // 确保存储目录存在
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }

    // 从存储中加载现有规则
    this.loadRulesFromStorage();
  }

  createRule(ruleDefinition: CustomRuleDefinition): CustomRule {
    // 验证规则定义
    const validationResult = this.validator.validateRule(ruleDefinition);
    if (!validationResult.isValid) {
      throw new Error(`Invalid rule definition: ${validationResult.errors.join(', ')}`);
    }

    // 创建自定义规则对象
    const rule: CustomRule = {
      ...ruleDefinition,
      id: this.generateRuleId(ruleDefinition.name),
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      author: 'Unknown',
      enabled: true,
    };

    return rule;
  }

  createRuleFromDSL(dslText: string): CustomRule {
    // 验证DSL语法
    const syntaxValidation = this.validator.validateSyntax(dslText);
    if (!syntaxValidation.isValid) {
      throw new Error(`Invalid DSL syntax: ${syntaxValidation.errors.join(', ')}`);
    }

    // 解析DSL
    const ruleDefinition = this.parser.parse(dslText);

    // 创建规则
    return this.createRule(ruleDefinition);
  }

  saveRule(rule: CustomRule): void {
    // 验证规则
    const validationResult = this.validator.validateRule(rule);
    if (!validationResult.isValid) {
      throw new Error(`Invalid rule: ${validationResult.errors.join(', ')}`);
    }

    // 保存规则到内存中
    this.rules.set(rule.id, rule);

    // 保存规则到存储中
    this.saveRuleToStorage(rule);
  }

  loadRule(ruleId: string): CustomRule | undefined {
    return this.rules.get(ruleId);
  }

  deleteRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.deleteRuleFromStorage(ruleId);
  }

  listRules(): CustomRule[] {
    return Array.from(this.rules.values());
  }

  validateRule(rule: CustomRule): ValidationResult {
    return this.validator.validateRule(rule);
  }

  validateDSL(dslText: string): ValidationResult {
    return this.validator.validateDSL(dslText);
  }

  compileRule(rule: CustomRule) {
    // 将规则定义编译为可执行规则
    return this.compiler.compile(rule);
  }

  // 版本管理功能
  updateRule(ruleId: string, updatedRuleDefinition: CustomRuleDefinition): CustomRule {
    const existingRule = this.rules.get(ruleId);
    if (!existingRule) {
      throw new Error(`Rule with id ${ruleId} not found`);
    }

    // 验证更新的规则定义
    const validationResult = this.validator.validateRule(updatedRuleDefinition);
    if (!validationResult.isValid) {
      throw new Error(`Invalid rule definition: ${validationResult.errors.join(', ')}`);
    }

    // 创建更新后的规则对象
    const updatedRule: CustomRule = {
      ...updatedRuleDefinition,
      id: ruleId,
      version: this.incrementVersion(existingRule.version),
      createdAt: existingRule.createdAt,
      updatedAt: new Date(),
      author: existingRule.author,
      enabled: existingRule.enabled,
    };

    // 保存更新后的规则
    this.saveRule(updatedRule);
    return updatedRule;
  }

  // 获取规则的所有版本
  getRuleVersions(ruleId: string): CustomRule[] {
    const versions: CustomRule[] = [];
    const rule = this.rules.get(ruleId);

    if (rule) {
      // 在文件系统中查找所有版本
      const files = fs.readdirSync(this.storagePath);
      for (const file of files) {
        if (file.startsWith(`${ruleId}_v`)) {
          const filePath = path.join(this.storagePath, file);
          const ruleData = fs.readFileSync(filePath, 'utf8');
          const versionedRule: CustomRule = JSON.parse(ruleData);
          // 转换日期字符串为Date对象
          versionedRule.createdAt = new Date(versionedRule.createdAt);
          versionedRule.updatedAt = new Date(versionedRule.updatedAt);
          versions.push(versionedRule);
        }
      }

      // 添加当前版本
      versions.push(rule);
    }

    return versions;
  }

  // 共享功能
  exportRule(ruleId: string): string {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule with id ${ruleId} not found`);
    }

    // 导出规则为JSON字符串
    return JSON.stringify(rule, null, 2);
  }

  importRule(ruleData: string): CustomRule {
    try {
      const rule: CustomRule = JSON.parse(ruleData);

      // 验证导入的规则
      const validationResult = this.validator.validateRule(rule);
      if (!validationResult.isValid) {
        throw new Error(`Invalid imported rule: ${validationResult.errors.join(', ')}`);
      }

      // 保存导入的规则
      this.saveRule(rule);
      return rule;
    } catch (error: any) {
      throw new Error(`Failed to import rule: ${error.message}`);
    }
  }

  // 启用/禁用规则
  toggleRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule with id ${ruleId} not found`);
    }

    rule.enabled = !rule.enabled;
    rule.updatedAt = new Date();
    this.saveRule(rule);

    return rule.enabled;
  }

  private generateRuleId(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '_');
  }

  private saveRuleToStorage(rule: CustomRule): void {
    try {
      const filePath = path.join(this.storagePath, `${rule.id}.json`);
      const ruleData = JSON.stringify(rule, null, 2);
      fs.writeFileSync(filePath, ruleData);
    } catch (error: any) {
      console.error(`Failed to save rule ${rule.id} to storage:`, error);
    }
  }

  private deleteRuleFromStorage(ruleId: string): void {
    try {
      const filePath = path.join(this.storagePath, `${ruleId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error: any) {
      console.error(`Failed to delete rule ${ruleId} from storage:`, error);
    }
  }

  private loadRulesFromStorage(): void {
    try {
      const files = fs.readdirSync(this.storagePath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.storagePath, file);
          const ruleData = fs.readFileSync(filePath, 'utf8');
          const rule: CustomRule = JSON.parse(ruleData);
          // 转换日期字符串为Date对象
          rule.createdAt = new Date(rule.createdAt);
          rule.updatedAt = new Date(rule.updatedAt);
          this.rules.set(rule.id, rule);
        }
      }
    } catch (error: any) {
      console.error('Failed to load rules from storage:', error);
    }
  }

  private incrementVersion(version: string): string {
    const versionParts = version.split('.');
    const major = parseInt(versionParts[0]);
    const minor = parseInt(versionParts[1]);
    const patch = parseInt(versionParts[2]);

    return `${major}.${minor}.${patch + 1}`;
  }
}
