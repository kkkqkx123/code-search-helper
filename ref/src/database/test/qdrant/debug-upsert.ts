import { QdrantClient } from '@qdrant/js-client-rest';

async function debugUpsert() {
  console.log('Testing Qdrant upsert operation...');

  const client = new QdrantClient({
    url: 'http://localhost:6333',
  });

  try {
    // Test connection
    console.log('Connecting to Qdrant...');
    await client.getCollections();
    console.log('Connected successfully');

    // Create a test collection
    const collectionName = 'debug-test-collection';
    console.log(`Creating collection ${collectionName}...`);

    try {
      await client.deleteCollection(collectionName);
      console.log(`Deleted existing collection ${collectionName}`);
    } catch (error) {
      console.log(`Collection ${collectionName} does not exist, creating new one`);
    }

    await client.createCollection(collectionName, {
      vectors: {
        size: 128,
        distance: 'Cosine',
      },
    });
    console.log(`Created collection ${collectionName}`);

    // Try to upsert a point
    console.log('Upserting test point...');
    const points = [
      {
        id: 'debug-point-1',
        vector: Array(128).fill(0.5),
        payload: {
          content: 'test content',
          filePath: '/test/file.ts',
          language: 'typescript',
          chunkType: 'function',
          startLine: 1,
          endLine: 10,
          metadata: {},
          timestamp: new Date().toISOString(),
        },
      },
    ];

    const result = await client.upsert(collectionName, {
      points: points,
    });

    console.log('Upsert result:', result);
    console.log('Successfully upserted point');

    // Clean up
    await client.deleteCollection(collectionName);
    console.log(`Cleaned up collection ${collectionName}`);
  } catch (error: any) {
    console.error('Error:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

debugUpsert();
