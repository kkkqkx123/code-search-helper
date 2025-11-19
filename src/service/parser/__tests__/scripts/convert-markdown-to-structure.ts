#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

interface TestCase {
  id: string;
  section: string;
  code: string;
  query: string;
  description: string;
}

interface IndexEntry {
  id: string;
  language: string;
  codeFile: string;
  queryFile: string;
  metadataFile: string;
  description: string;
}

/**
 * 从Markdown文件中解析测试用例
 */
function parseMarkdownFile(filePath: string): TestCase[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const testCases: TestCase[] = [];

  // 匹配 ## 标题（如 "## 1. 线程创建并发关系"）
  const sectionRegex = /^## (\d+)\.\s+(.+?)$/gm;
  const codeBlockRegex = /```c\n([\s\S]*?)\n```/g;
  const queryBlockRegex = /```\n([\s\S]*?)\n```(?!c)/g;

  let sectionMatch;
  let testIndex = 1;

  // 按部分逐个处理
  const sections = content.split(/^## \d+\./m);

  for (let i = 1; i < sections.length; i++) {
    const sectionContent = sections[i];
    
    // 提取section标题
    const titleMatch = sectionContent.match(/^\s+(.+?)$/m);
    const sectionTitle = titleMatch ? titleMatch[1].trim() : `section-${i}`;
    
    // 提取代码块
    const codeMatches = [...sectionContent.matchAll(/```c\n([\s\S]*?)\n```/g)];
    if (codeMatches.length === 0) continue;
    
    const codeBlock = codeMatches[0][1];
    
    // 提取查询块（在代码块之前的查询）
    const preCodeContent = sectionContent.substring(0, sectionContent.indexOf('```c'));
    const queryMatch = preCodeContent.match(/```\n([\s\S]*?)\n```/);
    
    // 或者从代码块后面提取查询
    let query = '';
    if (queryMatch) {
      query = queryMatch[1];
    } else {
      // 从代码块后查找查询
      const postCodeStart = sectionContent.indexOf(codeMatches[0][0]) + codeMatches[0][0].length;
      const postCodeContent = sectionContent.substring(postCodeStart);
      const postQueryMatch = postCodeContent.match(/```\n([\s\S]*?)\n```/);
      if (postQueryMatch) {
        query = postQueryMatch[1];
      }
    }

    testCases.push({
      id: String(testIndex).padStart(3, '0'),
      section: sectionTitle,
      code: codeBlock.trim(),
      query: query.trim(),
      description: `Test case ${String(testIndex).padStart(3, '0')}: ${sectionTitle}`
    });

    testIndex++;
  }

  return testCases;
}

/**
 * 从文件名提取语言和分类
 */
function extractLanguageAndCategory(filePath: string): { language: string; category: string } {
  // 匹配模式: *-{language}-{category}-*
  // 例: c-concurrency-queries-test-cases.md -> language: c, category: concurrency
  const filename = path.basename(filePath, '.md');
  const parts = filename.split('-');
  
  if (parts.length < 3) {
    throw new Error(`Invalid filename format. Expected: {language}-{category}-queries-test-cases.md, got: ${filename}`);
  }

  const language = parts[0];
  const category = parts[1];
  
  return { language, category };
}

/**
 * 生成目录结构并创建文件
 */
function generateStructure(testCases: TestCase[], language: string, category: string, outputDir: string): void {
  // 创建目录结构
  const testsDir = path.join(outputDir, 'tests');
  const resultsDir = path.join(outputDir, 'results');

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
  const indexEntries: IndexEntry[] = [];

  // 处理每个测试用例
  testCases.forEach((testCase) => {
    const testDir = path.join(testsDir, `test-${testCase.id}`);
    
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // 确定文件扩展名
    const codeExt = language === 'c' ? '.c' : language === 'cpp' ? '.cpp' : `.${language}`;
    const codeFileName = `code${codeExt}`;

    // 创建代码文件
    fs.writeFileSync(path.join(testDir, codeFileName), testCase.code);

    // 创建查询文件
    fs.writeFileSync(path.join(testDir, 'query.txt'), testCase.query);

    // 创建元数据文件
    const metadata = {
      id: `${category}-${testCase.id}`,
      section: testCase.section,
      description: testCase.description,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(path.join(testDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

    // 记录索引条目
    indexEntries.push({
      id: `${category}-${testCase.id}`,
      language,
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
  
  fs.writeFileSync(path.join(outputDir, `${category}.json`), JSON.stringify(indexFile, null, 2));

  console.log(`✓ Successfully converted ${testCases.length} test cases`);
  console.log(`✓ Output directory: ${outputDir}`);
  console.log(`✓ Index file: ${path.join(outputDir, `${category}.json`)}`);
}

/**
 * 主函数
 */
function main(): void {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: npx ts-node convert-markdown-to-structure.ts <source-file> <output-directory>');
    console.error('');
    console.error('Example:');
    console.error('  npx ts-node convert-markdown-to-structure.ts \\');
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
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
