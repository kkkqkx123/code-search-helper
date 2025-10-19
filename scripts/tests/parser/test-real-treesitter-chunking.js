const fs = require('fs');
const path = require('path');

// 模拟Tree-sitter解析和分段过程
function simulateRealTreeSitterChunking(content, filePath) {
    console.log(`\n--- 分析文件: ${filePath} ---`);
    console.log(`内容长度: ${content.length} 字符`);
    
    // 模拟Go语言的AST结构
    const chunks = [];
    
    // 1. 提取包声明
    const packageMatch = content.match(/^package\s+(\w+)/m);
    if (packageMatch) {
        chunks.push({
            type: 'package_declaration',
            content: packageMatch[0],
            startLine: content.substring(0, packageMatch.index).split('\n').length,
            endLine: content.substring(0, packageMatch.index).split('\n').length,
            metadata: {
                type: 'package_declaration',
                startLine: content.substring(0, packageMatch.index).split('\n').length,
                endLine: content.substring(0, packageMatch.index).split('\n').length,
                nodeIds: ['package_declaration']
            }
        });
    }
    
    // 2. 提取类型定义（struct）
    const typeRegex = /^type\s+(\w+)\s+struct\s*\{([^}]*)\}/gm;
    let typeMatch;
    let typeIndex = 0;
    
    while ((typeMatch = typeRegex.exec(content)) !== null) {
        const startPos = typeMatch.index;
        const endPos = startPos + typeMatch[0].length;
        
        const startLine = content.substring(0, startPos).split('\n').length + 1;
        const endLine = content.substring(0, endPos).split('\n').length;
        
        const chunk = {
            type: 'type_definition',
            content: typeMatch[0],
            startLine: startLine,
            endLine: endLine,
            metadata: {
                type: 'type_definition',
                startLine: startLine,
                endLine: endLine,
                nodeIds: [`type_${typeIndex++}`],
                typeName: typeMatch[1]
            }
        };
        
        chunks.push(chunk);
        
        // 模拟重叠分段问题 - 这是问题的根源
        if (typeMatch[0].length > 30) {
            // 创建部分重叠的块（模拟原始问题）
            const lines = typeMatch[0].split('\n');
            if (lines.length > 3) {
                // 创建包含前几行的部分块
                const partialChunk1 = {
                    type: 'partial_type_definition',
                    content: lines.slice(0, -1).join('\n'),
                    startLine: startLine,
                    endLine: startLine + lines.length - 2,
                    metadata: {
                        type: 'partial_type_definition',
                        startLine: startLine,
                        endLine: startLine + lines.length - 2,
                        nodeIds: [`partial_type_${typeIndex - 1}_1`]
                    }
                };
                
                // 创建包含后几行的部分块
                const partialChunk2 = {
                    type: 'partial_type_definition',
                    content: lines.slice(1).join('\n'),
                    startLine: startLine + 1,
                    endLine: endLine,
                    metadata: {
                        type: 'partial_type_definition',
                        startLine: startLine + 1,
                        endLine: endLine,
                        nodeIds: [`partial_type_${typeIndex - 1}_2`]
                    }
                };
                
                chunks.push(partialChunk1);
                chunks.push(partialChunk2);
            }
        }
    }
    
    // 3. 提取函数定义
    const funcRegex = /^func\s+(\w+)\s*\([^)]*\)\s*(?:\([^)]*\)|\w+)?\s*\{([\s\S]*?)^\}/gm;
    let funcMatch;
    let funcIndex = 0;
    
    while ((funcMatch = funcRegex.exec(content)) !== null) {
        const startPos = funcMatch.index;
        const endPos = startPos + funcMatch[0].length;
        
        const startLine = content.substring(0, startPos).split('\n').length + 1;
        const endLine = content.substring(0, endPos).split('\n').length;
        
        chunks.push({
            type: 'function_definition',
            content: funcMatch[0],
            startLine: startLine,
            endLine: endLine,
            metadata: {
                type: 'function_definition',
                startLine: startLine,
                endLine: endLine,
                nodeIds: [`func_${funcIndex++}`],
                functionName: funcMatch[1]
            }
        });
    }
    
    return chunks;
}

