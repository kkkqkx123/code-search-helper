const fs = require('fs');
const path = require('path');

/**
 * 批量 API 查询示例
 * 展示如何使用生成的 JSON 文件进行批量查询
 */
function batchApiExample() {
    const apiFile = path.join(__dirname, '../data/c-api-requests.json');
    
    console.log('=== 批量 API 查询示例 ===\n');
    
    try {
        // 读取 API 请求文件
        const content = fs.readFileSync(apiFile, 'utf8');
        const data = JSON.parse(content);
        const requests = data.requests;
        
        console.log(`总共 ${requests.length} 个查询请求`);
        
        // 分批处理（API 限制每批最多 10 个请求）
        const batchSize = 10;
        const batches = [];
        
        for (let i = 0; i < requests.length; i += batchSize) {
            batches.push(requests.slice(i, i + batchSize));
        }
        
        console.log(`分为 ${batches.length} 批进行处理\n`);
        
        // 模拟 API 调用
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            const batchData = {
                requests: batch
            };
            
            console.log(`--- 批次 ${i + 1} (${batch.length} 个请求) ---`);
            
            // 这里应该是实际的 API 调用
            // 例如: const response = fetch('/api/parse/batch', {
            //   method: 'POST',
            //   headers: { 'Content-Type': 'application/json' },
            //   body: JSON.stringify(batchData)
            // });
            
            // 模拟响应
            console.log('请求体示例:');
            console.log(JSON.stringify(batchData, null, 2).substring(0, 500) + '...');
            
            // 模拟处理每个请求的结果
            console.log('\n预期响应格式:');
            console.log(`{
  "success": true,
  "data": {
    "results": [
      {
        "success": true,
        "matches": [...],
        "errors": []
      },
      // ... 更多结果
    ],
    "summary": {
      "total": ${batch.length},
      "successful": ${batch.length},
      "failed": 0,
      "totalMatches": 0
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}`);
            
            console.log('\n');
        }
        
        console.log('=== 使用说明 ===');
        console.log('1. 生成的 JSON 文件位于: data/c-api-requests.json');
        console.log('2. 每个请求包含 language、code 和 query 字段');
        console.log('3. API 端点: POST /api/parse/batch');
        console.log('4. 每批最多处理 10 个请求');
        console.log('5. 总共需要 5 批次处理完所有 46 个请求');
        
    } catch (error) {
        console.error('错误:', error.message);
    }
}

/**
 * 创建单个请求示例
 */
function singleRequestExample() {
    console.log('\n=== 单个请求示例 ===\n');
    
    const singleRequest = {
        language: 'c',
        code: `#include <pthread.h>

void* thread_function(void* arg) {
    return NULL;
}

int main() {
    pthread_t thread;
    pthread_create(&thread, NULL, thread_function, NULL);
    return 0;
}`,
        query: `(call_expression) @concurrency.relationship.thread.creation
  function: (identifier) @thread.create.function
  (#match? @thread.create.function "^(pthread_create|CreateThread|_beginthreadex)$")
  arguments: (argument_list
    (identifier) @thread.handle
    (identifier) @thread.attributes
    (identifier) @thread.start.function
    (identifier) @thread.argument)`
    };
    
    console.log('单个请求示例:');
    console.log(JSON.stringify(singleRequest, null, 2));
    
    console.log('\n对应的 API 调用:');
    console.log('POST /api/parse');
    console.log('Content-Type: application/json');
    console.log('Body:', JSON.stringify(singleRequest, null, 2));
}

// 运行示例
if (require.main === module) {
    batchApiExample();
    singleRequestExample();
}

module.exports = {
    batchApiExample,
    singleRequestExample
};