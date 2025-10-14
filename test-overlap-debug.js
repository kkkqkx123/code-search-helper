const { UniversalTextSplitter } = require('./dist/service/parser/universal/UniversalTextSplitter');
const { LoggerService } = require('./dist/utils/LoggerService');

// 创建一个明确超过大小限制的超大代码块
const oversizedCode = `
function processLargeData() {
  const largeArray = [];
  ${Array(300).fill(0).map((_, i) => 
    `  largeArray.push({
    id: ${i},
    name: "item_${i}",
    description: "This is a very long description that contains lots of text to make the chunk exceed the maximum size limit and trigger overlap processing. This description is intentionally made very long to test the overlap functionality when chunks are split due to size constraints.",
    data: { value: ${i * 10}, category: "test", status: "active", metadata: { created: new Date(), updated: new Date(), index: ${i} } }
  });`).join('\n')}
  
  return largeArray.filter(item => item.id % 2 === 0);
}
`;

// 创建一个较小的markdown内容来测试重叠
const smallMarkdown = `
# Title

This is paragraph 1 with some content to test overlap functionality.

## Section 1

This is paragraph 2 with more content for testing.

### Subsection

This is paragraph 3 with additional content.

## Section 2

This is paragraph 4 with final content.
`;

async function debugOverlap() {
  console.log('=== 调试重叠功能 ===\n');
  
  const logger = new LoggerService();
  const splitter = new UniversalTextSplitter(logger);
  
  // 设置较小的块大小以便测试重叠
  splitter.setOptions({
    maxChunkSize: 500,  // 较小的块大小确保触发重叠
    overlapSize: 100,   // 重叠大小
    maxLinesPerChunk: 15,
    maxOverlapRatio: 0.3,
    enableBracketBalance: true,
    enableSemanticDetection: true
  });

  console.log('1. 测试超大代码块的重叠处理:');
  console.log(`代码大小: ${oversizedCode.length} 字符`);
  console.log(`最大块大小: 500 字符`);
  console.log(`预期: 应该被拆分为多个块，且块间有重叠\n`);

  const largeChunks = splitter.chunkBySemanticBoundaries(oversizedCode, 'large.ts', 'typescript');
  console.log(`实际分块数量: ${largeChunks.length}`);
  
  if (largeChunks.length > 1) {
    console.log('分块大小分析:');
    largeChunks.forEach((chunk, i) => {
      console.log(`  分块 ${i}: ${chunk.content.length} 字符`);
    });
    
    // 检查重叠
    console.log('\n重叠分析:');
    let totalOverlap = 0;
    for (let i = 0; i < largeChunks.length - 1; i++) {
      const currentLines = largeChunks[i].content.split('\n');
      const nextLines = largeChunks[i + 1].content.split('\n');
      
      // 查找重叠行
      let overlapCount = 0;
      for (let j = Math.max(0, currentLines.length - 5); j < currentLines.length; j++) {
        for (let k = 0; k < Math.min(5, nextLines.length); k++) {
          if (currentLines[j] === nextLines[k] && currentLines[j].trim() !== '') {
            overlapCount++;
          }
        }
      }
      
      if (overlapCount > 0) {
        totalOverlap += overlapCount;
        console.log(`  分块 ${i} -> ${i + 1}: ${overlapCount} 行重叠`);
      }
    }
    
    if (totalOverlap === 0) {
      console.log('  ⚠️  未检测到重叠');
    } else {
      console.log(`  ✓ 总重叠行数: ${totalOverlap}`);
    }
  }

  console.log('\n2. 测试Markdown文件的重叠:');
  console.log(`Markdown大小: ${smallMarkdown.length} 字符`);
  console.log(`预期: 应该有多个分块且分块间有重叠\n`);

  const mdChunks = splitter.chunkBySemanticBoundaries(smallMarkdown, 'test.md', 'markdown');
  console.log(`实际分块数量: ${mdChunks.length}`);
  
  if (mdChunks.length > 1) {
    console.log('分块大小分析:');
    mdChunks.forEach((chunk, i) => {
      console.log(`  分块 ${i}: ${chunk.content.length} 字符`);
    });
    
    // 检查重叠
    console.log('\n重叠分析:');
    let totalOverlap = 0;
    for (let i = 0; i < mdChunks.length - 1; i++) {
      const currentLines = mdChunks[i].content.split('\n');
      const nextLines = mdChunks[i + 1].content.split('\n');
      
      // 查找重叠行
      let overlapCount = 0;
      for (let j = Math.max(0, currentLines.length - 3); j < currentLines.length; j++) {
        for (let k = 0; k < Math.min(3, nextLines.length); k++) {
          if (currentLines[j] === nextLines[k] && currentLines[j].trim() !== '') {
            overlapCount++;
          }
        }
      }
      
      if (overlapCount > 0) {
        totalOverlap += overlapCount;
        console.log(`  分块 ${i} -> ${i + 1}: ${overlapCount} 行重叠`);
      }
    }
    
    if (totalOverlap === 0) {
      console.log('  ⚠️  未检测到重叠');
    } else {
      console.log(`  ✓ 总重叠行数: ${totalOverlap}`);
    }
  } else {
    console.log('  ⚠️  Markdown只生成了一个分块，无法测试重叠');
  }

  console.log('\n3. 检查分块阈值设置:');
  console.log(`当前最大块大小: ${splitter.options.maxChunkSize}`);
  console.log(`当前重叠大小: ${splitter.options.overlapSize}`);
  console.log(`当前最大重叠比例: ${splitter.options.maxOverlapRatio || 0.3}`);
  
  // 检查是否有块接近大小限制
  console.log('\n4. 检查接近大小限制的块:');
  const allChunks = [...largeChunks, ...mdChunks];
  let nearLimitCount = 0;
  allChunks.forEach((chunk, i) => {
    const ratio = chunk.content.length / splitter.options.maxChunkSize;
    if (ratio > 0.8) {
      nearLimitCount++;
      console.log(`  分块 ${i}: ${chunk.content.length} 字符 (${(ratio * 100).toFixed(1)}% 限制)`);
    }
  });
  
  if (nearLimitCount === 0) {
    console.log('  没有分块接近大小限制');
  }
}

// 运行调试
debugOverlap().catch(console.error);