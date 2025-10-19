const { QdrantClient } = require('@qdrant/js-client-rest');
const client = new QdrantClient({ host: 'localhost', port: 6333 });

async function debugUpsert() {
  try {
    // 检查集合信息
    const collectionInfo = await client.getCollection('project-a2c7b9d32367187c');
    console.log('Collection info:', JSON.stringify(collectionInfo.config.params.vectors, null, 2));
    
    // 使用数字ID进行测试
    const testPoint = {
      id: 1,  // 使用数字ID
      vector: Array(1024).fill(0.01), // 使用与实际应用相同的维度
      payload: {
        content: "print('Hello, World!')",
        filePath: 'D:\\\\ide\\\\tool\\\\code-search-helper\\\\test-files\\\\test.py',
        language: 'python',
        chunkType: ['code'],
        startLine: 1,
        endLine: 1,
        snippetMetadata: {
          snippetType: 'code'
        },
        metadata: {
          model: 'siliconflow',
          dimensions: 1024,
          processingTime: 100
        },
        timestamp: new Date().toISOString(),
        projectId: 'a2c7b9d32367187c'
      }
    };
    
    console.log('Attempting to upsert test point with numeric ID...');
    console.log('Point ID:', testPoint.id);
    console.log('Vector length:', testPoint.vector.length);
    
    const result = await client.upsert('project-a2c7b9d32367187c', {
      points: [testPoint]
    });
    
    console.log('Upsert with numeric ID successful:', result);
    
    // 现在尝试UUID格式的ID
    const uuidTestPoint = {
      id: '50e8400-e29b-41d4-a716-46655440000',  // 正确的UUID格式
      vector: Array(1024).fill(0.02),
      payload: {
        content: "print('Hello, World!')",
        filePath: 'D:\\\\ide\\\\tool\\\\code-search-helper\\\\test-files\\\\test.py',
        language: 'python',
        projectId: 'a2c7b9d32367187c'
      }
    };
    
    const result2 = await client.upsert('project-a2c7b9d32367187c', {
      points: [uuidTestPoint]
    });
    
    console.log('Upsert with UUID ID successful:', result2);
    
 } catch (error) {
    console.error('Upsert failed:', error.message);
    console.error('Error details:', error.data || error);
  }
}

debugUpsert();