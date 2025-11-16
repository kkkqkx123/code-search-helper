#!/usr/bin/env ts-node

/**
 * 命名捕获映射检查和补充脚本
 *
 * 该脚本检查语言适配器中的命名捕获列表是否完整覆盖了查询规则中使用的所有命名捕获
 * 并可以自动生成补充建议
 *
 * 使用方法：
 * - 检查所有语言：npx ts-node scripts/check-name-capture-mapping.ts
 * - 检查特定语言：npx ts-node scripts/check-name-capture-mapping.ts --language=c
 * - 自动补充缺失的命名捕获：npx ts-node scripts/check-name-capture-mapping.ts --language=c --fix
 */

import * as fs from 'fs';
import * as path from 'path';
import { LoggerService } from '../src/utils/LoggerService';

// 类型定义
interface NameCaptureIssue {
  language: string;
  missingCaptures: string[];
  unusedCaptures: string[];
  severity: 'error' | 'warning';
}

interface LanguageInfo {
  name: string;
  adapterPath?: string;
  queryPath?: string;
  utilsPath?: string;
}

class NameCaptureChecker {
  private logger: LoggerService;
  private adaptersDir: string;
  private queriesDir: string;
  private targetLanguage?: string;
  private autoFix: boolean;

  constructor(targetLanguage?: string, autoFix: boolean = false) {
    this.logger = new LoggerService();
    this.adaptersDir = path.join(__dirname, '../src/service/parser/core/normalization/adapters');
    this.queriesDir = path.join(__dirname, '../src/service/parser/constants/queries');
    this.targetLanguage = targetLanguage?.toLowerCase();
    this.autoFix = autoFix;
  }

  /**
   * 运行所有检查
   */
  async runAllChecks(): Promise<NameCaptureIssue[]> {
    const targetText = this.targetLanguage ? ` ${this.targetLanguage} 语言` : '';
    console.log(`开始运行命名捕获映射检查${targetText}...`);
    
    const issues: NameCaptureIssue[] = [];
    
    try {
      // 1. 收集所有语言信息
      console.log('1. 收集语言信息...');
      const languageInfos = await this.collectLanguageInfos();
      
      // 过滤目标语言
      const filteredLanguages = this.targetLanguage
        ? languageInfos.filter(lang => lang.name === this.targetLanguage)
        : languageInfos;
      
      if (this.targetLanguage && filteredLanguages.length === 0) {
        console.log(`❌ 未找到语言 "${this.targetLanguage}" 的相关信息`);
        return [];
      }
      
      console.log(`发现 ${filteredLanguages.length} 种语言${this.targetLanguage ? ` (仅检查 ${this.targetLanguage})` : ''}`);
      
      // 2. 检查每种语言的命名捕获映射
      console.log('2. 检查命名捕获映射...');
      for (const lang of filteredLanguages) {
        const issue = await this.checkLanguageNameCaptures(lang);
        if (issue) {
          issues.push(issue);
          
          // 如果启用了自动修复，尝试修复问题
          if (this.autoFix && issue.missingCaptures.length > 0) {
            await this.fixMissingNameCaptures(lang, issue.missingCaptures);
          }
        }
      }
      
      // 3. 生成报告
      console.log('3. 生成报告...');
      this.generateReport(issues);
      
      return issues;
    } catch (error) {
      console.error('检查过程中发生错误:', error);
      throw error;
    }
  }

  /**
   * 收集所有语言信息
   */
  private async collectLanguageInfos(): Promise<LanguageInfo[]> {
    const languages: LanguageInfo[] = [];
    
    // 从适配器目录收集语言
    const adapterFiles = fs.readdirSync(this.adaptersDir)
      .filter(file => file.endsWith('LanguageAdapter.ts') &&
             !file.includes('DefaultLanguageAdapter') &&
             !file.includes('ConfigLanguageAdapter'));
    
    for (const file of adapterFiles) {
      const languageName = this.extractLanguageFromFileName(file);
      languages.push({
        name: languageName,
        adapterPath: path.join(this.adaptersDir, file),
        queryPath: this.findQueryPath(languageName),
        utilsPath: this.findUtilsPath(languageName)
      });
    }
    
    return languages;
  }

  /**
   * 从文件名提取语言名称
   */
  private extractLanguageFromFileName(fileName: string): string {
    const match = fileName.match(/(.+)LanguageAdapter\.ts$/);
    return match ? match[1].toLowerCase() : '';
  }

  /**
   * 查找查询路径
   */
  private findQueryPath(languageName: string): string | undefined {
    const queryPath = path.join(this.queriesDir, languageName);
    return fs.existsSync(queryPath) ? queryPath : undefined;
  }

