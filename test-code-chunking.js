const { UniversalTextSplitter } = require('./dist/service/parser/universal/UniversalTextSplitter');
const { LoggerService } = require('./dist/utils/LoggerService');

// 创建测试用的代码内容
const testCode = `
import { Component } from '@angular/core';

@Component({
  selector: 'app-test',
  template: '<div>Hello World</div>'
})
export class TestComponent {
  private title: string = 'Test';
  
  constructor() {}
  
  ngOnInit(): void {
    console.log('Component initialized');
  }
  
  private helperMethod(): void {
    const data = [1, 2, 3];
    return data.map(x => x * 2);
  }
}

// 另一个类
export class AnotherClass {
  private value: number = 42;
  
  public getValue(): number {
    return this.value;
  }
  
  public setValue(value: number): void {
    this.value = value;
  }
}

// 一些工具函数
export function utilityFunction1() {
  return "utility 1";
}

export function utilityFunction2() {
  return "utility 2";
}

// 一个很长的函数来测试内部切割
export function veryLongFunction() {
  const longArray = [];
  for (let i = 0; i < 1000; i++) {
    longArray.push({
      id: i,
      name: \`item_\${i}\`,
      description: \`This is a very long description for item \${i} that contains a lot of text to make the chunk very large so we can test internal splitting functionality\`,
      metadata: {
        created: new Date(),
        updated: new Date(),
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
        properties: {
          color: 'red',
          size: 'large',
          weight: 100,
          dimensions: {
            width: 10,
            height: 20,
            depth: 5
          }
        }
      }
    });
  }
  
  return longArray.filter(item => item.id % 2 === 0);
}
`;

const pythonCode = `
import os
import sys
from typing import List, Dict

def main():
    """Main function"""
    print("Hello, World!")
    
    data = process_data([1, 2, 3, 4, 5])
    print(f"Processed: {data}")

def process_data(items: List[int]) -> List[int]:
    """Process the input data"""
    return [item * 2 for item in items]

class DataProcessor:
    def __init__(self, name: str):
        self.name = name
    
    def process(self, items: List[int]) -> Dict[str, int]:
        return {
            'count': len(items),
            'sum': sum(items)
        }

if __name__ == "__main__":
    main()
`;

const markdownContent = `
# Main Title

This is a paragraph with some content.

## Section 1

Some content for section 1.

### Subsection 1.1

More detailed content here.

## Section 2

Content for section 2.

\`\`\`javascript
const code = "example";
function test() {
  return code;
}
\`\`\`

### Subsection 2.1

Even more content.
`;

