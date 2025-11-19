const fs = require('fs');
const path = require('path');

/**
 * 解析单个 MD 文件，提取测试用例和查询规则
 * @param {string} filePath - MD 文件路径
 * @returns {Object} 包含测试用例和查询规则的对象
 */
function parseMarkdownFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    let testCase = '';
    let queryRule = '';
    let inTestCase = false;
    let inQueryRule = false;
    let inCodeBlock = false;
    let codeBlockLang = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 检测代码块开始
        if (line.startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                codeBlockLang = line.substring(3).trim();
            } else {
                inCodeBlock = false;
                codeBlockLang = '';
            }
            continue;
        }
        
        // 在代码块内
        if (inCodeBlock) {
            if (codeBlockLang === 'c' && inTestCase) {
                testCase += line + '\n';
            } else if (codeBlockLang === '' && inQueryRule) {
                queryRule += line + '\n';
            }
            continue;
        }
        
        // 检测章节标题
        if (line.includes('### 测试用例')) {
            inTestCase = true;
            inQueryRule = false;
            continue;
        }
        
        if (line.includes('### 查询规则')) {
            inTestCase = false;
            inQueryRule = true;
            continue;
        }
        
        // 其他章节，重置状态
        if (line.startsWith('###') && !line.includes('测试用例') && !line.includes('查询规则')) {
            inTestCase = false;
            inQueryRule = false;
        }
    }
    
    // 清理提取的内容
    testCase = testCase.trim();
    queryRule = queryRule.trim();
    
    return {
        testCase,
        queryRule
    };
}

/**
 * 递归获取目录中的所有 MD 文件
 * @param {string} dirPath - 目录路径
 * @returns {Array} MD 文件路径数组
 */
function getAllMarkdownFiles(dirPath) {
    const files = [];
    
    function traverse(currentPath) {
        const items = fs.readdirSync(currentPath);
        
        for (const item of items) {
            const itemPath = path.join(currentPath, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory()) {
                traverse(itemPath);
            } else if (item.endsWith('.md') && !item.includes('test-cases')) {
                files.push(itemPath);
            }
        }
    }
    
    traverse(dirPath);
    return files;
}

/**
 * 将解析结果转换为 API 批量查询格式
 * @param {Array} parsedFiles - 解析后的文件数组
 * @returns {Object} API 批量查询格式的对象
 */
function convertToApiFormat(parsedFiles) {
    const requests = [];
    
    for (const file of parsedFiles) {
        if (file.testCase && file.queryRule) {
            requests.push({
                language: 'c',
                code: file.testCase,
                query: file.queryRule
            });
        }
    }
    
    return {
        requests: requests
    };
}

/**
 * 主函数
 */
function main() {
    const sourceDir = path.join(__dirname, '../src/service/parser/__tests__/c');
    const outputFile = path.join(__dirname, '../data/c-api-requests.json');
    
    console.log('开始解析 MD 文件...');
    
    // 获取所有 MD 文件
    const mdFiles = getAllMarkdownFiles(sourceDir);
    console.log(`找到 ${mdFiles.length} 个 MD 文件`);
    
    // 解析所有文件
    const parsedFiles = [];
    for (const filePath of mdFiles) {
        try {
            const parsed = parseMarkdownFile(filePath);
            const relativePath = path.relative(sourceDir, filePath);
            parsedFiles.push({
                file: relativePath,
                ...parsed
            });
            console.log(`已解析: ${relativePath}`);
        } catch (error) {
            console.error(`解析文件失败 ${filePath}:`, error.message);
        }
    }
    
    // 转换为 API 格式
    const apiFormat = convertToApiFormat(parsedFiles);
    
    // 保存结果 - 只保存 API 请求格式
    fs.writeFileSync(outputFile, JSON.stringify(apiFormat, null, 2), 'utf8');
    console.log(`转换完成，结果已保存到: ${outputFile}`);
    console.log(`总共 ${apiFormat.requests.length} 个 API 请求`);
    
    // 同时保存一个包含详细信息的文件
    const detailFile = path.join(__dirname, '../data/c-test-cases-detail.json');
    const detailData = {
        metadata: {
            totalFiles: mdFiles.length,
            successfulFiles: parsedFiles.filter(f => f.testCase && f.queryRule).length,
            generatedAt: new Date().toISOString()
        },
        parsedFiles: parsedFiles,
        apiRequests: apiFormat
    };
    fs.writeFileSync(detailFile, JSON.stringify(detailData, null, 2), 'utf8');
    console.log(`详细信息已保存到: ${detailFile}`);
}

// 运行脚本
if (require.main === module) {
    main();
}

module.exports = {
    parseMarkdownFile,
    getAllMarkdownFiles,
    convertToApiFormat
};