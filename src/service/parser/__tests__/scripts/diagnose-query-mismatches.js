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

  // 处理合并查询的交替模式还原和去重
  const processedQueries = processMergedQueriesWithLineInfo(queries);
  
  return processedQueries;
}

/**
 * 处理合并查询的交替模式还原和去重（保留行号信息）
 */
function processMergedQueriesWithLineInfo(queries) {
  const processedQueries = [];
  const seenQueries = new Set();

  queries.forEach(query => {
    // 检查是否是合并查询（包含交替模式 [ ... ] 或多个 match 模式）
    if (isMergedQuery(query.content)) {
      // 还原为基础格式
      const baseQueries = expandMergedQueryWithLineInfo(query.content, query.description, query.startLine, query.endLine);
      
      baseQueries.forEach(baseQuery => {
        const normalized = normalizeQuery(baseQuery.content);
        const queryKey = generateQueryKey(normalized);
        
        // 去重：只添加未见过的新查询
        if (!seenQueries.has(queryKey)) {
          seenQueries.add(queryKey);
          processedQueries.push({
            content: normalized,
            description: baseQuery.description,
            startLine: baseQuery.startLine,
            endLine: baseQuery.endLine,
            rawContent: baseQuery.content,
            isExpanded: true,
            originalDescription: query.description,
            originalStartLine: query.startLine,
            originalEndLine: query.endLine
          });
        }
      });
    } else {
      // 非合并查询，直接添加（去重）
      const normalized = normalizeQuery(query.content);
      const queryKey = generateQueryKey(normalized);
      
      if (!seenQueries.has(queryKey)) {
        seenQueries.add(queryKey);
        processedQueries.push({
          content: normalized,
          description: query.description,
          startLine: query.startLine,
          endLine: query.endLine,
          rawContent: query.rawContent,
          isExpanded: false
        });
      }
    }
  });

  return processedQueries;
}

/**
 * 检查是否是合并查询
 */
