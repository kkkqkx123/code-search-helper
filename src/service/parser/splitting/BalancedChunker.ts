
import { LoggerService } from '../../../utils/LoggerService';

/**
 * 符号栈接口
 */
export interface SymbolStack {
  brackets: number;    // 圆括号 ()
  braces: number;      // 花括号 {}
  squares: number;     // 方括号 []
  templates: number;   // 模板字符串 ``
}

/**
 * 符号变化接口
 */
export interface SymbolStackChange {
  brackets: number;
  braces: number;
  squares: number;
  templates: number;
}

/**
 * 符号平衡跟踪器
 * 负责跟踪代码中的符号平衡状态，确保分段不会破坏语法结构
 */
export class BalancedChunker {
  private symbolStack: SymbolStack = {
    brackets: 0,
    braces: 0,
    squares: 0,
    templates: 0
  };
  
  private logger?: LoggerService;
  private analysisCache: Map<string, SymbolStackChange> = new Map();
  private static readonly MAX_CACHE_SIZE = 1000;
  private accessOrder: string[] = [];

  constructor(logger?: LoggerService) {
    this.logger = logger;
  }

  /**
   * 分析行中的符号变化
   */
  analyzeLineSymbols(line: string, lineNumber?: number): void {
    const lineHash = this.simpleHash(line);
    
    // 检查缓存
    const cachedChange = this.getCachedChange(lineHash);
    if (cachedChange) {
      this.applySymbolChange(cachedChange);
      return;
    }

    // 首次分析并缓存
    const originalState = { ...this.symbolStack };
    this.analyzeLineSymbolsInternal(line);
    const symbolChange = this.calculateSymbolChange(originalState, this.symbolStack);
    this.setCachedChange(lineHash, symbolChange);
  }

  /**
   * 内部符号分析方法
   */
  private analyzeLineSymbolsInternal(line: string): void {
    let inSingleComment = false;
    let inMultiComment = false;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      // 跳过注释和字符串内容
      if (inSingleComment) continue;
      if (inMultiComment) {
        if (char === '*' && nextChar === '/') {
          inMultiComment = false;
          i++; // 跳过'*/'
        }
        continue;
      }
      if (inString) {
        if (char === stringChar && line[i - 1] !== '\\') {
          inString = false;
          if (char === '`') this.symbolStack.templates--;
        }
        continue;
      }

      // 处理符号
      switch (char) {
        case '/':
          if (nextChar === '/') {
            inSingleComment = true;
            continue;
          }
          if (nextChar === '*') {
            inMultiComment = true;
            i++; // 跳过'/*'
            continue;
          }
          break;
        case '"': case "'": case '`':
          inString = true;
          stringChar = char;
          if (char === '`') this.symbolStack.templates++;
          break;
        case '(': this.symbolStack.brackets++; break;
        case ')': this.symbolStack.brackets--; break;
        case '{': this.symbolStack.braces++; break;
        case '}': this.symbolStack.braces--; break;
        case '[': this.symbolStack.squares++; break;
        case ']': this.symbolStack.squares--; break;
      }
    }
  }

  /**
   * 检查是否可以安全分段
   */
  canSafelySplit(): boolean {
    return this.symbolStack.brackets === 0 &&
           this.symbolStack.braces === 0 &&
           this.symbolStack.squares === 0 &&
           this.symbolStack.templates === 0;
  }

  /**
   * 重置符号栈
   */
  reset(): void {
    this.symbolStack = {
      brackets: 0,
      braces: 0,
      squares: 0,
      templates: 0
    };
  }

  /**
   * 获取当前符号栈状态
   */
  getCurrentState(): SymbolStack {
    return { ...this.symbolStack };
  }

  /**
   * 设置符号栈状态
   */
  setCurrentState(state: SymbolStack): void {
    this.symbolStack = { ...state };
  }

  /**
  
  /**
   * 应用符号变化
   */
  private applySymbolChange(change: SymbolStackChange): void {
    this.symbolStack.brackets += change.brackets;
    this.symbolStack.braces += change.braces;
    this.symbolStack.squares += change.squares;
    this.symbolStack.templates += change.templates;
  }

  /**
   * 计算符号变化
   */
  private calculateSymbolChange(original: SymbolStack, current: SymbolStack): SymbolStackChange {
    return {
      brackets: current.brackets - original.brackets,
      braces: current.braces - original.braces,
      squares: current.squares - original.squares,
      templates: current.templates - original.templates
    };
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString();
  }

  /**
   * 获取缓存的符号变化
   */
  private getCachedChange(lineHash: string): SymbolStackChange | undefined {
    const result = this.analysisCache.get(lineHash);
    if (result) {
      // 更新访问顺序（LRU）
      this.accessOrder = this.accessOrder.filter(hash => hash !== lineHash);
      this.accessOrder.push(lineHash);
    }
    return result;
  }

  /**
   * 设置缓存的符号变化
   */
  private setCachedChange(lineHash: string, change: SymbolStackChange): void {
    if (this.analysisCache.size >= BalancedChunker.MAX_CACHE_SIZE) {
      // 移除最久未使用的条目
      const oldestHash = this.accessOrder.shift();
      if (oldestHash) {
        this.analysisCache.delete(oldestHash);
      }
    }
    
    this.analysisCache.set(lineHash, change);
    this.accessOrder.push(lineHash);
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.analysisCache.clear();
    this.accessOrder = [];
  }

  /**
   * 预缓存常见代码模式
   */
  preCacheCommonPatterns(): void {
    const commonPatterns = [
      'function () {}',
      'if () {}',
      'for () {}',
      'while () {}',
      'try {} catch {}',
      'class {}',
      '[]',
      '{}'
    ];

    commonPatterns.forEach(pattern => {
      const lineHash = this.simpleHash(pattern);
      if (!this.analysisCache.has(lineHash)) {
        const tempState = { ...this.symbolStack };
        this.analyzeLineSymbolsInternal(pattern);
        const symbolChange = this.calculateSymbolChange(tempState, this.symbolStack);
        this.setCachedChange(lineHash, symbolChange);
        this.symbolStack = tempState; // 恢复状态
      }
    });
  }

  /**
   * 验证代码片段的符号平衡
   */
  validateCodeBalance(code: string): boolean {
    const tempState = { ...this.symbolStack };
    const lines = code.split('\n');
    
    for (const line of lines) {
      this.analyzeLineSymbolsInternal(line);
    }
    
    const isBalanced = this.canSafelySplit();
    this.symbolStack = tempState; // 恢复状态
    
    return isBalanced;
  }
}