import * as fs from 'fs/promises';
import * as path from 'path';
import { TreeSitterCoreService } from '../../../src/service/parser/core/parse/TreeSitterCoreService';
import { TreeSitterService } from '../../../src/service/parser/core/parse/TreeSitterService';
import { ASTCodeSplitter } from '../../../src/service/parser/splitting/ASTCodeSplitter';

/**
 * 测试脚本：验证parser模块功能
 * 该脚本使用test-files目录中的文件来测试解析和分段功能
 */
class ParserTestScript {
  private treeSitterCoreService: TreeSitterCoreService;
  private treeSitterService: TreeSitterService;
  private splitter: ASTCodeSplitter;
  private testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: [] as string[]
  };

  constructor() {
    this.treeSitterCoreService = new TreeSitterCoreService();
    this.treeSitterService = new TreeSitterService(this.treeSitterCoreService);
    this.splitter = new ASTCodeSplitter(this.treeSitterService);
  }

  /**
   * 递归读取目录中的所有文件
   */
  async readFilesRecursively(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await this.readFilesRecursively(fullPath);
        files = files.concat(subFiles);
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * 获取文件扩展名
   */
  getFileExtension(filePath: string): string {
    return path.extname(filePath).toLowerCase();
  }

  /**
   * 根据文件扩展名映射到语言
   */
  getLanguageFromExtension(ext: string): string {
    const languageMap: { [key: string]: string } = {
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

    return languageMap[ext] || 'unknown';
  }

  /**
   * 测试单个文件的解析功能
   */
  async testParseFile(filePath: string): Promise<boolean> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const extension = this.getFileExtension(filePath);
      const language = this.getLanguageFromExtension(extension);

      console.log(`\n--- 测试文件: ${filePath} (语言: ${language}) ---`);

      // 检查语言是否支持
      if (language === 'unknown') {
        console.log(`  跳过未知语言的文件: ${extension}`);
        return true;
      }

      if (!this.treeSitterCoreService.isLanguageSupported(language)) {
        console.log(`  跳过不支持的语言: ${language}`);
        return true;
      }

      // 测试解析功能
      console.log(`  开始解析...`);
      const parseResult = await this.treeSitterService.parseCode(content, language);

      if (parseResult.success) {
        console.log(`  ✓ 解析成功`);
        console.log(`    - 解析时间: ${parseResult.parseTime}ms`);
        console.log(`    - 从缓存: ${parseResult.fromCache ? '是' : '否'}`);

        // 测试AST功能
        console.log(`  测试AST功能...`);

        // 提取函数
        const functions = await this.treeSitterCoreService.extractFunctions(parseResult.ast, language);
        console.log(`    - 函数数量: ${functions.length}`);

        // 提取类
        const classes = await this.treeSitterCoreService.extractClasses(parseResult.ast, language);
        console.log(`    - 类数量: ${classes.length}`);

        // 提取导入
        const imports = this.treeSitterCoreService.extractImports(parseResult.ast, content);
        console.log(`    - 导入数量: ${imports.length}`);

        // 提取导出
        const exports = await this.treeSitterCoreService.extractExports(parseResult.ast, content, language);
        console.log(`    - 导出数量: ${exports.length}`);

        // 测试分段功能
        console.log(`  测试分段功能...`);
        const chunks = await this.splitter.split(content, language, filePath);
        console.log(`    - 代码块数量: ${chunks.length}`);

        // 验证分段结果
        let totalChunkSize = 0;
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          totalChunkSize += chunk.content.length;

          // 检查每个块是否有有效的元数据
          if (!chunk.metadata) {
            console.log(`    ! 块 ${i} 缺少元数据`);
          } else {
            console.log(`    - 块 ${i}: ${chunk.metadata.startLine}-${chunk.metadata.endLine} 行, ${chunk.content.length} 字符`);
          }
        }

        console.log(`    - 原始内容大小: ${content.length} 字符`);
        console.log(`    - 分块总大小: ${totalChunkSize} 字符`);

        // 验证内容完整性（分块内容的总和应该接近原始内容）
        const sizeRatio = totalChunkSize / content.length;
        if (sizeRatio < 0.95) {
          console.log(`    ! 警告: 内容完整性比率较低 (${(sizeRatio * 100).toFixed(2)}%)`);
        }

        console.log(`  ✓ ${filePath} 测试通过`);
        return true;
      } else {
        console.log(`  ✗ 解析失败: ${parseResult.error}`);
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.log(`  ✗ 测试失败: ${errorMessage}`);
      console.error('  详细错误:', errorStack);
      return false;
    }
  }

  /**
   * 运行测试
   */
  async runTests(): Promise<void> {
    console.log('开始测试parser模块功能...');
    console.log('使用 test-files 目录中的文件进行测试');

    try {
      // 读取test-files目录中的所有文件
      const testFiles = await this.readFilesRecursively('test-files');
      console.log(`\n找到 ${testFiles.length} 个测试文件`);

      // 对每个文件运行测试
      for (const file of testFiles) {
        this.testResults.total++;

        const success = await this.testParseFile(file);

        if (success) {
          this.testResults.passed++;
        } else {
          this.testResults.failed++;
          this.testResults.errors.push(file);
        }
      }

      // 输出测试结果
      this.printResults();

    } catch (error) {
      console.error('运行测试时出错:', error);
    }
  }

  /**
   * 打印测试结果
   */
  printResults(): void {
    console.log('\n' + '='.repeat(50));
    console.log('测试结果汇总:');
    console.log(`总测试数: ${this.testResults.total}`);
    console.log(`通过: ${this.testResults.passed}`);
    console.log(`失败: ${this.testResults.failed}`);

    if (this.testResults.failed > 0) {
      console.log('\n失败的文件:');
      this.testResults.errors.forEach(file => console.log(`  - ${file}`));
    }

    const passRate = this.testResults.total > 0 ?
      (this.testResults.passed / this.testResults.total * 100).toFixed(2) : 0;
    console.log(`通过率: ${passRate}%`);
    console.log('='.repeat(50));
  }
}

// 运行测试
async function runParserTests() {
  const testScript = new ParserTestScript();
  await testScript.runTests();
}

if (require.main === module) {
  runParserTests().catch(console.error);
}

export { ParserTestScript };