# 分段策略中的边界确定逻辑

## 概述

代码分段系统包含多种分段策略，每种策略都有其特定的边界确定逻辑。这些策略按照优先级顺序执行，确保代码在语义和语法上的完整性。本文档详细介绍各种分段策略中的边界确定逻辑。

## 分段策略概览

系统包含以下分段策略，按优先级排序：

1. **ImportSplitter** - 处理导入语句（最高优先级）
2. **ClassSplitter** - 处理类和接口定义
3. **FunctionSplitter** - 处理函数和方法
4. **SyntaxAwareSplitter** - 语法感知分段
5. **IntelligentSplitter** - 智能分段（后备方案）
6. **SemanticSplitter** - 语义分段（最后后备）

## 1. ImportSplitter 策略

### 1.1 策略概述

`ImportSplitter` 专注于提取和分割导入/引入语句，确保依赖关系清晰可见。

### 1.2 边界确定逻辑

#### 导入节点提取

```typescript
const imports = this.treeSitterService!.extractImportNodes(ast);
```

#### 边界确定方法

1. **AST 节点边界**: 使用 TreeSitter 解析的 AST 节点确定导入语句的精确边界
2. **位置信息**: 获取导入语句的起始和结束行号
3. **节点验证**: 确保节点未被其他策略使用

```typescript
private processImportNode(
  importNode: any,
  content: string,
  language: string,
  filePath?: string,
  nodeTracker?: any
): CodeChunk[] {
  // 获取导入文本和位置信息
  const importText = this.treeSitterService!.getNodeText(importNode, content);
  const location = this.treeSitterService!.getNodeLocation(importNode);
  
  // 验证基本信息
  if (!location) {
    this.logger?.warn('Failed to get import location');
    return [];
  }
  
  // 创建代码块
  const metadata = {
    startLine: location.startLine,
    endLine: location.endLine,
    language,
    filePath,
    type: 'import' as const,
    complexity: this.complexityCalculator.calculate(importText),
    nodeIds: [astNode.id],
    lineCount: location.endLine - location.startLine + 1
  };
  
  return [this.createChunk(importText, metadata)];
}
```

### 1.3 支持的导入格式

- JavaScript/TypeScript: `import ... from '...'`, `export ...`
- Python: `import ...`, `from ... import ...`
- Java: `import ...;`
- C/C++: `#include ...`, `using ...`
- Go: `import (...)`

## 2. ClassSplitter 策略

### 2.1 策略概述

`ClassSplitter` 专注于提取和分割类定义，支持保持方法在一起或分别提取类定义和方法。

### 2.2 边界确定逻辑

#### 类节点提取

```typescript
const classes = this.treeSitterService!.extractClasses(ast);
```

#### 边界确定方法

1. **AST 节点边界**: 使用 TreeSitter 解析的 AST 节点确定类定义的精确边界
2. **配置选项**: 根据 `keepMethodsTogether` 配置决定边界策略
3. **组件分割**: 可选择将类定义和方法分别分割

```typescript
private processClassNode(
  classNode: any,
  content: string,
  language: string,
  filePath?: string,
  nodeTracker?: any
): CodeChunk[] {
  // 获取类文本和位置信息
  const classText = this.treeSitterService!.getNodeText(classNode, content);
  const location = this.treeSitterService!.getNodeLocation(classNode);
  const className = this.treeSitterService!.getNodeName(classNode);
  
  // 根据配置决定是否保持方法在一起
  const keepMethodsTogether = this.options.classSpecificOptions?.keepMethodsTogether ?? true;
  
  if (keepMethodsTogether) {
    // 保持方法在一起，将整个类作为一个块
    return [this.createWholeClassChunk(classText, location, language, filePath, className)];
  } else {
    // 分别提取类定义和方法
    return this.splitClassComponents(classNode, classText, location, language, filePath, nodeTracker);
  }
}
```

### 2.3 类组件分割

当 `keepMethodsTogether` 为 false 时，系统会分割类组件：

