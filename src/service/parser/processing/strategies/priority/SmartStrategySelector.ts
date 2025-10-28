import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { PriorityManager, StrategyContext } from './PriorityManager';
import { ISplitStrategy } from '../../../interfaces/CoreISplitStrategy';

@injectable()
export class SmartStrategySelector {
  private priorityManager: PriorityManager;
  private logger?: LoggerService;

  constructor(
    @inject(TYPES.PriorityManager) priorityManager: PriorityManager,
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.priorityManager = priorityManager;
    this.logger = logger;
  }

  /**
   * 智能选择最优策略
   */
  selectOptimalStrategy(
    availableStrategies: ISplitStrategy[],
    context: StrategyContext
  ): ISplitStrategy {
    if (availableStrategies.length === 0) {
      throw new Error('No available strategies to select from');
    }

    // 1. 特定文件类型直接触发
    const specificStrategy = this.getSpecificFileStrategy(context.filePath, availableStrategies);
    if (specificStrategy) {
      this.logger?.debug(`Selected specific strategy for ${context.filePath}: ${specificStrategy.getName()}`);
      return specificStrategy;
    }

    // 2. 根据语言和文件特征选择
    const scoredStrategies = availableStrategies.map(strategy => ({
      strategy,
      score: this.calculateStrategyScore(strategy, context)
    }));

    // 3. 选择得分最高的策略
    scoredStrategies.sort((a, b) => b.score - a.score);
    const bestStrategy = scoredStrategies[0].strategy;

    this.logger?.debug(`Selected strategy: ${bestStrategy.getName()} with score ${scoredStrategies[0].score}`);
    return bestStrategy;
  }

  /**
   * 获取策略的优先级排序
   */
  getStrategiesByPriority(
    availableStrategies: ISplitStrategy[],
    context: StrategyContext
  ): ISplitStrategy[] {
    return availableStrategies
      .map(strategy => ({
        strategy,
        priority: this.priorityManager.getPriority(strategy.getName(), context)
      }))
      .sort((a, b) => a.priority - b.priority)
      .map(item => item.strategy);
  }

  /**
   * 获取适合指定语言的策略
   */
  getStrategiesForLanguage(
    availableStrategies: ISplitStrategy[],
    language: string
  ): ISplitStrategy[] {
    return availableStrategies.filter(strategy =>
      strategy.supportsLanguage(language)
    );
  }

  /**
   * 获取支持AST的策略
   */
  getASTStrategies(availableStrategies: ISplitStrategy[]): ISplitStrategy[] {
    return availableStrategies.filter(strategy =>
      (strategy as any).canHandleNode !== undefined
    );
  }

  private calculateStrategyScore(strategy: ISplitStrategy, context: StrategyContext): number {
    let score = 0;

    // 基础优先级得分
    const priority = this.priorityManager.getPriority(strategy.getName(), context);
    score += (12 - priority) * 10; // 优先级越高得分越高

    // 语言支持得分
    if (context.language && strategy.supportsLanguage(context.language)) {
      score += 20;
    }

    // AST支持得分（如果有AST）
    if (context.hasAST && (strategy as any).canHandleNode) {
      score += 15;
    }

    // 文件大小适应性得分
    if (context.fileSize) {
      score += this.calculateSizeAdaptability(strategy, context.fileSize);
    }

    // 内容特征得分
    if (context.content) {
      score += this.calculateContentAdaptability(strategy, context.content, context.language);
    }

    // 性能调整得分
    const adjustedPriority = this.priorityManager.adjustPriority(strategy.getName());
    const performanceBonus = (priority - adjustedPriority) * 2;
    score += performanceBonus;

    return score;
  }

  private getSpecificFileStrategy(
    filePath?: string,
    availableStrategies: ISplitStrategy[] = []
  ): ISplitStrategy | null {
    if (!filePath) return null;

    const extension = filePath.split('.').pop()?.toLowerCase();

    // Markdown文件
    if (['md', 'markdown'].includes(extension || '')) {
      return availableStrategies.find(s =>
        s.getName().includes('markdown') || s.getName().includes('md')
      ) || null;
    }

    // XML/HTML文件
    if (['xml', 'html', 'xhtml', 'svg'].includes(extension || '')) {
      return availableStrategies.find(s =>
        s.getName().includes('xml') || s.getName().includes('html')
      ) || null;
    }

    // 测试文件
    if (filePath.includes('.test.') || filePath.includes('.spec.')) {
      return availableStrategies.find(s => s.getName().includes('function')) || null;
    }

    // 配置文件
    if (['json', 'yaml', 'yml', 'toml'].includes(extension || '')) {
      return availableStrategies.find(s => s.getName().includes('ast')) || null;
    }

    return null;
  }

