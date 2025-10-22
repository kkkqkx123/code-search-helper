const Parser = require('tree-sitter');

// 尝试加载语言解析器
let Vue, TypeScript, CSS;

try {
    Vue = require('tree-sitter-vue');
} catch (e) {
    console.log('Vue解析器加载失败:', e.message);
}

try {
    TypeScript = require('tree-sitter-typescript');
} catch (e) {
    console.log('TypeScript解析器加载失败:', e.message);
}

try {
    CSS = require('tree-sitter-css');
} catch (e) {
    console.log('CSS解析器加载失败:', e.message);
}

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
        parser.setLanguage(Vue);
        const tree = parser.parse(vueCode);
        console.log('Vue AST结构:');
        console.log(tree.rootNode.toString());
    } catch (error) {
        console.error('Vue AST分析失败:', error.message);
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
        parser.setLanguage(TypeScript.typescript);
        const tree = parser.parse(tsxCode);
        console.log('TSX AST结构:');
        console.log(tree.rootNode.toString());
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
    } catch (error) {
        console.error('CSS AST分析失败:', error.message);
    }
}

function runAnalysis() {
    analyzeVueAST();
    analyzeTSXAST();
    analyzeCSSAST();
}

runAnalysis();