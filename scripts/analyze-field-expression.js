const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 配置
const HOST = 'localhost';
const PORT = 4001;
const PROTOCOL = 'http'; // 根据实际情况调整为'http'或'https'

// 简单的代码来分析
const TEST_CODE = `int main() {
    struct Point* ptr;
    ptr->x;
    return 0;
}`;

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
        console.log('分析field_expression结构...\n');
        
        // 尝试不同的查询来理解结构
        const queries = [
            '(field_expression) @field_expr',
            '(field_expression argument: (_) @arg field: (_) @field) @field_expr_full',
            '(field_expression argument: (identifier) @id field: (field_identifier) @fid) @with_identifiers',
            '(field_expression (identifier) @id (field_identifier) @fid) @simple_structure'
        ];
        
        for (const query of queries) {
            console.log(`查询: ${query}`);
            const response = await sendPostRequest({
                language: 'c',
                code: TEST_CODE,
                query: query
            });
            
            if (response.success && response.data && response.data.length > 0) {
                console.log(`找到 ${response.data.length} 个匹配项:`);
                response.data.forEach((match, index) => {
                    console.log(`  ${index + 1}. ${match.captureName}: "${match.text}" (${match.type})`);
                });
            } else {
                console.log('未找到匹配项');
            }
            console.log('');
        }
    } catch (error) {
        console.error('分析过程中出错:', error.message);
        process.exit(1);
    }
}

// 运行主函数
main();