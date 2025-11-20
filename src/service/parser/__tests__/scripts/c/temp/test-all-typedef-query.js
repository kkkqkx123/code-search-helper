const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 配置
const HOST = 'localhost';
const PORT = 4001;
const PROTOCOL = 'http';

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
 * 测试查询
 */
async function testQuery(language, code, query, description) {
    console.log(`\n=== 测试查询: ${description} ===`);
    console.log(`查询:\n${query}`);
    
    try {
        const response = await sendPostRequest({
            language: language,
            code: code,
            query: query
        });
        
        if (response.success) {
            console.log(`✅ 查询成功，找到 ${response.data.length} 个匹配:`);
            for (let i = 0; i < response.data.length; i++) {
                const match = response.data[i];
                console.log(`  匹配 ${i + 1}: "${match.text}" (行 ${match.startPosition.row + 1}, 列 ${match.startPosition.column + 1})`);
            }
        } else {
            console.log(`❌ 查询失败: ${response.message}`);
        }
    } catch (error) {
        console.error(`❌ 请求失败: ${error.message}`);
    }
}

/**
 * 主函数
 */
async function main() {
    const testCaseId = process.argv[2];
    if (!testCaseId) {
        console.error('请提供测试用例ID，例如: node test-all-typedef-query.js 006');
        process.exit(1);
    }

    console.log('开始测试所有类型别名查询模式...\n');
    
    // 构建路径
    const testDir = path.join(__dirname, '..', '..', '..', 'c', 'semantic-relationships', 'tests', `test-${testCaseId}`);
    const codePath = path.join(testDir, 'code.c');
    
    // 读取代码
    const code = fs.readFileSync(codePath, 'utf8');
    
    console.log(`测试用例: ${testCaseId}`);
    console.log(`代码:\n${code}\n`);
    
    // 测试所有类型别名相关的查询模式
    await testQuery('c', code, '(type_definition (sized_type_specifier) @orig (type_identifier) @alias)', '测试sized_type_specifier');
    await testQuery('c', code, '(type_definition (unsigned) @orig (type_identifier) @alias)', '测试unsigned');
    await testQuery('c', code, '(type_definition (long) @orig (type_identifier) @alias)', '测试long');
    await testQuery('c', code, '(type_definition (primitive_type) @orig (type_identifier) @alias)', '测试primitive_type');
    await testQuery('c', code, '(type_definition (struct_specifier) @orig (type_identifier) @alias)', '测试struct_specifier');
    
    console.log('\n测试完成!');
}

// 运行主函数
main();