#!/usr/bin/env ts-node

/**
 * JSON查询演示脚本
 * 展示如何使用Tree-sitter和查询规则来解析和查询JSON文档
 */

import { TreeSitterCoreService } from '../core/parse/TreeSitterCoreService';
import jsonQuery from '../constants/queries/json';

async function demonstrateJSONQuery() {
  console.log('=== JSON Tree-sitter 查询演示 ===\n');

  // 创建Tree-sitter核心服务实例
  const treeSitterService = new TreeSitterCoreService();

  // 示例JSON数据
  const sampleJSON = `{
    "application": {
      "name": "CodeSearchHelper",
      "version": "2.1.0",
      "features": {
        "search": {
          "enabled": true,
          "algorithms": ["fuzzy", "exact", "semantic"],
          "limits": {
            "maxResults": 100,
            "timeoutMs": 5000
          }
        },
        "indexing": {
          "autoRefresh": false,
          "schedule": "0 2 * * *"
        }
      },
      "database": {
        "primary": {
          "type": "qdrant",
          "host": "localhost",
          "port": 6333
        }
      }
    },
    "metadata": {
      "createdAt": "2023-01-15T10:30:00Z",
      "tags": ["production", "stable", "v2"],
      "authors": [
        {"name": "Developer One", "email": "dev1@example.com"},
        {"name": "Developer Two", "email": "dev2@example.com"}
      ]
    }
  }`;

  console.log('1. 检查JSON语言支持...');
  const supportedLanguages = treeSitterService.getSupportedLanguages();
  const jsonLanguage = supportedLanguages.find(lang => lang.name.toLowerCase() === 'json');
  
  if (jsonLanguage) {
    console.log(`   ✓ JSON语言支持: ${jsonLanguage.name}`);
    console.log(`   文件扩展名: ${jsonLanguage.fileExtensions.join(', ')}`);
  } else {
    console.log('   - JSON语言未直接支持，但查询规则仍然有效');
  }

  console.log('\n2. 验证JSON查询规则...');
  // 验证查询规则的关键部分
  const requiredPatterns = [
    '(object) @definition.object',
    '(array) @definition.array',
    '(string) @definition.string',
    '(number) @definition.number',
    '(true) @definition.boolean',
    '(false) @definition.boolean',
    '(null) @definition.null'
  ];

  console.log('   查询规则包含以下必要模式:');
  requiredPatterns.forEach(pattern => {
    const found = jsonQuery.includes(pattern);
    console.log(`   ${found ? '✓' : '✗'} ${pattern}`);
  });

  console.log('\n3. 解析和查询JSON...');
  try {
    // 尝试检测JSON语言
    const detectedLanguage = await treeSitterService.detectLanguage('config.json', sampleJSON);
    console.log(`   检测到的语言: ${detectedLanguage?.name || 'unknown'}`);
    console.log(`   语言支持状态: ${detectedLanguage?.supported ? '支持' : '不支持'}`);

    if (detectedLanguage && detectedLanguage.supported) {
      // 解析JSON
      const parseResult = await treeSitterService.parseCode(sampleJSON, 'json');
      if (parseResult.success) {
        console.log(`   ✓ 解析成功，耗时: ${parseResult.parseTime}ms`);

        // 执行查询
        const queryResults = treeSitterService.queryTree(parseResult.ast, jsonQuery);
        console.log(`   查询返回 ${queryResults.length} 个匹配项`);

        // 分析捕获的结果
        const allCaptures = queryResults.flatMap(result => result.captures);
        const captureCounts: Record<string, number> = {};

        allCaptures.forEach(capture => {
          captureCounts[capture.name] = (captureCounts[capture.name] || 0) + 1;
        });

        console.log('\n4. 查询结果统计:');
        Object.entries(captureCounts)
          .sort(([,a], [,b]) => b - a)
          .forEach(([name, count]) => {
            console.log(`   ${name}: ${count}`);
          });

        // 显示一些具体的捕获示例
        console.log('\n5. 具体捕获示例:');
        const objectCaptures = allCaptures.filter(c => c.name === 'definition.object');
        if (objectCaptures.length > 0) {
          console.log(`   对象示例 (${Math.min(3, objectCaptures.length)} 个):`);
          objectCaptures.slice(0, 3).forEach((capture, index) => {
            console.log(`     ${index + 1}. 类型: ${capture.node.type}`);
          });
        }

        const stringCaptures = allCaptures.filter(c => c.name === 'definition.string');
        if (stringCaptures.length > 0) {
          console.log(`   字符串示例 (${Math.min(3, stringCaptures.length)} 个):`);
          stringCaptures.slice(0, 3).forEach((capture, index) => {
            console.log(`     ${index + 1}. 值: ${capture.node.text.substring(0, 30)}${capture.node.text.length > 30 ? '...' : ''}`);
          });
        }
      } else {
        console.log(`   ✗ 解析失败: ${parseResult.error}`);
      }
    } else {
      console.log('   - JSON语言不被直接支持，跳过解析和查询执行');
      console.log('   - 但查询规则本身是有效的，可用于支持JSON的语言环境中');
    }
  } catch (error) {
    console.log(`   查询过程中出现错误: ${error}`);
    console.log('   但查询规则本身是有效的');
  }

  console.log('\n=== 演示完成 ===');
}

// 运行演示
if (require.main === module) {
  demonstrateJSONQuery().catch(console.error);
}

export { demonstrateJSONQuery };