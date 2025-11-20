const fs = require('fs');
const path = require('path');

// 获取命令行参数
const testCaseId = process.argv[2];
if (!testCaseId) {
  console.error('请提供测试用例ID，例如: node debug-specific-case.js 003');
  process.exit(1);
}

// 构建路径 - 使用正确的路径
const testDir = path.join(__dirname, '..', '..', '..', 'c', 'semantic-relationships', 'tests', `test-${testCaseId}`);
const codePath = path.join(testDir, 'code.c');

console.log(`测试目录: ${testDir}`);
console.log(`代码路径: ${codePath}`);

// 检查文件是否存在
if (!fs.existsSync(codePath)) {
  console.error(`代码文件不存在: ${codePath}`);
  process.exit(1);
}

// 读取代码
const code = fs.readFileSync(codePath, 'utf8');

// 发送到API进行解析
const apiUrl = 'http://localhost:4001/api/parse';
const payload = {
  language: 'c',
  code: code
};

console.log('正在发送请求到API...');
console.log('代码内容:');
console.log(code);
console.log('\n---\n');

fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
})
  .then(response => response.json())
  .then(data => {
    console.log('API响应:');
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(error => {
    console.error('请求失败:', error);
  });