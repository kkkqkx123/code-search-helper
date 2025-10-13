const fs = require('fs');
const path = require('path');
const { TreeSitterParser } = require('../src/service/parser/tree-sitter/TreeSitterParser');
const { ChunkingCoordinator } = require('../src/service/parser/splitting/utils/ChunkingCoordinator');
const { ContentHashIDGenerator } = require('../src/service/parser/splitting/utils/ContentHashIDGenerator');
const { SimilarityDetector } = require('../src/service/parser/splitting/utils/SimilarityDetector');

async function testChunkingDeduplication() {
    console.log('=== 测试Tree-sitter分段去重功能 ===\n');
    
    const testDir = 'test-files/dataStructure';
    const files = [
        'bt.go',
        'datastructure/linked_list.go'
    ];
    
    // 初始化组件
    const idGenerator = new ContentHashIDGenerator();
    const similarityDetector = new SimilarityDetector(0.8);
    const coordinator = new ChunkingCoordinator({
        enableChunkDeduplication: true,
        deduplicationThreshold: 0.8,
        chunkMergeStrategy: 'conservative',
        maxOverlapRatio: 0.3
    });
    
    for (const filePath of files) {
        const fullPath = path.join(testDir, filePath);
        console.log(`\n--- 处理文件: ${filePath} ---`);
        
        try {
            const content = fs.readFileSync(fullPath, 'utf8');
            console.log(`文件大小: ${content.length} 字符`);
            
            // 解析AST
            const parser = new TreeSitterParser();
            const ast = await parser.parse(content, fullPath);
            console.log(`AST节点数: ${ast.nodeCount}`);
            
            // 获取代码块
            const chunks = await coordinator.extractChunks(ast);
            console.log(`提取到 ${chunks.length} 个代码块`);
            
            // 分析重复情况
            analyzeDuplicates(chunks);
            
            // 显示详细的分段结果
            displayChunks(chunks);
            
        } catch (error) {
            console.error(`处理文件 ${filePath} 时出错:`, error.message);
        }
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
        console.log(`发现 ${duplicates.length} 个重复分段:`);
        duplicates.forEach(dup => {
            console.log(`  - 块 ${dup.index1} 和 块 ${dup.index2} 内容重复`);
            console.log(`    内容: "${dup.content.substring(0, 50)}..."`);
        });
    } else {
        console.log('✅ 未发现完全重复的分段');
    }
    
    // 检查相似内容
    checkSimilarContent(chunks);
}

function checkSimilarContent(chunks) {
    console.log('\n=== 相似内容分析 ===');
    
    const similarPairs = [];
    
    for (let i = 0; i < chunks.length; i++) {
        for (let j = i + 1; j < chunks.length; j++) {
            const similarity = calculateSimilarity(chunks[i].content, chunks[j].content);
            if (similarity > 0.7) {
                similarPairs.push({
                    index1: i,
                    index2: j,
                    similarity: similarity,
                    content1: chunks[i].content.substring(0, 30),
                    content2: chunks[j].content.substring(0, 30)
                });
            }
        }
    }
    
    if (similarPairs.length > 0) {
        console.log(`发现 ${similarPairs.length} 对相似分段:`);
        similarPairs.forEach(pair => {
            console.log(`  - 块 ${pair.index1} 和 块 ${pair.index2} 相似度: ${pair.similarity.toFixed(2)}`);
            console.log(`    内容1: "${pair.content1}..."`);
            console.log(`    内容2: "${pair.content2}..."`);
        });
    } else {
        console.log('✅ 未发现高度相似的分段');
    }
}

function calculateSimilarity(content1, content2) {
    const longer = content1.length > content2.length ? content1 : content2;
    const shorter = content1.length > content2.length ? content2 : content1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

function displayChunks(chunks) {
    console.log('\n=== 分段详情 ===');
    
    chunks.forEach((chunk, index) => {
        console.log(`\n--- 块 ${index + 1} ---`);
        console.log(`类型: ${chunk.type}`);
        console.log(`位置: ${chunk.startLine}-${chunk.endLine}`);
        console.log(`内容预览: "${chunk.content.trim().substring(0, 100)}..."`);
        console.log(`节点ID: ${chunk.nodeId || 'N/A'}`);
        console.log(`内容哈希: ${chunk.contentHash || 'N/A'}`);
    });
}

// 运行测试
testChunkingDeduplication().catch(console.error);