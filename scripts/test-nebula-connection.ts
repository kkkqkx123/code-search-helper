import { createClient } from '@nebula-contrib/nebula-nodejs';

async function testConnection() {
  console.log('Testing Nebula Graph connection...');
  
  const clientConfig = {
    servers: ['127.0.0.1:9669'],
    userName: 'root',
    password: 'nebula',
    space: 'test_space', // Required by ClientOption type
    poolSize: 10,
    bufferSize: 10,
    executeTimeout: 30000,
    pingInterval: 3000
  };

  try {
    console.log('Creating client with config:', clientConfig);
    const client = createClient(clientConfig);
    
    // 正确处理连接事件
    const connectionReady = new Promise<void>((resolve, reject) => {
      let connected = false;
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout: Client failed to connect within reasonable time'));
      }, 30000); // 30秒超时

      const handleAuthorized = (event: any) => {
        console.log('Client authorized event:', { sender: event.sender ? { connectionId: event.sender.connectionId } : 'no sender' });
        if (!connected) {
          connected = true;
          clearTimeout(timeout);
          resolve();
        }
      };

      const handleError = (event: any) => {
        console.log('Client error event:', {
          sender: event.sender ? { connectionId: event.sender.connectionId } : 'no sender',
          error: event.error
        });
        if (!connected) {
          clearTimeout(timeout);
          reject(new Error(`Connection error: ${event.error}`));
        }
      };

      client.on('connected', (event: any) => {
        console.log('Client connected event:', { sender: event.sender ? { connectionId: event.sender.connectionId } : 'no sender' });
      });

      client.on('authorized', handleAuthorized);
      client.on('error', handleError);
      
      // 监听 ready 事件作为备选方案
      client.on('ready', (event: any) => {
        console.log('Client ready event:', event);
        if (!connected) {
          connected = true;
          clearTimeout(timeout);
          resolve();
        }
      });
    });
    
    // 等待连接就绪
    await connectionReady;
    
    console.log('Client connected, attempting to execute simple query...');
    
    // 等待一点时间确保连接完全建立
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Try to execute a simple query to verify connection in the test_space
    const result = await client.execute('SHOW TAGS;');
    
    console.log('Query result:', result);
    console.log('Connection successful!');
    
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

    // Close the client
    if (typeof client.close === 'function') {
      await client.close();
      console.log('Client closed');
    }
    
    console.log('All tests completed successfully!');
  } catch (error) {
    console.error('Connection failed with error:', error);
    console.error('Error type:', typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available');
  } finally {
    // 确保脚本退出
    process.exit(0);
  }
}

testConnection();