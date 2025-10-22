const Parser = require('tree-sitter');

// 使用动态导入来处理ESM模块
async function loadParsers() {
    let Vue, TypeScript, CSS;
    
    try {
        Vue = require('tree-sitter-vue');
        console.log('Vue解析器加载成功');
    } catch (e) {
        console.log('Vue解析器加载失败:', e.message);
    }
    
    try {
        TypeScript = require('tree-sitter-typescript');
        console.log('TypeScript解析器加载成功');
    } catch (e) {
        console.log('TypeScript解析器加载失败:', e.message);
    }
    
    try {
        // 使用动态导入处理ESM模块
        CSS = await import('tree-sitter-css');
        console.log('CSS解析器加载成功');
    } catch (e) {
        console.log('CSS解析器加载失败:', e.message);
        
        // 尝试备用方案：直接使用WASM版本
        try {
            const fs = require('fs');
            const path = require('path');
            const wasmPath = path.join(__dirname, 'node_modules', 'tree-sitter-css', 'tree-sitter-css.wasm');
            
            if (fs.existsSync(wasmPath)) {
                console.log('尝试加载CSS WASM版本...');
                const wasmBuffer = fs.readFileSync(wasmPath);
                CSS = Parser.Language.load(wasmBuffer);
                console.log('CSS WASM解析器加载成功');
            }
        } catch (wasmError) {
            console.log('CSS WASM解析器加载失败:', wasmError.message);
        }
    }
    
    return { Vue, TypeScript, CSS };
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

async function analyzeVueAST(Vue) {
    console.log('=== 分析Vue AST结构 ===\n');
    
    if (!Vue) {
        console.log('跳过Vue分析 - 解析器不可用\n');
        return;
    }
    
    try {
        const parser = new Parser();
        
        // 检查Vue解析器的结构
        console.log('Vue解析器类型:', typeof Vue);
        console.log('Vue解析器属性:', Object.keys(Vue));
        
        // 尝试不同的方式设置语言
        let language = Vue;
        if (Vue.typescript) {
            language = Vue.typescript;
        } else if (Vue.default) {
            language = Vue.default;
        }
        
        parser.setLanguage(language);
        const tree = parser.parse(vueCode);
        console.log('Vue AST结构:');
        console.log(tree.rootNode.toString());
    } catch (error) {
        console.error('Vue AST分析失败:', error.message);
        console.error('错误堆栈:', error.stack);
    }
}

async function analyzeTSXAST(TypeScript) {
    console.log('\n=== 分析TSX AST结构 ===\n');
    
    if (!TypeScript) {
        console.log('跳过TSX分析 - 解析器不可用\n');
        return;
    }
    
    try {
        const parser = new Parser();
        
        // TypeScript解析器通常有typescript和tsx两个语言
        const language = TypeScript.tsx || TypeScript.typescript || TypeScript;
        
        console.log('使用TypeScript语言:', language === TypeScript.tsx ? 'tsx' : 'typescript');
        
        parser.setLanguage(language);
        const tree = parser.parse(tsxCode);
        console.log('TSX AST结构:');
        console.log(tree.rootNode.toString());
    } catch (error) {
        console.error('TSX AST分析失败:', error.message);
        console.error('错误堆栈:', error.stack);
    }
}

async function analyzeCSSAST(CSS) {
    console.log('\n=== 分析CSS AST结构 ===\n');
    
    if (!CSS) {
        console.log('跳过CSS分析 - 解析器不可用\n');
        return;
    }
    
    try {
        const parser = new Parser();
        
        // 处理不同的CSS解析器格式
        let language = CSS;
        if (CSS.default) {
            language = CSS.default;
        }
        
        console.log('CSS解析器类型:', typeof language);
        
        parser.setLanguage(language);
        const tree = parser.parse(cssCode);
        console.log('CSS AST结构:');
        console.log(tree.rootNode.toString());
    } catch (error) {
        console.error('CSS AST分析失败:', error.message);
        console.error('错误堆栈:', error.stack);
    }
}

async function runAnalysis() {
    console.log('开始加载解析器...\n');
    const { Vue, TypeScript, CSS } = await loadParsers();
    
    await analyzeVueAST(Vue);
    await analyzeTSXAST(TypeScript);
    await analyzeCSSAST(CSS);
}

// 运行分析
runAnalysis().catch(console.error);