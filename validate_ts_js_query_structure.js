// 验证TypeScript和JavaScript查询结构的一致性
const fs = require('fs');
const path = require('path');

// 读取TypeScript和JavaScript查询的index文件
const tsIndexPath = './src/service/parser/constants/queries/typescript/index.ts';
const jsIndexPath = './src/service/parser/constants/queries/javascript/index.ts';

const tsIndexContent = fs.readFileSync(tsIndexPath, 'utf8');
const jsIndexContent = fs.readFileSync(jsIndexPath, 'utf8');

// 提取导入的模块
function extractImportedModules(content) {
  const imports = [];
  const regex = /import\s+(\w+)\s+from\s+['"]\.\/([^'"]+)['"];?/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const importName = match[1];
    const moduleName = match[2];
    
    // 处理特殊的导出名称
    let actualName = moduleName;
    if (moduleName === 'controlFlow') {
      actualName = 'control-flow';
    } else if (importName.startsWith('_')) {
      actualName = importName.substring(1);
    }
    
    imports.push({
      importName,
      moduleName,
      actualName
    });
  }
  
  return imports;
}

// 分析单个查询文件的内容
function analyzeQueryFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 提取捕获名称
    const captureNames = new Set();
    const nameRegex = /@name\.([a-zA-Z_][a-zA-Z0-9_\.]*)/g;
    let nameMatch;
    
    while ((nameMatch = nameRegex.exec(content)) !== null) {
      captureNames.add(nameMatch[1]);
    }
    
    // 提取定义类型
    const definitionTypes = new Set();
    const defRegex = /@definition\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let defMatch;
    
    while ((defMatch = defRegex.exec(content)) !== null) {
      definitionTypes.add(defMatch[1]);
    }
    
    // 统计查询模式数量
    const queryPatterns = (content.match(/\([^)]+\)\s*@[a-zA-Z_][a-zA-Z0-9_\.]*/g) || []).length;
    
    return {
      captureNames: Array.from(captureNames),
      definitionTypes: Array.from(definitionTypes),
      queryPatterns
    };
  } catch (error) {
    console.warn(`无法分析文件 ${filePath}:`, error.message);
    return {
      captureNames: [],
      definitionTypes: [],
      queryPatterns: 0
    };
  }
}

// 分析所有查询文件
function analyzeAllQueryModules(basePath, modules) {
  const results = {};
  
  modules.forEach(module => {
    const filePath = path.join(basePath, `${module.moduleName}.ts`);
    results[module.actualName] = analyzeQueryFile(filePath);
  });
  
  return results;
}

// 执行验证
console.log('=== TypeScript和JavaScript查询结构一致性验证 ===\n');

const tsModules = extractImportedModules(tsIndexContent);
const jsModules = extractImportedModules(jsIndexContent);

console.log('TypeScript查询模块:');
tsModules.forEach(module => {
  console.log(`  ${module.importName} -> ${module.actualName} (${module.moduleName}.ts)`);
});

console.log('\nJavaScript查询模块:');
jsModules.forEach(module => {
  console.log(`  ${module.importName} -> ${module.actualName} (${module.moduleName}.ts)`);
});

// 分析所有查询文件
const tsBasePath = './src/service/parser/constants/queries/typescript';
const jsBasePath = './src/service/parser/constants/queries/javascript';

const tsAnalysis = analyzeAllQueryModules(tsBasePath, tsModules);
const jsAnalysis = analyzeAllQueryModules(jsBasePath, jsModules);

// 检查模块一致性
console.log('\n=== 模块一致性检查 ===');
const tsModuleNames = tsModules.map(m => m.actualName).sort();
const jsModuleNames = jsModules.map(m => m.actualName).sort();

console.log('TypeScript模块:', tsModuleNames);
console.log('JavaScript模块:', jsModuleNames);

const missingInJS = tsModuleNames.filter(name => !jsModuleNames.includes(name));
const missingInTS = jsModuleNames.filter(name => !tsModuleNames.includes(name));

