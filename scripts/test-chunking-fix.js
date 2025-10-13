const fs = require('fs');
const path = require('path');

// 模拟测试，验证修复效果
async function testChunkingFix() {
    console.log('=== 分段重复问题修复验证 ===\n');
    
    const testFiles = [
        'test-files/dataStructure/bt.go',
        'test-files/dataStructure/datastructure/linked_list.go'
    ];
    
    for (const testFile of testFiles) {
        console.log(`\n--- 测试文件: ${testFile} ---`);
        
        try {
            // 读取文件内容
            const content = fs.readFileSync(testFile, 'utf8');
            console.log(`内容长度: ${content.length} 字符`);
            
            // 模拟修复后的分段逻辑
            const chunks = simulateFixedChunking(content);
            
            console.log(`分段结果: ${chunks.length} 个块`);
            
            // 分析重复情况
            analyzeDuplicates(chunks);
            
            // 显示详细结果
            displayChunks(chunks);
            
        } catch (error) {
            console.error(`处理文件 ${testFile} 时出错:`, error.message);
        }
    }
}

function simulateFixedChunking(content) {
    const lines = content.split('\n');
    const chunks = [];
    
    // 模拟修复后的分段策略 - 防止重叠和重复
    const usedRanges = new Set(); // 跟踪已使用的行范围
    const contentHashes = new Set(); // 跟踪内容哈希
    
    let currentChunk = null;
    let inTypeDefinition = false;
    let braceCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // 检测类型定义开始
        if (line.startsWith('type ') && line.includes('struct')) {
            // 检查这个范围是否已经被使用
            const rangeKey = `struct_${i}`;
            if (usedRanges.has(rangeKey)) {
                continue; // 跳过已使用的范围
            }
            
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
            
            // 标记这个范围为已使用
            usedRanges.add(rangeKey);
            
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
                // 检查内容是否重复
                const contentHash = generateContentHash(currentChunk.content);
                if (!contentHashes.has(contentHash)) {
                    chunks.push(currentChunk);
                    contentHashes.add(contentHash);
                }
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
    
    // 添加最后一个块（如果存在且内容不重复）
    if (currentChunk) {
        const contentHash = generateContentHash(currentChunk.content);
        if (!contentHashes.has(contentHash)) {
            chunks.push(currentChunk);
        }
    }
    
    return chunks;
}

function generateContentHash(content) {
    // 简单的哈希函数
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
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
testChunkingFix().catch(console.error);