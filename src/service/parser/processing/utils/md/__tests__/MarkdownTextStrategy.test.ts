import { MarkdownTextStrategy } from '../MarkdownTextStrategy';
import { MarkdownChunkingConfig } from '../markdown-rules';

describe('MarkdownTextStrategy - 标题块单向合并', () => {
  let strategy: MarkdownTextStrategy;
  let testConfig: MarkdownChunkingConfig;
  let mockLogger: any;

  beforeEach(() => {
    // 创建模拟logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    testConfig = {
      minChunkSize: 100,
      maxChunkSize: 500,
      maxLinesPerChunk: 20,
      mergeWithHeading: true,
      headingLevelWeights: [10, 8, 6, 4, 2, 1],
      allowBackwardHeadingMerge: false, // 关键配置：不允许标题块与前面的内容合并
      preserveCodeBlocks: true,
      preserveTables: true,
      preserveLists: true,
      preserveStructureIntegrity: true,
      mergeConsecutiveHeadings: true,
      mergeShortParagraphs: true,
      enableSemanticMerge: true,
      semanticSimilarityThreshold: 0.7,
      overlapSize: 100,
      enableOverlap: true
    };
    strategy = new MarkdownTextStrategy(mockLogger, testConfig);
  });

  test('标题块应该只与后面的内容合并，不与前面的内容合并', async () => {
    const content = `# 主标题

这是主标题的内容。

## 子标题1

这是子标题1的内容。

## 子标题2

这是子标题2的内容。`;

    const chunks = await strategy.chunkMarkdown(content, 'test.md');

    // 验证标题块没有与前面的内容合并
    expect(chunks.length).toBeGreaterThan(0);

    // 检查第一个块是否包含主标题和其内容
    const firstChunk = chunks[0];
    expect(firstChunk.content).toContain('# 主标题');
    expect(firstChunk.content).toContain('这是主标题的内容');

    // 检查第二个块是否包含子标题1和其内容
    if (chunks.length > 1) {
      const secondChunk = chunks[1];
      expect(secondChunk.content).toContain('## 子标题1');
      expect(secondChunk.content).toContain('这是子标题1的内容');
    }
  });

  test('大块代码块应该被智能拆分', async () => {
    // 创建一个大的代码块，确保超过最大大小限制
    const longCode = `
function test1() {
  console.log('test1');
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
}

function test2() {
  console.log('test2');
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
}

function test3() {
  console.log('test3');
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
}

function test4() {
  console.log('test4');
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
}

function test5() {
  console.log('test5');
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
}

function test6() {
  console.log('test6');
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
}

function test7() {
  console.log('test7');
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
}

function test8() {
  console.log('test8');
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
}

function test9() {
  console.log('test9');
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
}

function test10() {
  console.log('test10');
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
  // 这是一个很长的注释，用来增加代码块的长度
}`;

    const content = `# 代码示例

以下是一个大的代码块：

\`\`\`javascript${longCode}
\`\`\`

代码结束。`;

    const chunks = await strategy.chunkMarkdown(content, 'test.md');

    // 验证代码块被拆分
    const codeChunks = chunks.filter(chunk => chunk.metadata.type === 'code');
    
    // 输出调试信息
    console.log('=== 大块代码块拆分测试调试信息 ===');
    console.log('Total chunks:', chunks.length);
    console.log('Code chunks:', codeChunks.length);
    chunks.forEach((chunk, index) => {
      console.log(`Chunk ${index + 1}: type=${chunk.metadata.type}, size=${chunk.content.length}`);
      console.log(` Content preview: ${chunk.content.substring(0, 100)}...`);
    });
    codeChunks.forEach((chunk, index) => {
      console.log(`Code chunk ${index + 1} length:`, chunk.content.length);
    });

    expect(codeChunks.length).toBeGreaterThan(1); // 应该被拆分成多个块
  });

  test('表格应该被智能拆分', async () => {
    // 创建一个大的表格
    const tableRows = Array.from({ length: 50 }, (_, i) =>
      `| 行${i + 1} | 数据${i + 1} | 描述${i + 1} |`
    ).join('\n');

    const content = `# 表格示例

| 列1 | 列2 | 列3 |
|-----|-----|-----|
${tableRows}`;

    const chunks = await strategy.chunkMarkdown(content, 'test.md');

    // 验证表格被拆分
    const tableChunks = chunks.filter(chunk => chunk.content.includes('|'));
    expect(tableChunks.length).toBeGreaterThan(1); // 应该被拆分成多个块
  });

  test('列表应该被智能拆分', async () => {
    // 创建一个大的列表
    const listItems = Array.from({ length: 30 }, (_, i) =>
      `- 列表项${i + 1}`
    ).join('\n');

    const content = `# 列表示例

${listItems}`;

    const chunks = await strategy.chunkMarkdown(content, 'test.md');

    // 验证列表被拆分
    const listChunks = chunks.filter(chunk => chunk.content.includes('- 列表项'));
    expect(listChunks.length).toBeGreaterThan(1); // 应该被拆分成多个块
  });

  test('标题块前面不应该添加重叠', async () => {
    const content = `# 第一个标题

内容1

# 第二个标题

内容2`;

    const chunks = await strategy.chunkMarkdown(content, 'test.md');

    // 验证标题块前面没有重叠内容
    for (let i = 1; i < chunks.length; i++) {
      const currentChunk = chunks[i];
      if (currentChunk.metadata.type === 'heading') {
        // 检查前一个块的内容是否没有重复到当前块中
        const prevChunk = chunks[i - 1];
        // 简单检查：如果当前块以标题开头，说明没有重叠
        expect(currentChunk.content.trim().startsWith('#')).toBe(true);
      }
    }
  });

  test('标题层级权重差异过大时不应该合并', async () => {
    const content = `# H1 标题

H1内容

###### H6 标题

H6内容`;

    // 启用调试日志
    const debugCalls = (mockLogger.debug as jest.Mock).mock.calls;
    
    const chunks = await strategy.chunkMarkdown(content, 'test.md');

    // 输出调试信息
    console.log('Total chunks:', chunks.length);
    chunks.forEach((chunk, index) => {
      console.log(`Chunk ${index + 1}:`, chunk.content);
      console.log(`Chunk ${index + 1} type:`, chunk.metadata.type);
    });

    // 输出调试日志
    console.log('Debug calls:', debugCalls.length);
    debugCalls.forEach((call, index) => {
      console.log(`Debug ${index + 1}:`, call[0]);
    });

    // 验证H1和H6标题没有被合并（权重差异过大）
    const h1Chunks = chunks.filter(chunk => chunk.content.includes('# H1 标题'));
    const h6Chunks = chunks.filter(chunk => chunk.content.includes('###### H6 标题'));
    
    console.log('H1 chunks:', h1Chunks.length);
    console.log('H6 chunks:', h6Chunks.length);
    
    // 应该在不同的块中
    expect(h1Chunks.length).toBe(1);
    expect(h6Chunks.length).toBe(1);
    expect(h1Chunks[0]).not.toBe(h6Chunks[0]);
  });
});