const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 配置
const HOST = 'localhost';
const PORT = 4001;
const PROTOCOL = 'http'; // 根据实际情况调整为'http'或'https'

// 测试用例16的实际数据
const TEST_CODE = `#include <stdio.h>

int main() {
    int arr[10];
    int matrix[5][5];
    
    // 数组访问测试
    arr[0] = 1;
    arr[1] = 2;
    arr[2] = arr[0] + arr[1];
    
    // 二维数组访问
    matrix[0][0] = 10;
    matrix[1][2] = 20;
    
    // 使用变量作为索引
    int i = 3;
    arr[i] = 30;
    
    return 0;
}`;

const QUERY = `(subscript_expression
  argument: (identifier) @array.name
  index: (_) @index) @definition.array.access`;

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
        console.log('调试测试用例16...\n');
        
        console.log('代码:');
        console.log(TEST_CODE);
        console.log('\n查询:');
        console.log(QUERY);
        console.log('');
        
        // 发送请求
        const response = await sendPostRequest({
            language: 'c',
            code: TEST_CODE,
            query: QUERY
        });
        
        console.log('响应:');
        console.log(JSON.stringify(response, null, 2));
        
        if (response.success && response.data && response.data.length > 0) {
            console.log('\n找到的匹配项:');
            response.data.forEach((match, index) => {
                console.log(`${index + 1}. 捕获名称: ${match.captureName}`);
                console.log(`   节点类型: ${match.type}`);
                console.log(`   文本内容: "${match.text}"`);
                console.log(`   位置: 行${match.startPosition.row}, 列${match.startPosition.column} - 行${match.endPosition.row}, 列${match.endPosition.column}`);
                console.log('');
            });
        } else {
            console.log('\n未找到匹配项');
            
            // 尝试一些替代查询来理解问题
            console.log('\n=== 调试替代查询 ===');
            const altQueries = [
                '(subscript_expression) @sub_expr',
                '(identifier) @id',
                '(assignment_expression) @assign'
            ];
            
            for (const query of altQueries) {
                console.log(`\n查询: ${query}`);
                const altResponse = await sendPostRequest({
                    language: 'c',
                    code: TEST_CODE,
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
        }
    } catch (error) {
        console.error('调试过程中出错:', error.message);
        process.exit(1);
    }
}

// 运行主函数
main();