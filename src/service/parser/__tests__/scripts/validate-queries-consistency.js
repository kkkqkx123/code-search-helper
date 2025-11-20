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
    'preprocessor'
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

  return queries;
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
          type: 'exact'
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
  console.log('查询一致性验证报告');
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
      console.log(`    测试用例: ${r.testCount}, 常量查询: ${r.constCount}, 匹配: ${r.matchedCount}\n`);
    });
  }

  if (failed.length > 0) {
    console.log('❌ 失败的类别\n');
    failed.forEach(r => {
      console.log(`  [${r.language}:${r.category}]`);
      console.log(`    测试用例: ${r.testCount}, 常量查询: ${r.constCount}`);
      console.log(`    ✓ 匹配: ${r.matchedCount}`);
      console.log(`    ✗ 不匹配: ${r.mismatchedCount}`);
      console.log(`    ⚠️  未使用常量查询: ${r.unusedConstQueriesCount}`);

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
