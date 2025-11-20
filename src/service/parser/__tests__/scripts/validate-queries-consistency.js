#!/usr/bin/env node

/**
 * 校验测试用例中的查询与查询常量定义的一致性
 *
 * 功能：
 * 1. 扫描所有测试用例的query.txt文件
 * 2. 扫描所有查询常量定义文件（constants/queries/{language}/{category}.ts）
 * 3. 提取并比较查询内容
 * 4. 生成详细的一致性报告
 *
 * 用法：
 *   node validate-queries-consistency.js [language] [category]
 *
 * 示例：
 *   node validate-queries-consistency.js                    # 验证所有语言
 *   node validate-queries-consistency.js c                  # 验证C语言
 *   node validate-queries-consistency.js c lifecycle        # 验证C lifecycle
 */

const fs = require('fs');
const path = require('path');

// 配置
const TESTS_BASE_DIR = path.join(__dirname, '../');
const QUERIES_CONST_DIR = path.join(__dirname, '../../constants/queries');

// 支持的语言和类别
const SUPPORTED_LANGUAGES = ['c', 'python', 'javascript', 'java', 'go', 'rust'];

const TEST_CATEGORIES = {
  c: [
    'lifecycle-relationships',
    'control-flow',
    'control-flow-relationships',
    'data-flow',
    'functions',
    'structs',
    'concurrency',
    'concurrency-relationships',
    'preprocessor',
    'variables'
  ],
  python: [],
  javascript: [],
};

/**
 * 规范化查询字符串（移除空行和注释）
 */
function normalizeQuery(query) {
  return query
    .split('\n')
    .map(line => {
      // 移除行尾注释
      const commentIndex = line.indexOf(';');
      return commentIndex !== -1 ? line.substring(0, commentIndex) : line;
    })
    .map(line => line.trim())
    .filter(line => line && !line.startsWith(';'))
    .join('\n')
    .trim();
}

/**
 * 从TypeScript常量文件中提取查询内容
 */
function extractQueriesFromConstantFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  
  // 匹配 export default `...` 的内容
  const match = content.match(/export\s+default\s+`([^`]*)`/s);
  
  if (!match) {
    return null;
  }

  const queryContent = match[1];
  
  // 分割单个查询（以 ; 开头的行作为分隔符）
  const queries = [];
  let currentQuery = [];
  let queryDescription = '';

  queryContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    
    if (trimmed.startsWith(';') && currentQuery.length > 0) {
      // 新查询开始，保存前一个
      const normalized = normalizeQuery(currentQuery.join('\n'));
      if (normalized) {
        queries.push({
          content: normalized,
          description: queryDescription
        });
      }
      queryDescription = trimmed;
      currentQuery = [];
    } else if (trimmed && !trimmed.startsWith(';')) {
      currentQuery.push(line);
    }
  });

  // 保存最后一个查询
  if (currentQuery.length > 0) {
    const normalized = normalizeQuery(currentQuery.join('\n'));
    if (normalized) {
      queries.push({
        content: normalized,
        description: queryDescription
      });
    }
  }

  // 处理合并查询的交替模式还原和去重
  const processedQueries = processMergedQueries(queries);
  
  return processedQueries;
}

/**
 * 处理合并查询的交替模式还原和去重
 */
function processMergedQueries(queries) {
  const processedQueries = [];
  const seenQueries = new Set();

  queries.forEach(query => {
    // 检查是否是合并查询（包含交替模式 [ ... ] 或多个 match 模式）
    if (isMergedQuery(query.content)) {
      // 还原为基础格式
      const baseQueries = expandMergedQuery(query.content, query.description);
      
      baseQueries.forEach(baseQuery => {
        const normalized = normalizeQuery(baseQuery.content);
        const queryKey = generateQueryKey(normalized);
        
        // 去重：只添加未见过的新查询
        if (!seenQueries.has(queryKey)) {
          seenQueries.add(queryKey);
          processedQueries.push({
            content: normalized,
            description: baseQuery.description,
            isExpanded: true,
            originalDescription: query.description
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
 * 展开合并查询为基础格式
 */
function expandMergedQuery(queryContent, description) {
  const baseQueries = [];
  
  // 检查是否包含交替模式和多个match模式
  const hasAlternation = /\[.*?\]/s.test(queryContent);
  const hasMultipleMatches = /\(#match\?.*?\|.*?\)/.test(queryContent);
  
  if (hasAlternation && hasMultipleMatches) {
    // 如果同时包含两种模式，先处理交替模式，然后对每个结果处理match模式
    const alternationQueries = expandAlternationQuery(queryContent, description);
    alternationQueries.forEach(altQuery => {
      if (/\(#match\?.*?\|.*?\)/.test(altQuery.content)) {
        const matchQueries = expandMatchQuery(altQuery.content, altQuery.description);
        baseQueries.push(...matchQueries);
      } else {
        baseQueries.push(altQuery);
      }
    });
  } else if (hasAlternation) {
    // 只包含交替模式
    const alternationQueries = expandAlternationQuery(queryContent, description);
    baseQueries.push(...alternationQueries);
  } else if (hasMultipleMatches) {
    // 只包含多个match模式
    const matchQueries = expandMatchQuery(queryContent, description);
    baseQueries.push(...matchQueries);
  }
  
  // 如果没有特殊模式，返回原查询
  if (baseQueries.length === 0) {
    baseQueries.push({
      content: queryContent,
      description: description
    });
  }
  
  return baseQueries;
}

/**
 * 展开交替模式查询
 */
function expandAlternationQuery(queryContent, description) {
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
      description: description
    }];
  }
  
  // 生成所有可能的组合
  const combinations = generateAlternationCombinations(alternations);
  
  combinations.forEach(combination => {
    let expandedContent = queryContent;
    
    // 从后往前替换，避免位置偏移问题
    for (let i = alternations.length - 1; i >= 0; i--) {
      const alternation = alternations[i];
      expandedContent = expandedContent.replace(alternation.fullMatch, combination[i]);
    }
    
    queries.push({
      content: expandedContent,
      description: description + ` (展开: ${combination.join(', ')})`
    });
  });
  
  return queries;
}

/**
 * 展开多个 match 模式查询
 */
function expandMatchQuery(queryContent, description) {
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
      description: description
    }];
  }
  
  // 为每个 match 选项生成单独的查询
  matches.forEach(matchItem => {
    matchItem.options.forEach(option => {
      let expandedContent = queryContent;
      
      // 替换 match 模式为单个选项
      const singleMatch = matchItem.fullMatch.replace(
        /\|[^|]*/g, ''
      ).replace(matchItem.options[0], option);
      
      expandedContent = expandedContent.replace(matchItem.fullMatch, singleMatch);
      
      queries.push({
        content: expandedContent,
        description: description + ` (匹配: ${option})`
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
 * 从测试文件中提取查询内容
 */
function extractQueriesFromTestFiles(testDir) {
  if (!fs.existsSync(testDir)) {
    return [];
  }

  const testQueries = [];
  const testDirs = fs.readdirSync(testDir).filter(f => f.startsWith('test-'));

  testDirs.forEach(testName => {
    const queryPath = path.join(testDir, testName, 'query.txt');
    const metadataPath = path.join(testDir, testName, 'metadata.json');

    if (fs.existsSync(queryPath)) {
      const query = fs.readFileSync(queryPath, 'utf-8');
      const metadata = fs.existsSync(metadataPath)
        ? JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
        : {};

      testQueries.push({
        testName,
        testId: metadata.id || testName,
        content: normalizeQuery(query),
        description: metadata.description || ''
      });
    }
  });

  return testQueries;
}

/**
 * 比较两个查询是否相同
 */
function queriesEqual(query1, query2) {
  return query1.trim() === query2.trim();
}

/**
 * 查找最相似的查询
 */
function findSimilarQuery(targetQuery, queryList, threshold = 0.8) {
  const targetNorm = normalizeQuery(targetQuery);
  
  let bestMatch = null;
  let bestSimilarity = 0;

  queryList.forEach((item) => {
    const similarity = calculateSimilarity(targetNorm, item.content);
    if (similarity > bestSimilarity && similarity >= threshold) {
      bestSimilarity = similarity;
      bestMatch = {
        ...item,
        similarity: (similarity * 100).toFixed(1)
      };
    }
  });

  return bestMatch;
}

/**
 * 计算两个字符串的相似度（Levenshtein距离）
 */
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * 计算编辑距离
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

/**
 * 验证单个类别
 */
function validateCategory(language, category) {
  const categoryDir = path.join(TESTS_BASE_DIR, language, category);
  const testDir = path.join(categoryDir, 'tests');
  
  // 获取常量文件路径
  const constantFile = path.join(QUERIES_CONST_DIR, language, `${category}.ts`);
  
  // 提取查询
  const testQueries = extractQueriesFromTestFiles(testDir);
  const constQueries = extractQueriesFromConstantFile(constantFile);
  
  if (!constQueries) {
    return {
      category,
      language,
      status: 'ERROR',
      message: `常量文件不存在: ${constantFile}`,
      testCount: testQueries.length,
      constCount: 0
    };
  }

  // 统计展开信息
  const originalConstCount = constQueries.filter(q => !q.isExpanded).length;
  const expandedCount = constQueries.filter(q => q.isExpanded).length;

  // 比较查询
  const matches = [];
  const mismatches = [];
  const unusedConstQueries = new Set(constQueries.map((_, i) => i));

  testQueries.forEach(testQuery => {
    let matched = false;

    for (let i = 0; i < constQueries.length; i++) {
      if (queriesEqual(testQuery.content, constQueries[i].content)) {
        matches.push({
          testId: testQuery.testId,
          type: 'exact',
          isExpanded: constQueries[i].isExpanded,
          originalDescription: constQueries[i].originalDescription
        });
        unusedConstQueries.delete(i);
        matched = true;
        break;
      }
    }

    if (!matched) {
      // 查找最相似的查询
      const similar = findSimilarQuery(testQuery.content, constQueries);
      mismatches.push({
        testId: testQuery.testId,
        testContent: testQuery.content.substring(0, 100) + '...',
        similarIn: similar ? constQueries.indexOf(similar) : -1,
        similarity: similar ? similar.similarity : 0
      });
    }
  });

  return {
    category,
    language,
    status: mismatches.length === 0 && unusedConstQueries.size === 0 ? 'PASS' : 'FAIL',
    testCount: testQueries.length,
    constCount: constQueries.length,
    originalConstCount,
    expandedCount,
    matchedCount: matches.length,
    mismatchedCount: mismatches.length,
    unusedConstQueriesCount: unusedConstQueries.size,
    mismatches,
    unusedConstQueryIndices: Array.from(unusedConstQueries)
  };
}

/**
 * 生成报告
 */
function generateReport(results) {
  const passed = results.filter(r => r.status === 'PASS');
  const failed = results.filter(r => r.status === 'FAIL');
  const errors = results.filter(r => r.status === 'ERROR');

  console.log('\n' + '='.repeat(70));
  console.log('查询一致性验证报告（支持交替模式还原和去重）');
  console.log('='.repeat(70) + '\n');

  if (errors.length > 0) {
    console.log('❌ 错误\n');
    errors.forEach(r => {
      console.log(`  [${r.language}:${r.category}]`);
      console.log(`    ${r.message}\n`);
    });
  }

  if (passed.length > 0) {
    console.log('✅ 通过的类别\n');
    passed.forEach(r => {
      console.log(`  [${r.language}:${r.category}]`);
      console.log(`    📊 查询统计: 原始常量查询 ${r.originalConstCount} → 展开后 ${r.constCount} (去重后)`);
      console.log(`    📋 测试用例统计: 总数 ${r.testCount}, ✓ 匹配 ${r.matchedCount}, ✗ 不匹配 ${r.mismatchedCount}`);
      console.log(`    🔍 展开查询使用情况: 已使用 ${r.constCount - r.unusedConstQueriesCount}, 未使用 ${r.unusedConstQueriesCount}`);
      
      if (r.expandedCount > 0) {
        console.log(`    📈 测试用例匹配率: ${(r.matchedCount / r.testCount * 100).toFixed(1)}% (${r.matchedCount}/${r.testCount})`);
        console.log(`    📊 展开查询覆盖率: ${(r.matchedCount / r.constCount * 100).toFixed(1)}% (${r.matchedCount}/${r.constCount})`);
      }
      console.log('');
    });
  }

  if (failed.length > 0) {
    console.log('❌ 失败的类别\n');
    failed.forEach(r => {
      console.log(`  [${r.language}:${r.category}]`);
      console.log(`    📊 查询统计: 原始常量查询 ${r.originalConstCount} → 展开后 ${r.constCount} (去重后)`);
      console.log(`    📋 测试用例统计: 总数 ${r.testCount}, ✓ 匹配 ${r.matchedCount}, ✗ 不匹配 ${r.mismatchedCount}`);
      console.log(`    🔍 展开查询使用情况: 已使用 ${r.constCount - r.unusedConstQueriesCount}, 未使用 ${r.unusedConstQueriesCount}`);
      
      if (r.expandedCount > 0) {
        console.log(`    📈 测试用例匹配率: ${(r.matchedCount / r.testCount * 100).toFixed(1)}% (${r.matchedCount}/${r.testCount})`);
        console.log(`    📊 展开查询覆盖率: ${(r.matchedCount / r.constCount * 100).toFixed(1)}% (${r.matchedCount}/${r.constCount})`);
      }

      if (r.mismatches.length > 0) {
        console.log(`\n    不匹配的测试用例:`);
        r.mismatches.forEach(m => {
          console.log(`      - ${m.testId}: 最相似度 ${m.similarity}%`);
        });
      }

      if (r.unusedConstQueryIndices.length > 0) {
        console.log(`\n    未被测试用例使用的常量查询索引: ${r.unusedConstQueryIndices.join(', ')}`);
      }
      console.log('');
    });
  }

  // 总体统计
  console.log('=' .repeat(70));
  console.log(`总计: ${results.length} 个类别`);
  console.log(`  ✅ 通过: ${passed.length}`);
  console.log(`  ❌ 失败: ${failed.length}`);
  console.log(`  ⚠️  错误: ${errors.length}`);
  
  // 展开统计
  const totalExpanded = results.reduce((sum, r) => sum + (r.expandedCount || 0), 0);
  const totalOriginal = results.reduce((sum, r) => sum + (r.originalConstCount || 0), 0);
  if (totalExpanded > 0) {
    console.log(`  📊 查询展开统计: 原始 ${totalOriginal} → 展开后 ${totalOriginal + totalExpanded} (去重后)`);
  }
  
  console.log('=' .repeat(70) + '\n');

  return {
    passed: passed.length,
    failed: failed.length,
    errors: errors.length,
    total: results.length,
    allPassed: failed.length === 0 && errors.length === 0
  };
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);

  // 解析参数
  let targetLanguage = null;
  let targetCategory = null;

  if (args.length > 0) {
    targetLanguage = args[0];
    if (args.length > 1) {
      targetCategory = args[1];
    }
  }

  // 验证语言
  const languages = targetLanguage
    ? [targetLanguage]
    : SUPPORTED_LANGUAGES;

  const results = [];

  languages.forEach(lang => {
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      console.warn(`⚠️  不支持的语言: ${lang}`);
      return;
    }

    const categories = targetCategory
      ? TEST_CATEGORIES[lang].filter(cat => cat.includes(targetCategory))
      : TEST_CATEGORIES[lang];

    categories.forEach(category => {
      const result = validateCategory(lang, category);
      results.push(result);
    });
  });

  // 生成报告
  const summary = generateReport(results);

  // 返回适当的退出码
  process.exit(summary.allPassed ? 0 : 1);
}

// 运行主函数
main();
