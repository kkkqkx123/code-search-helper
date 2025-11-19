const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 配置
const HOST = 'localhost';
const PORT = 4001;
const PROTOCOL = 'http';
const TESTS_BASE_DIR = path.join(__dirname, '../');

// 支持的语言和测试类别
const SUPPORTED_LANGUAGES = ['c', 'python', 'javascript', 'java', 'go', 'rust'];

const TEST_CATEGORIES = {
  c: [
    'lifecycle-relationships',
    'control-flow',
    'control-flow-relationships',
    'data-flow',
    'functions',
    'structs',
    'concurrency'
  ],
  python: [],  // 后续扩展
  javascript: [],  // 后续扩展
  // ... 其他语言
};

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
 * 从文件系统加载测试用例
 * 新架构：从tests/test-XXX/目录中读取code和query文件
 */
function loadTestCaseFromFiles(testDir, testId) {
  const queryPath = path.join(testDir, 'query.txt');
  const metadataPath = path.join(testDir, 'metadata.json');

  // 查找代码文件（支持多种扩展名）
  const files = fs.readdirSync(testDir);
  const codeFile = files.find(f => f.startsWith('code.'));
  
  if (!codeFile || !fs.existsSync(queryPath)) {
    throw new Error(`Missing code or query file in ${testDir}`);
  }

  const code = fs.readFileSync(path.join(testDir, codeFile), 'utf-8');
  const query = fs.readFileSync(queryPath, 'utf-8');
  const metadata = fs.existsSync(metadataPath) 
    ? JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
    : {};

  return {
    id: metadata.id || testId,
    language: metadata.language || 'c',
    code,
    query,
    description: metadata.description || '',
    ...metadata
  };
}

/**
 * 处理单个类别的测试用例
 */
