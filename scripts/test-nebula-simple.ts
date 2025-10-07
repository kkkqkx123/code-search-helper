import { createClient } from '@nebula-contrib/nebula-nodejs';

// 简单测试，使用最基础的配置
async function testSimpleConnection() {
  console.log('Testing Nebula Graph connection with minimal configuration...');
  
  // 使用最基本的配置
  const config = {
    servers: ['127.0.0.1:9669'],
    userName: 'root',
    password: 'nebula',
    space: 'test_space'  // 必须指定space
  };

  console.log('Creating client with minimal config:', JSON.stringify(config, null, 2));

  try {
    // 创建客户端
    const client = createClient(config);
    console.log('Client created');
    
    // 等待连接建立
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout after 30 seconds'));
      }, 30000);

      // 等待ready事件
      const onReady = () => {
        console.log('Client is ready!');
        clearTimeout(timeout);
        client.removeListener('ready', onReady);
        client.removeListener('error', onError);
        resolve();
      };

      const onError = (error: any) => {
        console.log('Client error:', error?.message || error);
        clearTimeout(timeout);
        client.removeListener('ready', onReady);
        client.removeListener('error', onError);
        reject(error);
      };

      client.on('ready', onReady);
      client.on('error', onError);
    });

    console.log('Attempting to execute SHOW SPACES query...');
    const result = await client.execute('SHOW SPACES;');
    console.log('SHOW SPACES result:', result);

    console.log('All tests completed successfully!');
    
    // 关闭客户端
    if (typeof client.close === 'function') {
      await client.close();
      console.log('Client closed');
    }
  } catch (error) {
    console.error('Connection failed:', error);
    return false;
  }
}

testSimpleConnection().then(() => {
  console.log('Test completed, exiting...');
  process.exit(0);
}).catch(() => {
  console.log('Test failed, exiting...');
  process.exit(1);
});