  private calculateSizeAdaptability(strategy: ISplitStrategy, fileSize: number): number {
    const strategyName = strategy.getName().toLowerCase();

    // 小文件适合简单策略
    if (fileSize < 1000) {
      if (strategyName.includes('line') || strategyName.includes('bracket')) {
        return 10;
      }
      if (strategyName.includes('minimal') || strategyName.includes('fallback')) {
        return 8;
      }
    }

    // 大文件适合复杂策略
    if (fileSize > 10000) {
      if (strategyName.includes('ast') || strategyName.includes('semantic')) {
        return 15;
      }
      if (strategyName.includes('structure') || strategyName.includes('syntax')) {
        return 12;
      }
    }

    // 中等文件适合中等复杂度策略
    if (fileSize >= 1000 && fileSize <= 10000) {
      if (strategyName.includes('function') || strategyName.includes('class')) {
        return 10;
      }
      if (strategyName.includes('hierarchical') || strategyName.includes('module')) {
        return 8;
      }
    }

    return 5;
  }

  private calculateContentAdaptability(strategy: ISplitStrategy, content: string, language?: string): number {
    let score = 0;
    const strategyName = strategy.getName().toLowerCase();

    // 检查是否有复杂结构
    const hasComplexStructure = this.hasComplexStructure(content, language);
    if (hasComplexStructure) {
      if (strategyName.includes('ast') || strategyName.includes('structure')) {
        score += 10;
      }
      if (strategyName.includes('syntax') || strategyName.includes('hierarchical')) {
        score += 8;
      }
    }

    // 检查是否有函数定义
    const functionCount = this.countFunctions(content, language);
    if (functionCount > 0) {
      if (strategyName.includes('function')) {
        score += 8 + Math.min(functionCount, 5); // 最多加13分
      }
      if (strategyName.includes('ast') || strategyName.includes('syntax')) {
        score += 5;
      }
    }

    // 检查是否有类定义
    const classCount = this.countClasses(content, language);
    if (classCount > 0) {
      if (strategyName.includes('class')) {
        score += 8 + Math.min(classCount, 3); // 最多加11分
      }
      if (strategyName.includes('ast') || strategyName.includes('hierarchical')) {
        score += 5;
      }
    }

    // 检查是否有导入/导出语句
    const hasImports = this.hasImports(content);
    if (hasImports) {
      if (strategyName.includes('module')) {
        score += 6;
      }
      if (strategyName.includes('ast') || strategyName.includes('syntax')) {
        score += 3;
      }
    }

    // 检查是否有括号结构
    const bracketComplexity = this.calculateBracketComplexity(content);
    if (bracketComplexity > 5) {
      if (strategyName.includes('bracket')) {
        score += 6;
      }
      if (strategyName.includes('ast') || strategyName.includes('syntax')) {
        score += 4;
      }
    }

    return score;
  }

  // 辅助方法
  private hasComplexStructure(content: string, language?: string): boolean {
    const nestedBrackets = (content.match(/\{[^{}]*\{[^{}]*\}/g) || []).length;
    const nestedFunctions = (content.match(/function\s+\w+\s*\([^)]*\)\s*\{[^}]*function/g) || []).length;
    const nestedClasses = (content.match(/class\s+\w+\s*\{[^}]*class/g) || []).length;

    return nestedBrackets > 5 || nestedFunctions > 3 || nestedClasses > 2;
  }

  private countFunctions(content: string, language?: string): number {
    const patterns: Record<string, RegExp> = {
      javascript: /function\s+\w+|=>\s*{|const\s+\w+\s*=\s*\(/g,
      typescript: /function\s+\w+|=>\s*{|const\s+\w+\s*=\s*\(/g,
      python: /def\s+\w+/g,
      java: /(?:public|private|protected)?\s*(?:static\s+)?(?:\w+\s+)*\w+\s*\([^)]*\)\s*\{/g,
      cpp: /(?:\w+\s+)*\w+\s*\([^)]*\)\s*\{/g,
      c: /(?:\w+\s+)*\w+\s*\([^)]*\)\s*\{/g,
      go: /func\s+\w+/g,
      rust: /fn\s+\w+/g,
      kotlin: /fun\s+\w+/g
    };

    const pattern = language ? patterns[language.toLowerCase()] : /function\s+\w+/g;
    return pattern ? (content.match(pattern) || []).length : 0;
  }

  private countClasses(content: string, language?: string): number {
    const patterns: Record<string, RegExp> = {
      javascript: /class\s+\w+/g,
      typescript: /class\s+\w+/g,
      python: /class\s+\w+/g,
      java: /(?:public\s+)?class\s+\w+/g,
      cpp: /class\s+\w+/g,
      kotlin: /class\s+\w+/g
    };

    const pattern = language ? patterns[language.toLowerCase()] : /class\s+\w+/g;
    return pattern ? (content.match(pattern) || []).length : 0;
  }

  private hasImports(content: string): boolean {
    return /import\s+|require\s*\(|#include|using\s+/g.test(content);
  }

  private calculateBracketComplexity(content: string): number {
    const openBrackets = (content.match(/\{/g) || []).length;
    const closeBrackets = (content.match(/\}/g) || []).length;
    const parentheses = (content.match(/\(/g) || []).length;

    return openBrackets + closeBrackets + parentheses;
  }
}