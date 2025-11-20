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
 * 调试AST结构
 */
async function debugAST(language, code, description) {
    console.log(`\n=== 调试AST结构: ${description} ===`);
    console.log(`代码:\n${code}`);
    
    try {
        // 使用通用查询获取所有节点
        const response = await sendPostRequest({
            language: language,
            code: code,
            query: '_ @node'
        });
        
        if (response.success && response.data.length > 0) {
            console.log(`找到 ${response.data.length} 个节点:`);
            
            // 按类型分组并显示
            const nodesByType = {};
            for (const node of response.data) {
                if (!nodesByType[node.type]) {
                    nodesByType[node.type] = [];
                }
                nodesByType[node.type].push(node);
            }
            
            // 显示每种类型的节点
            for (const [type, nodes] of Object.entries(nodesByType)) {
                console.log(`\n${type} (${nodes.length}个):`);
                for (const node of nodes.slice(0, 3)) { // 只显示前3个
                    console.log(`  - "${node.text}" (行 ${node.startPosition.row + 1}, 列 ${node.startPosition.column + 1})`);
                }
                if (nodes.length > 3) {
                    console.log(`  - ... 还有 ${nodes.length - 3} 个`);
                }
            }
        } else {
            console.log(`❌ 没有找到任何节点`);
        }
    } catch (error) {
        console.error(`❌ 请求失败: ${error.message}`);
    }
}

/**
 * 主函数
 */
async function main() {
    const testCaseId = process.argv[2];
    if (!testCaseId) {
        console.error('请提供测试用例ID，例如: node debug-test-case.js 003');
        process.exit(1);
    }

    console.log('开始调试测试用例AST结构...\n');
    
    // 构建路径 - 修正路径
    const testDir = path.join(__dirname, '..', '..', '..', 'c', 'semantic-relationships', 'tests', `test-${testCaseId}`);
    const codePath = path.join(testDir, 'code.c');
    const queryPath = path.join(testDir, 'query.txt');
    
    console.log(`测试目录: ${testDir}`);
    console.log(`代码路径: ${codePath}`);
    
    // 检查文件是否存在
    if (!fs.existsSync(codePath)) {
        console.error(`代码文件不存在: ${codePath}`);
        process.exit(1);
    }
    
    // 读取代码和查询
    const code = fs.readFileSync(codePath, 'utf8');
    const query = fs.readFileSync(queryPath, 'utf8');
    
    console.log(`测试用例: ${testCaseId}`);
    console.log(`查询语句:\n${query}\n`);
    
    // 调试AST结构
    await debugAST('c', code, `测试用例 ${testCaseId}`);
    
    console.log('\n调试完成!');
}

// 运行主函数
main();