  /**
   * 查找工具路径 - 支持不同的命名约定
   */
  private findUtilsPath(languageName: string): string | undefined {
    // 尝试不同的命名约定
    const possiblePaths = [
      path.join(this.adaptersDir, `${languageName}-utils`),
      path.join(this.adaptersDir, `${this.getLanguageAbbreviation(languageName)}-utils`),
      path.join(this.adaptersDir, `${languageName}utils`)
    ];
    
    for (const utilsPath of possiblePaths) {
      if (fs.existsSync(utilsPath)) {
        return utilsPath;
      }
    }
    
    return undefined;
  }

  /**
   * 获取语言缩写
   */
  private getLanguageAbbreviation(languageName: string): string {
    const abbreviations: Record<string, string> = {
      'javascript': 'js',
      'typescript': 'ts',
      'cpp': 'cpp',
      'csharp': 'csharp'
    };
    return abbreviations[languageName] || languageName;
  }

  /**
   * 检查单个语言的命名捕获映射
   */
  private async checkLanguageNameCaptures(lang: LanguageInfo): Promise<NameCaptureIssue | null> {
    if (!lang.adapterPath || !lang.queryPath || !lang.utilsPath) {
      console.log(`⚠️ 跳过 ${lang.name}：缺少必要的文件`);
      return null;
    }

    try {
      // 1. 提取查询规则中使用的命名捕获
      const queryCaptures = this.extractNameCapturesFromQueries(lang.queryPath);
      
      // 2. 提取适配器中定义的命名捕获
      const adapterCaptures = this.extractNameCapturesFromAdapter(lang.utilsPath);
      
      // 3. 比较差异
      const missingCaptures = queryCaptures.filter(capture => !adapterCaptures.includes(capture));
      const unusedCaptures = adapterCaptures.filter(capture => !queryCaptures.includes(capture));
      
      if (missingCaptures.length === 0 && unusedCaptures.length === 0) {
        console.log(`✅ ${lang.name} 语言的命名捕获映射完整`);
        return null;
      }
      
      return {
        language: lang.name,
        missingCaptures,
        unusedCaptures,
        severity: missingCaptures.length > 0 ? 'error' : 'warning'
      };
    } catch (error) {
      this.logger.warn(`检查 ${lang.name} 的命名捕获时出错:`, error);
      return null;
    }
  }

  /**
   * 从查询规则中提取命名捕获
   */
  private extractNameCapturesFromQueries(queryPath: string): string[] {
    const nameCaptures: Set<string> = new Set();
    const files = fs.readdirSync(queryPath).filter(file => file.endsWith('.ts'));
    
    for (const file of files) {
      if (file === 'index.ts') continue;
      
      const content = fs.readFileSync(path.join(queryPath, file), 'utf-8');
      
      // 提取所有 @name.xxx 格式的命名捕获
      const captureMatches = content.matchAll(/@([a-zA-Z0-9_.-]+)/g);
      for (const match of captureMatches) {
        nameCaptures.add(match[1]);
      }
    }
    
    return Array.from(nameCaptures).sort();
  }

  /**
   * 从适配器工具文件中提取命名捕获
   */
  private extractNameCapturesFromAdapter(utilsPath: string): string[] {
    const constantsPath = path.join(utilsPath, 'constants.ts');
    
    if (!fs.existsSync(constantsPath)) {
      return [];
    }
    
    const content = fs.readFileSync(constantsPath, 'utf-8');
    
    // 提取 NAME_CAPTURES 常量
    const nameCapturesMatch = content.match(/export\s+const\s+\w*NAME_CAPTURES\s*=\s*\[([\s\S]*?)\]/);
    
    if (!nameCapturesMatch) {
      return [];
    }
    
    const capturesContent = nameCapturesMatch[1];
    const captures: string[] = [];
    
    // 提取字符串值
    const stringMatches = capturesContent.matchAll(/'([^']+)'/g);
    for (const match of stringMatches) {
      captures.push(match[1]);
    }
    