// 模拟修复后的分段过程
function simulateFixedTreeSitterChunking(content, filePath) {
    console.log(`\n--- 修复后分析: ${filePath} ---`);
    console.log(`内容长度: ${content.length} 字符`);
    
    const chunks = [];
    const usedRanges = new Set(); // 跟踪已使用的行范围
    const contentHashes = new Set(); // 跟踪内容哈希
    
    // 1. 提取包声明
    const packageMatch = content.match(/^package\s+(\w+)/m);
    if (packageMatch) {
        const startLine = content.substring(0, packageMatch.index).split('\n').length;
        const rangeKey = `package_${startLine}`;
        
        if (!usedRanges.has(rangeKey)) {
            const chunk = {
                type: 'package_declaration',
                content: packageMatch[0],
                startLine: startLine,
                endLine: startLine,
                metadata: {
                    type: 'package_declaration',
                    startLine: startLine,
                    endLine: startLine,
                    nodeIds: ['package_declaration']
                }
            };
            
            const contentHash = generateContentHash(chunk.content);
            if (!contentHashes.has(contentHash)) {
                chunks.push(chunk);
                usedRanges.add(rangeKey);
                contentHashes.add(contentHash);
            }
        }
    }
    
    // 2. 提取类型定义（struct）- 修复版本，防止重叠
    const typeRegex = /^type\s+(\w+)\s+struct\s*\{([^}]*)\}/gm;
    let typeMatch;
    let typeIndex = 0;
    
    while ((typeMatch = typeRegex.exec(content)) !== null) {
        const startPos = typeMatch.index;
        const endPos = startPos + typeMatch[0].length;
        
        const startLine = content.substring(0, startPos).split('\n').length + 1;
        const endLine = content.substring(0, endPos).split('\n').length;
        const rangeKey = `type_${startLine}_${endLine}`;
        
        // 检查这个范围是否已经被使用
        if (usedRanges.has(rangeKey)) {
            continue; // 跳过已使用的范围
        }
        
        const chunk = {
            type: 'type_definition',
            content: typeMatch[0],
            startLine: startLine,
            endLine: endLine,
            metadata: {
                type: 'type_definition',
                startLine: startLine,
                endLine: endLine,
                nodeIds: [`type_${typeIndex++}`],
                typeName: typeMatch[1]
            }
        };
        
        const contentHash = generateContentHash(chunk.content);
        if (!contentHashes.has(contentHash)) {
            chunks.push(chunk);
            usedRanges.add(rangeKey);
            contentHashes.add(contentHash);
        }
        
        // 不再创建部分重叠的块 - 这是修复的关键
    }
    
    // 3. 提取函数定义
    const funcRegex = /^func\s+(\w+)\s*\([^)]*\)\s*(?:\([^)]*\)|\w+)?\s*\{([\s\S]*?)^\}/gm;
    let funcMatch;
    let funcIndex = 0;
    
    while ((funcMatch = funcRegex.exec(content)) !== null) {
        const startPos = funcMatch.index;
        const endPos = startPos + funcMatch[0].length;
        
        const startLine = content.substring(0, startPos).split('\n').length + 1;
        const endLine = content.substring(0, endPos).split('\n').length;
        const rangeKey = `func_${startLine}_${endLine}`;
        
        // 检查这个范围是否已经被使用
        if (usedRanges.has(rangeKey)) {
            continue;
        }
        
        const chunk = {
            type: 'function_definition',
            content: funcMatch[0],
            startLine: startLine,
            endLine: endLine,
            metadata: {
                type: 'function_definition',
                startLine: startLine,
                endLine: endLine,
                nodeIds: [`func_${funcIndex++}`],
                functionName: funcMatch[1]
            }
        };
        
        // 检查内容是否重复
        const contentHash = generateContentHash(chunk.content);
        if (!contentHashes.has(contentHash)) {
            chunks.push(chunk);
            usedRanges.add(rangeKey);
            contentHashes.add(contentHash);
        }
    }
    
    return chunks;
}

function generateContentHash(content) {
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
        console.log(`内容预览: "${chunk.content.trim().substring(0, 100)}${chunk.content.length > 100 ? '...' : ''}"`);
        
        if (chunk.metadata.nodeIds && chunk.metadata.nodeIds.length > 0) {
            console.log(`节点ID: ${chunk.metadata.nodeIds.join(', ')}`);
        }
    });
}

async function testRealTreeSitterChunking() {
    console.log('=== 真实Tree-sitter分段测试 ===\n');
    
    const testFiles = [
        'test-files/dataStructure/bt.go',
        'test-files/dataStructure/datastructure/linked_list.go'
    ];
    
    for (const testFile of testFiles) {
        try {
            const content = fs.readFileSync(testFile, 'utf8');
            
            // 模拟原始问题版本
            const originalChunks = simulateRealTreeSitterChunking(content, testFile);
            console.log(`\n=== 原始分段结果 ===`);
            console.log(`总块数: ${originalChunks.length}`);
            analyzeDuplicates(originalChunks);
            
            // 模拟修复后版本
            const fixedChunks = simulateFixedTreeSitterChunking(content, testFile);
            console.log(`\n=== 修复后分段结果 ===`);
            console.log(`总块数: ${fixedChunks.length}`);
            analyzeDuplicates(fixedChunks);
            
        } catch (error) {
            console.error(`处理文件 ${testFile} 时出错:`, error.message);
        }
    }
}

// 运行测试
testRealTreeSitterChunking().catch(console.error);