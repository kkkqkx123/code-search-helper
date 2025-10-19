const { QdrantClient } = require('@qdrant/js-client-rest');
const client = new QdrantClient({ host: 'localhost', port: 6333 });

async function debugUpsert() {
  try {
    // 检查集合信息
    const collectionInfo = await client.getCollection('project-a2c7b9d32367187c');
    console.log('Collection info:', JSON.stringify(collectionInfo.config.params.vectors, null, 2));
    
    // 创建一个与应用中相同的数据结构
    const testPoint = {
      id: 'D__ide_tool_code-search-helper_test-files_test_py_1-1',
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
    
    console.log('Attempting to upsert test point...');
    console.log('Point ID:', testPoint.id);
    console.log('Vector length:', testPoint.vector.length);
    console.log('Payload keys:', Object.keys(testPoint.payload));
    
    const result = await client.upsert('project-a2c7b9d32367187c', {
      points: [testPoint]
    });
    
    console.log('Upsert successful:', result);
  } catch (error) {
    console.error('Direct upsert failed:', error.message);
    console.error('Error details:', error.data || error);
  }
}

debugUpsert();