if (missingInJS.length === 0 && missingInTS.length === 0) {
  console.log('\n✅ TypeScript和JavaScript查询模块完全一致');
} else {
  if (missingInJS.length > 0) {
    console.log('\n❌ JavaScript中缺少的模块:', missingInJS);
  }
  if (missingInTS.length > 0) {
    console.log('\n❌ TypeScript中缺少的模块:', missingInTS);
  }
}

// 检查共同模块的查询模式一致性
console.log('\n=== 共同模块查询模式比较 ===');
const commonModules = tsModuleNames.filter(name => jsModuleNames.includes(name));

commonModules.forEach(moduleName => {
  const tsData = tsAnalysis[moduleName];
  const jsData = jsAnalysis[moduleName];
  
  console.log(`\n模块: ${moduleName}`);
  console.log(`  TypeScript: ${tsData.queryPatterns} 个查询模式`);
  console.log(`  JavaScript:  ${jsData.queryPatterns} 个查询模式`);
  
  const patternDiff = Math.abs(tsData.queryPatterns - jsData.queryPatterns);
  if (patternDiff > 0) {
    console.log(`  ⚠️  查询模式数量差异: ${patternDiff}`);
  } else {
    console.log(`  ✅ 查询模式数量一致`);
  }
});

// 检查捕获名称格式一致性
console.log('\n=== 捕获名称格式一致性检查 ===');

// 统计使用name.definition.xxx格式的捕获名称
function countNameDefinitionFormat(captureNames) {
  return captureNames.filter(name => name.startsWith('name.definition.')).length;
}

// 统计使用definition.xxx格式的捕获名称
function countDefinitionFormat(captureNames) {
  return captureNames.filter(name => name.startsWith('definition.') && !name.startsWith('name.definition.')).length;
}

let tsNameDefinitionCount = 0;
let tsDefinitionCount = 0;
let jsNameDefinitionCount = 0;
let jsDefinitionCount = 0;

Object.values(tsAnalysis).forEach(data => {
  tsNameDefinitionCount += countNameDefinitionFormat(data.captureNames);
  tsDefinitionCount += countDefinitionFormat(data.captureNames);
});

Object.values(jsAnalysis).forEach(data => {
  jsNameDefinitionCount += countNameDefinitionFormat(data.captureNames);
  jsDefinitionCount += countDefinitionFormat(data.captureNames);
});

console.log('TypeScript捕获名称格式:');
console.log(`  name.definition.xxx 格式: ${tsNameDefinitionCount}`);
console.log(`  definition.xxx 格式: ${tsDefinitionCount}`);

console.log('\nJavaScript捕获名称格式:');
console.log(`  name.definition.xxx 格式: ${jsNameDefinitionCount}`);
console.log(`  definition.xxx 格式: ${jsDefinitionCount}`);

if (tsDefinitionCount === 0 && jsDefinitionCount > 0) {
  console.log('\n⚠️  JavaScript使用了definition.xxx格式，建议统一为name.definition.xxx格式');
} else if (tsDefinitionCount === 0 && jsDefinitionCount === 0) {
  console.log('\n✅ 两种语言都统一使用name.definition.xxx格式');
}

// 总体评估
console.log('\n=== 总体评估 ===');
const moduleConsistent = missingInJS.length === 0 && missingInTS.length === 0;
const formatConsistent = tsDefinitionCount === 0 && jsDefinitionCount === 0;

if (moduleConsistent && formatConsistent) {
  console.log('✅ TypeScript和JavaScript查询结构完全一致，适配器可以统一处理');
} else if (moduleConsistent && !formatConsistent) {
  console.log('⚠️  模块结构一致，但捕获名称格式需要统一');
} else if (!moduleConsistent && formatConsistent) {
  console.log('⚠️  捕获名称格式一致，但模块结构需要对齐');
} else {
  console.log('❌ 模块结构和捕获名称格式都需要调整');
}

console.log('\n=== 验证完成 ===');