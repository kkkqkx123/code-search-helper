const fs = require('fs');
const path = require('path');

// 读取源文件内容
function readSourceFile(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

// 解析测试用例
function parseTestCases(content) {
    const lines = content.split('\n');
    const testCases = [];
    let currentCase = null;
    let inCodeBlock = false;
    let inQueryBlock = false;
    let inResultBlock = false;
    let currentSection = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 检测测试用例标题
        if (line.match(/^## \d+\./)) {
            if (currentCase) {
                testCases.push(currentCase);
            }
            currentCase = {
                title: line,
                content: [],
                code: [],
                query: [],
                result: []
            };
            currentSection = 'content';
            continue;
        }
        
        if (!currentCase) continue;
        
        // 检测章节标题
        if (line.match(/^### /)) {
            if (line.includes('测试用例')) {
                currentSection = 'code';
                inCodeBlock = false;
            } else if (line.includes('查询规则')) {
                currentSection = 'query';
                inQueryBlock = false;
            } else if (line.includes('查询结果')) {
                currentSection = 'result';
                inResultBlock = false;
            }
            currentCase.content.push(line);
            continue;
        }
        
        // 处理代码块
        if (line.startsWith('```')) {
            if (currentSection === 'code') {
                inCodeBlock = !inCodeBlock;
                if (!inCodeBlock) {
                    currentCase.content.push(line);
                }
            } else if (currentSection === 'query') {
                inQueryBlock = !inQueryBlock;
                if (!inQueryBlock) {
                    currentCase.content.push(line);
                }
            } else if (currentSection === 'result') {
                inResultBlock = !inResultBlock;
                if (!inResultBlock) {
                    currentCase.content.push(line);
                }
            } else {
                currentCase.content.push(line);
            }
            continue;
        }
        
        // 添加内容
        if (currentSection === 'code' && inCodeBlock) {
            currentCase.code.push(line);
        } else if (currentSection === 'query' && inQueryBlock) {
            currentCase.query.push(line);
        } else if (currentSection === 'result' && inResultBlock) {
            currentCase.result.push(line);
        } else {
            currentCase.content.push(line);
        }
    }
    
    if (currentCase) {
        testCases.push(currentCase);
    }
    
    return testCases;
}

// 生成文件内容
function generateFileContent(testCase) {
    let content = testCase.title + '\n\n';
    
    // 添加内容部分
    let contentSection = [];
    let inContent = true;
    for (const line of testCase.content) {
        if (line.startsWith('### ')) {
            if (line.includes('测试用例')) {
                contentSection.push(line);
                inContent = false;
            } else if (line.includes('查询规则')) {
                contentSection.push(line);
                inContent = false;
            } else if (line.includes('查询结果')) {
                contentSection.push(line);
                inContent = false;
            } else if (inContent) {
                contentSection.push(line);
            }
        } else if (inContent && !line.startsWith('```')) {
            contentSection.push(line);
        }
    }
    
    content += contentSection.join('\n') + '\n\n';
    
    // 添加测试用例代码
    if (testCase.code.length > 0) {
        content += '### 测试用例\n';
        content += '```c\n';
        content += testCase.code.join('\n') + '\n';
        content += '```\n\n';
    }
    
    // 添加查询规则
    if (testCase.query.length > 0) {
        content += '### 查询规则\n';
        content += '```\n';
        content += testCase.query.join('\n') + '\n';
        content += '```\n\n';
    }
    
    // 添加查询结果
    content += '### 查询结果\n';
    content += '```\n';
    if (testCase.result.length > 0) {
        content += testCase.result.join('\n') + '\n';
    }
    content += '```\n';
    
    return content;
}

// 提取文件名
function extractFileName(title, index) {
    const match = title.match(/^## \d+\. (.+)$/);
    if (match) {
        let name = match[1];
        // 清理文件名中的特殊字符
        name = name.replace(/[^\w\u4e00-\u9fa5-]/g, '');
        return `c-${index + 1}-${name}.md`;
    }
    return `c-${index + 1}-test-case.md`;
}

// 主函数
function main() {
    const structsFile = 'src/service/parser/__tests__/c/structs/c-structs-queries-test-cases.md';
    const concurrencyFile = 'src/service/parser/__tests__/c/concurrency/c-concurrency-queries-test-cases.md';
    
    // 处理结构体测试用例（从第3个开始，因为前两个已经存在）
    console.log('处理结构体测试用例...');
    const structsContent = readSourceFile(structsFile);
    const structsTestCases = parseTestCases(structsContent);
    
    // 从第3个测试用例开始（索引2）
    for (let i = 2; i < structsTestCases.length; i++) {
        const testCase = structsTestCases[i];
        const fileName = extractFileName(testCase.title, i);
        const filePath = `src/service/parser/__tests__/c/structs/${fileName}`;
        const fileContent = generateFileContent(testCase);
        
        fs.writeFileSync(filePath, fileContent, 'utf8');
        console.log(`创建文件: ${filePath}`);
    }
    
    // 处理并发测试用例（从第13个开始，因为前12个已经创建）
    console.log('\n处理并发测试用例...');
    const concurrencyContent = readSourceFile(concurrencyFile);
    const concurrencyTestCases = parseTestCases(concurrencyContent);
    
    // 从第13个测试用例开始（索引12）
    for (let i = 12; i < concurrencyTestCases.length; i++) {
        const testCase = concurrencyTestCases[i];
        const fileName = extractFileName(testCase.title, i);
        const filePath = `src/service/parser/__tests__/c/concurrency/${fileName}`;
        const fileContent = generateFileContent(testCase);
        
        fs.writeFileSync(filePath, fileContent, 'utf8');
        console.log(`创建文件: ${filePath}`);
    }
    
    console.log('\n所有测试用例文件创建完成！');
}

main();