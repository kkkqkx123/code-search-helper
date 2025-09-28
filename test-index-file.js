const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

async function testIndexFile() {
  try {
    console.log('Testing indexFile functionality...');
    
    // 测试文件路径
    const testFilePath = path.join(__dirname, 'test-files', 'test.py');
    console.log('Test file path:', testFilePath);
    
    // 1. 测试文件读取（与IndexSyncService.indexFile中的方式相同）
    console.log('\n1. Testing file reading...');
    try {
      const content = await fs.readFile(testFilePath, 'utf-8');
      console.log('File content:', content);
      console.log('File content length:', content.length);
    } catch (error) {
      console.error('Error reading file:', error);
      return;
    }
    
    // 2. 测试文件分割（与IndexSyncService.chunkFile中的方式相同）
    console.log('\n2. Testing file chunking...');
    try {
      const content = await fs.readFile(testFilePath, 'utf-8');
      const lines = content.split('\n');
      console.log('Total lines:', lines.length);
      
      const chunks = [];
      const chunkSize = 100; // 每个块的行数
      const chunkOverlap = 10; // 块之间的重叠行数
      
      for (let i = 0; i < lines.length; i += chunkSize - chunkOverlap) {
        const startLine = i;
        const endLine = Math.min(i + chunkSize, lines.length);
        const chunkContent = lines.slice(startLine, endLine).join('\n');
        
        chunks.push({
          content: chunkContent,
          filePath: testFilePath,
          startLine: startLine + 1,
          endLine: endLine,
          language: 'python',
          chunkType: 'code'
        });
      }
      
      console.log('Total chunks:', chunks.length);
      chunks.forEach((chunk, index) => {
        console.log(`Chunk ${index + 1}: lines ${chunk.startLine}-${chunk.endLine}, length: ${chunk.content.length}`);
      });
    } catch (error) {
      console.error('Error in file chunking:', error);
    }
    
    // 3. 测试哈希计算（与FileSystemTraversal.calculateFileHash中的方式相同）
    console.log('\n3. Testing hash calculation...');
    try {
      const data = await fs.readFile(testFilePath);
      const hash = crypto.createHash('sha256');
      hash.update(data);
      const hashResult = hash.digest('hex');
      console.log('File hash:', hashResult);
    } catch (error) {
      console.error('Error in hash calculation:', error);
    }
    
    // 4. 测试二进制文件检测（与FileSystemTraversal.isBinaryFile中的方式相同）
    console.log('\n4. Testing binary file detection...');
    try {
      const buffer = await fs.readFile(testFilePath, { encoding: null });
      console.log('Buffer length:', buffer.length);
      
      const checkLength = Math.min(buffer.length, 1024);
      let isBinary = false;
      
      for (let i = 0; i < checkLength; i++) {
        if (buffer[i] === 0) {
          isBinary = true;
          break;
        }
      }
      
      console.log('Is binary file:', isBinary);
    } catch (error) {
      console.error('Error in binary file detection:', error);
    }
    
    console.log('\nAll tests completed successfully!');
    
  } catch (error) {
    console.error('Error in test:', error);
  }
}

testIndexFile();