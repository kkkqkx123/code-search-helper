import { createClient } from '@nebula-contrib/nebula-nodejs';

// 简单测试，直接使用客户端连接
async function testConnectionDirect() {
  console.log('Testing Nebula Graph connection directly...');
  
  // 使用与应用中相同的配置结构
  const config = {
    servers: ['127.0.0.1:9669'],
    userName: 'root',
    password: 'nebula',
    space: 'test_space', // 使用我们刚刚创建的测试空间
    poolSize: 10,
    bufferSize: 10,
    executeTimeout: 30000,
    pingInterval: 3000
  };

  console.log('Creating client with config:', JSON.stringify(config, null, 2));

  try {
    // 创建客户端
    const client = createClient(config);
    console.log('Client created, waiting for connections to be ready...');
    
    // 等待连接建立并测试查询
    await new Promise<void>((resolve, reject) => {
      let queryTested = false;
      
      // 监听连接事件
      client.on('connected', (event: any) => {
        console.log('Client connected event:', { 
          connectionId: event.sender?.connectionId 
        });
      });
      
      client.on('authorized', (event: any) => {
        console.log('Client authorized event:', { 
          connectionId: event.sender?.connectionId 
        });
      });
      
      client.on('error', (event: any) => {
        console.log('Client error event:', {
          connectionId: event.sender?.connectionId,
          error: event.error?.message || event.error
        });
        // 对于"会话无效或连接未就绪"错误，不立即reject，等待重试或ready事件
        const errorMsg = event.error?.message || String(event.error);
        if (errorMsg.includes('会话无效或连接未就绪') || errorMsg.includes('Session invalid')) {
          console.log('Connection not ready yet, waiting for ready event...');
        } else if (!queryTested) {
          reject(new Error(`Connection error: ${errorMsg}`));
        }
      });
      
      // 等待ready事件，这是连接完全就绪的标志
      client.on('ready', (event: any) => {
        console.log('Client ready event:', {
          connectionId: event.sender?.connectionId
        });
        if (!queryTested) {
          queryTested = true;
          resolve();
        }
      });
      
      // 监听所有连接的ready状态
      let readyConnections = 0;
      const totalConnections = config.poolSize || 10;
      
      client.on('connected', (event: any) => {
        console.log('Client connected event:', {
          connectionId: event.sender?.connectionId
        });
      });
      
      client.on('authorized', (event: any) => {
        console.log('Client authorized event:', {
          connectionId: event.sender?.connectionId
        });
        // 在authorized后，等待一段时间再检查连接是否ready
        setTimeout(() => {
          if (event.sender?.isReady) {
            readyConnections++;
            console.log(`Connection ${event.sender.connectionId} is ready (${readyConnections}/${totalConnections})`);
            if (readyConnections >= 1 && !queryTested) {
              queryTested = true;
              resolve();
            }
          } else {
            console.log(`Connection ${event.sender?.connectionId} authorized but not ready yet, waiting...`);
          }
        }, 2000); // 增加等待时间到2秒
      });
      
      
      // 设置总超时时间
      setTimeout(() => {
        if (!queryTested) {
          reject(new Error('Connection validation timeout after 30 seconds'));
        }
      }, 30000); // 30秒超时
    });
    
    console.log('Attempting to execute SHOW TAGS query...');
    const result = await client.execute('SHOW TAGS;');
    console.log('SHOW TAGS result:', result);

    // 执行更复杂的查询
    console.log('Executing complex query...');
    const result2 = await client.execute('YIELD 1 AS test_value');
    console.log('Complex query result:', result2);

    // 插入一些测试数据
    console.log('Inserting test data...');
    await client.execute('INSERT VERTEX file (name, file_path, content) VALUES "file1":("test.ts", "/path/to/test.ts", "console.log(\\"Hello World\\");");');
    console.log('Test data inserted successfully');

    // 查询刚刚插入的数据
    console.log('Querying test data...');
    const result3 = await client.execute('MATCH (v:file) RETURN v.file.name AS name, v.file.file_path AS path LIMIT 10;');
    console.log('Query result:', result3);

    // 关闭客户端
    if (typeof client.close === 'function') {
      await client.close();
      console.log('Client closed');
    }
    
    console.log('All tests completed successfully!');
  } catch (error) {
    console.error('Connection failed:', error);
    return false;
  } finally {
    // 退出程序
    process.exit(0);
  }
}

testConnectionDirect();