    return captures;
  }

  /**
   * 修复缺失的命名捕获
   */
  private async fixMissingNameCaptures(lang: LanguageInfo, missingCaptures: string[]): Promise<void> {
    const constantsPath = path.join(lang.utilsPath!, 'constants.ts');
    
    if (!fs.existsSync(constantsPath)) {
      console.log(`❌ 无法修复 ${lang.name}：找不到 constants.ts 文件`);
      return;
    }
    
    console.log(`🔧 修复 ${lang.name} 语言的命名捕获映射...`);
    
    let content = fs.readFileSync(constantsPath, 'utf-8');
    
    // 查找 NAME_CAPTURES 常量的位置
    const nameCapturesMatch = content.match(/(export\s+const\s+\w*NAME_CAPTURES\s*=\s*\[)([\s\S]*?)(\])/);
    
    if (!nameCapturesMatch) {
      console.log(`❌ 无法在 ${lang.name} 的 constants.ts 中找到 NAME_CAPTURES 常量`);
      return;
    }
    
    const prefix = nameCapturesMatch[1];
    const capturesContent = nameCapturesMatch[2];
    const suffix = nameCapturesMatch[3];
    
    // 解析现有的捕获
    const existingCaptures = this.extractNameCapturesFromAdapter(lang.utilsPath!);
    
    // 合并新的捕获
    const allCaptures = [...new Set([...existingCaptures, ...missingCaptures])].sort();
    
    // 生成新的捕获列表
    const newCapturesContent = allCaptures
      .map(capture => `  '${capture}'`)
      .join(',\n');
    
    // 替换内容
    const newContent = content.replace(
      nameCapturesMatch[0],
      `${prefix}${newCapturesContent}${suffix}`
    );
    
    // 写入文件
    fs.writeFileSync(constantsPath, newContent, 'utf-8');
    
    console.log(`✅ 已为 ${lang.name} 添加 ${missingCaptures.length} 个缺失的命名捕获`);
  }

  /**
   * 生成报告
   */
  private generateReport(issues: NameCaptureIssue[]): void {
    console.log('\n=== 命名捕获映射检查报告 ===');
    
    if (issues.length === 0) {
      console.log('✅ 所有语言的命名捕获映射都完整');
      return;
    }
    
    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');
    
    console.log(`\n发现 ${issues.length} 个问题 (${errors.length} 个错误, ${warnings.length} 个警告)\n`);
    
    for (const issue of issues) {
      console.log(`\n📝 ${issue.language.toUpperCase()} 语言:`);
      
      if (issue.missingCaptures.length > 0) {
        console.log(`  ❌ 缺失的命名捕获 (${issue.missingCaptures.length}个):`);
        for (const capture of issue.missingCaptures) {
          console.log(`    - ${capture}`);
        }
      }
      
      if (issue.unusedCaptures.length > 0) {
        console.log(`  ⚠️ 未使用的命名捕获 (${issue.unusedCaptures.length}个):`);
        for (const capture of issue.unusedCaptures) {
          console.log(`    - ${capture}`);
        }
      }
    }
    
    // 总结
    console.log('\n=== 总结 ===');
    if (errors.length > 0) {
      console.error(`❌ 发现 ${errors.length} 个错误，需要修复`);
      if (!this.autoFix) {
        console.log('💡 提示：使用 --fix 参数可以自动修复缺失的命名捕获');
      }
    }
    if (warnings.length > 0) {
      console.warn(`⚠️ 发现 ${warnings.length} 个警告，建议检查`);
    }
  }
}

// 主函数
async function main() {
  // 解析命令行参数
  const args = process.argv.slice(2);
  let targetLanguage: string | undefined;
  let autoFix = false;
  
  for (const arg of args) {
    if (arg.startsWith('--language=')) {
      targetLanguage = arg.split('=')[1];
    } else if (arg.startsWith('-l=')) {
      targetLanguage = arg.split('=')[1];
    } else if (arg === '--fix') {
      autoFix = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
命名捕获映射检查和补充脚本

使用方法:
  npx ts-node scripts/check-name-capture-mapping.ts [选项]

选项:
  -l, --language=<语言名>    只检查指定语言的命名捕获映射
  --fix                      自动修复缺失的命名捕获
  -h, --help               显示帮助信息

示例:
  npx ts-node scripts/check-name-capture-mapping.ts
  npx ts-node scripts/check-name-capture-mapping.ts --language=c
  npx ts-node scripts/check-name-capture-mapping.ts --language=c --fix

支持的语言: javascript, typescript, python, java, go, rust, c, cpp, csharp, kotlin, html, css, vue
      `);
      process.exit(0);
    }
  }
  
  const checker = new NameCaptureChecker(targetLanguage, autoFix);
  
  try {
    const issues = await checker.runAllChecks();
    
    // 根据问题严重程度设置退出码
    const hasErrors = issues.some(issue => issue.severity === 'error');
    process.exit(hasErrors && !autoFix ? 1 : 0);
  } catch (error) {
    console.error('检查脚本执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

export { NameCaptureChecker, NameCaptureIssue };