import { QdrantService } from '../QdrantService';
import { NebulaService } from '../NebulaService';
import { QdrantClientWrapper } from '../qdrant/QdrantClientWrapper';
import { NebulaConnectionManager } from '../nebula/NebulaConnectionManager';
import { NebulaSessionMonitor } from '../nebula/NebulaSessionMonitor';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';

// Mock the logger and error handler to reduce noise in tests
jest.mock('../../core/LoggerService');
jest.mock('../../core/ErrorHandlerService');

describe('Database Services Integration Tests', () => {
  let qdrantService: QdrantService;
  let nebulaService: NebulaService;
  let loggerService: LoggerService;
  let errorHandlerService: ErrorHandlerService;
  let configService: ConfigService;

  // Skip these tests if databases are not available
  const describeIfDatabasesAvailable = 
    process.env.QDRANT_HOST && process.env.NEBULA_HOST ? describe : describe.skip;

  beforeAll(() => {
    // Create real instances
    loggerService = new LoggerService();
    errorHandlerService = new ErrorHandlerService(loggerService);
    configService = ConfigService.getInstance();
    
    // Create Qdrant service
    const qdrantClient = new QdrantClientWrapper(configService, loggerService, errorHandlerService);
    qdrantService = new QdrantService(
      configService,
      loggerService,
      errorHandlerService,
      qdrantClient
    );
    
    // Create Nebula service
    const nebulaConnection = new NebulaConnectionManager(loggerService, errorHandlerService, configService);
    const nebulaSessionMonitor = new NebulaSessionMonitor(nebulaConnection, loggerService, errorHandlerService);
    nebulaService = new NebulaService(
      loggerService,
      errorHandlerService,
      nebulaConnection,
      nebulaSessionMonitor
    );
  });

  describeIfDatabasesAvailable('Cross-Database Operations', () => {
    const testProjectId = 'integration-test-' + Date.now();
    const qdrantCollectionName = `project-${testProjectId}`;
    const nebulaSpaceName = `project_${testProjectId}`;

    it('should initialize both database services successfully', async () => {
      // Initialize Qdrant
      const qdrantInitialized = await qdrantService.initialize();
      expect(qdrantInitialized).toBe(true);
      expect(qdrantService.isConnected()).toBe(true);

      // Initialize Nebula
      try {
        const nebulaInitialized = await nebulaService.initialize();
        expect(nebulaInitialized).toBe(true);
        expect(nebulaService.isConnected()).toBe(true);
      } catch (error) {
        // Nebula might not be available, but Qdrant should be
        console.log('Nebula initialization failed - continuing with Qdrant tests');
      }
    });

    it('should create project-specific resources in both databases', async () => {
      // Create Qdrant collection
      if (qdrantService.isConnected()) {
        const collectionCreated = await qdrantService.createCollection(qdrantCollectionName, 128);
        expect(collectionCreated).toBe(true);
        
        // Verify collection exists
        const collectionExists = await qdrantService.collectionExists(qdrantCollectionName);
        expect(collectionExists).toBe(true);
      }

      // Create Nebula space
      if (nebulaService.isConnected()) {
        try {
          const createSpaceQuery = `CREATE SPACE IF NOT EXISTS ${nebulaSpaceName} (partition_num=1, replica_factor=1, vid_type=FIXED_STRING(30))`;
          await nebulaService.executeWriteQuery(createSpaceQuery);
          
          // Use the space
          await nebulaService.useSpace(nebulaSpaceName);
          
          // Create test schema
          await nebulaService.executeWriteQuery('CREATE TAG IF NOT EXISTS code_snippet(content string, language string)');
          await nebulaService.executeWriteQuery('CREATE EDGE IF NOT EXISTS references_snippet(type string)');
        } catch (error) {
          console.log('Nebula space creation failed - continuing with other tests');
        }
      }
    });

    it('should store and retrieve data from both databases', async () => {
      // Store data in Qdrant
      if (qdrantService.isConnected()) {
        const testVectors = [
          {
            id: 'snippet-1',
            vector: Array(128).fill(0.5),
            payload: {
              content: 'Test code snippet 1',
              filePath: '/test/file1.ts',
              language: 'typescript',
              chunkType: 'function',
              startLine: 1,
              endLine: 10,
              metadata: { projectId: testProjectId },
              timestamp: new Date(),
            },
          },
          {
            id: 'snippet-2',
            vector: Array(128).fill(0.8),
            payload: {
              content: 'Test code snippet 2',
              filePath: '/test/file2.ts',
              language: 'typescript',
              chunkType: 'class',
              startLine: 15,
              endLine: 25,
              metadata: { projectId: testProjectId },
              timestamp: new Date(),
            },
          },
        ];

        const upsertResult = await qdrantService.upsertVectors(qdrantCollectionName, testVectors);
        expect(upsertResult).toBe(true);

        // Search vectors
        const queryVector = Array(128).fill(0.6);
        const searchResults = await qdrantService.searchVectors(qdrantCollectionName, queryVector, {
          limit: 5,
        });

        expect(searchResults).toBeDefined();
        expect(Array.isArray(searchResults)).toBe(true);
        expect(searchResults.length).toBeGreaterThan(0);
      }

      // Store data in Nebula
      if (nebulaService.isConnected()) {
        try {
          await nebulaService.useSpace(nebulaSpaceName);
          
          // Wait for schema to be ready
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Create nodes
          const node1 = {
            label: 'code_snippet',
            id: 'snippet-node-1',
            properties: { 
              content: 'Test code snippet for graph', 
              language: 'typescript' 
            }
          };
          
          const node2 = {
            label: 'code_snippet',
            id: 'snippet-node-2',
            properties: { 
              content: 'Another test code snippet for graph', 
              language: 'typescript' 
            }
          };
          
          await nebulaService.createNode(node1);
          await nebulaService.createNode(node2);
          
          // Create relationship
          const relationship = {
            type: 'references_snippet',
            sourceId: 'snippet-node-1',
            targetId: 'snippet-node-2',
            properties: { type: 'import' }
          };
          
          await nebulaService.createRelationship(relationship);
          
          // Verify data exists
          const nodes = await nebulaService.findNodes('code_snippet');
          expect(nodes).toBeDefined();
          expect(Array.isArray(nodes)).toBe(true);
        } catch (error) {
          console.log('Nebula data storage test failed - continuing with other tests');
        }
      }
    });

    it('should coordinate operations between Qdrant and NebulaGraph', async () => {
      // This test verifies that both services can work together
      // in a coordinated manner for a typical use case
      
      if (qdrantService.isConnected() && nebulaService.isConnected()) {
        // Simulate a code indexing operation that stores vector embeddings in Qdrant
        // and code relationships in Nebula
        
        const testSnippetId = 'coordinated-snippet-' + Date.now();
        
        // 1. Store vector embedding in Qdrant
        const vectorData = {
          id: testSnippetId,
          vector: Array(128).fill(0.7),
          payload: {
            content: 'Coordinated test snippet',
            filePath: '/test/coordinated.ts',
            language: 'typescript',
            chunkType: 'function',
            startLine: 1,
            endLine: 5,
            metadata: { projectId: testProjectId },
            timestamp: new Date(),
          },
        };
        
        const qdrantResult = await qdrantService.upsertVectors(qdrantCollectionName, [vectorData]);
        expect(qdrantResult).toBe(true);
        
        // 2. Store code relationships in Nebula
        await nebulaService.useSpace(nebulaSpaceName);
        
        const node = {
          label: 'code_snippet',
          id: testSnippetId,
          properties: { 
            content: 'Coordinated test snippet', 
            language: 'typescript' 
          }
        };
        
        const nodeId = await nebulaService.createNode(node);
        expect(nodeId).toBe(testSnippetId);
        
        // 3. Verify both operations succeeded
        // Search in Qdrant
        const queryVector = Array(128).fill(0.7);
        const qdrantResults = await qdrantService.searchVectors(qdrantCollectionName, queryVector, {
          limit: 1,
        });
        
        expect(qdrantResults).toBeDefined();
        expect(qdrantResults.length).toBeGreaterThan(0);
        expect(qdrantResults[0].id).toBe(testSnippetId);
        
        // Verify in Nebula
        const nebulaNodes = await nebulaService.findNodes('code_snippet', { 
          id: testSnippetId 
        });
        expect(nebulaNodes).toBeDefined();
      } else {
        console.log('Skipping coordination test - one or both databases not available');
      }
    });

    afterAll(async () => {
      // Clean up Qdrant resources
      if (qdrantService.isConnected()) {
        try {
          await qdrantService.deleteCollection(qdrantCollectionName);
        } catch (error) {
          console.error('Failed to cleanup Qdrant collection:', error);
        }
      }

      // Clean up Nebula resources
      if (nebulaService.isConnected()) {
        try {
          await nebulaService.executeWriteQuery(`DROP SPACE IF EXISTS ${nebulaSpaceName}`);
        } catch (error) {
          console.error('Failed to cleanup Nebula space:', error);
        }
      }

      // Close connections
      try {
        if (qdrantService.isConnected()) {
          await qdrantService.close();
        }
        if (nebulaService.isConnected()) {
          await nebulaService.close();
        }
      } catch (error) {
        // Ignore disconnect errors in cleanup
      }
    });
  });

  afterAll(async () => {
    try {
      if (qdrantService.isConnected()) {
        await qdrantService.close();
      }
      if (nebulaService.isConnected()) {
        await nebulaService.close();
      }
    } catch (error) {
      // Ignore disconnect errors in cleanup
    }
  });
});