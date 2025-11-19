#!/usr/bin/env node

/**
 * 诊断查询不匹配的具体原因
 *
 * 功能：
 * 1. 详细对比测试用例与常量定义中的每一个查询
 * 2. 显示具体的差异（行号、差异内容）
 * 3. 生成修复建议
 *
 * 用法：
 *   node diagnose-query-mismatches.js <language> <category> [testId]
 *
 * 示例：
 *   node diagnose-query-mismatches.js c lifecycle                # 诊断所有不匹配
 *   node diagnose-query-mismatches.js c lifecycle lifecycle-relationships-011  # 诊断特定测试
 */

const fs = require('fs');
const path = require('path');

const TESTS_BASE_DIR = path.join(__dirname, '../');
const QUERIES_CONST_DIR = path.join(__dirname, '../../constants/queries');

/**
 * 规范化查询（用于比对）
 */
function normalizeQuery(query) {
  return query
    .split('\n')
    .map(line => {
      const commentIndex = line.indexOf(';');
      return commentIndex !== -1 ? line.substring(0, commentIndex) : line;
    })
    .map(line => line.trim())
    .filter(line => line && !line.startsWith(';'))
    .join('\n')
    .trim();
}

/**
 * 提取常量文件中的查询（包含行号信息）
 */
function extractQueriesWithLineInfo(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/export\s+default\s+`([^`]*)`/s);
  
  if (!match) {
    return null;
  }

  const lines = match[1].split('\n');
  const queries = [];
  let currentQuery = [];
  let startLine = 0;
  let queryDescription = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (trimmed.startsWith(';') && currentQuery.length > 0) {
      const normalized = normalizeQuery(currentQuery.join('\n'));
      if (normalized) {
        queries.push({
          content: normalized,
          description: queryDescription,
          startLine,
          endLine: i - 1,
          rawContent: currentQuery.join('\n')
        });
      }
      queryDescription = trimmed;
      currentQuery = [];
      startLine = i + 1;
    } else if (trimmed && !trimmed.startsWith(';')) {
      currentQuery.push(line);
    }
  }

  if (currentQuery.length > 0) {
    const normalized = normalizeQuery(currentQuery.join('\n'));
    if (normalized) {
      queries.push({
        content: normalized,
        description: queryDescription,
        startLine,
        endLine: lines.length - 1,
        rawContent: currentQuery.join('\n')
      });
    }
  }

  return queries;
}

/**
 * 从测试文件中读取查询
 */
function readTestQuery(testDir, testName) {
  const queryPath = path.join(testDir, testName, 'query.txt');
  const metadataPath = path.join(testDir, testName, 'metadata.json');

  if (!fs.existsSync(queryPath)) {
    return null;
  }

  const rawContent = fs.readFileSync(queryPath, 'utf-8');
  const metadata = fs.existsSync(metadataPath)
    ? JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
    : {};

  return {
    content: normalizeQuery(rawContent),
    rawContent,
    description: metadata.description || '',
    metadata
  };
}

/**
 * 计算两个字符串的差异行
 */
function getDifferences(str1, str2) {
  const lines1 = str1.split('\n');
  const lines2 = str2.split('\n');
  const diffs = [];

  const maxLen = Math.max(lines1.length, lines2.length);
  for (let i = 0; i < maxLen; i++) {
    const line1 = lines1[i] || '';
    const line2 = lines2[i] || '';
    
    if (line1 !== line2) {
      diffs.push({
        lineNum: i + 1,
        from: line1 || '(missing)',
        to: line2 || '(missing)'
      });
    }
  }

  return diffs;
}

/**
 * 主诊断函数
 */
function diagnose(language, category, specificTestId = null) {
  const categoryDir = path.join(TESTS_BASE_DIR, language, category);
  const testDir = path.join(categoryDir, 'tests');
  const constantFile = path.join(QUERIES_CONST_DIR, language, `${category}.ts`);

  // 读取常量文件
  const constQueries = extractQueriesWithLineInfo(constantFile);
  if (!constQueries) {
    console.error(`❌ 常量文件不存在: ${constantFile}`);
    return;
  }

  // 读取测试用例
  const testDirs = fs.readdirSync(testDir)
    .filter(f => f.startsWith('test-'))
    .sort();

  const testQueries = {};
  testDirs.forEach(testName => {
    const testQuery = readTestQuery(testDir, testName);
    if (testQuery) {
      const metadataPath = path.join(testDir, testName, 'metadata.json');
      const metadata = fs.existsSync(metadataPath)
        ? JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
        : {};
      const testId = metadata.id || testName;
      
      testQueries[testId] = {
        ...testQuery,
        testName
      };
    }
  });

  // 查找不匹配
  console.log('\n' + '='.repeat(80));
  console.log(`诊断报告: ${language}:${category}`);
  console.log('='.repeat(80) + '\n');

  const mismatches = [];
  const matched = [];

  Object.entries(testQueries).forEach(([testId, testQuery]) => {
    // 跳过如果指定了特定测试ID且不匹配
    if (specificTestId && testId !== specificTestId) {
      return;
    }

    let found = false;
    for (let i = 0; i < constQueries.length; i++) {
      if (testQuery.content === constQueries[i].content) {
        matched.push({ testId, constIndex: i });
        found = true;
        break;
      }
    }

    if (!found) {
      mismatches.push({
        testId,
        testQuery,
        constQueries
      });
    }
  });

  if (mismatches.length === 0 && (!specificTestId || matched.some(m => m.testId === specificTestId))) {
    console.log('✅ 所有查询都匹配！\n');
    return;
  }

  // 显示不匹配的详情
  console.log(`❌ 发现 ${mismatches.length} 个不匹配的查询\n`);

  mismatches.forEach((mismatch, idx) => {
    const { testId, testQuery } = mismatch;
    
    console.log(`\n${idx + 1}. ${testId}`);
    console.log('-'.repeat(80));
    console.log(`测试文件: ${path.join('tests', mismatch.testQuery.testName, 'query.txt')}`);
    
    // 查找最相似的常量查询
    let bestMatch = null;
    let bestSimilarity = 0;
    let bestIndex = -1;

    constQueries.forEach((constQuery, idx) => {
      const similarity = calculateStringSimilarity(testQuery.content, constQuery.content);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = constQuery;
        bestIndex = idx;
      }
    });

    if (bestMatch && bestSimilarity > 0.5) {
      console.log(`\n最相似的常量查询: 索引 ${bestIndex} (相似度: ${(bestSimilarity * 100).toFixed(1)}%)`);
      console.log(`常量文件位置: 约第 ${bestMatch.startLine}-${bestMatch.endLine} 行`);
      
      // 显示差异
      const diffs = getDifferences(testQuery.content, bestMatch.content);
      if (diffs.length > 0) {
        console.log(`\n差异（共 ${diffs.length} 处）:`);
        diffs.slice(0, 10).forEach(diff => {
          console.log(`  行 ${diff.lineNum}:`);
          console.log(`    - ${diff.from}`);
          console.log(`    + ${diff.to}`);
        });
        if (diffs.length > 10) {
          console.log(`  ... 还有 ${diffs.length - 10} 处差异`);
        }
      }
    } else {
      console.log('\n⚠️  常量文件中没有相似的查询（可能是完全新增的查询）');
      console.log(`\n测试查询内容：`);
      console.log(testQuery.rawContent.split('\n').slice(0, 5).map(l => `  ${l}`).join('\n'));
      if (testQuery.rawContent.split('\n').length > 5) {
        console.log(`  ... (共 ${testQuery.rawContent.split('\n').length} 行)`);
      }
    }
  });

  // 显示未使用的常量查询
  const usedConstIndices = new Set();
  matched.forEach(m => usedConstIndices.add(m.constIndex));
  const unusedIndices = Array.from({ length: constQueries.length }, (_, i) => i)
    .filter(i => !usedConstIndices.has(i));

  if (unusedIndices.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log(`⚠️  未被使用的常量查询: ${unusedIndices.length} 个`);
    console.log('='.repeat(80) + '\n');

    unusedIndices.forEach(idx => {
      const query = constQueries[idx];
      console.log(`索引 ${idx} (第 ${query.startLine}-${query.endLine} 行)`);
      console.log(`描述: ${query.description || '(无)'}`);
      console.log(`内容: ${query.rawContent.split('\n').slice(0, 3).map(l => l.trim()).join(' ')}`);
      if (query.rawContent.split('\n').length > 3) {
        console.log(`... (共 ${query.rawContent.split('\n').length} 行)`);
      }
      console.log('');
    });
  }

  console.log('='.repeat(80));
  console.log('\n修复建议:');
  console.log('1. 对于高相似度的不匹配，检查是否只是格式或空白差异');
  console.log('2. 对于新增查询，添加到常量文件中');
  console.log('3. 对于未使用的查询，确认是否应该删除或添加对应的测试用例');
  console.log('\n');
}

/**
 * 计算字符串相似度
 */
function calculateStringSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * 编辑距离
 */
function getEditDistance(str1, str2) {
  const track = Array(str2.length + 1).fill(null).map(() =>
    Array(str1.length + 1).fill(null)
  );

  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }

  return track[str2.length][str1.length];
}

// 主函数
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('用法: node diagnose-query-mismatches.js <language> <category> [testId]');
  console.log('示例: node diagnose-query-mismatches.js c lifecycle');
  process.exit(1);
}

const language = args[0];
const category = args[1];
const testId = args[2];

diagnose(language, category, testId);
