import { injectable, inject } from 'inversify';
import { Splitter, CodeChunk } from './Splitter';
import { TYPES } from '../../../types';
import { TreeSitterService } from '../core/parse/TreeSitterService';
import { LoggerService } from '../../../utils/LoggerService';
import { BalancedChunker } from './BalancedChunker';
import { ChunkingConfigManager } from './config/ChunkingConfigManager';
import { SplitStrategyFactory } from './core/SplitStrategyFactory';
import { ChunkingCoordinator } from './utils/ChunkingCoordinator';
import { UnifiedOverlapCalculator } from './utils/UnifiedOverlapCalculator';
import { ChunkingOptions, DEFAULT_CHUNKING_OPTIONS } from './types';

/**
 * 重构后的AST代码分割器（完全替换旧实现）
 * 采用新的架构设计，使用工厂模式、策略模式和装饰器模式
 */
@injectable()
export class ASTCodeSplitter implements Splitter {
  private treeSitterService: TreeSitterService;
  private logger?: LoggerService;
  private balancedChunker: BalancedChunker;
  private configManager: ChunkingConfigManager;
  private strategyFactory: SplitStrategyFactory;
  private coordinator?: ChunkingCoordinator;
  private overlapCalculator?: UnifiedOverlapCalculator;
  private options: Required<ChunkingOptions>;

  constructor(
    @inject(TYPES.TreeSitterService) treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.treeSitterService = treeSitterService;
    this.logger = logger;
    this.balancedChunker = new BalancedChunker(logger);
    this.configManager = new ChunkingConfigManager();
    this.strategyFactory = new SplitStrategyFactory();
    this.options = { ...DEFAULT_CHUNKING_OPTIONS };

    this.initializeComponents();
  }

  /**
   * 初始化组件
   */
  private initializeComponents(): void {
    // 初始化协调器
    if (this.options.enableChunkingCoordination) {
      this.coordinator = new ChunkingCoordinator(
        {} as any, // AST节点跟踪器需要在这里创建
        this.options,
        this.logger
      );
    }

    // 初始化重叠计算器
    if (this.options.addOverlap) {
      this.overlapCalculator = new UnifiedOverlapCalculator({
        maxSize: this.options.overlapSize,
        minLines: 1,
        maxOverlapRatio: this.options.maxOverlapRatio,
        maxOverlapLines: 50,
        enableASTBoundaryDetection: this.options.enableASTBoundaryDetection,
        enableNodeAwareOverlap: this.options.astNodeTracking,
        logger: this.logger
      });
    }
  }

  async split(code: string, language: string, filePath?: string): Promise<CodeChunk[]> {
    // 处理空代码
    if (!code || code.trim() === '') {
      return [];
    }

    try {
      // 获取配置
      const config = this.configManager.getMergedConfig(language);

      // 解析代码
      const parseResult = await this.treeSitterService.parseCode(code, language);

      if (parseResult.success && parseResult.ast) {
        return await this.processWithAST(code, parseResult, language, filePath, config);
      } else {
        this.logger?.warn(`TreeSitterService failed for language ${language}, using fallback strategy`);
        return await this.processWithFallback(code, language, filePath, config);
      }
    } catch (error) {
      this.logger?.error(`Code splitting failed: ${error}`);
      // 最终fallback：简单的文本分割
      return this.simpleTextSplit(code, language, filePath);
    }
  }

  /**
   * 使用AST进行处理
   */
  private async processWithAST(
    code: string,
    parseResult: any,
    language: string,
    filePath?: string,
    config?: ChunkingOptions
  ): Promise<CodeChunk[]> {
    let chunks: CodeChunk[];

    if (this.options.enableChunkingCoordination && this.coordinator) {
      // 使用协调器进行处理
      chunks = await this.coordinator.coordinate(code, language, filePath, parseResult.ast);
    } else {
      // 使用策略工厂创建策略链
      chunks = await this.processWithStrategyChain(code, parseResult, language, filePath, config);
    }

    // 应用重叠
    if (this.options.addOverlap && this.overlapCalculator) {
      chunks = this.overlapCalculator.addOverlap(chunks, code);
    }

    return chunks;
  }