```typescript
private splitClassComponents(
  classNode: any,
  classContent: string,
  location: any,
  language: string,
  filePath?: string,
  nodeTracker?: any
): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  
  // 首先添加类定义头
  const classHeader = this.extractClassHeader(classNode, classContent);
  if (classHeader) {
    const headerMetadata = {
      startLine: location.startLine,
      endLine: location.startLine + classHeader.split('\n').length - 1,
      language,
      filePath,
      type: 'class' as const,
      className: this.treeSitterService!.getNodeName(classNode) || 'unknown_class',
      complexity: this.complexityCalculator.calculate(classHeader),
      component: 'header'
    };
    
    chunks.push(this.createChunk(classHeader, headerMetadata));
  }
  
  // 简化处理：不再尝试提取方法，因为TreeSitterService可能没有extractMethods方法
  return chunks;
}
```

### 2.4 类头部提取

```typescript
private extractClassHeader(classNode: any, classContent: string): string {
  // 找到类名后的第一个大括号，提取到那里为止的内容
  const lines = classContent.split('\n');
  let braceCount = 0;
  let headerEnd = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    braceCount += (line.match(/\{/g) || []).length;
    braceCount -= (line.match(/\}/g) || []).length;
    
    if (braceCount > 0) {
      headerEnd = i;
      break;
    }
  }
  
  return lines.slice(0, headerEnd + 1).join('\n');
}
```

## 3. FunctionSplitter 策略

### 3.1 策略概述

`FunctionSplitter` 专注于提取和分割函数/方法定义，支持根据文件大小动态调整参数。

### 3.2 边界确定逻辑

#### 函数节点提取

```typescript
const functions = this.treeSitterService!.extractFunctions(ast);
```

#### 边界确定方法

1. **AST 节点边界**: 使用 TreeSitter 解析的 AST 节点确定函数的精确边界
2. **文件大小调整**: 根据文件大小动态调整分段参数
3. **节点验证**: 确保节点未被其他策略使用

```typescript
private processFunctionNode(
  functionNode: any,
  content: string,
  language: string,
  filePath?: string,
  nodeTracker?: any
): CodeChunk[] {
  // 获取函数文本和位置信息
  const functionText = this.treeSitterService!.getNodeText(functionNode, content);
  const location = this.treeSitterService!.getNodeLocation(functionNode);
  const functionName = this.treeSitterService!.getNodeName(functionNode);
  
  // 验证基本信息
  if (!location) {
    this.logger?.warn('Failed to get function location');
    return [];
  }
  
  // 创建函数块的元数据
  const metadata = {
    startLine: location.startLine,
    endLine: location.endLine,
    language,
    filePath,
    type: 'function' as const,
    functionName,
    complexity: this.complexityCalculator.calculate(functionText),
    nodeIds: [astNode.id],
    lineCount: location.endLine - location.startLine + 1
  };
  
  return [this.createChunk(functionText, metadata)];
}
```

### 3.3 文件大小自适应

```typescript
private adjustOptionsForFileSize(content: string, originalOptions?: ChunkingOptions): ChunkingOptions {
  const lines = content.split('\n');
  const lineCount = lines.length;
  
  // 小文件特殊处理
  if (lineCount <= 20) {
    return {
      ...baseOptions,
      functionSpecificOptions: {
        preferWholeFunctions: true,
        minFunctionOverlap: baseOptions.functionSpecificOptions?.minFunctionOverlap || 50,
        maxFunctionSize: baseOptions.functionSpecificOptions?.maxFunctionSize || 2000,
        maxFunctionLines: Math.max(lineCount, 50), // 放宽最大行数限制
        minFunctionLines: 1, // 最小行数降为1
        enableSubFunctionExtraction: false // 禁用子函数提取
      },
      minChunkSize: 5, // 降低最小块大小
      maxChunkSize: Math.max(100, lineCount * 3) // 调整最大块大小
    };
  }
  
  // 中等文件
  if (lineCount <= 100) {
    return {
      ...baseOptions,
      functionSpecificOptions: {
        preferWholeFunctions: true,
        minFunctionOverlap: baseOptions.functionSpecificOptions?.minFunctionOverlap || 50,
        maxFunctionSize: baseOptions.functionSpecificOptions?.maxFunctionSize || 2000,
        maxFunctionLines: 100, // 适度放宽
        minFunctionLines: 3, // 稍微降低最小行数
        enableSubFunctionExtraction: baseOptions.functionSpecificOptions?.enableSubFunctionExtraction ?? true
      }
    };
  }
  
  // 大文件使用默认配置
  return baseOptions;
}
```

