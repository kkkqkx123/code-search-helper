const fs = require('fs');
const path = require('path');
const { TreeSitterCoreService } = require('../src/service/parser/core/parse/TreeSitterCoreService');
const { ASTCodeSplitter } = require('../src/service/parser/splitting/ASTCodeSplitter');

async function testSimpleChunking() {
    console.log('=== 简单分段测试 ===\n');
    
    const testFile = 'test-files/dataStructure/bt.go';
    
    try {
        // 读取文件内容
        const content = fs.readFileSync(testFile, 'utf8');
        console.log(`处理文件: ${testFile}`);
        console.log(`内容长度: ${content.length} 字符`);
        
        // 初始化Tree-sitter服务
        const treeSitterService = new TreeSitterCoreService();
        
        // 解析文件
        const parseResult = await treeSitterService.parseFile(testFile, content);
        if (!parseResult.success) {
            throw new Error(`解析失败: ${parseResult.error}`);
        }
        
        console.log(`解析成功，AST节点数: ${parseResult.ast.childCount}`);
        
        // 创建分段器
        const splitter = new ASTCodeSplitter(treeSitterService);
        
        // 设置分段选项
        const options = {
            enableChunkDeduplication: true,
            deduplicationThreshold: 0.8,
            chunkMergeStrategy: 'conservative',
            maxOverlapRatio: 0.3
        };
        
        // 执行分段
        const chunks = await splitter.split(content, 'go', testFile, options);
        
        console.log(`\n分段结果: ${chunks.length} 个块`);
        
        // 分析重复情况
        analyzeDuplicates(chunks);
        
        // 显示详细结果
        displayChunks(chunks);
        
    } catch (error) {
        console.error('测试失败:', error);
    }
}

function analyzeDuplicates(chunks) {
    console.log('\n=== 重复分析 ===');
    
    const contentMap = new Map();
    const duplicates = [];
    
    chunks.forEach((chunk, index) => {
        const normalizedContent = chunk.content.trim();
        
        if (contentMap.has(normalizedContent)) {
            const existingIndex = contentMap.get(normalizedContent);
            duplicates.push({
                index1: existingIndex,
                index2: index,
                content: normalizedContent
            });
        } else {
            contentMap.set(normalizedContent, index);
        }
    });
    
    if (duplicates.length > 0) {
        console.log(`❌ 发现 ${duplicates.length} 个重复分段:`);
        duplicates.forEach(dup => {
            console.log(`  - 块 ${dup.index1} 和 块 ${dup.index2} 内容重复`);
            console.log(`    内容: "${dup.content.substring(0, 50)}..."`);
        });
    } else {
        console.log('✅ 未发现完全重复的分段');
    }
}

function displayChunks(chunks) {
    console.log('\n=== 分段详情 ===');
    
    chunks.forEach((chunk, index) => {
        console.log(`\n--- 块 ${index + 1} ---`);
        console.log(`类型: ${chunk.type}`);
        console.log(`位置: ${chunk.metadata.startLine}-${chunk.metadata.endLine}`);
        console.log(`内容: "${chunk.content.trim()}"`);
        
        if (chunk.metadata.nodeIds && chunk.metadata.nodeIds.length > 0) {
            console.log(`节点ID: ${chunk.metadata.nodeIds.join(', ')}`);
        }
    });
}

// 运行测试
testSimpleChunking().catch(console.error);