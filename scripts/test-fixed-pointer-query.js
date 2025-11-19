const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 配置
const HOST = 'localhost';
const PORT = 4001;
const PROTOCOL = 'http'; // 根据实际情况调整为'http'或'https'

// 测试用例
const TEST_CODE = `#include <stdio.h>

struct Point {
    int x;
    int y;
};

int main() {
    struct Point p = {5, 10};
    struct Point* ptr = &p;
    
    // 简单指针成员访问
    printf("X: %d, Y: %d\\n", ptr->x, ptr->y);
    
    // 解引用指针成员访问
    printf("X: %d, Y: %d\\n", (*ptr)->x, (*ptr)->y);
    
    // 修改通过指针访问的成员
    ptr->x = 15;
    ptr->y = 25;
    
    return 0;
}`;

// 修复后的查询（合并两个查询）
const FIXED_QUERY = `; 匹配简单的指针成员访问 (ptr->field)
(field_expression
  argument: (identifier) @pointer.name
  field: (field_identifier) @field.name) @definition.pointer.member.access

; 匹配解引用的指针成员访问 ((*ptr)->field)
(field_expression
  argument: (parenthesized_expression
    (pointer_expression
      argument: (identifier) @pointer.name))
  field: (field_identifier) @field.name) @definition.pointer.member.access`;

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
        console.log('测试修复后的指针成员访问查询...\n');
        
        console.log('代码:');
        console.log(TEST_CODE);
        console.log('\n查询:');
        console.log(FIXED_QUERY);
        console.log('');
        
        // 发送请求
        const response = await sendPostRequest({
            language: 'c',
            code: TEST_CODE,
            query: FIXED_QUERY
        });
        
        console.log('响应:');
        console.log(JSON.stringify(response, null, 2));
        
        if (response.success && response.data && response.data.length > 0) {
            console.log('\n找到的匹配项:');
            // 按照捕获名称分组显示
            const groupedMatches = {};
            response.data.forEach(match => {
                if (!groupedMatches[match.captureName]) {
                    groupedMatches[match.captureName] = [];
                }
                groupedMatches[match.captureName].push(match);
            });
            
            Object.keys(groupedMatches).forEach(captureName => {
                console.log(`${captureName}:`);
                groupedMatches[captureName].forEach((match, index) => {
                    console.log(`  ${index + 1}. "${match.text}" (${match.type}) at 行${match.startPosition.row}, 列${match.startPosition.column}`);
                });
            });
        } else {
            console.log('\n未找到匹配项');
        }
    } catch (error) {
        console.error('测试过程中出错:', error.message);
        process.exit(1);
    }
}

// 运行主函数
main();