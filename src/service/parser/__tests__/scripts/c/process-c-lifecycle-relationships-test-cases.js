const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 配置
const HOST = 'localhost';
const PORT = 4001;
const PROTOCOL = 'http'; // 根据实际情况调整为'http'或'https'

// 测试用例文件路径
const LIFECYCLE_TEST_CASE_FILE = path.join(__dirname, '../../c/lifecycle-relationships/c-lifecycle-relationships.json');

// 输出目录
const LIFECYCLE_OUTPUT_DIR = path.join(__dirname, '../../c/lifecycle-relationships');

/**
 * 发送POST请求
 */
function sendPostRequest(data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);

        const options = {
            hostname: HOST,
            port: PORT,
            path: '/api/parse',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = (PROTOCOL === 'https' ? https : http).request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    resolve(result);
                } catch (error) {
                    reject(new Error(`Failed to parse response: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

/**
 * 处理测试用例
 */
async function processTestCases(testCases, outputDir, prefix) {
    const results = [];

    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];

        try {
            // 发送请求
            const response = await sendPostRequest({
                language: testCase.language,
                code: testCase.code,
                query: testCase.query
            });

            // 保存响应结果到单独的JSON文件
            const outputFile = path.join(outputDir, `${prefix}-result-${i + 1}.json`);
            fs.writeFileSync(outputFile, JSON.stringify(response, null, 2));

            results.push({
                testCaseIndex: i,
                request: {
                    language: testCase.language,
                    code: testCase.code,
                    query: testCase.query
                },
                response: response
            });
        } catch (error) {
            console.error(`Error processing test case ${i + 1}:`, error.message);
            results.push({
                testCaseIndex: i,
                request: {
                    language: testCase.language,
                    code: testCase.code,
                    query: testCase.query
                },
                error: error.message
            });
        }
    }

    return results;
}

/**
 * 分析结果并找出问题
 */
function analyzeResults(results, queryFile) {
    console.log('\n=== 分析结果 ===');

    const issues = [];
    let totalTests = results.length;
    let passedTests = 0;

    for (const result of results) {
        if (result.error) {
            issues.push({
                type: 'REQUEST_ERROR',
                testCaseIndex: result.testCaseIndex,
                message: result.error
            });
        } else if (!result.response.success) {
            issues.push({
                type: 'PARSING_ERROR',
                testCaseIndex: result.testCaseIndex,
                message: result.response.errors?.join(', ') || 'Unknown parsing error'
            });
        } else {
            passedTests++;

            // 检查是否有匹配结果
            const matches = result.response.data || [];
            if (matches.length === 0) {
                issues.push({
                    type: 'NO_MATCHES',
                    testCaseIndex: result.testCaseIndex,
                    message: 'Query executed successfully but found no matches'
                });
            }
        }
    }

    console.log(`总计: ${totalTests}, 通过: ${passedTests}, 失败: ${totalTests - passedTests}`);

    if (issues.length > 0) {
        console.log('\n发现的问题:');
        for (const issue of issues) {
            console.log(`- 测试用例 ${issue.testCaseIndex + 1} [${issue.type}]: ${issue.message}`);
        }
    }

    return issues;
}

/**
 * 更新查询文件
 */
function updateQueryFiles(lifecycleIssues) {
    console.log('\n=== 更新查询文件 ===');

    // 这里应该根据具体问题更新查询文件
    // 由于这是一个示例脚本，我们只打印建议

    if (lifecycleIssues.length > 0) {
        console.log('\n生命周期关系查询文件 (src/service/parser/constants/queries/c/lifecycle-relationships.ts) 可能需要更新:');
        for (const issue of lifecycleIssues) {
            console.log(`- 问题 ${issue.testCaseIndex + 1}: ${issue.message}`);
        }
    }
}

/**
 * 主函数
 */
async function main() {
    try {
        console.log('开始处理C语言生命周期关系测试用例...\n');

        // 读取生命周期关系测试用例
        console.log('读取生命周期关系测试用例...');
        const lifecycleTestData = JSON.parse(fs.readFileSync(LIFECYCLE_TEST_CASE_FILE, 'utf8'));
        console.log(`找到 ${lifecycleTestData.requests.length} 个生命周期关系测试用例\n`);

        // 处理生命周期关系测试用例
        console.log('处理生命周期关系测试用例...');
        const lifecycleResults = await processTestCases(lifecycleTestData.requests, LIFECYCLE_OUTPUT_DIR, 'lifecycle');

        // 分析结果
        const lifecycleIssues = analyzeResults(lifecycleResults, '../src/service/parser/constants/queries/c/lifecycle-relationships.ts');

        // 更新查询文件
        updateQueryFiles(lifecycleIssues);

        console.log('\n处理完成!');
    } catch (error) {
        console.error('处理过程中出错:', error.message);
        process.exit(1);
    }
}

// 运行主函数
main();