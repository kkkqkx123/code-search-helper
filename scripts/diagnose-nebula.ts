import { createClient } from '@nebula-contrib/nebula-nodejs';

// 诊断脚本，尝试不同的连接配置
async function diagnoseNebulaConnection() {
  console.log('=== Nebula Graph Connection Diagnosis ===');

  // 测试配置：既然 test_space 已确认存在，直接测试各种配置
  const configs = [
    {
      name: 'Standard Config (test_space)',
      config: {
        servers: ['127.0.0.1:9669'],
        userName: 'root',
        password: 'nebula',
        space: 'test_space'
      }
    },
    {
      name: 'Config with poolSize=1',
      config: {
        servers: ['127.0.0.1:9669'],
        userName: 'root',
        password: 'nebula',
        space: 'test_space',
        poolSize: 1
      }
    },
    {
      name: 'Config with explicit timeouts',
      config: {
        servers: ['127.0.0.1:9669'],
        userName: 'root',
        password: 'nebula',
        space: 'test_space',
        poolSize: 1,
        bufferSize: 10,
        executeTimeout: 10000,
        pingInterval: 10000
      }
    }
  ];

  for (const testConfig of configs) {
    console.log(`\n--- Testing ${testConfig.name} ---`);
    console.log('Config:', JSON.stringify(testConfig.config, null, 2));
    
    try {
      // @ts-ignore - space is required in type but we want to test without it initially
      const client = createClient(testConfig.config);
      console.log('✓ Client created successfully');
      
      // 监听所有可能的事件
      const events = [];
      const eventTypes = ['ready', 'error', 'connected', 'authorized', 'free', 'close'];
      
      eventTypes.forEach(eventType => {
        client.on(eventType, (data) => {
          events.push({ type: eventType, data, timestamp: Date.now() });
          if (eventType === 'error') {
            console.log(`Event: ${eventType}`, data?.message || data || 'No data');
          } else if (data && typeof data === 'object' && data.connectionId) {
            console.log(`Event: ${eventType}`, { connectionId: data.connectionId, isReady: data.isReady });
          } else {
            console.log(`Event: ${eventType}`, data ? 'Received data' : 'No data');
          }
        });
      });
      
      // 等待连接或超时
      const result = await Promise.race([
        new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection timeout after 15 seconds'));
          }, 15000);
          
          client.once('ready', () => {
            clearTimeout(timeout);
            resolve('ready');
          });
          
          client.once('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        }),
        new Promise(resolve => setTimeout(() => resolve('timeout'), 15000))
      ]);
      
      if (result === 'ready') {
        console.log('✓ Connection established successfully!');
        
        // 尝试执行简单查询 - 先不依赖 space
        try {
          // 等待额外时间确保连接完全就绪
          await new Promise(resolve => setTimeout(resolve, 3000));

          console.log('Executing validation query: YIELD 1');
          const queryResult = await client.execute('YIELD 1 AS test;');
          console.log('✓ Basic query executed successfully:', queryResult);

          // 如果基本查询成功，尝试查询 spaces
          try {
            console.log('Executing: SHOW SPACES;');
            const spacesResult = await client.execute('SHOW SPACES;');
            console.log('✓ SHOW SPACES executed successfully:', spacesResult);
          } catch (spacesError: any) {
            console.log('✗ SHOW SPACES failed:', spacesError?.message || spacesError);
          }

        } catch (queryError: any) {
          console.log('✗ Query failed:', queryError?.message || queryError);
        }
        
        // 关闭客户端
        if (typeof client.close === 'function') {
          await client.close();
          console.log('✓ Client closed');
        }
      } else {
        console.log('✗ Connection timeout');
      }
      
    } catch (error: any) {
      console.log('✗ Connection failed:', error?.message || error);
      if (error?.code) console.log('Error code:', error.code);
      if (error?.errno) console.log('Error number:', error.errno);
    }
  }
  
  console.log('\n=== Diagnosis completed ===');
}

diagnoseNebulaConnection().then(() => {
  console.log('Diagnosis completed, exiting...');
  process.exit(0);
}).catch((error) => {
  console.log('Diagnosis failed:', error);
  process.exit(1);
});