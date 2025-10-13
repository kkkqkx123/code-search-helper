import { ASTCodeSplitter } from '../ASTCodeSplitter';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { LoggerService } from '../../../../utils/LoggerService';
import { CodeChunk } from '../Splitter';

// 模拟 TreeSitterService
class MockTreeSitterService {
  async parse(content: string, language: string) {
    // 返回模拟的AST结构
    return {
      rootNode: {
        type: 'program',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: content.split('\n').length - 1, column: 0 },
        children: this.generateMockNodes(content, language)
      }
    };
  }

  private generateMockNodes(content: string, language: string) {
    const lines = content.split('\n');
    const nodes = [];
    
    // 模拟Go语言的struct定义
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('package ')) {
        nodes.push({
          type: 'package_declaration',
          startPosition: { row: i, column: 0 },
          endPosition: { row: i, column: line.length },
          children: []
        });
      } else if (line.startsWith('type ') && line.includes('struct')) {
        // 找到struct的结束位置
        let braceCount = 0;
        let endLine = i;
        
        for (let j = i; j < lines.length; j++) {
          const currentLine = lines[j];
          braceCount += (currentLine.match(/\{/g) || []).length;
          braceCount -= (currentLine.match(/\}/g) || []).length;
          
          if (braceCount === 0 && j > i) {
            endLine = j;
            break;
          }
        }
        
        nodes.push({
          type: 'type_declaration',
          startPosition: { row: i, column: 0 },
          endPosition: { row: endLine, column: lines[endLine].length },
          children: []
        });
      }
    }
    
    return nodes;
  }
}

describe('Real World Duplicate Fix - Go Struct Problem', () => {
  let astSplitter: ASTCodeSplitter;
  let mockTreeSitterService: MockTreeSitterService;
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService();
    mockTreeSitterService = new MockTreeSitterService() as any;
    astSplitter = new ASTCodeSplitter(mockTreeSitterService as any, logger);
  });

  test('should not create duplicate chunks for Go struct definition', async () => {
    const goContent = `package main

type Node struct {
    data       int
    leftChild  *Node
    rightChild *Node
}

type Tree struct {
}`;

    const chunks = await astSplitter.split(goContent, 'test.go', 'go');
    
    console.log('Generated chunks:', chunks.length);
    chunks.forEach((chunk, index) => {
      console.log(`Chunk ${index + 1}:`, {
        type: chunk.metadata?.type,
        startLine: chunk.metadata?.startLine,
        endLine: chunk.metadata?.endLine,
        content: chunk.content.trim().substring(0, 50) + '...'
      });
    });

    // 检查重复内容
    const contentSet = new Set<string>();
    const duplicates: string[] = [];
    
    chunks.forEach(chunk => {
      const normalizedContent = chunk.content.trim();
      if (contentSet.has(normalizedContent)) {
        duplicates.push(normalizedContent);
      } else {
        contentSet.add(normalizedContent);
      }
    });

    // 断言：不应该有重复内容
    expect(duplicates.length).toBe(0);
    expect(contentSet.size).toBe(chunks.length);

    // 检查相似内容（相似度>0.9）
    const similarPairs: Array<{index1: number, index2: number, similarity: number}> = [];
    
    for (let i = 0; i < chunks.length; i++) {
      for (let j = i + 1; j < chunks.length; j++) {
        const similarity = calculateSimilarity(chunks[i].content, chunks[j].content);
        if (similarity > 0.9) {
          similarPairs.push({index1: i, index2: j, similarity});
        }
      }
    }

    // 不应该有高相似度的块
    expect(similarPairs.length).toBeLessThanOrEqual(1); // 允许少量相似但不完全相同的块
  });

  test('should handle complex Go file with multiple types', async () => {
    const complexGoContent = `package main

import "fmt"

type Node struct {
    data       int
    leftChild  *Node
    rightChild *Node
}

type Tree struct {
    root *Node
}

func (t *Tree) Insert(value int) {
    // Insert logic here
}

func (n *Node) Print() {
    fmt.Println(n.data)
}`;

    const chunks = await astSplitter.split(complexGoContent, 'complex.go', 'go');
    
    // 分析结果
    const contentSet = new Set<string>();
    const duplicates: string[] = [];
    
    chunks.forEach(chunk => {
      const normalizedContent = chunk.content.trim();
      if (contentSet.has(normalizedContent)) {
        duplicates.push(normalizedContent);
      } else {
        contentSet.add(normalizedContent);
      }
    });

    // 不应该有完全重复的内容
    expect(duplicates.length).toBe(0);
    
    // 检查相似度
    const similarPairs = findSimilarPairs(chunks, 0.85);
    expect(similarPairs.length).toBeLessThanOrEqual(2); // 允许少量相似
  });

  test('should demonstrate the fix for overlapping partial chunks', async () => {
    // 这是用户报告的具体问题案例
    const problematicContent = `package main

type Node struct {
    data       int
    leftChild  *Node
    rightChild *Node
}

type Tree struct {
}`;

    const chunks = await astSplitter.split(problematicContent, 'problematic.go', 'go');
    
    // 记录详细的块信息
    console.log('\n=== 详细块分析 ===');
    chunks.forEach((chunk, index) => {
      console.log(`块 ${index + 1}:`);
      console.log(`  类型: ${chunk.metadata?.type}`);
      console.log(`  位置: ${chunk.metadata?.startLine}-${chunk.metadata?.endLine}`);
      console.log(`  内容: "${chunk.content.trim()}"`);
      console.log(`  长度: ${chunk.content.length}`);
      console.log('');
    });

    // 验证没有重叠的struct定义
    const structChunks = chunks.filter(chunk => 
      chunk.content.includes('type Node struct') || 
      chunk.content.includes('type Tree struct')
    );

    // 每个struct应该只被分割一次
    const nodeStructChunks = structChunks.filter(chunk => chunk.content.includes('type Node struct'));
    const treeStructChunks = structChunks.filter(chunk => chunk.content.includes('type Tree struct'));

    expect(nodeStructChunks.length).toBeLessThanOrEqual(1);
    expect(treeStructChunks.length).toBeLessThanOrEqual(1);

    // 验证没有部分重叠的struct块
    const partialStructChunks = chunks.filter(chunk => {
      const content = chunk.content.trim();
      return (content.includes('data       int') || 
              content.includes('leftChild  *Node') || 
              content.includes('rightChild *Node')) &&
             !content.includes('type Node struct');
    });

    // 不应该有部分struct块，除非它们是合法的子结构
    expect(partialStructChunks.length).toBe(0);
  });
});

// 辅助函数
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

function findSimilarPairs(chunks: CodeChunk[], threshold: number): Array<{index1: number, index2: number, similarity: number}> {
  const similarPairs: Array<{index1: number, index2: number, similarity: number}> = [];
  
  for (let i = 0; i < chunks.length; i++) {
    for (let j = i + 1; j < chunks.length; j++) {
      const similarity = calculateSimilarity(chunks[i].content, chunks[j].content);
      if (similarity > threshold) {
        similarPairs.push({index1: i, index2: j, similarity});
      }
    }
  }
  
  return similarPairs;
}