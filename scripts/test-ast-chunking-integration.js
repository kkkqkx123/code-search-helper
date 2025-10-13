const fs = require('fs');
const path = require('path');

// 直接导入ASTCodeSplitter
const { ASTCodeSplitter } = require('../src/service/parser/splitting/ASTCodeSplitter');
const { TreeSitterService } = require('../src/service/parser/core/parse/TreeSitterService');
const { LoggerService } = require('../src/utils/LoggerService');

async function testASTChunkingIntegration() {
    console.log('=== AST CodeSplitter 集成测试 ===\n');
    
    try {
        // 创建logger
        const logger = new LoggerService();
        
        // 创建TreeSitterService
        const treeSitterService = new TreeSitterService(logger);
        
        // 创建ASTCodeSplitter
        const astSplitter = new ASTCodeSplitter(treeSitterService, logger);
        
        // 测试文件
        const testFiles = [
            'test-files/dataStructure/bt.go',
            'test-files/dataStructure/datastructure/linked_list.go'
        ];
        
        for (const testFile of testFiles) {
            console.log(`\n--- 测试文件: ${testFile} ---`);
            
            if (!fs.existsSync(testFile)) {
                console.log(`文件不存在: ${testFile}`);
                continue;
            }
            
            const content = fs.readFileSync(testFile, 'utf8');
            const language = path.extname(testFile).substring(1); // 移除点号
            
            console.log(`内容长度: ${content.length} 字符`);
            
            try {
                // 使用ASTCodeSplitter进行分段
                const chunks = await astSplitter.split(content, testFile, language);
                
                console.log(`AST分段结果: ${chunks.length} 个块`);
                
                // 分析重复情况
                analyzeDuplicates(chunks);
                
                // 显示分段详情
                displayChunks(chunks);
                
            } catch (error) {
                console.error(`AST分段失败: ${error.message}`);
            }
        }
        
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
        console.log(`类型: ${chunk.metadata?.type || 'unknown'}`);
        console.log(`位置: ${chunk.metadata?.startLine || 0}-${chunk.metadata?.endLine || 0}`);
        console.log(`内容: "${chunk.content.trim().substring(0, 100)}${chunk.content.length > 100 ? '...' : ''}"`);
        
        if (chunk.metadata?.functionName) {
            console.log(`函数名: ${chunk.metadata.functionName}`);
        }
        if (chunk.metadata?.className) {
            console.log(`类名: ${chunk.metadata.className}`);
        }
    });
}

// 运行测试
testASTChunkingIntegration().catch(console.error);