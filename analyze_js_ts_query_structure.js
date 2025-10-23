// 分析JavaScript和TypeScript查询结构的差异
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

// 执行分析
console.log('=== JavaScript和TypeScript查询结构分析 ===\n');

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

// 比较共同模块
console.log('\n=== 共同模块比较 ===');
const commonModules = tsModules.filter(tsModule => 
  jsModules.some(jsModule => jsModule.actualName === tsModule.actualName)
);

commonModules.forEach(module => {
  const moduleName = module.actualName;
  const tsData = tsAnalysis[moduleName];
  const jsData = jsAnalysis[moduleName];
  
  console.log(`\n模块: ${moduleName}`);
  console.log(`  TypeScript: ${tsData.queryPatterns} 个查询模式, ${tsData.captureNames.length} 个捕获名称`);
  console.log(`  JavaScript:  ${jsData.queryPatterns} 个查询模式, ${jsData.captureNames.length} 个捕获名称`);
  
  // 找出JavaScript独有的捕获名称
  const jsOnlyCaptures = jsData.captureNames.filter(capture => !tsData.captureNames.includes(capture));
  if (jsOnlyCaptures.length > 0) {
    console.log(`  JavaScript独有的捕获名称: ${jsOnlyCaptures.slice(0, 5).join(', ')}${jsOnlyCaptures.length > 5 ? '...' : ''}`);
  }
});

// JavaScript独有的模块
console.log('\n=== JavaScript独有的模块 ===');
const jsOnlyModules = jsModules.filter(jsModule => 
  !tsModules.some(tsModule => tsModule.actualName === jsModule.actualName)
);

jsOnlyModules.forEach(module => {
  const moduleName = module.actualName;
  const jsData = jsAnalysis[moduleName];
  
  console.log(`\n模块: ${moduleName}`);
  console.log(`  查询模式: ${jsData.queryPatterns}`);
  console.log(`  捕获名称: ${jsData.captureNames.slice(0, 10).join(', ')}${jsData.captureNames.length > 10 ? '...' : ''}`);
  
  // 分析这些模块是否可以合并到现有TypeScript模块中
  if (moduleName === 'control-flow') {
    console.log('  建议: 可以作为独立的查询类型，映射到control-flow标准类型');
  } else if (moduleName === 'expressions') {
    console.log('  建议: 可以作为独立的查询类型，映射到expression标准类型');
  }
});

// TypeScript独有的模块
console.log('\n=== TypeScript独有的模块 ===');
const tsOnlyModules = tsModules.filter(tsModule => 
  !jsModules.some(jsModule => jsModule.actualName === tsModule.actualName)
);

tsOnlyModules.forEach(module => {
  const moduleName = module.actualName;
  const tsData = tsAnalysis[moduleName];
  
  console.log(`\n模块: ${moduleName}`);
  console.log(`  查询模式: ${tsData.queryPatterns}`);
  console.log(`  捕获名称: ${tsData.captureNames.slice(0, 10).join(', ')}${tsData.captureNames.length > 10 ? '...' : ''}`);
});

// 分析调整建议
console.log('\n=== 调整建议分析 ===');

// 1. 模块结构对齐
console.log('\n1. 模块结构对齐:');
console.log('   - JavaScript缺少methods, exports, interfaces, types, properties模块');
console.log('   - TypeScript缺少control-flow, expressions模块');
console.log('   - 建议统一模块结构，使两种语言使用相同的查询类型');

// 2. 捕获名称标准化
console.log('\n2. 捕获名称标准化:');
console.log('   - JavaScript使用大量definition.xxx格式的捕获名称');
console.log('   - TypeScript主要使用name.definition.xxx格式');
console.log('   - 建议统一使用name.definition.xxx格式，便于适配器处理');

// 3. 查询粒度分析
console.log('\n3. 查询粒度分析:');
console.log('   - JavaScript的expressions模块包含了很多细粒度的表达式类型');
console.log('   - TypeScript的查询更加结构化，专注于主要语言构造');
console.log('   - 建议保持适度的查询粒度，避免过于细分的查询类型');

// 4. 适配器兼容性
console.log('\n4. 适配器兼容性:');
console.log('   - 当前TypeScript适配器需要大幅扩展以支持JavaScript查询');
console.log('   - 或者创建专门的JavaScript适配器');
console.log('   - 或者调整JavaScript查询结构以适应TypeScript适配器');

// 最终建议
console.log('\n=== 最终建议 ===');
console.log('基于分析结果，建议采用以下方案之一:');
console.log('');
console.log('方案1: 调整JavaScript查询结构（推荐）');
console.log('- 将JavaScript的control-flow和expressions模块重构为更符合TypeScript风格的结构');
console.log('- 统一捕获名称格式为name.definition.xxx');
console.log('- 添加缺失的methods, exports, interfaces, types, properties模块');
console.log('- 这样可以使TypeScript适配器同时支持两种语言');
console.log('');
console.log('方案2: 创建专门的JavaScript适配器');
console.log('- 保持JavaScript查询的当前结构');
console.log('- 创建专门的JavaScriptLanguageAdapter');
console.log('- 这样可以保持各自的特点，但增加了维护成本');
console.log('');
console.log('方案3: 创建通用适配器');
console.log('- 抽象出通用的适配器基类');
console.log('- TypeScript和JavaScript适配器继承基类');
console.log('- 在基类中处理共同的部分，在子类中处理特定的部分');