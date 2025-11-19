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
    console.log('开始调试字面量查询...\n');
    
    // 调试true字面量
    await debugQuery(
        'c',
        '#include <stdio.h>\n#include <stdbool.h>\n\nint main() {\n    bool flag = true;\n    if (flag) {\n        printf("Flag is true\\n");\n    }\n    return 0;\n}',
        '(true) @definition.boolean_literal',
        'true字面量'
    );
    
    // 调试false字面量
    await debugQuery(
        'c',
        '#include <stdio.h>\n#include <stdbool.h>\n\nint main() {\n    bool flag = false;\n    if (!flag) {\n        printf("Flag is false\\n");\n    }\n    return 0;\n}',
        '(false) @definition.boolean_literal',
        'false字面量'
    );
    
    // 调试NULL字面量
    await debugQuery(
        'c',
        '#include <stdio.h>\n#include <stddef.h>\n\nint main() {\n    int* ptr = NULL;\n    if (ptr == NULL) {\n        printf("Pointer is null\\n");\n    }\n    return 0;\n}',
        '(null) @definition.null_literal',
        'NULL字面量'
    );
    
    // 调试type_qualifier
    await debugQuery(
        'c',
        '#include <stdio.h>\n\nint main() {\n    const int x = 5;\n    printf("x = %d\\n", x);\n    return 0;\n}',
        '(type_qualifier) @definition.type_qualifier',
        'type_qualifier'
    );
    
    // 调试storage_class_specifier
    await debugQuery(
        'c',
        '#include <stdio.h>\n\nstatic int global_var = 10;\n\nint main() {\n    printf("global_var = %d\\n", global_var);\n    return 0;\n}',
        '(storage_class_specifier) @definition.storage_class',
        'storage_class_specifier'
    );
    
    console.log('\n调试完成!');
}

// 运行主函数
main();