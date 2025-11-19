const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 配置
const HOST = 'localhost';
const PORT = 4001;
const PROTOCOL = 'http'; // 根据实际情况调整为'http'或'https'

// 测试用例12（索引11）的数据
const TEST_CODE_12 = `#include <stdio.h>

struct Point {
    int x;
    int y;
};

int main() {
    struct Point p = {5, 10};
    struct Point* ptr = &p;
    
    // 指针成员访问测试
    printf("X: %d, Y: %d\\n", ptr->x, ptr->y);
    
    // 修改通过指针访问的成员
    ptr->x = 15;
    ptr->y = 25;
    
    return 0;
}`;

const QUERY_12 = `(field_expression
  argument: (pointer_expression
    argument: (identifier) @pointer.name)
  field: (field_identifier) @field.name) @definition.pointer.member.access`;

// 测试用例16（索引15）的数据（与测试用例12相同）
const TEST_CODE_16 = TEST_CODE_12;
const QUERY_16 = QUERY_12;

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
        console.log('调试指针成员访问测试用例...\n');
        
        // 测试第12个测试用例
        console.log('=== 测试用例12（索引11）===');
        console.log('代码:');
        console.log(TEST_CODE_12);
        console.log('\n查询:');
        console.log(QUERY_12);
        console.log('');
        
        const response12 = await sendPostRequest({
            language: 'c',
            code: TEST_CODE_12,
            query: QUERY_12
        });
        
        console.log('响应:');
        console.log(JSON.stringify(response12, null, 2));
        
        if (response12.success && response12.data && response12.data.length > 0) {
            console.log('\n找到的匹配项:');
            response12.data.forEach((match, index) => {
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
                '(field_expression) @field_expr',
                '(pointer_expression) @ptr_expr',
                '(field_identifier) @field_id'
            ];
            
            for (const query of altQueries) {
                console.log(`\n查询: ${query}`);
                const altResponse = await sendPostRequest({
                    language: 'c',
                    code: TEST_CODE_12,
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
        
        // 测试第16个测试用例
        console.log('\n\n=== 测试用例16（索引15）===');
        const response16 = await sendPostRequest({
            language: 'c',
            code: TEST_CODE_16,
            query: QUERY_16
        });
        
        console.log('响应:');
        console.log(JSON.stringify(response16, null, 2));
    } catch (error) {
        console.error('调试过程中出错:', error.message);
        process.exit(1);
    }
}

// 运行主函数
main();