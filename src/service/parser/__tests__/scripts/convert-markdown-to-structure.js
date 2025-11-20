#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 注意：由于这是一个JavaScript文件，无法直接导入TypeScript中的常量
// 这里保留原有的常量定义，以维持脚本的独立性

/**
 * 从Markdown文件中解析测试用例
 */
function parseMarkdownFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const testCases = [];

  // 按 ## \d+. 标题分割文档
  const sections = content.split(/^## \d+\.\s+/m);

  let testIndex = 1;

  for (let i = 1; i < sections.length; i++) {
    const sectionContent = sections[i];
    
    // 提取section标题（第一行）
    const titleMatch = sectionContent.match(/^([^\n]+)/);
    const sectionTitle = titleMatch ? titleMatch[1].trim() : `section-${i}`;
    
    // 提取代码块（支持多种语言标记）
    const codeBlockRegex = /```(\w+)\n([\s\S]*?)\n```/g;
    const codeMatches = [...sectionContent.matchAll(codeBlockRegex)];
    if (codeMatches.length === 0) continue;
    
    // 使用第一个代码块的语言标记
    const language = codeMatches[0][1].toLowerCase();
    const codeBlock = codeMatches[0][2];
    
    // 查找查询块：先找代码块前的查询，再找代码块后的查询
    let query = '';
    
    // 在代码块之前查找查询
    const preCodeContent = sectionContent.substring(0, sectionContent.indexOf(codeMatches[0][0]));
    const preQueryMatches = [...preCodeContent.matchAll(/```\n([\s\S]*?)\n```/g)];
    
    if (preQueryMatches.length > 0) {
      query = preQueryMatches[preQueryMatches.length - 1][1]; // 使用最后一个匹配的查询块
    } else {
      // 从代码块后查找查询
      const postCodeStart = sectionContent.indexOf(codeMatches[0][0]) + codeMatches[0][0].length;
      const postCodeContent = sectionContent.substring(postCodeStart);
      const postQueryMatches = [...postCodeContent.matchAll(/```\n([\s\S]*?)\n```/g)];
      if (postQueryMatches.length > 0) {
        query = postQueryMatches[0][1];
      }
    }

    testCases.push({
      id: String(testIndex).padStart(3, '0'),
      section: sectionTitle,
      code: codeBlock.trim(),
      query: query.trim(),
      description: `Test case ${String(testIndex).padStart(3, '0')}: ${sectionTitle}`,
      language: language  // 添加语言字段
    });

    testIndex++;
  }

  return testCases;
}

/**
 * 从文件名提取语言和分类
 * 预期格式: {language}-{category}-queries-test-cases.md 或类似变体
 */
function extractLanguageAndCategory(filePath) {
  // 匹配模式: *-{language}-{category}-*
  // 例: c-concurrency-queries-test-cases.md -> language: c, category: concurrency
  const filename = path.basename(filePath, '.md');
  const parts = filename.split('-');
  
  if (parts.length < 3) {
    throw new Error(
      `Invalid filename format. Expected: {language}-{category}-queries-test-cases.md or similar, got: ${filename}`
    );
  }

  const language = parts[0];
  const category = parts[1];
  
  return { language, category };
}

// LANGUAGE_MAP 常量，用于将语言名称映射到扩展名
const LANGUAGE_MAP = {
  '.js': 'javascript',
  '.ts': 'typescript',
  '.jsx': 'javascript',
 '.tsx': 'typescript',
  '.py': 'python',
  '.java': 'java',
  '.cpp': 'cpp',
  '.c': 'c',
  '.h': 'cpp',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.go': 'go',
  '.rs': 'rust',
  '.php': 'php',
  '.rb': 'ruby',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.md': 'markdown',
  '.json': 'json',
  '.xml': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.sql': 'sql',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.fish': 'shell',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.txt': 'text',
  '.log': 'log',
  '.ini': 'ini',
 '.cfg': 'ini',
  '.conf': 'ini',
  '.toml': 'toml',
  '.dockerfile': 'dockerfile',
  '.makefile': 'makefile',
  '.cmake': 'cmake',
  '.pl': 'perl',
  '.r': 'r',
  '.m': 'matlab',
  '.lua': 'lua',
  '.dart': 'dart',
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.erl': 'erlang',
 '.hs': 'haskell',
  '.ml': 'ocaml',
  '.fs': 'fsharp',
  '.vb': 'visualbasic',
  '.ps1': 'powershell',
  '.bat': 'batch',
  '.cmd': 'batch',
  '.csv': 'csv',
};

