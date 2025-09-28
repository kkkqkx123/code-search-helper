import { HashUtils } from './HashUtils.js';
import { PathUtils } from './PathUtils.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

async function testUtils() {
  console.log('Testing HashUtils and PathUtils...');
  
  // Test HashUtils
  console.log('\n--- Testing HashUtils ---');
  
  // Test string hash
  const testString = 'Hello, World!';
  const stringHash = HashUtils.calculateStringHash(testString);
  console.log(`String hash of "${testString}": ${stringHash}`);
  
  // Test ID generation
  const id1 = HashUtils.generateId('test');
  const id2 = HashUtils.generateId('test');
  console.log(`Generated IDs: ${id1}, ${id2}`);
  
  // Test file extension
  const ext1 = HashUtils.getFileExtension('src/index.ts');
  const ext2 = HashUtils.getFileExtension('README.md');
  console.log(`File extensions: src/index.ts -> ${ext1}, README.md -> ${ext2}`);
  
  // Test code file validation
  const isCode1 = HashUtils.isValidCodeFile('src/main.ts');
  const isCode2 = HashUtils.isValidCodeFile('docs/README.txt');
  console.log(`Is code file: src/main.ts -> ${isCode1}, docs/README.txt -> ${isCode2}`);
  
  // Test PathUtils
  console.log('\n--- Testing PathUtils ---');
  
  // Create a temporary directory for testing
  const tempDir = path.join(os.tmpdir(), 'codebase-test');
  await PathUtils.ensureDirectoryExists(tempDir);
  console.log(`Created temp directory: ${tempDir}`);
  
  // Test file operations
  const testFile = path.join(tempDir, 'test.txt');
  await fs.writeFile(testFile, 'This is a test file');
  console.log(`Created test file: ${testFile}`);
  
  // Test file existence
  const exists = await PathUtils.fileExists(testFile);
  console.log(`File exists: ${exists}`);
  
  // Test file size
  const fileSize = await PathUtils.getFileSize(testFile);
  console.log(`File size: ${fileSize} bytes`);
  
  // Test isFile
  const isFile = await PathUtils.isFile(testFile);
  console.log(`Is file: ${isFile}`);
  
  // Test path operations
  const normalizedPath = PathUtils.joinPaths('src', 'utils', 'test.ts');
  console.log(`Joined path: ${normalizedPath}`);
  
  // Test directory operations
  const isDir = await PathUtils.isDirectory(tempDir);
  console.log(`Is directory: ${isDir}`);
  
  // Test directory size
  const dirSize = await PathUtils.getDirectorySize(tempDir);
  console.log(`Directory size: ${dirSize} bytes`);
  
  // Test file system stats
  const stats = await PathUtils.getFileSystemStats(tempDir);
  console.log(`File system stats: ${JSON.stringify(stats, null, 2)}`);
  
  // Clean up
  await PathUtils.deleteFile(testFile);
  await PathUtils.deleteDirectory(tempDir);
  console.log('Cleaned up test files');
  
  console.log('\nAll tests completed successfully!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  testUtils().catch(console.error);
}

export { testUtils };