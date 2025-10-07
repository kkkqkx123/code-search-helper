import { createClient } from '@nebula-contrib/nebula-nodejs';

// 先连接到默认space，然后创建test_space
async function setupNebulaSpace() {
  console.log('Setting up Nebula Graph space...');
  
  try {
    // 首先尝试连接到系统默认space
    const systemConfig = {
      servers: ['127.0.0.1:9669'],
      userName: 'root',
      password: 'nebula',
      space: 'system'  // 系统默认space
    };

    console.log('Connecting to system space...');
    const systemClient = createClient(systemConfig);
    
    // 等待连接建立
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout after 30 seconds'));
      }, 30000);

      const onReady = () => {
        console.log('System client is ready!');
        clearTimeout(timeout);
        systemClient.removeListener('ready', onReady);
        systemClient.removeListener('error', onError);
        resolve();
      };

      const onError = (error: any) => {
        console.log('System client error:', error?.message || error);
        clearTimeout(timeout);
        systemClient.removeListener('ready', onReady);
        systemClient.removeListener('error', onError);
        reject(error);
      };

      systemClient.on('ready', onReady);
      systemClient.on('error', onError);
    });

    // 检查是否已存在test_space
    console.log('Checking existing spaces...');
    const showSpacesResult = await systemClient.execute('SHOW SPACES;');
    console.log('Existing spaces:', showSpacesResult);

    // 创建test_space
    console.log('Creating test_space...');
    try {
      const createSpaceResult = await systemClient.execute('CREATE SPACE IF NOT EXISTS test_space (partition_num=10, replica_factor=1);');
      console.log('Create space result:', createSpaceResult);
    } catch (error) {
      console.log('Error creating space (might already exist):', error);
    }

    // 等待space创建完成
    console.log('Waiting for space to be ready...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 关闭系统客户端
    if (typeof systemClient.close === 'function') {
      await systemClient.close();
      console.log('System client closed');
    }

    console.log('Space setup completed!');
    return true;
    
  } catch (error) {
    console.error('Space setup failed:', error);
    return false;
  }
}

setupNebulaSpace().then(() => {
  console.log('Setup completed, exiting...');
  process.exit(0);
}).catch(() => {
  console.log('Setup failed, exiting...');
  process.exit(1);
});