## 4. SyntaxAwareSplitter 策略

### 4.1 策略概述

`SyntaxAwareSplitter` 使用 AST 信息进行语法感知分段，结合多种子策略进行综合分段。

### 4.2 边界确定逻辑

#### AST 解析

```typescript
const parseResult = await this.treeSitterService.parseCode(content, language);
```

#### 多策略组合

```typescript
private async createEnhancedSyntaxAwareChunks(
  content: string,
  parseResult: any,
  language: string,
  filePath: string | undefined,
  options: Required<ChunkingOptions>
): Promise<CodeChunk[]> {
  const chunks: CodeChunk[] = [];
  
  // 使用策略工厂创建子分割器
  this.functionSplitter = this.functionSplitter || strategyFactory.create('FunctionSplitter', options);
  this.classSplitter = this.classSplitter || strategyFactory.create('ClassSplitter', options);
  this.importSplitter = this.importSplitter || strategyFactory.create('ImportSplitter', options);
  
  try {
    // 1. 函数和方法分段（包含嵌套函数）
    if (this.functionSplitter && typeof (this.functionSplitter as any).extractFunctions === 'function') {
      const functionChunks = (this.functionSplitter as any).extractFunctions(content, parseResult.ast, language, filePath);
      if (functionChunks && functionChunks.length > 0) {
        chunks.push(...functionChunks);
      }
    }
    
    // 2. 类和接口分段
    if (this.classSplitter && typeof (this.classSplitter as any).extractClasses === 'function') {
      const classChunks = (this.classSplitter as any).extractClasses(content, parseResult.ast, language, filePath);
      if (classChunks && classChunks.length > 0) {
        chunks.push(...classChunks);
      }
    }
    
    // 3. 导入导出语句分段
    if (this.importSplitter && typeof (this.importSplitter as any).extractImports === 'function') {
      const importChunks = (this.importSplitter as any).extractImports(content, parseResult.ast, language, filePath);
      if (importChunks && importChunks.length > 0) {
        chunks.push(...importChunks);
      }
    }
  } catch (error) {
    this.logger?.error(`Error in syntax-aware chunking: ${error}`);
  }
  
  // 4. 优化块大小
  this.chunkOptimizer = this.chunkOptimizer || new ChunkOptimizer(options);
  return this.chunkOptimizer.optimize(chunks, content);
}
```

## 5. IntelligentSplitter 策略

### 5.1 策略概述

`IntelligentSplitter` 使用语义边界评分进行智能分段，结合符号平衡、语法验证和性能优化。

### 5.2 边界确定逻辑

#### 语义边界评分决策

```typescript
private shouldSplitWithSemanticBoundary(
  line: string,
  currentChunk: string[],
  currentSize: number,
  lineSize: number,
  maxChunkSize: number,
  language: string,
  allLines: string[],
  currentIndex: number
): boolean {
  // 大小限制检查（优先）
  if (currentSize + lineSize > maxChunkSize) {
    return true;
  }
  
  // 符号平衡检查 - 只有在符号平衡时才允许分段
  if (!this.balancedChunker.canSafelySplit()) {
    return false;
  }
  
  // 使用语义边界评分
  if (this.semanticBoundaryAnalyzer) {
    const context = allLines.slice(Math.max(0, currentIndex - 2), currentIndex + 1);
    const boundaryScore = this.semanticBoundaryAnalyzer.calculateBoundaryScore(line, context, language);
    
    // 如果边界评分足够高，允许分段
    if (boundaryScore.score > 0.7) {
      return currentSize > maxChunkSize * 0.3;
    }
    
    // 如果边界评分中等，需要更大的块大小
    if (boundaryScore.score > 0.5) {
      return currentSize > maxChunkSize * 0.5;
    }
  }
  
  // 如果没有语义边界分析器，使用简单的大小检查
  return currentSize > maxChunkSize * 0.8;
}
```

