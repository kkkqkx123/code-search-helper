const { TreeSitterService } = require('../src/service/parser/core/parse/TreeSitterService');
const { TreeSitterCoreService } = require('../src/service/parser/core/parse/TreeSitterCoreService');
const { ASTCodeSplitter } = require('../src/service/parser/splitting/ASTCodeSplitter');
const { registerDefaultStrategies } = require('../src/service/parser/splitting/core/StrategyRegistration');
const fs = require('fs');
const path = require('path');

/**
 * 测试parser修复效果的脚本
 */
class ParserFixTester {
  constructor() {
    this.coreService = new TreeSitterCoreService();
    this.treeSitterService = new TreeSitterService(this.coreService);
    this.splitter = new ASTCodeSplitter(this.treeSitterService);
    
    // 注册策略
    registerDefaultStrategies();
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🚀 开始Parser修复测试...\n');
    
    const results = {
      languageDetection: await this.testLanguageDetection(),
      smallFileHandling: await this.testSmallFileHandling(),
      codeBlockValidation: await this.testCodeBlockValidation(),
      searchRelevance: await this.testSearchRelevance()
    };
    
    this.printResults(results);
    return results;
  }

  /**
   * 测试语言检测
   */
  async testLanguageDetection() {
    console.log('📝 测试语言检测...');
    
    const testCases = [
      { file: 'test-files/dataStructure/bt.go', expected: 'Go' },
      { file: 'test-files/dataStructure/datastructure/linked_list.go', expected: 'Go' },
      { file: 'test-files/dataStructure/堆排序.txt', expected: 'Go' }, // 内容应该是Go
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
      try {
        const content = fs.readFileSync(testCase.file, 'utf8');
        const detected = this.coreService.detectLanguage(testCase.file, content);
        
        const result = {
          file: testCase.file,
          expected: testCase.expected,
          detected: detected?.name || 'null',
          success: detected?.name === testCase.expected,
          contentPreview: content.substring(0, 100)
        };
        
        results.push(result);
        
        if (result.success) {
          console.log(`  ✅ ${path.basename(testCase.file)}: ${detected?.name}`);
        } else {
          console.log(`  ❌ ${path.basename(testCase.file)}: 期望 ${testCase.expected}, 实际 ${detected?.name}`);
        }
      } catch (error) {
        console.log(`  ❌ ${path.basename(testCase.file)}: 读取失败 - ${error.message}`);
        results.push({
          file: testCase.file,
          expected: testCase.expected,
          detected: 'error',
          success: false,
          error: error.message
        });
      }
    }
    
    const successRate = results.filter(r => r.success).length / results.length;
    console.log(`  📊 语言检测成功率: ${(successRate * 100).toFixed(1)}%\n`);
    
    return { results, successRate };
  }

  /**
   * 测试小文件处理
   */
  async testSmallFileHandling() {
    console.log('📝 测试小文件处理...');
    
    const testCases = [
      { file: 'test-files/dataStructure/bt.go', minLines: 1 },
      { file: 'test-files/dataStructure/tiny-test.go', content: 'package main\nfunc hello() { println("hi") }', minLines: 1 },
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
      try {
        let content;
        if (testCase.content) {
          content = testCase.content;
          // 创建临时文件
          fs.writeFileSync(testCase.file, content);
        } else {
          content = fs.readFileSync(testCase.file, 'utf8');
        }
        
        const chunks = await this.splitter.split(content, 'go', testCase.file);
        
        const result = {
          file: testCase.file,
          contentLines: content.split('\n').length,
          chunksGenerated: chunks.length,
          success: chunks.length >= testCase.minLines,
          chunkDetails: chunks.map(chunk => ({
            lines: chunk.content.split('\n').length,
            preview: chunk.content.substring(0, 50)
          }))
        };
        
        results.push(result);
        
        if (result.success) {
          console.log(`  ✅ ${path.basename(testCase.file)}: ${chunks.length} 个块, ${content.split('\n').length} 行`);
        } else {
          console.log(`  ❌ ${path.basename(testCase.file)}: 生成 ${chunks.length} 个块, 期望至少 ${testCase.minLines}`);
        }
        
        // 清理临时文件
        if (testCase.content && fs.existsSync(testCase.file)) {
          fs.unlinkSync(testCase.file);
        }
      } catch (error) {
        console.log(`  ❌ ${path.basename(testCase.file)}: 处理失败 - ${error.message}`);
        results.push({
          file: testCase.file,
          success: false,
          error: error.message
        });
      }
    }
    
    const successRate = results.filter(r => r.success).length / results.length;
    console.log(`  📊 小文件处理成功率: ${(successRate * 100).toFixed(1)}%\n`);
    
    return { results, successRate };
  }

