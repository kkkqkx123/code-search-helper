#!/usr/bin/env node

/**
 * 测试查询展开功能
 */

const fs = require('fs');
const path = require('path');

// 简单的测试：直接运行验证脚本并分析输出
function testExpandFunctionality() {
  console.log('🧪 测试查询展开功能\n');
  
  // 运行验证脚本并捕获输出
  const { execSync } = require('child_process');
  
  try {
    const output = execSync('node validate-queries-consistency.js c concurrency-relationships', {
      cwd: __dirname,
      encoding: 'utf-8'
    });
    
    console.log('📋 验证脚本输出:');
    console.log(output);
    
    // 分析输出中的展开统计
    const lines = output.split('\n');
    const expandStatsLine = lines.find(line => line.includes('展开统计:'));
    
    if (expandStatsLine) {
      console.log('\n📊 展开功能分析:');
      console.log(expandStatsLine);
      
      // 提取数字
      const matches = expandStatsLine.match(/原始 (\d+) → 展开后 (\d+)/);
      if (matches) {
        const [_, original, expanded] = matches;
        console.log(`✅ 成功将 ${original} 个原始查询展开为 ${expanded} 个查询`);
        console.log(`📈 展开倍数: ${(expanded / original).toFixed(2)}x`);
      }
    }
    
    // 检查是否有匹配的测试用例
    const matchLine = lines.find(line => line.includes('匹配:'));
    if (matchLine) {
      const matchCount = matchLine.match(/匹配: (\d+)/);
      if (matchCount) {
        console.log(`✅ 成功匹配 ${matchCount[1]} 个测试用例`);
      }
    }
    
  } catch (error) {
    console.error('❌ 运行验证脚本时出错:', error.message);
  }
}

// 运行测试
testExpandFunctionality();