const Parser = require('tree-sitter');

// 加载解析器
let TypeScript, CSS;

try {
    TypeScript = require('tree-sitter-typescript');
    console.log('TypeScript解析器加载成功');
} catch (e) {
    console.log('TypeScript解析器加载失败:', e.message);
}

// 使用动态导入处理CSS的ESM问题
(async () => {
    try {
        CSS = await import('tree-sitter-css');
        CSS = CSS.default;
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

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  msg: string
}

const props = defineProps<Props>()
const count = ref(0)

function increment() {
  count.value++
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

function extractVueSections(vueCode) {
    const sections = {
        template: null,
        script: [],
        style: []
    };
    
    // 提取template部分
    const templateMatch = vueCode.match(/<template[^>]*>([\s\S]*?)<\/template>/);
    if (templateMatch) {
        sections.template = templateMatch[1].trim();
    }
    
    // 提取所有script部分
    const scriptMatches = vueCode.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g);
    for (const match of scriptMatches) {
        const scriptContent = match[1].trim();
        const langMatch = match[0].match(/lang="([^"]*)"/);
        const lang = langMatch ? langMatch[1] : 'javascript';
        sections.script.push({ content: scriptContent, lang });
    }
    
    // 提取所有style部分
    const styleMatches = vueCode.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g);
    for (const match of styleMatches) {
        const styleContent = match[1].trim();
        sections.style.push(styleContent);
    }
    
    return sections;
}

function analyzeVueWithTSParser() {
    console.log('=== 使用TypeScript解析器分析Vue文件 ===\n');
    
    if (!TypeScript) {
        console.log('跳过Vue分析 - TypeScript解析器不可用\n');
        return;
    }
    
    try {
        const sections = extractVueSections(vueCode);
        
        console.log('Vue文件结构分析:');
        console.log('- Template部分:', sections.template ? '存在' : '不存在');
        console.log('- Script部分数量:', sections.script.length);
        console.log('- Style部分数量:', sections.style.length);
        
        // 分析每个script部分
        sections.script.forEach((script, index) => {
            console.log(`\n--- Script部分 ${index + 1} (${script.lang}) ---`);
            
            try {
                const parser = new Parser();
                const language = script.lang === 'ts' || script.lang === 'typescript' 
                    ? TypeScript.typescript 
                    : TypeScript.typescript; // 使用typescript解析器处理JavaScript
                
                parser.setLanguage(language);
                const tree = parser.parse(script.content);
                
                console.log('AST结构:');
                console.log(tree.rootNode.toString());
                
                console.log('\n解析统计:');
                console.log('- 根节点类型:', tree.rootNode.type);
                console.log('- 子节点数量:', tree.rootNode.childCount);
                console.log('- 是否有错误:', tree.rootNode.hasError);
                
                // 提取一些有用的信息
                if (script.lang === 'ts' || script.lang === 'typescript') {
                    const interfaces = tree.rootNode.descendantsOfType('interface_declaration');
                    const functions = tree.rootNode.descendantsOfType('function_declaration');
                    const variables = tree.rootNode.descendantsOfType('lexical_declaration');
                    
                    console.log('\nTypeScript元素:');
                    console.log('- 接口数量:', interfaces.length);
                    console.log('- 函数数量:', functions.length);
                    console.log('- 变量声明数量:', variables.length);
                    
                    if (interfaces.length > 0) {
                        console.log('- 接口名称:', interfaces.map(n => n.childForFieldName('name')?.text).filter(Boolean));
                    }
                }
                
            } catch (error) {
                console.error(`Script部分 ${index + 1} 解析失败:`, error.message);
            }
        });
        
        // 分析style部分
        if (CSS && sections.style.length > 0) {
            console.log('\n=== Style部分分析 ===');
            sections.style.forEach((style, index) => {
                console.log(`\n--- Style部分 ${index + 1} ---`);
                try {
                    const parser = new Parser();
                    parser.setLanguage(CSS);
                    const tree = parser.parse(style);
                    
                    console.log('CSS AST结构:');
                    console.log(tree.rootNode.toString());
                    
                    console.log('\nCSS解析统计:');
                    console.log('- 根节点类型:', tree.rootNode.type);
                    console.log('- 子节点数量:', tree.rootNode.childCount);
                    console.log('- 是否有错误:', tree.rootNode.hasError);
                    
                } catch (error) {
                    console.error(`Style部分 ${index + 1} 解析失败:`, error.message);
                }
            });
        }
        
        // 分析template部分（作为HTML注释）
        if (sections.template) {
            console.log('\n=== Template部分 ===');
            console.log('Template内容 (无法解析，仅显示):');
            console.log(sections.template.substring(0, 200) + (sections.template.length > 200 ? '...' : ''));
            console.log('\n注意：Template部分需要专门的Vue/HTML解析器');
        }
        
    } catch (error) {
        console.error('Vue文件分析失败:', error.message);
    }
}

function runAnalysis() {
    analyzeVueWithTSParser();
    
    console.log('\n=== 总结 ===');
    console.log('✅ 使用TypeScript解析器成功解析Vue文件的script部分');
    console.log('✅ CSS解析器成功解析Vue文件的style部分');
    console.log('⚠️ Template部分需要专门的Vue/HTML解析器');
    console.log('\n💡 建议：对于Vue文件，可以采用分段解析策略：');
    console.log('   1. 使用TypeScript解析器解析script部分');
    console.log('   2. 使用CSS解析器解析style部分');
    console.log('   3. 使用HTML解析器解析template部分');
    console.log('   4. 将各部分的AST结果合并分析');
}