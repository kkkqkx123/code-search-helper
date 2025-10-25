## 完整增强实现方案

基于现有的 [`HashUtils`](src/utils/HashUtils.ts) 工具类，我可以提供一个更健壮和集成的解决方案：

### 1. 修改 QueryResultNormalizer.ts

```typescript
// 在文件顶部添加导入
import { HashUtils } from '../../../utils/HashUtils';

// 替换现有的 hashAST 方法
private hashAST(ast: Parser.SyntaxNode): string {
  // 提取全面的识别信息
  const components = {
    content: ast.text || '',
    startPosition: `${ast.startPosition.row}:${ast.startPosition.column}`,
    endPosition: `${ast.endPosition.row}:${ast.endPosition.column}`,
    nodeType: ast.type || '',
    nodeId: ast.id || '0', // 如果Tree-sitter提供节点ID
    contentLength: (ast.text || '').length
  };

  // 使用 HashUtils 的加密安全哈希
  return HashUtils.calculateStringHash(JSON.stringify(components));
}

// 删除原有的 simpleHash 方法，因为不再需要
```

### 2. 添加分段类型差异化支持

```typescript
// 添加新的方法用于不同类型的分段
private generateSegmentHash(segment: any, segmentType: string): string {
  const baseComponents = {
    segmentType,
    contentLength: segment.content?.length || 0
  };

  let specificComponents: any = {};

  switch (segmentType) {
    case 'markdown':
      specificComponents = {
        contentPreview: this.getContentPreview(segment.content),
        headingLevel: segment.headingLevel,
        position: segment.position
      };
      break;
    
    case 'code':
      specificComponents = {
        language: segment.metadata?.language,
        startLine: segment.startLine,
        endLine: segment.endLine,
        complexity: segment.metadata?.complexity
      };
      break;
    
    default:
      specificComponents = {
        contentPreview: this.getContentPreview(segment.content)
      };
  }

  const hashInput = JSON.stringify({ ...baseComponents, ...specificComponents });
  return HashUtils.calculateStringHash(hashInput);
}

// 内容预览辅助方法
private getContentPreview(content: string, maxLength: number = 100): string {
  if (!content || content.length <= maxLength) return content;
  
  // 取前80字符和后20字符，中间用省略号
  const prefix = content.substring(0, 80);
  const suffix = content.substring(content.length - 20);
  return `${prefix}...${suffix}`;
}
```

### 3. 增强缓存键生成

```typescript
private generateCacheKey(
  ast: Parser.SyntaxNode, 
  language: string, 
  queryTypes?: string[]
): string {
  // 基于AST内容、语言和查询类型生成缓存键
  const astHash = this.hashAST(ast);
  const queryTypesStr = queryTypes?.join(',') || 'auto';
  
  // 使用更健壮的组合方式
  return HashUtils.calculateStringHash(`${language}:${astHash}:${queryTypesStr}`);
}
```

### 4. 缓存失效策略

```typescript
// 添加文件哈希检查方法
private async getFileContextHash(filePath: string): Promise<string> {
  try {
    // 使用现有的 HashUtils 计算文件哈希
    return await HashUtils.calculateFileHash(filePath);
  } catch (error) {
    // 如果文件读取失败，使用文件路径和当前时间
    const fallbackInput = `${filePath}:${Date.now()}`;
    return HashUtils.calculateStringHash(fallbackInput);
  }
}

// 在缓存检查时添加文件上下文
private async shouldInvalidateCache(cacheKey: string, filePath: string): Promise<boolean> {
  const currentFileHash = await this.getFileContextHash(filePath);
  const cachedFileHash = this.cacheAdapter.get<string>(`${cacheKey}:file_hash`);
  
  // 如果文件哈希发生变化，需要失效缓存
  if (cachedFileHash && cachedFileHash !== currentFileHash) {
    return true;
  }
  
  return false;
}
```

### 5. 集成测试示例

```typescript
// 在现有的测试文件中添加哈希碰撞测试
describe('hashAST method', () => {
  test('不同节点应产生不同哈希', () => {
    const node1 = { 
      text: 'function test() {}', 
      startPosition: { row: 1, column: 0 }, 
      endPosition: { row: 1, column: 16 }, 
      type: 'function_declaration',
      id: '1'
    };
    
    const node2 = { 
      text: 'function test() {}', 
      startPosition: { row: 2, column: 0 }, 
      endPosition: { row: 2, column: 16 }, 
      type: 'function_declaration',
      id: '2'
    };
    
    const hash1 = normalizer.hashAST(node1 as any);
    const hash2 = normalizer.hashAST(node2 as any);
    
    expect(hash1).not.toEqual(hash2);
    expect(hash1.length).toBe(64); // SHA-256哈希长度
    expect(hash2.length).toBe(64);
  });

  test('相同节点应产生相同哈希', () => {
    const node = { 
      text: 'const x = 1;', 
      startPosition: { row: 1, column: 0 }, 
      endPosition: { row: 1, column: 11 }, 
      type: 'variable_declaration',
      id: '3'
    };
    
    const hash1 = normalizer.hashAST(node as any);
    const hash2 = normalizer.hashAST(node as any);
    
    expect(hash1).toEqual(hash2);
  });

  test('内容变化应产生不同哈希', () => {
    const node1 = { 
      text: 'const x = 1;', 
      startPosition: { row: 1, column: 0 }, 
      endPosition: { row: 1, column: 11 }, 
      type: 'variable_declaration',
      id: '4'
    };
    
    const node2 = { 
      text: 'const y = 2;', 
      startPosition: { row: 1, column: 0 }, 
      endPosition: { row: 1, column: 11 }, 
      type: 'variable_declaration',
      id: '5'
    };
    
    const hash1 = normalizer.hashAST(node1 as any);
    const hash2 = normalizer.hashAST(node2 as any);
    
    expect(hash1).not.toEqual(hash2);
  });
});
```

## 方案优势

1. **复用现有工具**：利用项目中已有的 [`HashUtils`](src/utils/HashUtils.ts) 类，避免重复造轮子
2. **加密安全**：使用真正的 SHA-256 哈希算法，而不是简化的版本
3. **信息完整**：包含所有相关的AST节点信息（内容、位置、类型、ID等）
4. **类型安全**：为不同分段类型提供差异化的哈希策略
5. **性能优化**：利用现有的缓存和性能监控基础设施
6. **易于测试**：提供全面的测试用例确保哈希功能的正确性

这个方案完全解决了原始问题中的哈希冲突风险，同时与项目现有的架构和工具链完美集成。