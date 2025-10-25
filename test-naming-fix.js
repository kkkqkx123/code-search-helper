const { HashUtils } = require('./src/utils/HashUtils');
const { QdrantConfigService } = require('./src/config/service/QdrantConfigService');
const { NebulaConfigService } = require('./src/config/service/NebulaConfigService');

// 测试路径
const testPaths = [
  'D:/ide/tool/code-search-helper',
  'D:/code/Go/dataStructure',
  '/home/user/project',
  'C:\\Users\\Test\\Project',
  'simple-project-name'
];

console.log('测试新的名称生成函数...\n');

// 测试 HashUtils.generateSafeProjectName
console.log('=== HashUtils.generateSafeProjectName 测试 ===');
testPaths.forEach(path => {
  const safeName = HashUtils.generateSafeProjectName(path, 'project');
  console.log(`路径: ${path}`);
  console.log(`安全名称: ${safeName}`);
  console.log(`长度: ${safeName.length}`);
  console.log('---');
});

// 测试命名规范验证
console.log('\n=== 命名规范验证测试 ===');
const pattern = /^[a-zA-Z0-9_-]{1,63}$/;
testPaths.forEach(path => {
  const safeName = HashUtils.generateSafeProjectName(path, 'project');
  const isValid = pattern.test(safeName) && !safeName.startsWith('_');
  console.log(`路径: ${path}`);
  console.log(`安全名称: ${safeName}`);
  console.log(`符合命名规范: ${isValid ? '✓' : '✗'}`);
  console.log('---');
});