  /**
   * 使用策略链进行处理
   */
  private async processWithStrategyChain(
    code: string,
    parseResult: any,
    language: string,
    filePath?: string,
    config?: ChunkingOptions
  ): Promise<CodeChunk[]> {
    const allChunks: CodeChunk[] = [];
    const processedRanges: Array<{ startLine: number, endLine: number }> = [];

    // 按优先级顺序执行策略
    const strategyTypes = this.options.strategyExecutionOrder || [
      'ImportSplitter',
      'ClassSplitter',
      'FunctionSplitter',
      'SyntaxAwareSplitter',
      'IntelligentSplitter'
    ];

    for (const strategyType of strategyTypes) {
      try {
        if (!this.strategyFactory.supportsStrategy(strategyType)) {
          this.logger?.debug(`Strategy ${strategyType} not registered, skipping`);
          continue;
        }

        // 创建策略实例
        const strategy = this.strategyFactory.create(strategyType, config);

        // 设置依赖服务
        this.configureStrategy(strategy);

        // 执行策略
        const strategyChunks = await strategy.split(code, language, filePath, config, null, parseResult.ast);

        // 过滤掉已处理的区域
        const newChunks = this.filterUnprocessedChunks(strategyChunks, processedRanges);

        allChunks.push(...newChunks);
        this.updateProcessedRanges(newChunks, processedRanges);

        this.logger?.debug(`Strategy ${strategyType} generated ${newChunks.length} new chunks`);

      } catch (error) {
        this.logger?.warn(`Strategy ${strategyType} failed: ${error}`);
      }
    }

    // 处理剩余未分割的代码
    const remainingChunks = await this.processRemainingCode(code, language, filePath, processedRanges);
    allChunks.push(...remainingChunks);

    return allChunks;
  }

  /**
   * 配置策略依赖
   */
  private configureStrategy(strategy: any): void {
    if (typeof strategy.setTreeSitterService === 'function') {
      strategy.setTreeSitterService(this.treeSitterService);
    }

    if (typeof strategy.setLogger === 'function' && this.logger) {
      strategy.setLogger(this.logger);
    }

    if (typeof strategy.setBalancedChunker === 'function') {
      strategy.setBalancedChunker(this.balancedChunker);
    }
  }

  /**
   * 过滤未处理的代码块
   */
  private filterUnprocessedChunks(
    chunks: CodeChunk[],
    processedRanges: Array<{ startLine: number, endLine: number }>
  ): CodeChunk[] {
    return chunks.filter(chunk => {
      const chunkRange = {
        startLine: chunk.metadata.startLine,
        endLine: chunk.metadata.endLine
      };

      return !this.isRangeProcessed(chunkRange, processedRanges);
    });
  }

  /**
   * 检查范围是否已处理
   */
  private isRangeProcessed(
    range: { startLine: number, endLine: number },
    processedRanges: Array<{ startLine: number, endLine: number }>
  ): boolean {
    return processedRanges.some(processed =>
      (range.startLine >= processed.startLine && range.startLine <= processed.endLine) ||
      (range.endLine >= processed.startLine && range.endLine <= processed.endLine) ||
      (range.startLine <= processed.startLine && range.endLine >= processed.endLine)
    );
  }

  /**
   * 更新已处理范围
   */
  private updateProcessedRanges(
    chunks: CodeChunk[],
    processedRanges: Array<{ startLine: number, endLine: number }>
  ): void {
    for (const chunk of chunks) {
      processedRanges.push({
        startLine: chunk.metadata.startLine,
        endLine: chunk.metadata.endLine
      });
    }
  }

