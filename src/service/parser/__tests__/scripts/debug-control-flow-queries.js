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
 * 调试单个查询
 */
async function debugQuery(language, code, query, description) {
    console.log(`\n=== 调试: ${description} ===`);
    console.log(`代码:\n${code}`);
    console.log(`查询:\n${query}`);
    
    try {
        const response = await sendPostRequest({
            language: language,
            code: code,
            query: query
        });
        
        console.log(`响应: ${JSON.stringify(response, null, 2)}`);
        
        if (response.success && response.data.length > 0) {
            console.log(`✅ 成功匹配到 ${response.data.length} 个结果`);
        } else {
            console.log(`❌ 没有匹配到结果`);
        }
    } catch (error) {
        console.error(`❌ 请求失败: ${error.message}`);
    }
}

/**
 * 主函数
 */
async function main() {
    console.log('开始调试控制流查询...\n');
    
    // 调试测试用例10: _Alignof
    await debugQuery(
        'c',
        '#include <stdio.h>\n#include <stdalign.h>\n\nint main() {\n    int x = _Alignof(int);\n    printf("Alignment of int: %d\\n", x);\n    return 0;\n}',
        '(alignof_expression) @definition.alignof_expression',
        '测试用例10: _Alignof表达式'
    );
    
    // 调试测试用例16: _Alignas
    await debugQuery(
        'c',
        '#include <stdio.h>\n#include <stdalign.h>\n\n_Alignas(16) int x;\n\nint main() {\n    printf("Alignment of x: %zu\\n", _Alignof(x));\n    return 0;\n}',
        '(alignas_qualifier) @definition.alignas_qualifier',
        '测试用例16: _Alignas限定符'
    );
    
    // 调试control-flow-relationships测试用例1: if语句
    await debugQuery(
        'c',
        '#include <stdio.h>\n\nint main() {\n    int x = 10;\n    if (x > 5) {\n        printf("x is greater than 5\\n");\n    }\n    return 0;\n}',
        '(if_statement\n  condition: (parenthesized_expression\n    (_)? @source.condition)\n  consequence: (statement) @target.if.block) @control.flow.if',
        'control-flow-relationships测试用例1: if语句'
    );
    
    console.log('\n调试完成!');
}

// 运行主函数
main();