#### 分段流程

```typescript
private createIntelligentChunks(
  content: string,
  language: string,
  filePath?: string,
  options: Required<ChunkingOptions> = this.options,
  nodeTracker?: any
): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const lines = content.split('\n');
  let currentChunk: string[] = [];
  let currentLine = 1;
  let currentSize = 0;
  
  // 重置符号跟踪器
  this.balancedChunker.reset();
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineSize = line.length + 1; // +1 for newline
    
    // 更新符号跟踪
    this.balancedChunker.analyzeLineSymbols(line, i + 1);
    
    // 使用语义边界评分检查是否应该在逻辑边界处分段
    const shouldSplit = this.shouldSplitWithSemanticBoundary(
      line,
      currentChunk,
      currentSize,
      lineSize,
      this.options.maxChunkSize,
      language,
      lines,
      i
    );
    
    if (shouldSplit && currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      
      // 验证分段语法
      if (this.syntaxValidator.validate(chunkContent, language)) {
        const complexity = this.complexityCalculator.calculate(chunkContent);
        
        const metadata: CodeChunkMetadata = {
          startLine: currentLine,
          endLine: currentLine + currentChunk.length - 1,
          language,
          filePath,
          type: 'generic',
          complexity
        };
        
        chunks.push({
          content: chunkContent,
          metadata
        });
        
        // 使用统一重叠计算
        if (this.unifiedOverlapCalculator) {
          const overlapLines = this.unifiedOverlapCalculator.calculateSmartOverlap(
            currentChunk,
            content,
            currentLine
          );
          currentChunk = overlapLines;
          currentLine = i - overlapLines.length + 1;
          currentSize = overlapLines.join('\n').length;
        }
      }
    }
    
    currentChunk.push(line);
    currentSize += lineSize;
  }
  
  // 处理最后的chunk
  if (currentChunk.length > 0) {
    const chunkContent = currentChunk.join('\n');
    
    // 验证最后一段的语法
    if (this.syntaxValidator.validate(chunkContent, language)) {
      const complexity = this.complexityCalculator.calculate(chunkContent);
      
      const metadata: CodeChunkMetadata = {
        startLine: currentLine,
        endLine: currentLine + currentChunk.length - 1,
        language,
        filePath,
        type: 'generic',
        complexity
      };
      
      chunks.push({
        content: chunkContent,
        metadata
      });
    }
  }
  
  return chunks;
}
```

### 5.3 优化级别确定

```typescript
private getOptimizationLevel(content: string): 'low' | 'medium' | 'high' {
  const lines = content.split('\n').length;
  const complexity = this.complexityCalculator.estimate(content);
  
  if (lines < 100 && complexity < 50) {
    return 'low'; // 使用基本符号跟踪
  } else if (lines < 1000 && complexity < 200) {
    return 'medium'; // 使用缓存优化
  } else {
    return 'high'; // 使用完整优化策略
  }
}
```

## 6. SemanticSplitter 策略

### 6.1 策略概述

`SemanticSplitter` 使用语义分数进行分段，作为最后的后备方案。

### 6.2 边界确定逻辑

#### 语义分数计算

