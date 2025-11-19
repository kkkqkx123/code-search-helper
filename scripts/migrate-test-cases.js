#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * 迁移测试用例：将嵌入JSON中的code和query提取到单独文件
 * 使用方式: node scripts/migrate-test-cases.js <category> <json-file>
 * 例如: node scripts/migrate-test-cases.js lifecycle-relationships src/service/parser/__tests__/c/lifecycle-relationships/c-lifecycle-relationships.json
 */

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('使用方式: node scripts/migrate-test-cases.js <category> <json-file>');
  console.error('例如: node scripts/migrate-test-cases.js lifecycle-relationships src/service/parser/__tests__/c/lifecycle-relationships/c-lifecycle-relationships.json');
  process.exit(1);
}

const [category, jsonFilePath] = args;
const targetDir = path.dirname(jsonFilePath);
const testsDir = path.join(targetDir, 'tests');
const indexJsonPath = path.join(targetDir, `${path.basename(targetDir)}.json`);

// 创建tests目录
if (!fs.existsSync(testsDir)) {
  fs.mkdirSync(testsDir, { recursive: true });
  console.log(`✓ 创建目录: ${testsDir}`);
}

// 读取原始JSON
const jsonContent = fs.readFileSync(jsonFilePath, 'utf-8');
const data = JSON.parse(jsonContent);

const requests = data.requests || [];
const newRequests = [];

requests.forEach((request, index) => {
  const testId = String(index + 1).padStart(3, '0');
  const testDir = path.join(testsDir, `test-${testId}`);
  
  // 创建测试用例目录
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const { code, query, ...rest } = request;
  
  // 确定代码文件扩展名
  const codeExt = getFileExtension(request.language || 'c');
  const codeFile = path.join(testDir, `code.${codeExt}`);
  const queryFile = path.join(testDir, `query.txt`);
  const metadataFile = path.join(testDir, `metadata.json`);
  
  // 写入代码文件
  if (code) {
    fs.writeFileSync(codeFile, code, 'utf-8');
    console.log(`  ✓ 代码文件: tests/test-${testId}/code.${codeExt}`);
  }
  
  // 写入查询文件
  if (query) {
    fs.writeFileSync(queryFile, query, 'utf-8');
    console.log(`  ✓ 查询文件: tests/test-${testId}/query.txt`);
  }
  
  // 写入元数据文件
  const metadata = {
    id: `${category}-${testId}`,
    language: request.language || 'c',
    description: request.description || `Test case ${testId}`,
    ...rest
  };
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');
  console.log(`  ✓ 元数据文件: tests/test-${testId}/metadata.json`);
  
  // 创建新的请求对象（仅包含引用）
  newRequests.push({
    id: `${category}-${testId}`,
    language: request.language || 'c',
    codeFile: `tests/test-${testId}/code.${codeExt}`,
    queryFile: `tests/test-${testId}/query.txt`,
    metadataFile: `tests/test-${testId}/metadata.json`,
    description: metadata.description
  });
});

// 写入新的索引JSON
const indexJson = {
  category: category,
  totalTests: requests.length,
  requests: newRequests
};

fs.writeFileSync(indexJsonPath, JSON.stringify(indexJson, null, 2), 'utf-8');
console.log(`\n✓ 索引文件: ${path.basename(indexJsonPath)}`);

// 备份原始文件
const backupPath = jsonFilePath + '.backup';
if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(jsonFilePath, backupPath);
  console.log(`✓ 备份原文件: ${path.basename(backupPath)}`);
}

console.log(`\n迁移完成！共处理 ${requests.length} 个测试用例`);
console.log(`\n可以安全删除原文件: ${path.basename(jsonFilePath)}`);

/**
 * 根据语言返回文件扩展名
 */
function getFileExtension(language) {
  const extensions = {
    c: 'c',
    cpp: 'cpp',
    python: 'py',
    javascript: 'js',
    typescript: 'ts',
    java: 'java',
    go: 'go',
    rust: 'rs',
  };
  return extensions[language] || 'txt';
}
