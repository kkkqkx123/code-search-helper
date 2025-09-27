import {
  CustomRuleDefinition,
  CompiledRule,
  RuleCondition,
  RuleAction,
} from '../../models/CustomRuleTypes';
import * as Parser from 'tree-sitter';
import { SnippetChunk } from '../parser/types';

/**
 * DSL 编译器
 * 将 DSL 规则编译为可执行的 Tree-sitter 规则
 */
export class DSLCompiler {
  compile(ruleDefinition: CustomRuleDefinition): CompiledRule {
    return {
      id: this.generateId(ruleDefinition.name),
      name: ruleDefinition.name,
      description: ruleDefinition.description,
      targetType: ruleDefinition.targetType,
      conditionEvaluator: this.createConditionEvaluator(ruleDefinition.conditions),
      actionExecutor: this.createActionExecutor(ruleDefinition.actions),
    };
  }

  private generateId(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '_');
  }

  private createConditionEvaluator(
    conditions: RuleCondition[]
  ): (node: any, sourceCode: string) => boolean {
    return (node: any, sourceCode: string): boolean => {
      // 检查节点类型
      const typeCondition = conditions.find(c => c.type === 'nodeType');
      if (typeCondition && !this.evaluateCondition(typeCondition, node.type)) {
        return false;
      }

      // 检查内容模式
      const contentCondition = conditions.find(c => c.type === 'contentPattern');
      if (contentCondition) {
        const content = sourceCode.substring(node.startIndex, node.endIndex);
        if (!this.evaluateCondition(contentCondition, content)) {
          return false;
        }
      }

      // 检查复杂度
      const complexityCondition = conditions.find(c => c.type === 'complexity');
      if (complexityCondition) {
        const content = sourceCode.substring(node.startIndex, node.endIndex);
        const complexity = this.calculateComplexity(content);
        if (!this.evaluateCondition(complexityCondition, complexity.toString())) {
          return false;
        }
      }

      // 检查语言特性
      const languageFeatureCondition = conditions.find(c => c.type === 'languageFeature');
      if (languageFeatureCondition) {
        const content = sourceCode.substring(node.startIndex, node.endIndex);
        const hasFeature = this.hasLanguageFeature(content, languageFeatureCondition.value);
        if (!this.evaluateCondition(languageFeatureCondition, hasFeature.toString())) {
          return false;
        }
      }

      return true;
    };
  }

  private evaluateCondition(condition: RuleCondition, value: string): boolean {
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return value.includes(condition.value);
      case 'matches':
        const regex = new RegExp(condition.value);
        return regex.test(value);
      case 'greaterThan':
        return parseFloat(value) > parseFloat(condition.value);
      case 'lessThan':
        return parseFloat(value) < parseFloat(condition.value);
      default:
        return false;
    }
  }

  private calculateComplexity(content: string): number {
    let complexity = 1;

    const controlStructures = content.match(
      /\b(?:if|else|for|while|switch|case|try|catch|finally)\b/g
    );
    complexity += controlStructures ? controlStructures.length : 0;

    const logicalOps = content.match(/&&|\|\|/g);
    complexity += logicalOps ? logicalOps.length : 0;

    const brackets = content.match(/[{}[\]()]/g);
    complexity += brackets ? brackets.length * 0.5 : 0;

    const functionCalls = content.match(/\w+\s*\(/g);
    complexity += functionCalls ? functionCalls.length * 0.3 : 0;

    return Math.round(complexity);
  }

  private hasLanguageFeature(content: string, feature: string): boolean {
    switch (feature.toLowerCase()) {
      case 'async':
        return /\basync\b/.test(content) && /\bawait\b/.test(content);
      case 'generator':
        return /\bfunction\*\b/.test(content) || /\byield\b/.test(content);
      case 'destructuring':
        return /[{[]\s*\w+/.test(content) || /=\s*[{[]/.test(content);
      case 'spread':
        return /\.\.\./.test(content);
      case 'template':
        return /`[^`]*\$\{[^}]*\}[^`]*`/.test(content);
      default:
        return false;
    }
  }

  private createActionExecutor(
    actions: RuleAction[]
  ): (node: any, sourceCode: string) => SnippetChunk | null {
    return (node: any, sourceCode: string): SnippetChunk | null => {
      // 目前只处理第一个动作
      if (actions.length === 0) {
        return null;
      }

      const action = actions[0];
      const content = sourceCode.substring(node.startIndex, node.endIndex);
      const startLine = node.startPosition.row + 1;
      const endLine = node.endPosition.row + 1;

      switch (action.type) {
        case 'extract':
          return {
            id: this.generateSnippetId(content, startLine),
            content,
            startLine,
            endLine,
            startByte: node.startIndex,
            endByte: node.endIndex,
            type: 'snippet',
            imports: [],
            exports: [],
            metadata: {},
            snippetMetadata: {
              snippetType: 'function_call_chain', // 默认类型，实际应根据规则动态确定
              contextInfo: {
                nestingLevel: 0,
              },
              languageFeatures: this.analyzeLanguageFeatures(content),
              complexity: this.calculateComplexity(content),
              isStandalone: true,
              hasSideEffects: this.hasSideEffects(content),
            },
          };
        case 'highlight':
          // 高亮动作不需要返回代码片段，但可以记录需要高亮的信息
          return null;
        case 'report':
          // 报告动作可能需要返回特定格式的信息
          return null;
        default:
          return null;
      }
    };
  }

  private generateSnippetId(content: string, startLine: number): string {
    const hash = this.simpleHash(content).substring(0, 8);
    return `custom_rule_${startLine}_${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private analyzeLanguageFeatures(content: string): {
    usesAsync?: boolean;
    usesGenerators?: boolean;
    usesDestructuring?: boolean;
    usesSpread?: boolean;
    usesTemplateLiterals?: boolean;
  } {
    return {
      usesAsync: /\basync\b/.test(content) && /\bawait\b/.test(content),
      usesGenerators: /\bfunction\*\b/.test(content) || /\byield\b/.test(content),
      usesDestructuring: /[{[]\s*\w+/.test(content) || /=\s*[{[]/.test(content),
      usesSpread: /\.\.\./.test(content),
      usesTemplateLiterals: /`[^`]*\$\{[^}]*\}[^`]*`/.test(content),
    };
  }

  private hasSideEffects(content: string): boolean {
    const sideEffectPatterns = [
      /\+\+|--/,
      /\b(?:delete|new|throw)\b/,
      /\.\w+\s*=/,
      /\b(?:console\.log|process\.exit|process\.kill)\b/,
    ];

    const hasSideEffect = sideEffectPatterns.some(pattern => pattern.test(content));

    if (!hasSideEffect && /=/.test(content)) {
      if (/\.\w+\s*=/.test(content)) {
        return true;
      }

      if (/\b(?:window|global|document|console|process|module|exports)\.\w+\s*=/.test(content)) {
        return true;
      }
    }

    return hasSideEffect;
  }
}
