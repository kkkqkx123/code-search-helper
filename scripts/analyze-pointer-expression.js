const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 配置
const HOST = 'localhost';
const PORT = 4001;
const PROTOCOL = 'http'; // 根据实际情况调整为'http'或'https'

// 测试不同的指针表达式
const TEST_CODES = [
    {
        name: '简单指针访问',
        code: `int main() {
    struct Point* ptr;
    ptr->x;
    return 0;
}`
    },
    {
        name: '解引用指针访问',
        code: `int main() {
    struct Point* ptr;
    (*ptr)->x;
    return 0;
}`
    },
    {
        name: '地址取值访问',
        code: `int main() {
    struct Point p;
    (&p)->x;
    return 0;
}`
    }
];

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
        console.log('分析不同类型的指针表达式结构...\n');
        
        // 使用一个能匹配所有field_expression的查询
        const query = '(field_expression argument: (_) @arg field: (_) @field) @field_expr';
        
        for (const test of TEST_CODES) {
            console.log(`=== ${test.name} ===`);
            console.log('代码:');
            console.log(test.code);
            
            const response = await sendPostRequest({
                language: 'c',
                code: test.code,
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
        
        // 特别分析解引用指针的情况
        console.log('=== 详细分析解引用指针 ===');
        const derefCode = `int main() {
    struct Point* ptr;
    (*ptr)->x;
    return 0;
}`;
        
        const detailedQueries = [
            '(pointer_expression) @ptr_expr',
            '(pointer_expression argument: (identifier) @id) @ptr_with_id',
            '(field_expression argument: (pointer_expression argument: (identifier) @ptr_id) field: (field_identifier) @field_id) @deref_field'
        ];
        
        for (const query of detailedQueries) {
            console.log(`查询: ${query}`);
            const response = await sendPostRequest({
                language: 'c',
                code: derefCode,
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