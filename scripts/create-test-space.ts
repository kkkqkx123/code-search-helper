import { Client } from '@nebula-contrib/nebula-nodejs';

async function createTestSpace() {
  const config = {
    servers: ['127.0.0.1:9669'],
    userName: 'root',
    password: 'nebula',
    space: 'nebula', // Need to connect to default space first
    poolSize: 1, // Use a single connection
    bufferSize: 10,
    executeTimeout: 30000,
    pingInterval: 3000
  };

  try {
    console.log('Creating Nebula Graph client...');
    const client = new Client(config);

    console.log('Attempting to connect to Nebula Graph...');
    
    // First check if the test space exists
    console.log('Checking if test_space exists...');
    const result = await client.execute('SHOW SPACES;');
    console.log('Current spaces:', result);

    // Drop space if it exists
    try {
      await client.execute('DROP SPACE IF EXISTS test_space;');
      console.log('Dropped test_space if it existed');
    } catch (e: any) {
      console.log('Could not drop test_space (may not exist):', e.message);
    }

    // Create a new test space
    await client.execute('CREATE SPACE test_space (partition_num = 1, replica_factor = 1, vid_type = FIXED_STRING(30));');
    console.log('Created test_space');

    // Disconnect and reconnect with the new space
    await client.close();
    console.log('Closed client');

    // Now reconnect with the test_space
    const testSpaceConfig = {
      ...config,
      space: 'test_space'
    };

    console.log('Reconnecting with test_space...');
    const testClient = new Client(testSpaceConfig);

    // Use the space (already set in config, but just to be sure)
    await testClient.execute('USE test_space;');
    console.log('Using test_space');

    // Create a simple tag for testing
    await testClient.execute('CREATE TAG IF NOT EXISTS test_tag (name string, value string);');
    console.log('Created test_tag');

    console.log('Test space created successfully');
    
    // Close the test client
    await testClient.close();
    console.log('Connection released');
  } catch (error) {
    console.error('Error creating test space:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    } else {
      console.error('Unknown error:', error);
    }
  }
}

createTestSpace();