  /**
   * 测试代码块验证
   */
  async testCodeBlockValidation() {
    console.log('📝 测试代码块验证...');
    
    const invalidCases = [
      '}',
      '{',
      ';',
      '',
      '   ',
      '// just comment',
      '/* just comment */'
    ];
    
    const validCases = [
      'package main\nfunc test() {}',
      'type Node struct { value int }',
      'import "fmt"\nfunc main() {}'
    ];
    
    const results = [];
    
    // 测试无效代码块应该被拒绝
    for (const invalidContent of invalidCases) {
      const chunks = await this.splitter.split(invalidContent, 'go', 'test.go');
      const result = {
        content: invalidContent,
        expected: 'rejected',
        actual: chunks.length === 0 ? 'rejected' : 'accepted',
        success: chunks.length === 0
      };
      results.push(result);
      
      if (result.success) {
        console.log(`  ✅ "${invalidContent}" 正确被拒绝`);
      } else {
        console.log(`  ❌ "${invalidContent}" 被错误接受, 生成了 ${chunks.length} 个块`);
      }
    }
    
    // 测试有效代码块应该被接受
    for (const validContent of validCases) {
      const chunks = await this.splitter.split(validContent, 'go', 'test.go');
      const result = {
        content: validContent,
        expected: 'accepted',
        actual: chunks.length > 0 ? 'accepted' : 'rejected',
        success: chunks.length > 0
      };
      results.push(result);
      
      if (result.success) {
        console.log(`  ✅ 有效代码块被正确接受`);
      } else {
        console.log(`  ❌ 有效代码块被错误拒绝`);
      }
    }
    
    const successRate = results.filter(r => r.success).length / results.length;
    console.log(`  📊 代码块验证成功率: ${(successRate * 100).toFixed(1)}%\n`);
    
    return { results, successRate };
  }

  /**
   * 测试搜索相关性
   */
  async testSearchRelevance() {
    console.log('📝 测试搜索相关性...');
    
    // 模拟搜索"tree struct"的结果
    const testContent = fs.readFileSync('test-files/dataStructure/bt.go', 'utf8');
    const chunks = await this.splitter.split(testContent, 'go', 'bt.go');
    
    // 模拟搜索关键词匹配
    const searchTerms = ['tree', 'struct', 'node'];
    const relevantChunks = [];
    
    for (const chunk of chunks) {
      const contentLower = chunk.content.toLowerCase();
      const matches = searchTerms.filter(term => contentLower.includes(term));
      if (matches.length > 0) {
        relevantChunks.push({
          chunk,
          matches,
          relevance: matches.length / searchTerms.length
        });
      }
    }
    
    // 排序按相关性
    relevantChunks.sort((a, b) => b.relevance - a.relevance);
    
    console.log(`  找到 ${relevantChunks.length} 个相关块`);
    console.log(`  最高相关性: ${relevantChunks.length > 0 ? relevantChunks[0].relevance : 0}`);
    
    // 检查是否包含结构定义
    const hasStructDefinition = relevantChunks.some(item => 
      item.chunk.content.includes('type') && item.chunk.content.includes('struct')
    );
    
    const result = {
      totalChunks: chunks.length,
      relevantChunks: relevantChunks.length,
      maxRelevance: relevantChunks.length > 0 ? relevantChunks[0].relevance : 0,
      hasStructDefinition,
      success: relevantChunks.length > 0 && hasStructDefinition
    };
    
    if (result.success) {
      console.log(`  ✅ 搜索相关性测试通过`);
    } else {
      console.log(`  ❌ 搜索相关性测试失败`);
    }
    
    return result;
  }

  /**
   * 打印测试结果
   */
  printResults(results) {
    console.log('\n📊 测试结果汇总:');
    console.log('==================');
    
    console.log(`语言检测成功率: ${(results.languageDetection.successRate * 100).toFixed(1)}%`);
    console.log(`小文件处理成功率: ${(results.smallFileHandling.successRate * 100).toFixed(1)}%`);
    console.log(`代码块验证成功率: ${(results.codeBlockValidation.successRate * 100).toFixed(1)}%`);
    
    const overallSuccess = (
      results.languageDetection.successRate * 0.3 +
      results.smallFileHandling.successRate * 0.3 +
      results.codeBlockValidation.successRate * 0.2 +
      (results.searchRelevance.success ? 1 : 0) * 0.2
    );
    
    console.log(`\n🎯 总体修复效果: ${(overallSuccess * 100).toFixed(1)}%`);
    
    if (overallSuccess >= 0.8) {
      console.log('✅ 修复效果良好，建议部署到生产环境');
    } else if (overallSuccess >= 0.6) {
      console.log('⚠️  修复效果一般，建议进一步优化');
    } else {
      console.log('❌ 修复效果不佳，需要深入分析问题');
    }
    
    console.log('\n📋 详细结果已保存到: test-results-parser-fix.json');
    
    // 保存详细结果
    fs.writeFileSync('test-results-parser-fix.json', JSON.stringify(results, null, 2));
  }
}

// 运行测试
async function main() {
  const tester = new ParserFixTester();
  
  try {
    const results = await tester.runAllTests();
    
    // 检查是否有重大改进
    const hasImprovement = 
      results.languageDetection.successRate > 0.7 &&
      results.smallFileHandling.successRate > 0.7 &&
      results.codeBlockValidation.successRate > 0.8;
    
    if (hasImprovement) {
      console.log('\n🎉 Parser修复测试完成，检测到显著改进！');
    } else {
      console.log('\n⚠️  Parser修复测试完成，但改进效果有限，建议进一步分析。');
    }
    
  } catch (error) {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { ParserFixTester };