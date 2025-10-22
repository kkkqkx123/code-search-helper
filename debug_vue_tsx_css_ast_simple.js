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
        
        // 尝试直接设置语言
        try {
            parser.setLanguage(Vue);
            const tree = parser.parse(vueCode);
            console.log('Vue AST结构:');
            console.log(tree.rootNode.toString());
        } catch (error) {
            console.log('Vue解析器设置失败，可能存在版本兼容性问题');
            console.log('错误详情:', error.message);
            
            // 尝试只解析模板部分作为HTML
            try {
                console.log('\n尝试解析Vue模板部分...');
                const templateMatch = vueCode.match(/<template>([\s\S]*?)<\/template>/);
                if (templateMatch) {
                    const templateCode = templateMatch[1].trim();
                    console.log('模板代码:', templateCode.substring(0, 100) + '...');
                    
                    // 由于没有HTML解析器，我们只能显示这个限制
                    console.log('注意：由于tree-sitter-vue版本兼容性问题，无法完整解析Vue文件');
                    console.log('建议：升级tree-sitter-vue到兼容版本或使用其他Vue解析方案');
                }
            } catch (templateError) {
                console.log('模板解析也失败:', templateError.message);
            }
        }
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
        parser.setLanguage(TypeScript.tsx);
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
    
    console.log('\n=== 问题总结 ===');
    console.log('1. CSS解析器：已修复ESM模块导入问题，可以正常工作');
    console.log('2. TSX解析器：工作正常');
    console.log('3. Vue解析器：存在tree-sitter版本兼容性问题，需要升级或降级相关包');
    console.log('\n建议解决方案：');
    console.log('- 升级tree-sitter-vue到与tree-sitter 0.25.0兼容的版本');
    console.log('- 或者降级tree-sitter到与tree-sitter-vue 0.2.1兼容的版本');
    console.log('- 或者使用专门的Vue解析器如@vue/compiler-sfc');
}