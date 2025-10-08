const { createClient } = require('../index.js');

// 测试CREATE SPACE查询的修复
async function testCreateSpaceFix() {
    console.log('Testing CREATE SPACE query fix...');
    
    // 创建客户端配置
    const clientConfig = {
        servers: ['127.0.0.1:9669'],
        userName: 'root',
        password: 'nebula',
        poolSize: 1,
        bufferSize: 100,
        executeTimeout: 60000,
        pingInterval: 3000
    };

    const client = createClient(clientConfig);
    
    try {
        console.log('Connected to Nebula Graph');
        
        // 测试简单的YIELD查询
        console.log('Testing simple query...');
        const simpleResult = await client.execute('YIELD 1 AS test');
        console.log('Simple query result:', simpleResult);
        
        // 测试会导致字符串截断的CREATE SPACE查询
        const testSpaceName = 'project_test_space_buffer_fix';
        const createSpaceQuery = `CREATE SPACE IF NOT EXISTS \`${testSpaceName}\` (partition_num = 10, replica_factor = 1, vid_type = "FIXED_STRING(32)")`;
        
        console.log('Testing CREATE SPACE query...');
        console.log('Query:', createSpaceQuery);
        
        // 执行CREATE SPACE查询
        const createResult = await client.execute(createSpaceQuery);
        console.log('CREATE SPACE query executed successfully:', createResult);
        
        // 清理：删除测试空间
        console.log('Cleaning up test space...');
        const dropResult = await client.execute(`DROP SPACE IF EXISTS \`${testSpaceName}\``);
        console.log('DROP SPACE query executed successfully:', dropResult);
        
        console.log('All tests completed successfully!');
    } catch (error) {
        console.error('Test failed with error:', error.message);
    } finally {
        if (client) {
            await client.close();
            console.log('Client closed');
        }
    }
}

// 运行测试
testCreateSpaceFix().catch(console.error);