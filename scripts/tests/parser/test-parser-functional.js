const fs = require('fs').promises;
const path = require('path');

// 由于依赖注入和模块路径问题，我们使用require动态加载模块
async function runParserTest() {
  console.log('开始测试parser模块功能...');
  console.log('使用 test-files 目录中的文件进行测试');
  
  try {
    // 使用require来动态加载模块 - 使用编译后的dist目录
    const { TreeSitterCoreService } = require('../../../dist/service/parser/core/parse/TreeSitterCoreService');
    const { TreeSitterService } = require('../../../dist/service/parser/core/parse/TreeSitterService');
    const { ASTCodeSplitter } = require('../../../dist/service/parser/splitting/ASTCodeSplitter');
    
    // 由于依赖注入问题，我们先测试TreeSitterCoreService
    console.log('初始化 TreeSitterCoreService...');
    const treeSitterCoreService = new TreeSitterCoreService();
    
    console.log('检查服务是否初始化...');
    if (treeSitterCoreService.isInitialized()) {
      console.log('✓ TreeSitterCoreService 初始化成功');
    } else {
      console.log('✗ TreeSitterCoreService 初始化失败');
      return;
    }
    
    // 获取支持的语言
    console.log('获取支持的语言...');
    const supportedLanguages = treeSitterCoreService.getSupportedLanguages();
    console.log(`✓ 支持 ${supportedLanguages.length} 种语言:`, 
      supportedLanguages.map(lang => lang.name).join(', '));
    
    // 读取test-files目录中的文件
    async function readFilesRecursively(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      let files = [];
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await readFilesRecursively(fullPath);
          files = files.concat(subFiles);
        } else {
          files.push(fullPath);
        }
      }
      
      return files;
    }
    
    const testFiles = await readFilesRecursively('test-files');
    console.log(`\n找到 ${testFiles.length} 个测试文件`);
    
    // 测试每个文件
    for (const file of testFiles) {
      console.log(`\n--- 测试文件: ${file} ---`);
      
      try {
        const content = await fs.readFile(file, 'utf8');
        const extension = path.extname(file).toLowerCase();
        
        // 根据扩展名映射语言
        const languageMap = {
          '.ts': 'typescript',
          '.js': 'javascript',
          '.py': 'python',
          '.java': 'java',
          '.go': 'go',
          '.rs': 'rust',
          '.cpp': 'cpp',
          '.c': 'c',
          '.h': 'c',
          '.hpp': 'cpp',
          '.cs': 'csharp',
          '.scala': 'scala',
          '.md': 'markdown',
          '.json': 'json',
          '.html': 'html',
          '.css': 'css',
          '.jsx': 'javascript',
          '.tsx': 'typescript'
        };
        
        const language = languageMap[extension] || 'unknown';
        
        if (language === 'unknown') {
          console.log(`  跳过未知语言: ${extension}`);
          continue;
        }
        
        if (!treeSitterCoreService.isLanguageSupported(language)) {
          console.log(`  跳过不支持的语言: ${language}`);
          continue;
        }
        
        console.log(`  语言: ${language}`);
        console.log(`  内容长度: ${content.length} 字符`);
        
        // 测试解析
        console.log(`  执行解析...`);
        const startTime = Date.now();
        const parseResult = await treeSitterCoreService.parseCode(content, language);
        const parseTime = Date.now() - startTime;
        
        if (parseResult.success) {
          console.log(`  ✓ 解析成功 (耗时: ${parseTime}ms)`);
          console.log(`  - AST节点类型: ${parseResult.ast.type}`);
          console.log(`  - 从缓存: ${parseResult.fromCache ? '是' : '否'}`);
          
          // 测试函数提取
          console.log(`  测试函数提取...`);
          const functions = await treeSitterCoreService.extractFunctions(parseResult.ast, language);
          console.log(`  - 找到 ${functions.length} 个函数`);
          
          // 测试类提取
          console.log(`  测试类提取...`);
          const classes = await treeSitterCoreService.extractClasses(parseResult.ast, language);
          console.log(`  - 找到 ${classes.length} 个类`);
          
          // 测试导入提取
          console.log(`  测试导入提取...`);
          const imports = treeSitterCoreService.extractImports(parseResult.ast, content);
          console.log(`  - 找到 ${imports.length} 个导入`);
          
          // 测试导出提取
          console.log(`  测试导出提取...`);
          const exports = await treeSitterCoreService.extractExports(parseResult.ast, content, language);
          console.log(`  - 找到 ${exports.length} 个导出`);
          
        } else {
          console.log(`  ✗ 解析失败: ${parseResult.error}`);
        }
      } catch (error) {
        console.log(`  ✗ 处理文件时出错: ${error.message}`);
      }
    }
    
    console.log('\n测试完成！');
  } catch (error) {
    console.error('测试脚本执行失败:', error.message);
    console.error('错误堆栈:', error.stack);
  }
}

// 运行测试
if (require.main === module) {
  runParserTest().catch(console.error);
}

module.exports = { runParserTest };