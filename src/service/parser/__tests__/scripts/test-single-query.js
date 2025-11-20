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
            path: '/api/query',
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
    const testDir = process.argv[2];
    if (!testDir) {
        console.error('请提供测试目录路径');
        process.exit(1);
    }

    try {
        // 读取代码和查询文件
        const codeFile = path.join(testDir, 'code.c');
        const queryFile = path.join(testDir, 'query.txt');
        
        if (!fs.existsSync(codeFile) || !fs.existsSync(queryFile)) {
            console.error('代码或查询文件不存在');
            process.exit(1);
        }
        
        const code = fs.readFileSync(codeFile, 'utf8').trim();
        const query = fs.readFileSync(queryFile, 'utf8').trim();
        
        console.log(`测试目录: ${testDir}`);
        console.log(`代码:\n${code}`);
        console.log(`查询:\n${query}`);
        
        // 发送请求
        const response = await sendPostRequest({
            language: 'c',
            code: code,
            query: query
        });
        
        console.log('\n响应:');
        console.log(JSON.stringify(response, null, 2));
        
        if (response.success && response.data.length > 0) {
            console.log(`\n✅ 查询成功，找到 ${response.data.length} 个匹配`);
        } else {
            console.log('\n❌ 查询失败或无匹配');
        }
    } catch (error) {
        console.error(`❌ 错误: ${error.message}`);
    }
}

// 运行主函数
main();