async function processTestCategory(config, specificTestIndices = null) {
    const { language, category, indexFile, testDir, resultsDir } = config;
    const results = [];

    // 确保输出目录存在
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }

    // 读取索引文件
    if (!fs.existsSync(indexFile)) {
        console.warn(`⚠️  索引文件不存在: ${indexFile}`);
        return results;
    }

    const indexData = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
    const testRequests = indexData.requests || [];

    // 确定要处理的测试用例
    let indicesToProcess = specificTestIndices 
        ? specificTestIndices.filter(i => i < testRequests.length)
        : Array.from({ length: testRequests.length }, (_, i) => i);

    console.log(`处理 ${language}:${category}: 找到 ${testRequests.length} 个测试用例，处理 ${indicesToProcess.length} 个`);

    for (const i of indicesToProcess) {
        const testRequest = testRequests[i];
        const testId = testRequest.id || `${category}-${String(i + 1).padStart(3, '0')}`;

        try {
            // 从文件系统加载测试用例
            const testCase = loadTestCaseFromFiles(path.join(testDir, path.dirname(testRequest.codeFile).replace(/^tests\//, '')), testId);
            
            // 组装API请求
            const apiRequest = {
                language: testCase.language,
                code: testCase.code,
                query: testCase.query
            };

            // 发送请求
            const response = await sendPostRequest(apiRequest);

            // 保存结果到单独的JSON文件
            const resultFile = path.join(resultsDir, `result-${String(i + 1).padStart(3, '0')}.json`);
            fs.writeFileSync(resultFile, JSON.stringify({
                testId,
                request: apiRequest,
                response: response,
                timestamp: new Date().toISOString()
            }, null, 2));

            results.push({
                testCaseIndex: i,
                testId,
                request: apiRequest,
                response: response
            });

            console.log(`  ✓ ${testId}`);
        } catch (error) {
            const errorMessage = error.message || '未知错误';
            const errorDetails = error.stack || '';
            console.error(`  ✗ 错误处理测试用例 ${testId}: ${errorMessage}`);
            
            results.push({
                testCaseIndex: i,
                testId,
                error: errorMessage,
                errorDetails: errorDetails
            });
        }
    }

    return results;
}

/**
 * 生成问题报告
 */
function generateReport(allResults) {
    if (Object.keys(allResults).length === 0) {
        console.log('\n没有任何测试用例被处理');
        return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('测试执行总结');
    console.log('='.repeat(60));

    for (const [categoryKey, results] of Object.entries(allResults)) {
        if (results.length === 0) continue;

        const totalTests = results.length;
        const passedTests = results.filter(r => !r.error && r.response?.success).length;
        const failedTests = totalTests - passedTests;
        const emptyMatches = results.filter(r => !r.error && r.response?.success && (!r.response?.data || r.response.data.length === 0)).length;

        console.log(`\n[${categoryKey}]`);
        console.log(`  总计: ${totalTests}, 通过: ${passedTests}, 失败: ${failedTests}`);
        if (emptyMatches > 0) {
            console.log(`  ⚠️  空匹配: ${emptyMatches} (查询无结果)`);
        }
    }
}

/**
 * 解析命令行参数
 * 格式：lang:category:001,lang:category,lang
 * 示例：
 *   c                              # 所有C语言测试
 *   c:lifecycle                    # C语言的lifecycle-relationships类别
 *   c:lifecycle:001,c:lifecycle:003 # 特定测试用例
 */
function parseArguments(args) {
    if (args.length === 0) {
        // 无参数：运行所有支持的语言和类别
        return buildFullConfig();
    }

    const specs = [];
    
    // 处理所有参数（保持原始参数结构，不按逗号分割）
    // 这样可以确保 c:lifecycle:001,002,003,004,005 被作为一个整体处理
    for (const arg of args) {
        const parts = arg.split(':').map(p => p.toLowerCase().trim());
        
        if (parts.length === 0 || !parts[0]) continue;

        const language = parts[0];

        // 验证语言
        if (!SUPPORTED_LANGUAGES.includes(language)) {
            console.warn(`⚠️  不支持的语言: ${language}`);
            continue;
        }

        const categories = TEST_CATEGORIES[language] || [];

        if (parts.length === 1) {
            // 仅指定语言：所有类别
            for (const category of categories) {
                specs.push({
                    language,
                    category,
                    testIndices: null
                });
            }
        } else if (parts.length >= 2) {
            // 指定类别（可能包含通配符）
            const categoryPattern = parts[1];
            const matchedCategories = categories.filter(cat => 
                cat.includes(categoryPattern) || categoryPattern === 'all'
            );

            if (matchedCategories.length === 0) {
                console.warn(`⚠️  未找到匹配的类别: ${language}:${categoryPattern}`);
                continue;
            }

            for (const category of matchedCategories) {
                if (parts.length === 2) {
                    // 语言:类别 - 所有测试用例
                    specs.push({
                        language,
                        category,
                        testIndices: null
                    });
                } else {
                    // 语言:类别:001,002... - 特定测试用例
                    const testIndices = [];
                    for (let i = 2; i < parts.length; i++) {
                        const indicesPart = parts[i];
                        // 处理逗号分隔的多个索引，如 "001,002,003"
                        const indices = indicesPart.split(',').map(idx => parseInt(idx.trim()) - 1); // 转换为0-based索引
                        for (const index of indices) {
                            if (!isNaN(index) && index >= 0) {
                                testIndices.push(index);
                            }
                        }
                    }
                    if (testIndices.length > 0) {
                        specs.push({
                            language,
                            category,
                            testIndices
                        });
                    }
                }
            }
        }
    }

    if (specs.length === 0) {
        console.warn('未能解析任何有效的测试指定');
        return [];
    }

    return specs;
}

/**
 * 构建完整的配置（所有支持的语言和类别）
 */
function buildFullConfig() {
    const specs = [];
    
    for (const language of SUPPORTED_LANGUAGES) {
        const categories = TEST_CATEGORIES[language] || [];
        for (const category of categories) {
            specs.push({
                language,
                category,
                testIndices: null
            });
        }
    }

    return specs;
}

/**
 * 将规范转换为配置对象
 */
function buildConfigs(specs) {
    const configs = [];

    for (const spec of specs) {
        const { language, category, testIndices } = spec;
        const categoryDir = path.join(TESTS_BASE_DIR, language, category);
        
        const config = {
            language,
            category,
            indexFile: path.join(categoryDir, `${category}.json`),
            testDir: path.join(categoryDir, 'tests'),
            resultsDir: path.join(categoryDir, 'results'),
            testIndices
        };

        configs.push(config);
    }

    return configs;
}

/**
 * 打印使用说明
 */
function printUsage() {
    console.log(`
使用说明:
  node process-test-cases.js [选项]

选项格式:
  (无选项)                          # 运行所有支持的语言和类别
  
  语言
    c                               # 所有C语言测试
    python                          # 所有Python测试
  
  语言:类别
    c:lifecycle                     # C语言的lifecycle-relationships类别
    c:control                       # C语言的control-flow类别（前缀匹配）
    c:all                           # C语言的所有类别
  
  语言:类别:序号
    c:lifecycle:001                 # C语言lifecycle-relationships的第1个测试
    c:lifecycle:001,003             # 第1和3个测试
    c:lifecycle:001,002,003         # 第1、2、3个测试
  
  多个指定（用逗号或空格分隔）
    c:lifecycle:001,c:control-flow  # 混合指定
    c:lifecycle:001 c:control-flow  # 空格分隔
    c c:structs:001                 # 混合语言和类别

支持的语言:
    ${SUPPORTED_LANGUAGES.join(', ')}

C语言支持的类别:
    ${TEST_CATEGORIES.c.join(', ')}

示例:
    node process-test-cases.js                          # 运行全部
    node process-test-cases.js c                        # 运行所有C语言
    node process-test-cases.js c:lifecycle              # C语言lifecycle
    node process-test-cases.js c:lifecycle:001,003,005  # 特定测试
    node process-test-cases.js c:lifecycle:001 c:structs # 多个类别
`);
}

/**
 * 主函数
 */
async function main() {
    const args = process.argv.slice(2);

    // 检查帮助选项
    if (args.includes('--help') || args.includes('-h') || args.includes('help')) {
        printUsage();
        process.exit(0);
    }

    try {
        // 解析参数
        const specs = parseArguments(args);
        
        if (specs.length === 0) {
            console.log('未指定任何测试');
            printUsage();
            process.exit(1);
        }

        // 构建配置
        const configs = buildConfigs(specs);

        console.log(`\n处理${configs.length}个测试指定\n`);

        const allResults = {};

        // 处理所有配置
        for (const config of configs) {
            if (!fs.existsSync(config.indexFile)) {
                console.log(`⏭️  跳过 ${config.language}:${config.category} (索引文件不存在)\n`);
                continue;
            }

            try {
                const results = await processTestCategory(config, config.testIndices);
                const key = `${config.language}:${config.category}`;
                allResults[key] = results;
                console.log('');
            } catch (error) {
                console.error(`✗ 处理 ${config.language}:${config.category} 出错: ${error.message}\n`);
            }
        }

        // 生成总体报告
        generateReport(allResults);

        console.log('\n✓ 处理完成!');
        
    } catch (error) {
        console.error('处理过程中出错:', error.message);
        process.exit(1);
    }
}

// 运行主函数
main();