function isMergedQuery(queryContent) {
  // 检查是否包含交替模式 [ ... ]
  const hasAlternation = /\[.*?\]/s.test(queryContent);
  
  // 检查是否包含多个 match 模式（用 | 分隔）
  const hasMultipleMatches = /\(#match\?.*?\|.*?\)/.test(queryContent);
  
  return hasAlternation || hasMultipleMatches;
}

/**
 * 展开合并查询为基础格式（保留行号信息）
 */
function expandMergedQueryWithLineInfo(queryContent, description, startLine, endLine) {
  const baseQueries = [];
  
  // 检查是否包含交替模式和多个match模式
  const hasAlternation = /\[.*?\]/s.test(queryContent);
  const hasMultipleMatches = /\(#match\?.*?\|.*?\)/.test(queryContent);
  
  if (hasAlternation && hasMultipleMatches) {
    // 如果同时包含两种模式，先处理交替模式，然后对每个结果处理match模式
    const alternationQueries = expandAlternationQueryWithLineInfo(queryContent, description, startLine, endLine);
    alternationQueries.forEach(altQuery => {
      if (/\(#match\?.*?\|.*?\)/.test(altQuery.content)) {
        const matchQueries = expandMatchQueryWithLineInfo(altQuery.content, altQuery.description, startLine, endLine);
        baseQueries.push(...matchQueries);
      } else {
        baseQueries.push(altQuery);
      }
    });
  } else if (hasAlternation) {
    // 只包含交替模式
    const alternationQueries = expandAlternationQueryWithLineInfo(queryContent, description, startLine, endLine);
    baseQueries.push(...alternationQueries);
  } else if (hasMultipleMatches) {
    // 只包含多个match模式
    const matchQueries = expandMatchQueryWithLineInfo(queryContent, description, startLine, endLine);
    baseQueries.push(...matchQueries);
  }
  
  // 如果没有特殊模式，返回原查询
  if (baseQueries.length === 0) {
    baseQueries.push({
      content: queryContent,
      description: description,
      startLine: startLine,
      endLine: endLine
    });
  }
  
  return baseQueries;
}

/**
 * 展开交替模式查询（保留行号信息）
 */
function expandAlternationQueryWithLineInfo(queryContent, description, startLine, endLine) {
  const queries = [];
  
  // 找到所有交替模式块
  const alternationRegex = /(\[([^\]]*)\])/g;
  let match;
  const alternations = [];
  
  while ((match = alternationRegex.exec(queryContent)) !== null) {
    // 正确解析交替模式选项
    const content = match[1];
    const options = [];
    let currentOption = '';
    let braceLevel = 0;
    let parenLevel = 0;
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      
      if (char === '(') {
        parenLevel++;
      } else if (char === ')') {
        parenLevel--;
      } else if (char === '{') {
        braceLevel++;
      } else if (char === '}') {
        braceLevel--;
      }
      
      currentOption += char;
      
      // 当括号和花括号都平衡时，且遇到空白字符，认为是一个完整选项
      if ((parenLevel === 0 && braceLevel === 0) &&
          (char === '\n' || char === ' ' || char === '\t') &&
          currentOption.trim()) {
        
        const trimmed = currentOption.trim();
        if (trimmed && !options.includes(trimmed)) {
          options.push(trimmed);
        }
        currentOption = '';
      }
    }
    
    // 添加最后一个选项
    const lastOption = currentOption.trim();
    if (lastOption && !options.includes(lastOption)) {
      options.push(lastOption);
    }
    
    // 过滤掉只有括号的选项
    const filteredOptions = options.filter(option =>
      option !== '[' && option !== ']' && option.trim().length > 0
    );
    
    alternations.push({
      fullMatch: match[0],
      options: filteredOptions
    });
  }
  
  if (alternations.length === 0) {
    return [{
      content: queryContent,
      description: description,
      startLine: startLine,
      endLine: endLine
    }];
  }
  
  // 生成所有可能的组合
  const combinations = generateAlternationCombinations(alternations);
  
  combinations.forEach((combination, index) => {
    let expandedContent = queryContent;
    
    // 从后往前替换，避免位置偏移问题
    for (let i = alternations.length - 1; i >= 0; i--) {
      const alternation = alternations[i];
      expandedContent = expandedContent.replace(alternation.fullMatch, combination[i]);
    }
    
    queries.push({
      content: expandedContent,
      description: description + ` (展开: ${combination.join(', ')})`,
      startLine: startLine,
      endLine: endLine,
      expansionIndex: index
    });
  });
  
  return queries;
}

/**
 * 展开多个 match 模式查询（保留行号信息）
 */
function expandMatchQueryWithLineInfo(queryContent, description, startLine, endLine) {
  const queries = [];
  
  // 找到所有 match 模式
  const matchRegex = /\(#match\?\s*@(\w+)\s+"([^"]*(?:\|[^"]*)*)"\)/g;
  let match;
  const matches = [];
  
  while ((match = matchRegex.exec(queryContent)) !== null) {
    const options = match[2].split('|').map(opt => opt.trim());
    matches.push({
      varName: match[1],
      fullMatch: match[0],
      options: options
    });
  }
  
  if (matches.length === 0) {
    return [{
      content: queryContent,
      description: description,
      startLine: startLine,
      endLine: endLine
    }];
  }
  
  // 为每个 match 选项生成单独的查询
  matches.forEach(matchItem => {
    matchItem.options.forEach((option, index) => {
      let expandedContent = queryContent;
      
      // 替换 match 模式为单个选项
      const singleMatch = matchItem.fullMatch.replace(
        /\|[^|]*/g, ''
      ).replace(matchItem.options[0], option);
      
      expandedContent = expandedContent.replace(matchItem.fullMatch, singleMatch);
      
      queries.push({
        content: expandedContent,
        description: description + ` (匹配: ${option})`,
        startLine: startLine,
        endLine: endLine,
        expansionIndex: index
      });
    });
  });
  
  return queries;
}

/**
 * 生成交替模式的所有组合
 */
function generateAlternationCombinations(alternations) {
  if (alternations.length === 0) {
    return [];
  }
  
  const combinations = [];
  
  function generateCombinations(index, current) {
    if (index === alternations.length) {
      combinations.push([...current]);
      return;
    }
    
    const alternation = alternations[index];
    for (const option of alternation.options) {
      current.push(option);
      generateCombinations(index + 1, current);
      current.pop();
    }
  }
  
  generateCombinations(0, []);
  return combinations;
}

/**
 * 生成查询的唯一键用于去重
 */
function generateQueryKey(queryContent) {
  // 移除所有空白字符，生成规范化键
  return queryContent.replace(/\s+/g, ' ').trim().toLowerCase();
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

  // 统计展开信息
  const originalConstCount = constQueries.filter(q => !q.isExpanded).length;
  const expandedCount = constQueries.filter(q => q.isExpanded).length;

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
  console.log(`诊断报告: ${language}:${category} (支持交替模式还原和去重)`);
  console.log('='.repeat(80) + '\n');

  // 显示展开统计
  if (expandedCount > 0) {
    console.log(`📊 查询统计: 原始常量查询 ${originalConstCount} → 展开后 ${constQueries.length} (去重后)`);
    console.log(`   展开的查询数量: ${expandedCount}\n`);
  }

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
        matched.push({
          testId,
          constIndex: i,
          isExpanded: constQueries[i].isExpanded,
          originalDescription: constQueries[i].originalDescription
        });
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
    if (expandedCount > 0) {
      console.log(`📈 成功利用展开功能匹配了 ${matched.length} 个测试用例`);
    }
    return;
  }

  console.log(`\n❌ 发现 ${mismatches.length} 个不匹配的查询\n`);

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
      
      // 显示展开信息
      if (bestMatch.isExpanded) {
        console.log(`📊 展开查询: 是 (来自原始查询第 ${bestMatch.originalStartLine}-${bestMatch.originalEndLine} 行)`);
        console.log(`原始描述: ${bestMatch.originalDescription || '(无)'}`);
        console.log(`展开描述: ${bestMatch.description || '(无)'}`);
      } else {
        console.log(`📊 展开查询: 否`);
        console.log(`描述: ${bestMatch.description || '(无)'}`);
      }
      
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

  // 显示统计摘要
  const totalTestCases = Object.keys(testQueries).length;
  const usedExpandedQueries = constQueries.length - unusedIndices.length;
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 统计摘要');
  console.log('='.repeat(80));
  console.log(`📋 测试用例统计: 总数 ${totalTestCases}, ✓ 匹配 ${matched.length}, ✗ 不匹配 ${mismatches.length}`);
  console.log(`🔍 展开查询使用情况: 已使用 ${usedExpandedQueries}, 未使用 ${unusedIndices.length}`);
  
  if (expandedCount > 0) {
    console.log(`📈 测试用例匹配率: ${(matched.length / totalTestCases * 100).toFixed(1)}% (${matched.length}/${totalTestCases})`);
    console.log(`📊 展开查询覆盖率: ${(matched.length / constQueries.length * 100).toFixed(1)}% (${matched.length}/${constQueries.length})`);
  }
  console.log('');

  if (unusedIndices.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log(`⚠️  未被使用的常量查询: ${unusedIndices.length} 个`);
    console.log('='.repeat(80) + '\n');

    unusedIndices.forEach(idx => {
      const query = constQueries[idx];
      console.log(`索引 ${idx} (第 ${query.startLine}-${query.endLine} 行)`);
      
      // 显示展开信息
      if (query.isExpanded) {
        console.log(`📊 展开查询: 是 (来自原始查询第 ${query.originalStartLine}-${query.originalEndLine} 行)`);
        console.log(`原始描述: ${query.originalDescription || '(无)'}`);
        console.log(`展开描述: ${query.description || '(无)'}`);
      } else {
        console.log(`📊 展开查询: 否`);
        console.log(`描述: ${query.description || '(无)'}`);
      }
      
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
  if (expandedCount > 0) {
    console.log('4. 对于展开的查询，检查原始合并查询是否需要调整');
    console.log('5. 考虑是否需要为展开的查询添加对应的测试用例');
  }
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