async function testChunking() {
  console.log('测试代码分块逻辑 - 无重叠除非超过最大限制...\n');

  const logger = new LoggerService();
  const splitter = new UniversalTextSplitter(logger);

  // 设置较小的块大小以便测试
  splitter.setOptions({
    maxChunkSize: 800,  // 较小的块大小
    overlapSize: 100,   // 重叠大小
    maxLinesPerChunk: 20,
    maxOverlapRatio: 0.3, // 最大重叠比例
    enableBracketBalance: true,
    enableSemanticDetection: true
  });

  console.log('=== 测试 TypeScript 代码文件 ===');
  const tsChunks = splitter.chunkBySemanticBoundaries(testCode, 'test.ts', 'typescript');
  console.log(`TypeScript 分块数量: ${tsChunks.length}`);

  // 检查重叠情况
  let hasOverlap = false;
  let totalOverlapLines = 0;

  for (let i = 0; i < tsChunks.length - 1; i++) {
    const currentChunk = tsChunks[i].content;
    const nextChunk = tsChunks[i + 1].content;

    // 检查重叠
    const overlap = findOverlap(currentChunk, nextChunk);
    if (overlap.length > 0) {
      hasOverlap = true;
      totalOverlapLines += overlap.length;
      console.log(`分块 ${i} 和 ${i + 1} 之间有重叠: ${overlap.length} 行`);
      console.log(`重叠内容示例: "${overlap[0] || ''}"`);
    }
  }

  if (!hasOverlap) {
    console.log('✓ 未检测到 TypeScript 分块间的重叠');
  } else {
    console.log(`✓ 检测到重叠，总共 ${totalOverlapLines} 行重叠`);
  }

  // 检查块大小
  console.log('\n分块大小分析:');
  let oversizedChunks = 0;
  for (let i = 0; i < tsChunks.length; i++) {
    const chunk = tsChunks[i];
    const size = chunk.content.length;
    console.log(`分块 ${i}: ${size} 字符, 行 ${chunk.metadata.startLine}-${chunk.metadata.endLine}`);

    if (size > 900) { // 接近最大限制
      oversizedChunks++;
      console.log(`  ⚠️  大分块检测到: ${size} 字符`);
    }
  }

  if (oversizedChunks > 0) {
    console.log(`✓ ${oversizedChunks} 个分块接近大小限制，可能触发了重叠拆分`);
  }

  console.log('\n=== 测试 Python 代码文件 ===');
  const pyChunks = splitter.chunkBySemanticBoundaries(pythonCode, 'test.py', 'python');
  console.log(`Python 分块数量: ${pyChunks.length}`);

  // 检查Python代码的重叠
  hasOverlap = false;
  totalOverlapLines = 0;

  for (let i = 0; i < pyChunks.length - 1; i++) {
    const currentChunk = pyChunks[i].content;
    const nextChunk = pyChunks[i + 1].content;

    const overlap = findOverlap(currentChunk, nextChunk);
    if (overlap.length > 0) {
      hasOverlap = true;
      totalOverlapLines += overlap.length;
    }
  }

  if (!hasOverlap) {
    console.log('✓ 未检测到 Python 分块间的重叠');
  } else {
    console.log(`✓ 检测到重叠，总共 ${totalOverlapLines} 行重叠`);
  }

  console.log('\n=== 测试 Markdown 文件 ===');
  const mdChunks = splitter.chunkBySemanticBoundaries(markdownContent, 'test.md', 'markdown');
  console.log(`Markdown 分块数量: ${mdChunks.length}`);

  // Markdown应该仍然有重叠
  hasOverlap = false;
  totalOverlapLines = 0;

  for (let i = 0; i < mdChunks.length - 1; i++) {
    const currentChunk = mdChunks[i].content;
    const nextChunk = mdChunks[i + 1].content;

    const overlap = findOverlap(currentChunk, nextChunk);
    if (overlap.length > 0) {
      hasOverlap = true;
      totalOverlapLines += overlap.length;
    }
  }

  if (hasOverlap) {
    console.log(`✓ Markdown 分块检测到重叠，总共 ${totalOverlapLines} 行重叠 (预期行为)`);
  } else {
    console.log('! Markdown 分块未检测到重叠 (非预期)');
  }

  console.log('\n=== 测试超大代码块的重叠处理 ===');

  // 创建一个超大的代码块
  const largeCode = `
function processLargeData() {
  const largeArray = [];
  ${Array(200).fill(0).map((_, i) =>
    `  largeArray.push({
    id: ${i},
    name: "item_${i}",
    description: "This is a very long description that contains lots of text to make the chunk exceed the maximum size limit and trigger overlap processing",
    data: { value: ${i * 10}, category: "test", status: "active", metadata: { created: new Date(), updated: new Date() } }
  });`).join('\n')}
  
  return largeArray.filter(item => item.id % 2 === 0);
}
`;

  const largeChunks = splitter.chunkBySemanticBoundaries(largeCode, 'large.ts', 'typescript');
  console.log(`大代码块分块数量: ${largeChunks.length}`);

  // 分析大代码块的重叠情况
  if (largeChunks.length > 1) {
    console.log('✓ 超大代码块被正确拆分为多个分块');

    hasOverlap = false;
    for (let i = 0; i < largeChunks.length - 1; i++) {
      const overlap = findOverlap(largeChunks[i].content, largeChunks[i + 1].content);
      if (overlap.length > 0) {
        hasOverlap = true;
        console.log(`分块 ${i} 和 ${i + 1} 之间有 ${overlap.length} 行重叠`);
      }
    }

    if (hasOverlap) {
      console.log('✓ 超大代码块拆分使用了重叠策略');
    } else {
      console.log('! 超大代码块拆分未使用重叠策略');
    }
  }

  console.log('\n=== 测试不同的分块方法 ===');

  // 测试括号平衡方法
  console.log('测试 chunkByBracketsAndLines...');
  const bracketChunks = splitter.chunkByBracketsAndLines(testCode, 'test.ts', 'typescript');
  console.log(`括号平衡分块: ${bracketChunks.length}`);

  // 测试简单行数方法
  console.log('测试 chunkByLines...');
  const lineChunks = splitter.chunkByLines(testCode, 'test.ts', 'typescript');
  console.log(`行数分块: ${lineChunks.length}`);

  console.log('\n=== 测试总结 ===');
  console.log('代码文件 (TypeScript, Python) 应该具有:');
  console.log('- 正常情况下分块间无重叠');
  console.log('- 当分块超过最大限制时使用重叠进行内部拆分');
  console.log('- 保持代码结构完整性');
  console.log('');
  console.log('Markdown 文件应该具有:');
  console.log('- 分块间有重叠 (用于上下文)');
  console.log('- 基于标题/结构的语义分块');
}

// 辅助函数：查找两个文本块之间的重叠
function findOverlap(text1, text2) {
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  const overlap = [];

  // 检查text1末尾与text2开头的重叠
  const maxOverlap = Math.min(lines1.length, lines2.length, 10); // 最多检查10行

  for (let i = 1; i <= maxOverlap; i++) {
    const endLines = lines1.slice(-i);
    const startLines = lines2.slice(0, i);

    if (JSON.stringify(endLines) === JSON.stringify(startLines)) {
      overlap.push(...endLines);
    }
  }

  return overlap;
}

// 运行测试
testChunking().catch(console.error);