// 反向映射：从语言名到扩展名
const LANGUAGE_TO_EXTENSION = {};
Object.entries(LANGUAGE_MAP).forEach(([ext, lang]) => {
  if (!LANGUAGE_TO_EXTENSION[lang]) {
    LANGUAGE_TO_EXTENSION[lang] = ext;  // 保留第一个映射
  }
});

/**
 * 获取代码文件扩展名
 */
function getCodeFileExtension(language) {
  // 首先检查输入是否已经是扩展名格式（以点开头）
  if (language.startsWith('.')) {
    return language;
  }
  
  // 尝试在LANGUAGE_TO_EXTENSION中查找对应的语言
 const langLower = language.toLowerCase();
  if (LANGUAGE_TO_EXTENSION[langLower]) {
    return LANGUAGE_TO_EXTENSION[langLower];
  }
  
  // 如果没有找到，返回原格式（可能无法识别）
  return `.${language}`;
}

/**
 * 生成目录结构并创建文件
 */
function generateStructure(testCases, language, category, outputDir) {
  // 创建目录结构
  const testsDir = path.join(outputDir, 'tests');
  const resultsDir = path.join(outputDir, 'results');

  // 确保目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  if (!fs.existsSync(testsDir)) {
    fs.mkdirSync(testsDir, { recursive: true });
  }
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
 }

  // 创建索引文件
 const indexEntries = [];

  // 处理每个测试用例
  testCases.forEach((testCase) => {
    const testDir = path.join(testsDir, `test-${testCase.id}`);
    
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // 确定文件扩展名，优先使用测试用例中检测到的语言
    const actualLanguage = testCase.language || language;
    const codeExt = getCodeFileExtension(actualLanguage);
    const codeFileName = `code${codeExt}`;

    // 创建代码文件
    fs.writeFileSync(path.join(testDir, codeFileName), testCase.code);

    // 创建查询文件
    fs.writeFileSync(path.join(testDir, 'query.txt'), testCase.query);

    // 创建元数据文件
    const metadata = {
      id: `${category}-${testCase.id}`,
      language: actualLanguage, // 在元数据中记录实际语言
      section: testCase.section,
      description: testCase.description,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(
      path.join(testDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    // 记录索引条目
    indexEntries.push({
      id: `${category}-${testCase.id}`,
      language: actualLanguage,
      codeFile: `tests/test-${testCase.id}/${codeFileName}`,
      queryFile: `tests/test-${testCase.id}/query.txt`,
      metadataFile: `tests/test-${testCase.id}/metadata.json`,
      description: testCase.description
    });
 });

  // 创建索引文件
 const indexFile = {
    category,
    totalTests: testCases.length,
    requests: indexEntries
  };
  
  fs.writeFileSync(
    path.join(outputDir, `${category}.json`),
    JSON.stringify(indexFile, null, 2)
  );

  console.log(`✓ Successfully converted ${testCases.length} test cases`);
  console.log(`✓ Output directory: ${outputDir}`);
  console.log(`✓ Index file: ${path.join(outputDir, `${category}.json`)}`);
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node convert-markdown-to-structure.js <source-file> <output-directory>');
    console.error('');
    console.error('Example:');
    console.error('  node convert-markdown-to-structure.js \\');
    console.error('    ./c-concurrency-queries-test-cases.md \\');
    console.error('    ./output/c/concurrency');
    process.exit(1);
  }

  const sourceFile = args[0];
  const outputDir = args[1];

  // 验证源文件
  if (!fs.existsSync(sourceFile)) {
    console.error(`Error: Source file not found: ${sourceFile}`);
    process.exit(1);
  }

  try {
    console.log(`Parsing: ${sourceFile}`);
    
    // 解析Markdown文件
    const testCases = parseMarkdownFile(sourceFile);
    
    if (testCases.length === 0) {
      console.error('Error: No test cases found in the markdown file');
      process.exit(1);
    }

    console.log(`✓ Found ${testCases.length} test cases`);

    // 提取语言和分类
    const { language, category } = extractLanguageAndCategory(sourceFile);
    console.log(`✓ Language: ${language}, Category: ${category}`);

    // 生成目录结构
    generateStructure(testCases, language, category, outputDir);

    console.log('✓ Conversion completed successfully!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
