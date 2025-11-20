#!/usr/bin/env node

/**
 * 测试匹配逻辑是否正确
 */

const fs = require('fs');
const path = require('path');

// 导入验证脚本中的函数
const { execSync } = require('child_process');

function testMatchingLogic() {
  console.log('🧪 测试匹配逻辑\n');
  
  try {
    // 运行验证脚本
    const output = execSync('node validate-queries-consistency.js c concurrency-relationships', {
      cwd: __dirname,
      encoding: 'utf-8'
    });
    
    console.log('📋 验证脚本输出:');
    console.log(output);
    
    // 分析输出
    const lines = output.split('\n');
    
    // 提取统计信息
    const testCountLine = lines.find(line => line.includes('测试用例:'));
    const constCountLine = lines.find(line => line.includes('展开后:'));
    const matchedLine = lines.find(line => line.includes('匹配:'));
    const mismatchedLine = lines.find(line => line.includes('不匹配:'));
    
    if (testCountLine && constCountLine && matchedLine && mismatchedLine) {
      const testCount = parseInt(testCountLine.match(/测试用例: (\d+)/)[1]);
      const constCount = parseInt(constCountLine.match(/展开后: (\d+)/)[1]);
      const matchedCount = parseInt(matchedLine.match(/匹配: (\d+)/)[1]);
      const mismatchedCount = parseInt(mismatchedLine.match(/不匹配: (\d+)/)[1]);
      
      console.log('\n📊 匹配统计验证:');
      console.log(`测试用例总数: ${testCount}`);
      console.log(`常量查询总数（展开后）: ${constCount}`);
      console.log(`匹配数量: ${matchedCount}`);
      console.log(`不匹配数量: ${mismatchedCount}`);
      console.log(`验证: ${matchedCount} + ${mismatchedCount} = ${matchedCount + mismatchedCount} (应该等于 ${testCount})`);
      
      if (matchedCount + mismatchedCount === testCount) {
        console.log('✅ 匹配统计正确');
      } else {
        console.log('❌ 匹配统计有误');
      }
      
      // 计算匹配率
      const matchRate = (matchedCount / testCount * 100).toFixed(1);
      console.log(`📈 匹配率: ${matchRate}%`);
      
      // 检查是否是基于展开后的查询进行匹配
      console.log('\n🔍 匹配逻辑分析:');
      console.log('当前实现是基于展开+去重后的常量查询进行匹配');
      console.log('这意味着:');
      console.log('1. 原始合并查询被展开为基础格式');
      console.log('2. 展开后的查询进行去重处理');
      console.log('3. 测试用例与去重后的展开查询进行精确匹配');
      
    } else {
      console.log('❌ 无法提取统计信息');
    }
    
  } catch (error) {
    console.error('❌ 运行验证脚本时出错:', error.message);
  }
}

// 运行测试
testMatchingLogic();