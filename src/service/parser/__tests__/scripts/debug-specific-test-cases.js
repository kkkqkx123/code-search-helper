const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 配置
const HOST = 'localhost';
const PORT = 4001;
const PROTOCOL = 'http'; // 根据实际情况调整为'http'或'https'

// 读取测试用例文件
const testData = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/service/parser/__tests__/c/structs/c-struct.json'), 'utf8'));

// 获取第12个和第16个测试用例（索引11和15）
const testCase12 = testData.requests[11];
const testCase16 = testData.requests[15];

console.log('测试用例12:');
console.log('- 代码:');
console.log(testCase12.code);
console.log('- 查询:');
console.log(testCase12.query);
console.log('');

console.log('测试用例16:');
console.log('- 代码:');
console.log(testCase16.code);
console.log('- 查询:');
console.log(testCase16.query);
console.log('');

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
 * 主函数
 */
async function main() {
    try {
        console.log('调试特定测试用例...\n');
        
        // 测试第12个测试用例
        console.log('=== 测试用例12 ===');
        const response12 = await sendPostRequest({
            language: testCase12.language,
            code: testCase12.code,
            query: testCase12.query
        });
        
        console.log('响应:');
        console.log(JSON.stringify(response12, null, 2));
        
        // 测试第16个测试用例
        console.log('\n=== 测试用例16 ===');
        const response16 = await sendPostRequest({
            language: testCase16.language,
            code: testCase16.code,
            query: testCase16.query
        });
        
        console.log('响应:');
        console.log(JSON.stringify(response16, null, 2));
        
        // 尝试一些替代查询来理解问题
        console.log('\n=== 调试图12的替代查询 ===');
        const altQueries12 = [
            '(declaration) @decl',
            '(array_declarator) @array_decl',
            '(identifier) @id'
        ];
        
        for (const query of altQueries12) {
            console.log(`\n查询: ${query}`);
            const altResponse = await sendPostRequest({
                language: testCase12.language,
                code: testCase12.code,
                query: query
            });
            
            if (altResponse.success && altResponse.data && altResponse.data.length > 0) {
                console.log(`找到 ${altResponse.data.length} 个匹配项`);
                // 显示前几个匹配项
                const displayCount = Math.min(3, altResponse.data.length);
                for (let i = 0; i < displayCount; i++) {
                    const match = altResponse.data[i];
                    console.log(`  ${i+1}. ${match.captureName}: "${match.text}" (${match.type})`);
                }
                if (altResponse.data.length > displayCount) {
                    console.log(`  ... 还有 ${altResponse.data.length - displayCount} 个匹配项`);
                }
            } else {
                console.log('未找到匹配项');
            }
        }
        
        console.log('\n=== 调试图16的替代查询 ===');
        const altQueries16 = [
            '(subscript_expression) @sub_expr',
            '(assignment_expression) @assign',
            '(identifier) @id'
        ];
        
        for (const query of altQueries16) {
            console.log(`\n查询: ${query}`);
            const altResponse = await sendPostRequest({
                language: testCase16.language,
                code: testCase16.code,
                query: query
            });
            
            if (altResponse.success && altResponse.data && altResponse.data.length > 0) {
                console.log(`找到 ${altResponse.data.length} 个匹配项`);
                // 显示前几个匹配项
                const displayCount = Math.min(3, altResponse.data.length);
                for (let i = 0; i < displayCount; i++) {
                    const match = altResponse.data[i];
                    console.log(`  ${i+1}. ${match.captureName}: "${match.text}" (${match.type})`);
                }
                if (altResponse.data.length > displayCount) {
                    console.log(`  ... 还有 ${altResponse.data.length - displayCount} 个匹配项`);
                }
            } else {
                console.log('未找到匹配项');
            }
        }
    } catch (error) {
        console.error('调试过程中出错:', error.message);
        process.exit(1);
    }
}

// 运行主函数
main();