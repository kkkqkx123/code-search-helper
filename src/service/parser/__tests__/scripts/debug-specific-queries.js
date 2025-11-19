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
    console.log('开始调试特定查询...\n');
    
    // 调试_Generic表达式
    await debugQuery(
        'c',
        '#include <stdio.h>\n\nint main() {\n    int x = 5;\n    _Generic(x, int: "integer", float: "float", default: "other");\n    return 0;\n}',
        '(generic_expression\n    selector: (_) @generic.selector\n    associations: (generic_association_list\n      (generic_association\n        pattern: (_) @association.pattern\n        result: (_) @association.result)*)) @definition.generic_expression',
        '_Generic表达式'
    );
    
    // 调试注释
    await debugQuery(
        'c',
        '#include <stdio.h>\n\nint main() {\n    // This is a comment\n    printf("Hello\\n");\n    return 0;\n}',
        '(comment) @definition.comment',
        '注释'
    );
    
    // 调试简化版_Generic表达式
    await debugQuery(
        'c',
        '#include <stdio.h>\n\nint main() {\n    int x = 5;\n    _Generic(x, int: "integer", float: "float", default: "other");\n    return 0;\n}',
        '(generic_expression) @definition.generic_expression',
        '简化版_Generic表达式'
    );
    
    console.log('\n调试完成!');
}

// 运行主函数
main();