const fs = require('fs');
const path = require('path');

// 模拟测试，直接分析分段逻辑
async function testRealChunking() {
    console.log('=== 真实分段逻辑测试 ===\n');
    
    const testFile = 'test-files/dataStructure/bt.go';
    
    try {
        // 读取文件内容
        const content = fs.readFileSync(testFile, 'utf8');
        console.log(`处理文件: ${testFile}`);
        
        // 模拟分段过程
        const chunks = simulateChunking(content);
        
        console.log(`\n分段结果: ${chunks.length} 个块`);
        
        // 分析重复情况
        analyzeDuplicates(chunks);
        
        // 显示详细结果
        displayChunks(chunks);
        
    } catch (error) {
        console.error('测试失败:', error);
    }
}

function simulateChunking(content) {
    const lines = content.split('\n');
    const chunks = [];
    
    // 模拟不同类型的分段策略
    const strategies = [
        'type_definition',    // 类型定义
        'function_definition', // 函数定义
        'struct_definition',   // 结构体定义
        'interface_definition' // 接口定义
    ];
    
    let currentChunk = null;
    let inTypeDefinition = false;
    let braceCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // 检测类型定义开始
        if (line.startsWith('type ') && line.includes('struct')) {
            if (currentChunk) {
                chunks.push(currentChunk);
            }
            
            currentChunk = {
                type: 'struct_definition',
                startLine: i + 1,
                endLine: i + 1,
                content: line,
                metadata: {
                    startLine: i + 1,
                    endLine: i + 1,
                    type: 'struct_definition',
                    nodeIds: [`struct_${i}`]
                }
            };
            
            inTypeDefinition = true;
            braceCount = 0;
            
            // 计算大括号
            if (line.includes('{')) braceCount++;
            if (line.includes('}')) braceCount--;
        } else if (inTypeDefinition && currentChunk) {
            // 在类型定义内部
            currentChunk.content += '\n' + line;
            currentChunk.endLine = i + 1;
            currentChunk.metadata.endLine = i + 1;
            
            // 计算大括号
            const openBraces = (line.match(/\{/g) || []).length;
            const closeBraces = (line.match(/\}/g) || []).length;
            braceCount += openBraces - closeBraces;
            
            // 如果大括号平衡，结束当前块
            if (braceCount === 0) {
                chunks.push(currentChunk);
                currentChunk = null;
                inTypeDefinition = false;
            }
        } else if (line && !line.startsWith('//')) {
            // 其他非空行
            if (!currentChunk) {
                currentChunk = {
                    type: 'general_code',
                    startLine: i + 1,
                    endLine: i + 1,
                    content: line,
                    metadata: {
                        startLine: i + 1,
                        endLine: i + 1,
                        type: 'general_code',
                        nodeIds: [`line_${i}`]
                    }
                };
            } else {
                currentChunk.content += '\n' + line;
                currentChunk.endLine = i + 1;
                currentChunk.metadata.endLine = i + 1;
            }
        }
    }
    
    // 添加最后一个块
    if (currentChunk) {
        chunks.push(currentChunk);
    }
    
    // 模拟重叠分段 - 这是问题的根源
    addOverlappingChunks(chunks, content);
    
    return chunks;
}

function addOverlappingChunks(originalChunks, content) {
    // 模拟重叠分段的产生
    const overlappingChunks = [];
    
    originalChunks.forEach(chunk => {
        // 创建原始块
        overlappingChunks.push(chunk);
        
        // 创建重叠块 - 这是问题的根源
        if (chunk.content.length > 50) {
            // 创建部分重叠的块
            const partialChunk1 = {
                type: 'partial_' + chunk.type,
                startLine: chunk.startLine,
                endLine: chunk.endLine - 1,
                content: chunk.content.split('\n').slice(0, -1).join('\n'),
                metadata: {
                    startLine: chunk.startLine,
                    endLine: chunk.endLine - 1,
                    type: 'partial_' + chunk.type,
                    nodeIds: [`partial_${chunk.metadata.nodeIds[0]}`]
                }
            };
            
            const partialChunk2 = {
                type: 'partial_' + chunk.type,
                startLine: chunk.startLine + 1,
                endLine: chunk.endLine,
                content: chunk.content.split('\n').slice(1).join('\n'),
                metadata: {
                    startLine: chunk.startLine + 1,
                    endLine: chunk.endLine,
                    type: 'partial_' + chunk.type,
                    nodeIds: [`partial2_${chunk.metadata.nodeIds[0]}`]
                }
            };
            
            overlappingChunks.push(partialChunk1);
            overlappingChunks.push(partialChunk2);
        }
    });
    
    // 替换原始块数组
    originalChunks.splice(0, originalChunks.length, ...overlappingChunks);
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
        console.log(`类型: ${chunk.type}`);
        console.log(`位置: ${chunk.startLine}-${chunk.endLine}`);
        console.log(`内容: "${chunk.content.trim()}"`);
        
        if (chunk.metadata.nodeIds && chunk.metadata.nodeIds.length > 0) {
            console.log(`节点ID: ${chunk.metadata.nodeIds.join(', ')}`);
        }
    });
}

// 运行测试
testRealChunking().catch(console.error);