```typescript
private createSemanticFallbackChunks(
  content: string,
  language: string,
  filePath?: string,
  options: Required<ChunkingOptions> = this.options
): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const lines = content.split('\n');
  let currentChunk: string[] = [];
  let currentLine = 1;
  let semanticScore = 0;
  
  // 添加内存保护：限制处理的行数，避免处理超大文件时内存占用过高
  const maxLines = Math.min(lines.length, this.maxLines);
  
  for (let i = 0; i < maxLines; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // 计算语义分数
    const lineScore = this.complexityCalculator.calculateSemanticScore(trimmedLine);
    semanticScore += lineScore;
    
    // 决定是否分段
    const shouldSplit = semanticScore > this.options.maxChunkSize * 0.8 ||
      (trimmedLine === '' && currentChunk.length > 3) ||
      i === maxLines - 1;
    
    if (shouldSplit && currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      const complexity = this.complexityCalculator.calculate(chunkContent);
      
      const metadata: CodeChunkMetadata = {
        startLine: currentLine,
        endLine: currentLine + currentChunk.length - 1,
        language,
        filePath,
        type: 'semantic',
        complexity
      };
      
      chunks.push({
        content: chunkContent,
        metadata
      });
      
      currentChunk = [];
      currentLine = i + 1;
      semanticScore = 0;
    }
    
    currentChunk.push(line);
    
    // 每处理1000行检查一次内存使用情况
    if (i > 0 && i % 1000 === 0) {
      const currentMemory = process.memoryUsage();
      if (currentMemory.heapUsed / currentMemory.heapTotal > 0.85) {
        this.logger?.warn(`High memory usage detected during semantic fallback chunking, stopping at line ${i}`);
        break; // 如果内存使用过高，停止处理
      }
    }
  }
  
  // 处理最后的chunk
  if (currentChunk.length > 0) {
    const chunkContent = currentChunk.join('\n');
    const complexity = this.complexityCalculator.calculate(chunkContent);
    
    const metadata: CodeChunkMetadata = {
      startLine: currentLine,
      endLine: currentLine + currentChunk.length - 1,
      language,
      filePath,
      type: 'semantic',
      complexity
    };
    
    chunks.push({
      content: chunkContent,
      metadata
    });
  }
  
  return chunks;
}
```

## 7. 分段协调器

### 7.1 策略优先级

`ChunkingCoordinator` 按以下优先级执行分段策略：

```typescript
private readonly strategyPriority: string[] = [
  'ImportSplitter',    // 处理导入语句（最高优先级）
  'ClassSplitter',     // 处理类和接口定义  
  'FunctionSplitter',  // 处理函数和方法
  'SyntaxAwareSplitter', // 语法感知分段
  'IntelligentSplitter', // 智能分段（后备方案）
  'SemanticSplitter'   // 语义分段（最后后备）
];
```

### 7.2 协调执行流程

```typescript
async coordinate(
  content: string,
  language: string,
  filePath?: string,
  ast?: any
): Promise<CodeChunk[]> {
  const allChunks: CodeChunk[] = [];
  
  // 重置节点跟踪器
  this.nodeTracker.clear();
  
  // 按优先级执行分段策略
  for (const strategyName of this.strategyPriority) {
    const strategy = this.strategies.get(strategyName);
    
    if (!strategy || !strategy.supportsLanguage(language)) {
      continue;
    }
    
    try {
      // 执行分段策略
      const chunks = await strategy.split(
        content,
        language,
        filePath,
        this.options,
        this.nodeTracker,
        ast
      );
      
      // 过滤冲突的代码块
      const filteredChunks = this.filterChunksWithTracker(chunks);
      
      // 标记节点为已使用
      this.markUsedNodesWithTracker(filteredChunks);
      
      allChunks.push(...filteredChunks);
    } catch (error) {
      this.logger?.warn(`Strategy ${strategyName} failed: ${error}`);
    }
  }
  
  // 后处理：合并相似块和智能重叠控制
  return this.postProcessChunks(allChunks, content);
}
```

## 总结

分段策略系统通过多层次的策略和优先级机制，确保代码分段在语法正确性和语义完整性方面达到最佳效果。每种策略都有其特定的边界确定逻辑，从 AST 级别的精确边界到语义评分的智能边界，为不同场景提供了灵活而精确的分段能力。