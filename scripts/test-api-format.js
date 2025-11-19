const fs = require('fs');
const path = require('path');

/**
 * 验证 API 请求格式的 JSON 文件
 * @param {string} filePath - JSON 文件路径
 */
function validateApiFormat(filePath) {
    console.log(`验证文件: ${filePath}`);
    
    try {
        // 读取并解析 JSON 文件
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        
        // 检查基本结构
        if (!data.requests || !Array.isArray(data.requests)) {
            console.error('❌ 错误: 缺少 requests 数组');
            return false;
        }
        
        console.log(`✅ 找到 ${data.requests.length} 个请求`);
        
        // 验证每个请求的格式
        let validCount = 0;
        for (let i = 0; i < data.requests.length; i++) {
            const request = data.requests[i];
            
            // 检查必需字段
            if (!request.language || !request.code || !request.query) {
                console.error(`❌ 请求 ${i + 1} 缺少必需字段`);
                continue;
            }
            
            // 检查语言字段
            if (request.language !== 'c') {
                console.error(`❌ 请求 ${i + 1} 语言字段不正确: ${request.language}`);
                continue;
            }
            
            // 检查代码和查询是否为空
            if (!request.code.trim() || !request.query.trim()) {
                console.error(`❌ 请求 ${i + 1} 代码或查询为空`);
                continue;
            }
            
            validCount++;
        }
        
        console.log(`✅ ${validCount}/${data.requests.length} 个请求格式正确`);
        
        // 显示前几个请求的摘要
        console.log('\n前 3 个请求摘要:');
        for (let i = 0; i < Math.min(3, data.requests.length); i++) {
            const request = data.requests[i];
            console.log(`\n请求 ${i + 1}:`);
            console.log(`  语言: ${request.language}`);
            console.log(`  代码长度: ${request.code.length} 字符`);
            console.log(`  查询长度: ${request.query.length} 字符`);
            console.log(`  代码预览: ${request.code.substring(0, 50)}...`);
            console.log(`  查询预览: ${request.query.substring(0, 50)}...`);
        }
        
        return validCount === data.requests.length;
        
    } catch (error) {
        console.error(`❌ 解析文件失败: ${error.message}`);
        return false;
    }
}

/**
 * 测试批量请求的分块（API 限制最多 10 个请求）
 * @param {string} filePath - JSON 文件路径
 */
function testBatchChunking(filePath) {
    console.log('\n测试批量请求分块...');
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        const requests = data.requests;
        
        // 分块处理，每批最多 10 个请求
        const chunks = [];
        for (let i = 0; i < requests.length; i += 10) {
            chunks.push(requests.slice(i, i + 10));
        }
        
        console.log(`✅ 总共 ${requests.length} 个请求，分为 ${chunks.length} 批`);
        
        for (let i = 0; i < chunks.length; i++) {
            console.log(`  批次 ${i + 1}: ${chunks[i].length} 个请求`);
        }
        
        return true;
        
    } catch (error) {
        console.error(`❌ 分块测试失败: ${error.message}`);
        return false;
    }
}

/**
 * 主函数
 */
function main() {
    const apiFile = path.join(__dirname, '../data/c-api-requests.json');
    
    console.log('=== API 格式验证测试 ===\n');
    
    const isValid = validateApiFormat(apiFile);
    const chunkingValid = testBatchChunking(apiFile);
    
    console.log('\n=== 测试结果 ===');
    if (isValid && chunkingValid) {
        console.log('✅ 所有测试通过！JSON 文件格式正确，可以用于 API 批量查询。');
    } else {
        console.log('❌ 测试失败，请检查 JSON 文件格式。');
    }
}

// 运行测试
if (require.main === module) {
    main();
}

module.exports = {
    validateApiFormat,
    testBatchChunking
};