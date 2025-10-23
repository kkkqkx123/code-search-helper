const fs = require('fs');
const path = require('path');

// 读取HTML查询文件
function readHtmlQueryFiles() {
  const queriesDir = path.join(__dirname, 'src/service/parser/constants/queries/html');
  const files = fs.readdirSync(queriesDir);
  
  const queryTypes = new Set();
  
  files.forEach(file => {
    if (file.endsWith('.ts')) {
      const content = fs.readFileSync(path.join(queriesDir, file), 'utf8');
      
      // 提取@definition.xxx模式
      const definitionMatches = content.match(/@definition\.([a-zA-Z_][a-zA-Z0-9_]*)/g);
      if (definitionMatches) {
        definitionMatches.forEach(match => {
          const type = match.replace('@definition.', '');
          queryTypes.add(type);
        });
      }
    }
  });
  
  return Array.from(queryTypes).sort();
}

// 读取适配器支持的查询类型
function readAdapterSupportedTypes() {
  const adapterPath = path.join(__dirname, 'src/service/parser/core/normalization/adapters/HtmlLanguageAdapter.ts');
  const content = fs.readFileSync(adapterPath, 'utf8');
  
  // 提取getSupportedQueryTypes方法返回的数组
  const match = content.match(/getSupportedQueryTypes\(\):\s*string\[\]\s*{\s*return\s*\[([\s\S]*?)\];/);
  if (!match) {
    throw new Error('Could not find getSupportedQueryTypes method');
  }
  
  const arrayContent = match[1];
  const types = [];
  
  // 提取单引号或双引号包围的字符串
  const stringMatches = arrayContent.match(/['"]([^'"]+)['"]/g);
  if (stringMatches) {
    stringMatches.forEach(str => {
      types.push(str.replace(/['"]/g, ''));
    });
  }
  
  return types.sort();
}

// 读取适配器的映射类型
function readAdapterMappingTypes() {
  const adapterPath = path.join(__dirname, 'src/service/parser/core/normalization/adapters/HtmlLanguageAdapter.ts');
  const content = fs.readFileSync(adapterPath, 'utf8');
  
  // 提取mapQueryTypeToStandardType方法中的映射
  const match = content.match(/mapQueryTypeToStandardType\(queryType:\s*string\):[^{]*\{[\s\S]*?const mapping:[\s\S]*?=\s*\{([\s\S]*?)\};/);
  if (!match) {
    throw new Error('Could not find mapQueryTypeToStandardType method');
  }
  
  const mappingContent = match[1];
  const mappings = {};
  
  // 提取键值对
  const keyValueMatches = mappingContent.match(/['"]([^'"]+)['"]:\s*['"]([^'"]+)['"]/g);
  if (keyValueMatches) {
    keyValueMatches.forEach(pair => {
      const [key, value] = pair.split(':').map(s => s.trim().replace(/['"]/g, ''));
      mappings[key] = value;
    });
  }
  
  return mappings;
}

// 验证一致性
function validateConsistency() {
  console.log('🔍 验证HTML适配器与查询文件的一致性...\n');
  
  const queryTypes = readHtmlQueryFiles();
  const adapterTypes = readAdapterSupportedTypes();
  const mappingTypes = readAdapterMappingTypes();
  
  console.log('📋 查询文件中定义的类型:');
  console.log(queryTypes.join(', '));
  console.log(`\n总计: ${queryTypes.length} 个类型\n`);
  
  console.log('🔧 适配器支持的类型:');
  console.log(adapterTypes.join(', '));
  console.log(`\n总计: ${adapterTypes.length} 个类型\n`);
  
  // 检查缺失的类型
  const missingTypes = queryTypes.filter(type => !adapterTypes.includes(type));
  if (missingTypes.length > 0) {
    console.log('❌ 适配器中缺失的类型:');
    console.log(missingTypes.join(', '));
    console.log(`\n总计: ${missingTypes.length} 个缺失类型\n`);
  } else {
    console.log('✅ 适配器支持所有查询文件中定义的类型\n');
  }
  
  // 检查多余的类型
  const extraTypes = adapterTypes.filter(type => !queryTypes.includes(type));
  if (extraTypes.length > 0) {
    console.log('⚠️ 适配器中多余的类型 (查询文件中未定义):');
    console.log(extraTypes.join(', '));
    console.log(`\n总计: ${extraTypes.length} 个多余类型\n`);
  } else {
    console.log('✅ 适配器中没有多余的类型\n');
  }
  
  // 检查映射完整性
  const unmappedTypes = adapterTypes.filter(type => !mappingTypes.hasOwnProperty(type));
  if (unmappedTypes.length > 0) {
    console.log('⚠️ 适配器中未映射的类型:');
    console.log(unmappedTypes.join(', '));
    console.log(`\n总计: ${unmappedTypes.length} 个未映射类型\n`);
  } else {
    console.log('✅ 所有适配器类型都有映射\n');
  }
  
  // 显示映射关系
  console.log('📊 类型映射关系:');
  Object.entries(mappingTypes).forEach(([key, value]) => {
    console.log(`  ${key} -> ${value}`);
  });
  
  // 总体评估
  const isConsistent = missingTypes.length === 0 && extraTypes.length === 0 && unmappedTypes.length === 0;
  
  console.log('\n' + '='.repeat(50));
  if (isConsistent) {
    console.log('🎉 验证通过! HTML适配器与查询文件完全一致');
  } else {
    console.log('❌ 验证失败! 发现不一致之处');
  }
  console.log('='.repeat(50));
  
  return isConsistent;
}

// 运行验证
if (require.main === module) {
  try {
    validateConsistency();
  } catch (error) {
    console.error('验证过程中发生错误:', error.message);
    process.exit(1);
  }
}

module.exports = {
  readHtmlQueryFiles,
  readAdapterSupportedTypes,
  readAdapterMappingTypes,
  validateConsistency
};