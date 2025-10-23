const fs = require('fs');
const path = require('path');

// 读取Kotlin查询文件
const kotlinQueriesPath = path.join(__dirname, 'src/service/parser/constants/queries/kotlin');
const classesFunctionsPath = path.join(kotlinQueriesPath, 'classes-functions.ts');
const constructorsPropertiesPath = path.join(kotlinQueriesPath, 'constructors-properties.ts');

// 读取Kotlin适配器
const adapterPath = path.join(__dirname, 'src/service/parser/core/normalization/adapters/KotlinLanguageAdapter.ts');

console.log('🔍 验证Kotlin适配器与查询文件的一致性...\n');

// 1. 提取查询文件中定义的捕获名称
function extractCapturesFromQueryFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const captures = [];
  
  // 匹配 @name.definition.xxx 模式
  const captureRegex = /@name\.definition\.(\w+)/g;
  let match;
  
  while ((match = captureRegex.exec(content)) !== null) {
    captures.push(`name.definition.${match[1]}`);
  }
  
  return [...new Set(captures)]; // 去重
}

// 2. 提取查询文件中定义的查询类型（这里应该是文件名，不是文件内部的查询类型）
function extractQueryFileNames(directoryPath) {
  const files = fs.readdirSync(directoryPath);
  return files
    .filter(file => file.endsWith('.ts') && file !== 'index.ts')
    .map(file => file.replace('.ts', ''));
}

// 3. 提取适配器中支持的查询类型
function extractSupportedQueryTypesFromAdapter() {
  const content = fs.readFileSync(adapterPath, 'utf8');
  
  // 匹配 getSupportedQueryTypes 方法返回的数组
  const match = content.match(/getSupportedQueryTypes\(\):\s*string\[\]\s*{\s*return\s*\[([\s\S]*?)\];/);
  if (!match) {
    return [];
  }
  
  const arrayContent = match[1];
  const queryTypes = [];
  
  // 提取单引号或双引号包围的字符串
  const stringRegex = /['"]([^'"]+)['"]/g;
  let stringMatch;
  
  while ((stringMatch = stringRegex.exec(arrayContent)) !== null) {
    queryTypes.push(stringMatch[1]);
  }
  
  return queryTypes;
}

// 4. 提取适配器中使用的捕获名称
function extractCapturesFromAdapter() {
  const content = fs.readFileSync(adapterPath, 'utf8');
  const captures = [];
  
  // 匹配 extractName 方法中的 nameCaptures 数组
  const match = content.match(/const nameCaptures\s*=\s*\[([\s\S]*?)\];/);
  if (!match) {
    return [];
  }
  
  const arrayContent = match[1];
  
  // 提取单引号或双引号包围的字符串
  const stringRegex = /['"]([^'"]+)['"]/g;
  let stringMatch;
  
  while ((stringMatch = stringRegex.exec(arrayContent)) !== null) {
    captures.push(stringMatch[1]);
  }
  
  return captures;
}

// 执行验证
try {
  // 从查询文件提取信息
  const classesFunctionsCaptures = extractCapturesFromQueryFile(classesFunctionsPath);
  const constructorsPropertiesCaptures = extractCapturesFromQueryFile(constructorsPropertiesPath);
  const allQueryCaptures = [...new Set([...classesFunctionsCaptures, ...constructorsPropertiesCaptures])];
  
  const allQueryFileNames = extractQueryFileNames(kotlinQueriesPath);
  
  // 从适配器提取信息
  const supportedQueryTypes = extractSupportedQueryTypesFromAdapter();
  const adapterCaptures = extractCapturesFromAdapter();
  
  console.log('📋 查询文件中定义的捕获名称:');
  console.log(allQueryCaptures.sort());
  console.log(`\n📋 适配器中使用的捕获名称:`);
  console.log(adapterCaptures.sort());
  
  console.log(`\n📋 查询文件中定义的查询文件名:`);
  console.log(allQueryFileNames.sort());
  console.log(`\n📋 适配器中支持的查询类型:`);
  console.log(supportedQueryTypes.sort());
  
  // 检查一致性
  console.log('\n🔍 一致性检查:');
  
  // 检查捕获名称一致性
  const missingCaptures = adapterCaptures.filter(capture => !allQueryCaptures.includes(capture));
  const extraCaptures = allQueryCaptures.filter(capture => !adapterCaptures.includes(capture));
  
  if (missingCaptures.length > 0) {
    console.log(`❌ 适配器中使用了查询文件中不存在的捕获名称: ${missingCaptures.join(', ')}`);
  } else {
    console.log('✅ 适配器中的捕获名称都与查询文件一致');
  }
  
  if (extraCaptures.length > 0) {
    console.log(`⚠️  查询文件中有适配器未使用的捕获名称: ${extraCaptures.join(', ')}`);
  }
  
  // 检查查询类型一致性
  const missingQueryTypes = supportedQueryTypes.filter(type => !allQueryFileNames.includes(type));
  const extraQueryTypes = allQueryFileNames.filter(type => !supportedQueryTypes.includes(type));
  
  if (missingQueryTypes.length > 0) {
    console.log(`❌ 适配器中支持了查询文件中不存在的查询类型: ${missingQueryTypes.join(', ')}`);
  } else {
    console.log('✅ 适配器中的查询类型都与查询文件一致');
  }
  
  if (extraQueryTypes.length > 0) {
    console.log(`⚠️  查询文件中有适配器未支持的查询类型: ${extraQueryTypes.join(', ')}`);
  }
  
  // 总结
  const hasErrors = missingCaptures.length > 0 || missingQueryTypes.length > 0;
  const hasWarnings = extraCaptures.length > 0 || extraQueryTypes.length > 0;
  
  console.log('\n📊 验证结果:');
  if (hasErrors) {
    console.log('❌ 发现错误，需要修复适配器');
  } else if (hasWarnings) {
    console.log('⚠️  发现警告，建议检查');
  } else {
    console.log('✅ 验证通过，适配器与查询文件完全一致');
  }
  
} catch (error) {
  console.error('❌ 验证过程中发生错误:', error.message);
}