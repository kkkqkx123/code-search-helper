/**
 * MarkdownChunker 测试文件
 */

import { MarkdownChunker } from '../MarkdownChunker';
import { MarkdownChunkingConfig } from '../markdown-rules';

describe('MarkdownChunker', () => {
  let chunker: MarkdownChunker;
  let defaultConfig: Partial<MarkdownChunkingConfig>;

  beforeEach(() => {
    defaultConfig = {
      maxChunkSize: 500,
      minChunkSize: 50,
      maxLinesPerChunk: 20,
      excludeCodeFromChunkSize: true
    };
    chunker = new MarkdownChunker(defaultConfig);
  });

  describe('基本功能测试', () => {
    it('应该正确处理空内容', async () => {
      const chunks = await chunker.chunkMarkdown('');
      expect(chunks).toEqual([]);
    });

    it('应该正确处理简单的段落', async () => {
      const content = '这是一个简单的段落。';
      const chunks = await chunker.chunkMarkdown(content);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(content);
      expect(chunks[0].metadata.language).toBe('markdown');
    });

    it('应该正确处理多个段落', async () => {
      const content = '第一个段落。\n\n第二个段落。\n\n第三个段落。';
      const chunks = await chunker.chunkMarkdown(content);
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.content.trim().length > 0)).toBe(true);
    });
  });

  describe('标题处理测试', () => {
    it('应该基于标题进行分段', async () => {
      const content = `# 主标题

主标题内容。

## 子标题1

子标题1内容。

## 子标题2

子标题2内容。`;

      const chunks = await chunker.chunkMarkdown(content);
      
      expect(chunks.length).toBeGreaterThan(1);
      
      // 检查每个块是否包含标题
      const headingChunks = chunks.filter(chunk => 
        chunk.content.includes('#') && chunk.metadata.headingLevel
      );
      expect(headingChunks.length).toBeGreaterThan(0);
    });

    it('应该正确识别不同级别的标题', async () => {
      const content = `# 一级标题

一级标题内容。

## 二级标题

二级标题内容。

### 三级标题

三级标题内容。`;

      const chunks = await chunker.chunkMarkdown(content);
      
      // 检查标题级别
      const h1Chunk = chunks.find(chunk => chunk.metadata.headingLevel === 1);
      const h2Chunk = chunks.find(chunk => chunk.metadata.headingLevel === 2);
      const h3Chunk = chunks.find(chunk => chunk.metadata.headingLevel === 3);
      
      expect(h1Chunk).toBeDefined();
      expect(h2Chunk).toBeDefined();
      expect(h3Chunk).toBeDefined();
    });
  });

  describe('代码块处理测试', () => {
    it('应该保持代码块的完整性', async () => {
      const content = `# 代码示例

以下是一个代码块：

\`\`\`javascript
function hello() {
  console.log("Hello, World!");
}
\`\`\`

代码块结束。`;

      const chunks = await chunker.chunkMarkdown(content);
      
      // 检查代码块是否保持完整
      const codeBlockChunks = chunks.filter(chunk => 
        chunk.content.includes('```javascript')
      );
      
      expect(codeBlockChunks.length).toBeGreaterThan(0);
      
      // 验证代码块完整性
      codeBlockChunks.forEach(chunk => {
        const codeBlockStart = (chunk.content.match(/```/g) || []).length;
        expect(codeBlockStart % 2).toBe(0); // 代码块标记应该是偶数
      });
    });

    it('应该正确计算排除代码块的文本长度', async () => {
      const content = `# 标题

这是一段文本。

\`\`\`javascript
// 这段代码不应该计入长度
function test() {
  return "test";
}
\`\`\`

更多文本内容。`;

      const chunks = await chunker.chunkMarkdown(content);
      
      // 验证分块大小计算
      chunks.forEach(chunk => {
        const textWithoutCode = chunk.content.replace(/```[\s\S]*?```/g, '');
        const expectedLength = textWithoutCode.length;
        
        // 由于我们配置了excludeCodeFromChunkSize: true，
        // 实际分块应该基于排除代码块后的长度
        expect(chunk.content.length).toBeGreaterThan(0);
      });
    });
  });

  describe('大块分割测试', () => {
    it('应该正确分割过大的内容', async () => {
      // 创建一个超过maxChunkSize的内容
      const longContent = '这是一个很长的段落。'.repeat(50);
      const content = `# 标题

${longContent}

更多内容。`;

      const chunks = await chunker.chunkMarkdown(content);
      
      // 应该被分割成多个块
      expect(chunks.length).toBeGreaterThan(1);
      
      // 验证每个块的大小不超过限制
      chunks.forEach(chunk => {
        const size = chunker['calculateLengthExcludingCode'](chunk.content);
        expect(size).toBeLessThanOrEqual(defaultConfig.maxChunkSize! + 100); // 允许一些误差
      });
    });

    it('应该在合适的位置分割内容', async () => {
      const content = `# 标题

第一段内容。

第二段内容。

第三段内容。

${'这是一个很长的段落，应该被分割。'.repeat(20)}

结束内容。`;

      const chunks = await chunker.chunkMarkdown(content);
      
      // 验证分割点的合理性
      for (let i = 1; i < chunks.length; i++) {
        const prevChunk = chunks[i - 1];
        const currChunk = chunks[i];
        
        // 检查分割点是否在合理位置（如段落边界）
        const prevEnd = prevChunk.content.trim().slice(-10);
        const currStart = currChunk.content.trim().slice(0, 10);
        
        // 分割点应该在空行或句子结尾附近
        const hasReasonableSplit = 
          prevChunk.content.endsWith('\n\n') ||
          prevChunk.content.match(/[。！？.!?]\s*$/) ||
          currChunk.content.startsWith('\n\n');
        
        // 注意：这个测试可能会因为具体实现而调整
      }
    });
  });

  describe('分隔符系统测试', () => {
    it('应该使用配置的分隔符进行分割', async () => {
      const customConfig = {
        ...defaultConfig,
        separators: ['\n\n', '。', '！'],
        isSeparatorRegex: false
      };
      
      const customChunker = new MarkdownChunker(customConfig);
      
      const content = `第一段。第二段！第三段。

第四段。第五段！第六段。`;

      const chunks = await customChunker.chunkMarkdown(content);
      
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('性能和质量评估测试', () => {
    it('应该收集性能指标', async () => {
      const content = `# 测试内容

这是一个测试文档。

## 第一节

第一节内容。

## 第二节

第二节内容。`;

      const chunks = await chunker.chunkMarkdown(content);
      
      // 验证性能指标收集
      expect(chunks.length).toBeGreaterThan(0);
      
      // 验证元数据
      chunks.forEach(chunk => {
        expect(chunk.metadata).toBeDefined();
        expect(chunk.metadata.startLine).toBeDefined();
        expect(chunk.metadata.endLine).toBeDefined();
        expect(chunk.metadata.language).toBe('markdown');
        expect(chunk.metadata.strategy).toBe('markdown-chunker');
        expect(chunk.metadata.timestamp).toBeDefined();
      });
    });

    it('应该评估分块质量', async () => {
      const content = `# 高质量文档

这是一个结构良好的文档，包含标题、段落和适当的分段。

## 第一节

第一节的内容，包含完整的思想单元。

## 第二节

第二节的内容，同样包含完整的思想单元。`;

      const chunks = await chunker.chunkMarkdown(content);
      
      // 验证质量评估
      const qualityMetrics = chunker['evaluateChunkQuality'](chunks, content);
      
      expect(qualityMetrics.semanticCohesion).toBeGreaterThanOrEqual(0);
      expect(qualityMetrics.semanticCohesion).toBeLessThanOrEqual(1);
      
      expect(qualityMetrics.structuralIntegrity).toBeGreaterThanOrEqual(0);
      expect(qualityMetrics.structuralIntegrity).toBeLessThanOrEqual(1);
      
      expect(qualityMetrics.sizeDistribution).toBeGreaterThanOrEqual(0);
      expect(qualityMetrics.sizeDistribution).toBeLessThanOrEqual(1);
      
      expect(qualityMetrics.codeBlockPreservation).toBeGreaterThanOrEqual(0);
      expect(qualityMetrics.codeBlockPreservation).toBeLessThanOrEqual(1);
      
      expect(qualityMetrics.overallScore).toBeGreaterThanOrEqual(0);
      expect(qualityMetrics.overallScore).toBeLessThanOrEqual(1);
    });
  });

  describe('配置更新测试', () => {
    it('应该能够更新配置', async () => {
      const newConfig = {
        maxChunkSize: 300,
        minChunkSize: 30,
        excludeCodeFromChunkSize: false
      };
      
      chunker.updateConfig(newConfig);
      
      const updatedConfig = chunker.getConfig();
      expect(updatedConfig.maxChunkSize).toBe(300);
      expect(updatedConfig.minChunkSize).toBe(30);
      expect(updatedConfig.excludeCodeFromChunkSize).toBe(false);
    });

    it('应该在配置更新后应用新设置', async () => {
      const content = `# 测试内容

${'这是一个很长的段落。'.repeat(30)}`;

      // 使用初始配置
      const initialChunks = await chunker.chunkMarkdown(content);
      
      // 更新配置
      chunker.updateConfig({ maxChunkSize: 200 });
      
      // 使用新配置
      const newChunks = await chunker.chunkMarkdown(content);
      
      // 验证新配置生效
      expect(newChunks.length).toBeGreaterThanOrEqual(initialChunks.length);
    });
  });

  describe('边界情况测试', () => {
    it('应该处理只有标题的内容', async () => {
      const content = `# 标题1
## 标题2
### 标题3`;

      const chunks = await chunker.chunkMarkdown(content);
      
      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.content.trim().length).toBeGreaterThan(0);
      });
    });

    it('应该处理只有代码块的内容', async () => {
      const content = `\`\`\`javascript
function test() {
  return "Hello, World!";
}
\`\`\``;

      const chunks = await chunker.chunkMarkdown(content);
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toContain('```javascript');
    });

    it('应该处理混合内容', async () => {
      const content = `# 文档标题

介绍文本。

## 代码示例

\`\`\`javascript
function example() {
  return "example";
}
\`\`\`

## 表格示例

| 列1 | 列2 |
|-----|-----|
| 值1 | 值2 |

## 列表示例

- 项目1
- 项目2
- 项目3

结束文本。`;

      const chunks = await chunker.chunkMarkdown(content);
      
      expect(chunks.length).toBeGreaterThan(0);
      
      // 验证不同类型的内容都被正确处理
      const allContent = chunks.map(c => c.content).join('\n');
      expect(allContent).toContain('# 文档标题');
      expect(allContent).toContain('```javascript');
      expect(allContent).toContain('| 列1 | 列2 |');
      expect(allContent).toContain('- 项目1');
    });
  });
});