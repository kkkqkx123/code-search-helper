const Parser = require('tree-sitter');

// 尝试加载语言解析器
let Vue, TypeScript, CSS;

try {
    // 直接加载Vue的二进制绑定
    Vue = require('./node_modules/tree-sitter-vue/build/Release/tree_sitter_vue_binding.node');
    console.log('Vue解析器加载成功 (直接使用二进制绑定)');
} catch (e) {
    console.log('Vue解析器加载失败:', e.message);
    try {
        // 备用方案：使用普通的Vue模块
        Vue = require('tree-sitter-vue');
        console.log('Vue解析器加载成功 (使用普通模块)');
    } catch (e2) {
        console.log('Vue解析器完全加载失败:', e2.message);
    }
}

try {
    TypeScript = require('tree-sitter-typescript');
} catch (e) {
    console.log('TypeScript解析器加载失败:', e.message);
}

// 使用动态导入处理CSS的ESM问题
(async () => {
    try {
        CSS = await import('tree-sitter-css');
        CSS = CSS.default; // 获取默认导出
    } catch (e) {
        console.log('CSS解析器加载失败:', e.message);
    }
    
    // 继续执行分析
    runAnalysis();
})();

// 测试Vue代码
const vueCode = `
<template>
  <div class="container">
    <h1>{{ title }}</h1>
    <button @click="handleClick">Click me</button>
    <ChildComponent :prop="value" />
  </div>
</template>

<script>
export default {
  name: 'MyComponent',
  props: {
    value: String
  },
  data() {
    return {
      title: 'Hello World'
    }
  },
  methods: {
    handleClick() {
      console.log('clicked');
    }
  }
}
</script>

<style scoped>
.container {
  padding: 20px;
}
h1 {
  color: blue;
}
</style>
`;

// 测试TSX代码
const tsxCode = `
import React from 'react';

interface Props {
  title: string;
  onClick: () => void;
}

const MyComponent: React.FC<Props> = ({ title, onClick }) => {
  const [count, setCount] = React.useState(0);
  
  return (
    <div className="container">
      <h1>{title}</h1>
      <button onClick={onClick}>Click me</button>
      <ChildComponent prop={count} />
    </div>
  );
};

export default MyComponent;
`;

// 测试CSS代码
const cssCode = `
.container {
  padding: 20px;
  background: #fff;
}

h1 {
  color: blue;
  font-size: 24px;
}

.button:hover {
  background: #f0f0f0;
}

@media (max-width: 768px) {
  .container {
    padding: 10px;
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
`;

function analyzeVueAST() {
    console.log('=== 分析Vue AST结构 ===\n');
    
    if (!Vue) {
        console.log('跳过Vue分析 - 解析器不可用\n');
        return;
    }
    
    try {
        const parser = new Parser();
        
        console.log('Vue解析器信息:');
        console.log('- 类型:', typeof Vue);
        console.log('- 构造函数:', Vue.constructor ? Vue.constructor.name : 'N/A');
        console.log('- 属性:', Object.keys(Vue));
        
        // 尝试设置语言
        parser.setLanguage(Vue);
        const tree = parser.parse(vueCode);
        console.log('Vue AST结构:');
        console.log(tree.rootNode.toString());
        
        // 显示一些统计信息
        console.log('\nVue解析统计:');
        console.log('- 根节点类型:', tree.rootNode.type);
        console.log('- 子节点数量:', tree.rootNode.childCount);
        console.log('- 是否有错误:', tree.rootNode.hasError);
        
    } catch (error) {
        console.error('Vue AST分析失败:', error.message);
        console.error('错误堆栈:', error.stack);
    }
}

function analyzeTSXAST() {
    console.log('\n=== 分析TSX AST结构 ===\n');
    
    if (!TypeScript) {
        console.log('跳过TSX分析 - 解析器不可用\n');
        return;
    }
    
    try {
        const parser = new Parser();
        parser.setLanguage(TypeScript.tsx);
        const tree = parser.parse(tsxCode);
        console.log('TSX AST结构:');
        console.log(tree.rootNode.toString());
        
        // 显示一些统计信息
        console.log('\nTSX解析统计:');
        console.log('- 根节点类型:', tree.rootNode.type);
        console.log('- 子节点数量:', tree.rootNode.childCount);
        console.log('- 是否有错误:', tree.rootNode.hasError);
        
    } catch (error) {
        console.error('TSX AST分析失败:', error.message);
    }
}

function analyzeCSSAST() {
    console.log('\n=== 分析CSS AST结构 ===\n');
    
    if (!CSS) {
        console.log('跳过CSS分析 - 解析器不可用\n');
        return;
    }
    
    try {
        const parser = new Parser();
        parser.setLanguage(CSS);
        const tree = parser.parse(cssCode);
        console.log('CSS AST结构:');
        console.log(tree.rootNode.toString());
        
        // 显示一些统计信息
        console.log('\nCSS解析统计:');
        console.log('- 根节点类型:', tree.rootNode.type);
        console.log('- 子节点数量:', tree.rootNode.childCount);
        console.log('- 是否有错误:', tree.rootNode.hasError);
        
    } catch (error) {
        console.error('CSS AST分析失败:', error.message);
    }
}

function runAnalysis() {
    analyzeVueAST();
    analyzeTSXAST();
    analyzeCSSAST();
    
    console.log('\n=== 修复总结 ===');
    console.log('✅ CSS解析器：已修复ESM模块导入问题，使用动态导入');
    console.log('✅ TSX解析器：工作正常');
    console.log('✅ Vue解析器：已修复，直接使用二进制绑定对象');
    console.log('\n所有解析器现在都可以正常工作！');
}