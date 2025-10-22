const Parser = require('tree-sitter');

/**
 * Vue文件解析器 - 使用分段解析策略
 * 解决tree-sitter-vue兼容性问题的实用方案
 */
class VueFileParser {
    constructor() {
        this.typeScript = null;
        this.css = null;
        this.html = null;
        this.initializeParsers();
    }

    async initializeParsers() {
        try {
            this.typeScript = require('tree-sitter-typescript');
            console.log('✅ TypeScript解析器加载成功');
        } catch (e) {
            console.log('❌ TypeScript解析器加载失败:', e.message);
        }

        try {
            this.css = await import('tree-sitter-css');
            this.css = this.css.default;
            console.log('✅ CSS解析器加载成功');
        } catch (e) {
            console.log('❌ CSS解析器加载失败:', e.message);
        }

        try {
            // 尝试加载HTML解析器用于template部分
            this.html = require('tree-sitter-html');
            console.log('✅ HTML解析器加载成功');
        } catch (e) {
            console.log('⚠️ HTML解析器加载失败，template部分将无法解析:', e.message);
        }
    }

    /**
     * 解析Vue文件，提取各个部分
     */
    parseVueFile(vueCode) {
        const sections = {
            template: null,
            script: [],
            style: []
        };
        
        // 提取template部分
        const templateMatch = vueCode.match(/<template[^>]*>([\s\S]*?)<\/template>/);
        if (templateMatch) {
            sections.template = {
                content: templateMatch[1].trim(),
                lang: 'html'
            };
        }
        
        // 提取所有script部分
        const scriptMatches = vueCode.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g);
        for (const match of scriptMatches) {
            const scriptContent = match[1].trim();
            const langMatch = match[0].match(/lang="([^"]*)"/);
            const lang = langMatch ? langMatch[1] : 'javascript';
            sections.script.push({
                content: scriptContent,
                lang: lang
            });
        }
        
        // 提取所有style部分
        const styleMatches = vueCode.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g);
        for (const match of styleMatches) {
            const styleContent = match[1].trim();
            const scopedMatch = match[0].match(/scoped/);
            sections.style.push({
                content: styleContent,
                scoped: !!scopedMatch
            });
        }
        
        return sections;
    }

    /**
     * 解析Vue文件的各个部分
     */
    async analyzeVueFile(vueCode) {
        if (!this.typeScript || !this.css) {
            throw new Error('必要的解析器未初始化');
        }

        const sections = this.parseVueFile(vueCode);
        const analysis = {
            template: null,
            script: [],
            style: [],
            summary: {
                hasTemplate: !!sections.template,
                scriptCount: sections.script.length,
                styleCount: sections.style.length,
                hasTypeScript: sections.script.some(s => s.lang === 'ts'),
                hasScopedStyles: sections.style.some(s => s.scoped)
            }
        };

        // 分析template部分
        if (sections.template && this.html) {
            try {
                const parser = new Parser();
                parser.setLanguage(this.html);
                const tree = parser.parse(sections.template.content);
                
                analysis.template = {
                    ast: tree.rootNode.toString(),
                    statistics: {
                        nodeType: tree.rootNode.type,
                        childCount: tree.rootNode.childCount,
                        hasError: tree.rootNode.hasError
                    }
                };
            } catch (error) {
                analysis.template = {
                    error: error.message,
                    content: sections.template.content
                };
            }
        } else if (sections.template) {
            analysis.template = {
                content: sections.template.content,
                note: 'HTML解析器不可用，仅显示原始内容'
            };
        }

        // 分析script部分
        for (let i = 0; i < sections.script.length; i++) {
            const script = sections.script[i];
            const scriptAnalysis = {
                lang: script.lang,
                ast: null,
                statistics: null,
                typescriptInfo: null,
                error: null
            };

            try {
                const parser = new Parser();
                const language = script.lang === 'ts' || script.lang === 'typescript' 
                    ? this.typeScript.typescript 
                    : this.typeScript.typescript;
                
                parser.setLanguage(language);
                const tree = parser.parse(script.content);
                
                scriptAnalysis.ast = tree.rootNode.toString();
                scriptAnalysis.statistics = {
                    nodeType: tree.rootNode.type,
                    childCount: tree.rootNode.childCount,
                    hasError: tree.rootNode.hasError
                };

                // TypeScript特定分析
                if (script.lang === 'ts' || script.lang === 'typescript') {
                    const interfaces = tree.rootNode.descendantsOfType('interface_declaration');
                    const functions = tree.rootNode.descendantsOfType('function_declaration');
                    const variables = tree.rootNode.descendantsOfType('lexical_declaration');
                    const typeAliases = tree.rootNode.descendantsOfType('type_alias_declaration');
                    
                    scriptAnalysis.typescriptInfo = {
                        interfaceCount: interfaces.length,
                        functionCount: functions.length,
                        variableCount: variables.length,
                        typeAliasCount: typeAliases.length,
                        interfaces: interfaces.map(n => n.childForFieldName('name')?.text).filter(Boolean),
                        functions: functions.map(n => n.childForFieldName('name')?.text).filter(Boolean)
                    };
                }
                
            } catch (error) {
                scriptAnalysis.error = error.message;
            }

            analysis.script.push(scriptAnalysis);
        }

        // 分析style部分
        for (let i = 0; i < sections.style.length; i++) {
            const style = sections.style[i];
            const styleAnalysis = {
                scoped: style.scoped,
                ast: null,
                statistics: null,
                error: null
            };

            try {
                const parser = new Parser();
                parser.setLanguage(this.css);
                const tree = parser.parse(style.content);
                
                styleAnalysis.ast = tree.rootNode.toString();
                styleAnalysis.statistics = {
                    nodeType: tree.rootNode.type,
                    childCount: tree.rootNode.childCount,
                    hasError: tree.rootNode.hasError
                };

                // CSS特定分析
                const ruleSets = tree.rootNode.descendantsOfType('rule_set');
                const mediaQueries = tree.rootNode.descendantsOfType('media_statement');
                const keyframes = tree.rootNode.descendantsOfType('keyframes_statement');
                
                styleAnalysis.cssInfo = {
                    ruleSetCount: ruleSets.length,
                    mediaQueryCount: mediaQueries.length,
                    keyframesCount: keyframes.length,
                    selectors: ruleSets.flatMap(rs => 
                        rs.childForFieldName('selectors')?.namedChildren.map(cn => cn.text) || []
                    )
                };
                
            } catch (error) {
                styleAnalysis.error = error.message;
            }

            analysis.style.push(styleAnalysis);
        }

        return analysis;
    }

    /**
     * 打印分析结果
     */
    printAnalysis(analysis) {
        console.log('\n=== Vue文件分析结果 ===\n');
        
        console.log('📊 文件概览:');
        console.log(`- Template部分: ${analysis.summary.hasTemplate ? '✅ 存在' : '❌ 不存在'}`);
        console.log(`- Script部分: ${analysis.summary.scriptCount} 个`);
        console.log(`- Style部分: ${analysis.summary.styleCount} 个`);
        console.log(`- 包含TypeScript: ${analysis.summary.hasTypeScript ? '✅ 是' : '❌ 否'}`);
        console.log(`- 包含作用域样式: ${analysis.summary.hasScopedStyles ? '✅ 是' : '❌ 否'}`);

        // Template分析
        if (analysis.template) {
            console.log('\n🎨 Template部分:');
            if (analysis.template.error) {
                console.log('❌ 解析失败:', analysis.template.error);
            } else if (analysis.template.content) {
                console.log('⚠️ HTML解析器不可用，显示原始内容:');
                console.log(analysis.template.content.substring(0, 200) + '...');
            } else {
                console.log('✅ 解析成功');
                console.log(`- 根节点类型: ${analysis.template.statistics.nodeType}`);
                console.log(`- 子节点数量: ${analysis.template.statistics.childCount}`);
                console.log(`- 是否有错误: ${analysis.template.statistics.hasError ? '是' : '否'}`);
            }
        }

        // Script分析
        analysis.script.forEach((script, index) => {
            console.log(`\n📜 Script部分 ${index + 1} (${script.lang}):`);
            if (script.error) {
                console.log('❌ 解析失败:', script.error);
            } else {
                console.log('✅ 解析成功');
                console.log(`- 根节点类型: ${script.statistics.nodeType}`);
                console.log(`- 子节点数量: ${script.statistics.childCount}`);
                console.log(`- 是否有错误: ${script.statistics.hasError ? '是' : '否'}`);
                
                if (script.typescriptInfo) {
                    console.log('📘 TypeScript元素:');
                    console.log(`  - 接口: ${script.typescriptInfo.interfaceCount} 个`);
                    console.log(`  - 函数: ${script.typescriptInfo.functionCount} 个`);
                    console.log(`  - 变量: ${script.typescriptInfo.variableCount} 个`);
                    console.log(`  - 类型别名: ${script.typescriptInfo.typeAliasCount} 个`);
                    
                    if (script.typescriptInfo.interfaces.length > 0) {
                        console.log(`  - 接口名称: ${script.typescriptInfo.interfaces.join(', ')}`);
                    }
                }
            }
        });

        // Style分析
        analysis.style.forEach((style, index) => {
            console.log(`\n🎨 Style部分 ${index + 1} ${style.scoped ? '(作用域)' : ''}:`);
            if (style.error) {
                console.log('❌ 解析失败:', style.error);
            } else {
                console.log('✅ 解析成功');
                console.log(`- 根节点类型: ${style.statistics.nodeType}`);
                console.log(`- 子节点数量: ${style.statistics.childCount}`);
                console.log(`- 是否有错误: ${style.statistics.hasError ? '是' : '否'}`);
                
                if (style.cssInfo) {
                    console.log('📘 CSS元素:');
                    console.log(`  - 规则集: ${style.cssInfo.ruleSetCount} 个`);
                    console.log(`  - 媒体查询: ${style.cssInfo.mediaQueryCount} 个`);
                    console.log(`  - 关键帧: ${style.cssInfo.keyframesCount} 个`);
                    
                    if (style.cssInfo.selectors.length > 0) {
                        console.log(`  - 选择器: ${style.cssInfo.selectors.slice(0, 5).join(', ')}${style.cssInfo.selectors.length > 5 ? '...' : ''}`);
                    }
                }
            }
        });
    }
}

// 使用示例
async function demonstrateVueParser() {
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
  labels?: string[]
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

<style>
.global-style {
  margin: 10px;
}
</style>
`;

    console.log('🚀 初始化Vue文件解析器...');
    const parser = new VueFileParser();
    
    // 等待解析器初始化
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('📂 开始分析Vue文件...');
    try {
        const analysis = await parser.analyzeVueFile(vueCode);
        parser.printAnalysis(analysis);
        
        console.log('\n✅ Vue文件分析完成！');
        console.log('\n💡 这个解决方案的优势:');
        console.log('   1. 绕过了tree-sitter-vue的兼容性问题');
        console.log('   2. 可以充分利用TypeScript和CSS解析器的完整功能');
        console.log('   3. 支持多script标签和多style标签');
        console.log('   4. 提供详细的AST分析和统计信息');
        console.log('   5. 可以扩展支持更多Vue特性');
        
    } catch (error) {
        console.error('❌ 分析失败:', error.message);
    }
}

// 运行演示
demonstrateVueParser();