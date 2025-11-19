const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 配置
const HOST = 'localhost';
const PORT = 4001;
const PROTOCOL = 'http'; // 根据实际情况调整为'http'或'https'

// 测试用例（来自struct-result-12.json对应的数据）
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
        console.log('测试数组访问查询...\n');
        
        // 发送请求
        const response = await sendPostRequest({
            language: 'c',
            code: TEST_CODE,
            query: QUERY
        });
        
        console.log('请求响应:');
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
            
            // 尝试一个更简单的查询来理解语法树结构
            console.log('\n尝试更简单的查询...');
            const simpleResponse = await sendPostRequest({
                language: 'c',
                code: TEST_CODE,
                query: '(subscript_expression) @array.access'
            });
            
            console.log('简单查询响应:');
            console.log(JSON.stringify(simpleResponse, null, 2));
        }
    } catch (error) {
        console.error('测试过程中出错:', error.message);
        process.exit(1);
    }
}

// 运行主函数
main();