  /**
   * 处理剩余未分割的代码
   */
  private async processRemainingCode(
    code: string,
    language: string,
    filePath?: string,
    processedRanges?: Array<{ startLine: number, endLine: number }>
  ): Promise<CodeChunk[]> {
    if (!processedRanges || processedRanges.length === 0) {
      // 如果没有已处理的区域，使用智能分割
      const intelligentStrategy = this.strategyFactory.create('IntelligentSplitter', this.options);
      this.configureStrategy(intelligentStrategy);
      return await intelligentStrategy.split(code, language, filePath, this.options);
    }

    // 识别未处理的代码区域
    const lines = code.split('\n');
    const unprocessedRanges = this.calculateUnprocessedRanges(lines.length, processedRanges);

    const remainingChunks: CodeChunk[] = [];

    for (const range of unprocessedRanges) {
      if (range.endLine < range.startLine) continue;

      const remainingContent = lines.slice(range.startLine - 1, range.endLine).join('\n');
      if (remainingContent.trim().length === 0) continue;

      // 对每个未处理区域使用智能分割
      const intelligentStrategy = this.strategyFactory.create('IntelligentSplitter', this.options);
      this.configureStrategy(intelligentStrategy);

      const chunks = await intelligentStrategy.split(remainingContent, language, filePath, this.options);

      // 调整行号
      const adjustedChunks = chunks.map(chunk => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          startLine: chunk.metadata.startLine + range.startLine - 1,
          endLine: chunk.metadata.endLine + range.startLine - 1
        }
      }));

      remainingChunks.push(...adjustedChunks);
    }

    return remainingChunks;
  }

  /**
   * 计算未处理的范围
   */
  private calculateUnprocessedRanges(
    totalLines: number,
    processedRanges: Array<{ startLine: number, endLine: number }>
  ): Array<{ startLine: number, endLine: number }> {
    if (processedRanges.length === 0) {
      return [{ startLine: 1, endLine: totalLines }];
    }

    // 排序处理范围
    const sortedRanges = [...processedRanges].sort((a, b) => a.startLine - b.startLine);

    const unprocessedRanges: Array<{ startLine: number, endLine: number }> = [];
    let currentLine = 1;

    for (const range of sortedRanges) {
      if (currentLine < range.startLine) {
        unprocessedRanges.push({
          startLine: currentLine,
          endLine: range.startLine - 1
        });
      }
      currentLine = Math.max(currentLine, range.endLine + 1);
    }

    // 添加最后一个未处理范围
    if (currentLine <= totalLines) {
      unprocessedRanges.push({
        startLine: currentLine,
        endLine: totalLines
      });
    }

    return unprocessedRanges;
  }

  /**
   * 使用fallback策略进行处理
   */
  private async processWithFallback(
    code: string,
    language: string,
    filePath?: string,
    config?: ChunkingOptions
  ): Promise<CodeChunk[]> {
    try {
      const intelligentStrategy = this.strategyFactory.create('IntelligentSplitter', config);
      this.configureStrategy(intelligentStrategy);

      let chunks = await intelligentStrategy.split(code, language, filePath, config);

      // 应用重叠
      if (this.options.addOverlap && this.overlapCalculator) {
        chunks = this.overlapCalculator.addOverlap(chunks, code);
      }

      return chunks;
    } catch (error) {
      this.logger?.warn(`Intelligent splitter failed: ${error}`);
      return this.simpleTextSplit(code, language, filePath);
    }
  }

  /**
   * 简单的文本分割（最终fallback）
   */
  private simpleTextSplit(code: string, language: string, filePath?: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = code.split('\n');

    // 对于非常小的文件，直接返回整个文件
    if (lines.length <= 20) {
      if (this.validateCodeChunk(code, language)) {
        chunks.push({
          content: code,
          metadata: {
            startLine: 1,
            endLine: lines.length,
            language,
            filePath,
            type: 'generic',
            chunkIndex: 0
          }
        });
      }
      return chunks;
    }

    // 对于较大的文件，使用智能分割
    const chunkSize = Math.max(15, Math.floor(lines.length / 3)); // 增加最小块大小

    let position = 0;
    let chunkIndex = 0;

    while (position < lines.length) {
      // 寻找合适的分割点
      const splitResult = this.findSmartSplitPoint(lines, position, chunkSize, language);
      if (!splitResult) break;

      const { content, startLine, endLine } = splitResult;

      if (this.validateCodeChunk(content, language)) {
        chunks.push({
          content,
          metadata: {
            startLine,
            endLine,
            language,
            filePath,
            type: 'generic',
            chunkIndex: chunkIndex++
          }
        });
      }

      position = endLine;
    }

    return chunks;
  }

  // 新增：寻找智能分割点
  private findSmartSplitPoint(
    lines: string[],
    startPos: number,
    preferredSize: number,
    language: string
  ): { content: string; startLine: number; endLine: number } | null {

    const maxPos = Math.min(startPos + preferredSize * 2, lines.length); // 允许扩展到2倍大小
    let bestEndPos = -1;
    let bestScore = -1;

    // 在允许范围内寻找最佳分割点
    for (let pos = startPos + preferredSize; pos <= maxPos; pos++) {
      if (pos >= lines.length) break;

      const candidateLines = lines.slice(startPos, pos);
      const candidateContent = candidateLines.join('\n');

      // 评估分割点的质量
      const score = this.evaluateSplitPoint(candidateContent, lines[pos] || '', language);

      if (score > bestScore) {
        bestScore = score;
        bestEndPos = pos;
      }

      // 如果找到完美分割点，立即停止
      if (score >= 0.9) break;
    }

    if (bestEndPos === -1) {
      return null;
    }

    const content = lines.slice(startPos, bestEndPos).join('\n');
    return {
      content,
      startLine: startPos + 1,
      endLine: bestEndPos
    };
  }

  // 新增：评估分割点质量
  private evaluateSplitPoint(
    beforeContent: string,
    nextLine: string,
    language: string
  ): number {
    let score = 0;

    // 1. 基本语法完整性检查
    if (!this.isSymbolBalanced(beforeContent, language)) {
      return 0; // 语法不平衡，无效分割点
    }

    // 2. 语义分割点偏好
    const trimmedContent = beforeContent.trim();

    // 在函数/类/语句结束处分割得分高
    if (trimmedContent.endsWith('}') || trimmedContent.endsWith(';')) {
      score += 0.5;
    }

    // 3. 避免在字符串或注释中分割
    if (this.isInStringOrComment(trimmedContent, language)) {
      score -= 0.3;
    }

    // 4. 内容质量检查
    if (trimmedContent.length < 10) {
      score -= 0.2; // 内容太少
    }

    // 5. 下一行开始的合理性检查
    if (nextLine) {
      const trimmedNext = nextLine.trim();
      if (trimmedNext.startsWith('func ') ||
        trimmedNext.startsWith('type ') ||
        trimmedNext.startsWith('class ') ||
        trimmedNext.startsWith('def ')) {
        score += 0.3; // 在重要结构开始前的分割点
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  // 新增：代码块验证
  private validateCodeChunk(content: string, language: string): boolean {
    try {
      // 1. 基本内容验证
      const trimmed = content.trim();
      if (trimmed.length < 5) {  // 最少5个字符
        return false;
      }

      // 2. 排除明显无效的代码块
      if (trimmed === '}' || trimmed === '{' || trimmed === ';') {
        return false;
      }

      // 3. 语法符号平衡检查
      if (!this.isSymbolBalanced(content, language)) {
        return false;
      }

      // 4. 语言特定验证
      switch (language.toLowerCase()) {
        case 'go':
          return this.validateGoCode(content);
        case 'typescript':
        case 'javascript':
          return this.validateJSCode(content);
        case 'python':
          return this.validatePythonCode(content);
        default:
          return true; // 未知语言，基本验证通过即可
      }
    } catch (error) {
      this.logger?.warn(`Code chunk validation failed: ${error}`);
      return false;
    }
  }

  // 新增：符号平衡检查
  private isSymbolBalanced(content: string, language: string): boolean {
    try {
      const symbols = this.getLanguageSymbols(language);
      const stack: string[] = [];

      let inString = false;
      let stringChar = '';
      let escaped = false;

      for (let i = 0; i < content.length; i++) {
        const char = content[i];

        // 处理转义字符
        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          continue;
        }

        // 处理字符串
        if ((char === '"' || char === "'" || char === '`') && !inString) {
          inString = true;
          stringChar = char;
          continue;
        }

        if (inString && char === stringChar) {
          inString = false;
          stringChar = '';
          continue;
        }

        // 在字符串中，不检查括号
        if (inString) continue;

        // 检查括号匹配
        if (symbols.opening.includes(char)) {
          stack.push(char);
        } else if (symbols.closing.includes(char)) {
          const last = stack.pop();
          if (!last || !this.isMatchingPair(last, char)) {
            return false;
          }
        }
      }

      return stack.length === 0 && !inString;
    } catch (error) {
      return false;
    }
  }

  // 新增：获取语言特定符号
  private getLanguageSymbols(language: string): { opening: string[]; closing: string[] } {
    const languageSymbols: Map<string, { opening: string[]; closing: string[] }> = new Map([
      ['go', { opening: ['(', '[', '{'], closing: [')', ']', '}'] }],
      ['typescript', { opening: ['(', '[', '{'], closing: [')', ']', '}'] }],
      ['javascript', { opening: ['(', '[', '{'], closing: [')', ']', '}'] }],
      ['python', { opening: ['(', '[', '{'], closing: [')', ']', '}'] }],
      ['java', { opening: ['(', '[', '{'], closing: [')', ']', '}'] }],
      ['rust', { opening: ['(', '[', '{'], closing: [')', ']', '}'] }],
      ['cpp', { opening: ['(', '[', '{'], closing: [')', ']', '}'] }],
      ['c', { opening: ['(', '[', '{'], closing: [')', ']', '}'] }]
    ]);

    return languageSymbols.get(language.toLowerCase()) ||
      { opening: ['(', '[', '{'], closing: [')', ']', '}'] };
  }

  // 新增：检查括号匹配
  private isMatchingPair(opening: string, closing: string): boolean {
    const pairs: Map<string, string> = new Map([
      ['(', ')'],
      ['[', ']'],
      ['{', '}']
    ]);
    return pairs.get(opening) === closing;
  }

  // 新增：Go代码验证
  private validateGoCode(content: string): boolean {
    const trimmed = content.trim();

    // Go代码应该包含一些基本元素
    if (trimmed.includes('package ') ||
      trimmed.includes('func ') ||
      trimmed.includes('type ') ||
      trimmed.includes('import ')) {
      return true;
    }

    // 或者至少有一些有效的Go语法结构
    const goPatterns = [
      /package\s+\w+/,           // package声明
      /func\s+\w+\s*\(/,         // 函数定义
      /type\s+\w+\s+(struct|interface)/, // 类型定义
      /var\s+\w+\s+\w+/,         // 变量声明
      /const\s+\w+\s*=/,         // 常量定义
      /if\s+\w+.*{/,             // if语句
      /for\s+.*{/,               // for循环
      /switch\s+.*{/,            // switch语句
      /struct\s*{/,              // 结构体
      /interface\s*{/            // 接口
    ];

    return goPatterns.some(pattern => pattern.test(trimmed));
  }

  // 新增：JavaScript/TypeScript代码验证
  private validateJSCode(content: string): boolean {
    const trimmed = content.trim();

    const jsPatterns = [
      /(const|let|var)\s+\w+/,           // 变量声明
      /function\s+\w+\s*\(/,            // 函数定义
      /=>/,                              // 箭头函数
      /import\s+.*from\s+/,             // import语句
      /export\s+(default\s+)?\w+/,      // export语句
      /class\s+\w+/,                     // 类定义
      /if\s*\(.*\)\s*{/,                 // if语句
      /for\s*\(.*\)\s*{/,                // for循环
      /while\s*\(.*\)\s*{/,              // while循环
      /try\s*{/,                         // try语句
      /console\.(log|error|warn)/,       // console调用
      /document\.(getElementById|querySelector)/ // DOM操作
    ];

    return jsPatterns.some(pattern => pattern.test(trimmed));
  }

  // 新增：Python代码验证
  private validatePythonCode(content: string): boolean {
    const trimmed = content.trim();

    const pyPatterns = [
      /def\s+\w+\s*\(/,                   // 函数定义
      /import\s+\w+/,                     // import语句
      /from\s+\w+\s+import/,              // from import语句
      /class\s+\w+.*:/,                   // 类定义
      /if\s+.*:/,                         // if语句
      /for\s+\w+\s+in\s+.*:/,             // for循环
      /while\s+.*:/,                      // while循环
      /try:/,                             // try语句
      /with\s+.*as\s+\w+:/,               // with语句
      /print\s*\(/,                       // print语句
      /if\s+__name__\s*==\s*["']__main__["']/ // main检查
    ];

    return pyPatterns.some(pattern => pattern.test(trimmed));
  }

  // 新增：检查是否在字符串或注释中
  private isInStringOrComment(content: string, language: string): boolean {
    // 简单的启发式检查，可以根据需要扩展
    const trimmed = content.trim();

    // 如果以这些字符结尾，可能在字符串中
    if (trimmed.endsWith('"') || trimmed.endsWith("'") || trimmed.endsWith('`')) {
      return true;
    }

    // 如果以注释符号结尾，可能在注释中
    if (language === 'python' && trimmed.endsWith('#')) {
      return true;
    }

    if (['javascript', 'typescript', 'go', 'java', 'cpp', 'c'].includes(language)) {
      if (trimmed.endsWith('//') || trimmed.endsWith('/*')) {
        return true;
      }
    }

    return false;
  }

  setChunkSize(chunkSize: number): void {
    this.options.maxChunkSize = chunkSize;
    this.configManager.updateGlobalConfig({ maxChunkSize: chunkSize });
  }

  setChunkOverlap(chunkOverlap: number): void {
    this.options.overlapSize = chunkOverlap;
    this.configManager.updateGlobalConfig({ overlapSize: chunkOverlap });

    // 重新初始化重叠计算器
    if (this.overlapCalculator) {
      this.overlapCalculator = new UnifiedOverlapCalculator({
        maxSize: chunkOverlap,
        minLines: 1,
        maxOverlapRatio: this.options.maxOverlapRatio,
        maxOverlapLines: 50,
        enableASTBoundaryDetection: this.options.enableASTBoundaryDetection,
        enableNodeAwareOverlap: this.options.astNodeTracking,
        logger: this.logger
      });
    }
  }
}