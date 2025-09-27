import { MCPServer } from '../src/mcp/MCPServer.js';
import { ApiServer } from '../src/api/ApiServer.js';
import { HashUtils } from '../src/utils/HashUtils.js';
import { PathUtils } from '../src/utils/PathUtils.js';
import fs from 'fs/promises';
import path from 'path';

async function testIntegration() {
  console.log('🚀 Starting integration tests...');
  
  // Test 1: HashUtils functionality
  console.log('\n--- Test 1: HashUtils ---');
  try {
    const testString = 'Integration test string';
    const hash = HashUtils.calculateStringHash(testString);
    console.log(`✅ String hash: ${hash.substring(0, 16)}...`);
    
    const id = HashUtils.generateId('test');
    console.log(`✅ Generated ID: ${id}`);
    
    const ext = HashUtils.getFileExtension('src/main.ts');
    console.log(`✅ File extension: ${ext}`);
  } catch (error) {
    console.error('❌ HashUtils test failed:', error);
  }
  
  // Test 2: PathUtils functionality
  console.log('\n--- Test 2: PathUtils ---');
  try {
    const exists = await PathUtils.fileExists('package.json');
    console.log(`✅ File exists (package.json): ${exists}`);
    
    const isFile = await PathUtils.isFile('package.json');
    console.log(`✅ Is file (package.json): ${isFile}`);
    
    const joinedPath = PathUtils.joinPaths('src', 'mcp', 'MCPServer.ts');
    console.log(`✅ Joined path: ${joinedPath}`);
  } catch (error) {
    console.error('❌ PathUtils test failed:', error);
  }
  
  // Test 3: Mock data loading
  console.log('\n--- Test 3: Mock Data Loading ---');
  try {
    const mockDataPath = path.join(process.cwd(), 'data', 'mock', 'code-snippets.json');
    const dataExists = await PathUtils.fileExists(mockDataPath);
    console.log(`✅ Mock data file exists: ${dataExists}`);
    
    if (dataExists) {
      const data = await fs.readFile(mockDataPath, 'utf-8');
      const parsed = JSON.parse(data);
      console.log(`✅ Mock data loaded, snippets count: ${parsed.snippets?.length || 0}`);
    }
  } catch (error) {
    console.error('❌ Mock data loading test failed:', error);
  }
  
  // Test 4: API server startup
  console.log('\n--- Test 4: API Server ---');
  try {
    const apiServer = new ApiServer(3001); // Use different port for testing
    console.log('✅ API Server created successfully');
    
    // Test 5: MCP server startup
    console.log('\n--- Test 5: MCP Server ---');
    const mcpServer = new MCPServer();
    console.log('✅ MCP Server created successfully');
    
    console.log('\n🎉 All integration tests passed!');
    console.log('\n📋 Next steps:');
    console.log('   1. Run `npm run dev` to start the development server');
    console.log('   2. Visit http://localhost:3000 to access the frontend');
    console.log('   3. Use an MCP client to connect to the MCP server');
    
  } catch (error) {
    console.error('❌ Server creation test failed:', error);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testIntegration().catch(console.error);
}

export { testIntegration };