const fs = require('fs');
const path = require('path');

// 模拟ProcessingGuard的核心逻辑 - 更新版本
function detectLanguageIntelligently(filePath, content) {
  const ext = path.extname(filePath).toLowerCase();
  
  // 扩展名映射
  const LANGUAGE_MAP = {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.py': 'python',
    '.java': 'java',
    '.md': 'markdown',
    '.txt': 'text',
    '.json': 'json',
    '.yml': 'yaml',
    '.yaml': 'yaml'
  };
  
  if (ext) {
    const languageFromExt = LANGUAGE_MAP[ext] || 'unknown';
    
    // 对于markdown文件，检查内容
    if (languageFromExt === 'markdown') {
      // 简单的内容检测：检查是否有代码特征
      const hasCodeFeatures = content.includes('function') || 
                             content.includes('class') || 
                             content.includes('import') ||
                             content.includes('export') ||
                             content.includes('const') ||
                             content.includes('let');
      
      if (hasCodeFeatures) {
        // 进一步检测具体语言
        if (content.includes('import') && content.includes('from')) {
          return 'typescript';
        }
        if (content.includes('function') && content.includes('const')) {
          return 'javascript';
        }
      }
      
      return 'markdown';
    }
    
    return languageFromExt;
  }
  
  return 'text';
}

function selectProcessingStrategy(language) {
  // 代码语言使用精细分段
  const CODE_LANGUAGES = ['javascript', 'typescript', 'python', 'java'];
  // 文本类语言使用语义分段
  const TEXT_LANGUAGES = ['markdown', 'text', 'log', 'ini', 'cfg', 'conf', 'toml'];
  
  if (CODE_LANGUAGES.includes(language)) {
    return 'universal-semantic-fine'; // 使用更精细的分段
  }
  
  if (TEXT_LANGUAGES.includes(language)) {
    return 'universal-semantic';
  }
  
  return 'universal-line';
}

// 精细语义分段 - 模拟更小的分段参数
function chunkByFineSemantic(content, language) {
  console.log(`  使用精细语义分段策略`);
  
  const maxChunkSize = 800;  // 更小的块大小
  const maxLinesPerChunk = 20; // 更少的行数
  
  const lines = content.split('\n');
  const chunks = [];
  let currentChunk = [];
  let currentLine = 1;
  let semanticScore = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // 简化的语义分数计算
    let lineScore = line.length;
    
    // 语言特定的关键字权重
    if (language === 'typescript' || language === 'javascript') {
      if (line.match(/\b(function|class|interface|const|let|var|import|export)\b/)) lineScore += 10;
      if (line.match(/\b(if|else|while|for|switch|case|try|catch|finally)\b/)) lineScore += 5;
      if (line.match(/\b(return|break|continue|throw|new)\b/)) lineScore += 4;
    }
    
    // 通用结构复杂度
    lineScore += (line.match(/[{}]/g) || []).length * 3;
    lineScore += (line.match(/[()]/g) || []).length * 2;
    
    // 注释和空行降低语义密度
    if (line.match(/^\s*\/\//) || line.match(/^\s*\/\*/) || line.match(/^\s*\*/)) lineScore *= 0.3;
    if (line.trim() === '') lineScore = 1;
    
    semanticScore += lineScore;
    
    // 更精细的分段逻辑
    let shouldSplit = false;
    
    // 大小限制
    if (semanticScore > maxChunkSize * 0.6) { // 降低到60%阈值
      shouldSplit = true;
    }
    
    // 函数/类/方法定义结束
    if (trimmedLine.match(/^[}]\s*$/) && trimmedLine !== '}' && currentChunk.length > 0) {
      shouldSplit = true;
    }
    
    // 函数定义开始
    if (trimmedLine.match(/\b(function|class|async function|constructor)\b/) && currentChunk.length > 0) {
      shouldSplit = true;
    }
    
    // 方法定义开始（简化检测）
    if (trimmedLine.match(/^\s*(async\s+)?\w+\s*\([^)]*\)\s*[:{]/) && currentChunk.length > 0) {
      shouldSplit = true;
    }
    
    // 控制结构结束
    if (trimmedLine.match(/^\s*(}|\)|\]|;)\s*$/) && currentChunk.length > 3) {
      shouldSplit = true;
    }
    
    // 空行作为潜在分割点
    if (trimmedLine === '' && currentChunk.length > 3) {
      shouldSplit = true;
    }
    
    if (shouldSplit && currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
      currentChunk = [];
      currentLine = i + 1;
      semanticScore = 0;
    }
    
    currentChunk.push(line);
  }
  
  // 处理最后的chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }
  
  return chunks;
}

async function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const language = detectLanguageIntelligently(filePath, content);
  const strategy = selectProcessingStrategy(language);
  
  console.log(`\n文件: ${path.basename(filePath)}`);
  console.log(`检测到的语言: ${language}`);
  console.log(`处理策略: ${strategy}`);
  console.log(`内容长度: ${content.length} 字符`);
  
  // 执行分段
  let chunks = [];
  
  if (strategy === 'universal-semantic-fine') {
    chunks = chunkByFineSemantic(content, language);
  } else if (strategy === 'universal-semantic') {
    // 按段落分割markdown
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
    chunks = paragraphs;
  } else {
    // 单行分段
    chunks = [content];
  }
  
  console.log(`分段数量: ${chunks.length}`);
  
  if (chunks.length > 1) {
    console.log('分段预览:');
    chunks.forEach((chunk, index) => {
      const preview = chunk.substring(0, 100).replace(/\n/g, ' ');
      console.log(`  [${index}] ${preview}... (${chunk.length} chars)`);
    });
  }
  
  return {
    language,
    strategy,
    chunksCount: chunks.length,
    chunks: chunks.map((chunk, index) => ({
      index,
      content: chunk,
      length: chunk.length
    }))
  };
}

async function testFiles() {
  const testDir = path.join(process.cwd(), 'test-files');
  const resultDir = path.join(process.cwd(), 'test-data', 'parser-result');
  
  // 确保结果目录存在
  if (!fs.existsSync(resultDir)) {
    fs.mkdirSync(resultDir, { recursive: true });
  }
  
  // 测试几个关键文件
  const testFiles = [
    'example.md',
    'long-readme.md', 
    'README.md'
  ];
  
  for (const fileName of testFiles) {
    const filePath = path.join(testDir, fileName);
    
    if (fs.existsSync(filePath)) {
      try {
        const result = await processFile(filePath);
        const resultFilePath = path.join(resultDir, fileName + '.result.json');
        
        fs.writeFileSync(resultFilePath, JSON.stringify(result, null, 2), 'utf-8');
        console.log(`✅ 结果已保存到: ${resultFilePath}`);
      } catch (error) {
        console.error(`❌ 处理 ${fileName} 失败:`, error.message);
      }
    } else {
      console.log(`⚠️ 文件不存在: ${filePath}`);
    }
  }
}

// 运行测试
console.log('🧪 测试优化后的Parser集成效果...\n');
testFiles().then(() => {
  console.log('\n✨ 测试完成！');
}).catch(error => {
  console.error('测试失败:', error);
});