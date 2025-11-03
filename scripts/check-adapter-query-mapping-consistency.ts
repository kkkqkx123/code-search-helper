#!/usr/bin/env ts-node

/**
 * 适配器、查询规则和图映射一致性检查脚本
 *
 * 该脚本检查以下三个组件之间的一致性：
 * 1. src/service/parser/core/normalization/adapters 中的语言适配器
 * 2. src/service/parser/constants/queries 中的查询规则
 * 3. src/service/graph/mapping/LanguageNodeTypes.ts 中的图映射定义
 *
 * 使用方法：
 * - 检查所有语言：npx ts-node scripts/check-adapter-query-mapping-consistency.ts
 * - 检查特定语言：npx ts-node scripts/check-adapter-query-mapping-consistency.ts --language=javascript
 */

import * as fs from 'fs';
import * as path from 'path';
import { LoggerService } from '../src/utils/LoggerService';

// 类型定义
interface LanguageInfo {
  name: string;
  adapterPath?: string;
  queryPath?: string;
  hasMapping: boolean;
}

interface AdapterInfo {
  language: string;
  supportedQueryTypes: string[];
  nodeTypeMappings: Record<string, string>;
  queryTypeMappings: Record<string, string>;
}

interface QueryInfo {
  language: string;
  queryFiles: string[];
  queryTypes: string[];
}

interface MappingInfo {
  language: string;
  nodeMappings: Record<string, string[]>;
}

interface ConsistencyIssue {
  type: 'missing_adapter' | 'missing_query' | 'missing_mapping' | 'query_type_mismatch' | 'node_type_mismatch';
  language: string;
  details: string;
  severity: 'error' | 'warning';
}

class ConsistencyChecker {
  private logger: LoggerService;
  private adaptersDir: string;
  private queriesDir: string;
  private mappingFile: string;
  private targetLanguage?: string;

  constructor(targetLanguage?: string) {
    this.logger = new LoggerService();
    this.adaptersDir = path.join(__dirname, '../src/service/parser/core/normalization/adapters');
    this.queriesDir = path.join(__dirname, '../src/service/parser/constants/queries');
    this.mappingFile = path.join(__dirname, '../src/service/graph/mapping/LanguageNodeTypes.ts');
    this.targetLanguage = targetLanguage?.toLowerCase();
  }

  /**
   * 运行所有一致性检查
   */
  async runAllChecks(): Promise<ConsistencyIssue[]> {
    const targetText = this.targetLanguage ? ` ${this.targetLanguage} 语言` : '';
    console.log(`开始运行适配器、查询规则和图映射一致性检查${targetText}...`);
    
    const issues: ConsistencyIssue[] = [];
    
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
      
      // 2. 检查缺失的组件
      console.log('2. 检查缺失的组件...');
      issues.push(...this.checkMissingComponents(filteredLanguages));
      
      // 3. 检查适配器与查询规则的一致性
      console.log('3. 检查适配器与查询规则的一致性...');
      issues.push(...this.checkAdapterQueryConsistency(filteredLanguages));
      
      // 4. 检查查询规则与图映射的一致性
      console.log('4. 检查查询规则与图映射的一致性...');
      issues.push(...this.checkQueryMappingConsistency(filteredLanguages));
      
      // 5. 检查适配器与图映射的一致性
      console.log('5. 检查适配器与图映射的一致性...');
      issues.push(...this.checkAdapterMappingConsistency(filteredLanguages));
      
      // 6. 生成报告
      console.log('6. 生成报告...');
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
      .filter(file => file.endsWith('LanguageAdapter.ts') && !file.includes('DefaultLanguageAdapter'));
    
    for (const file of adapterFiles) {
      const languageName = this.extractLanguageFromFileName(file);
      languages.push({
        name: languageName,
        adapterPath: path.join(this.adaptersDir, file),
        queryPath: this.findQueryPath(languageName),
        hasMapping: this.checkMappingExists(languageName)
      });
    }
    
    // 从查询目录检查是否有遗漏的语言
    const queryDirs = fs.readdirSync(this.queriesDir)
      .filter(file => fs.statSync(path.join(this.queriesDir, file)).isDirectory());
    
    for (const dir of queryDirs) {
      if (!languages.find(lang => lang.name === dir)) {
        languages.push({
          name: dir,
          queryPath: path.join(this.queriesDir, dir),
          hasMapping: this.checkMappingExists(dir)
        });
      }
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
   * 检查映射是否存在
   */
  private checkMappingExists(languageName: string): boolean {
    try {
      const mappingContent = fs.readFileSync(this.mappingFile, 'utf-8');
      return mappingContent.includes(`'${languageName}'`);
    } catch {
      return false;
    }
  }

  /**
   * 检查缺失的组件
   */
  private checkMissingComponents(languages: LanguageInfo[]): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];
    
    for (const lang of languages) {
      if (!lang.adapterPath) {
        issues.push({
          type: 'missing_adapter',
          language: lang.name,
          details: `缺少 ${lang.name} 语言的适配器`,
          severity: 'error'
        });
      }
      
      if (!lang.queryPath) {
        issues.push({
          type: 'missing_query',
          language: lang.name,
          details: `缺少 ${lang.name} 语言的查询规则`,
          severity: 'error'
        });
      }
      
      if (!lang.hasMapping) {
        issues.push({
          type: 'missing_mapping',
          language: lang.name,
          details: `缺少 ${lang.name} 语言的图映射定义`,
          severity: 'warning'
        });
      }
    }
    
    return issues;
  }

  /**
   * 检查适配器与查询规则的一致性
   */
  private checkAdapterQueryConsistency(languages: LanguageInfo[]): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];
    
    for (const lang of languages) {
      if (!lang.adapterPath || !lang.queryPath) continue;
      
      try {
        const adapterInfo = this.extractAdapterInfo(lang.adapterPath);
        const queryInfo = this.extractQueryInfo(lang.queryPath);
        
        // 检查查询类型是否匹配
        const missingQueryTypes = adapterInfo.supportedQueryTypes.filter(
          type => !queryInfo.queryTypes.includes(type)
        );
        
        for (const missingType of missingQueryTypes) {
          issues.push({
            type: 'query_type_mismatch',
            language: lang.name,
            details: `适配器支持的查询类型 '${missingType}' 在查询规则中未找到`,
            severity: 'warning'
          });
        }
        
        const extraQueryTypes = queryInfo.queryTypes.filter(
          type => !adapterInfo.supportedQueryTypes.includes(type)
        );
        
        for (const extraType of extraQueryTypes) {
          issues.push({
            type: 'query_type_mismatch',
            language: lang.name,
            details: `查询规则中的查询类型 '${extraType}' 在适配器中未声明支持`,
            severity: 'warning'
          });
        }
      } catch (error) {
        this.logger.warn(`检查 ${lang.name} 的适配器与查询规则一致性时出错:`, error);
      }
    }
    
    return issues;
  }

  /**
   * 检查查询规则与图映射的一致性
   */
  private checkQueryMappingConsistency(languages: LanguageInfo[]): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];
    
    for (const lang of languages) {
      if (!lang.queryPath || !lang.hasMapping) continue;
      
      try {
        const queryInfo = this.extractQueryInfo(lang.queryPath);
        const mappingInfo = this.extractMappingInfo(lang.name);
        
        // 检查查询中使用的节点类型是否在映射中定义
        const queryNodeTypes = this.extractNodeTypesFromQueries(lang.queryPath);
        const mappedNodeTypes = Object.keys(mappingInfo.nodeMappings).flatMap(key => mappingInfo.nodeMappings[key]);
        
        for (const nodeType of queryNodeTypes) {
          if (!mappedNodeTypes.includes(nodeType)) {
            issues.push({
              type: 'node_type_mismatch',
              language: lang.name,
              details: `查询规则中使用的节点类型 '${nodeType}' 在图映射中未定义`,
              severity: 'warning'
            });
          }
        }
      } catch (error) {
        this.logger.warn(`检查 ${lang.name} 的查询规则与图映射一致性时出错:`, error);
      }
    }
    
    return issues;
  }

  /**
   * 检查适配器与图映射的一致性
   */
  private checkAdapterMappingConsistency(languages: LanguageInfo[]): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];
    
    for (const lang of languages) {
      if (!lang.adapterPath || !lang.hasMapping) continue;
      
      try {
        const adapterInfo = this.extractAdapterInfo(lang.adapterPath);
        const mappingInfo = this.extractMappingInfo(lang.name);
        
        // 检查适配器中的节点类型映射是否与图映射一致
        const adapterNodeTypes = Object.keys(adapterInfo.nodeTypeMappings);
        const mappingCategories = Object.keys(mappingInfo.nodeMappings);
        
        for (const nodeType of adapterNodeTypes) {
          const mappedCategory = adapterInfo.nodeTypeMappings[nodeType];
          if (!mappingCategories.includes(mappedCategory)) {
            issues.push({
              type: 'node_type_mismatch',
              language: lang.name,
              details: `适配器中的节点类型 '${nodeType}' 映射到类别 '${mappedCategory}'，但该类别在图映射中未定义`,
              severity: 'warning'
            });
          }
        }
      } catch (error) {
        this.logger.warn(`检查 ${lang.name} 的适配器与图映射一致性时出错:`, error);
      }
    }
    
    return issues;
  }

  /**
   * 提取适配器信息
   */
  private extractAdapterInfo(adapterPath: string): AdapterInfo {
    const content = fs.readFileSync(adapterPath, 'utf-8');
    
    // 提取支持的查询类型
    const queryTypesMatch = content.match(/getSupportedQueryTypes\(\):\s*string\[\]\s*{\s*return\s*\[([\s\S]*?)\];?/);
    const supportedQueryTypes = queryTypesMatch 
      ? queryTypesMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(s => s)
      : [];
    
    // 提取节点类型映射
    const nodeTypeMappingMatch = content.match(/mapNodeType\(nodeType:\s*string\):\s*string\s*{[\s\S]*?const\s+typeMapping[^=]*=[\s\S]*?{([\s\S]*?)}[\s\S]*?return\s+typeMapping/);
    const nodeTypeMappings: Record<string, string> = {};
    
    if (nodeTypeMappingMatch) {
      const mappingContent = nodeTypeMappingMatch[1];
      const mappingMatches = mappingContent.matchAll(/'([^']+)':\s*'([^']+)'/g);
      for (const match of mappingMatches) {
        nodeTypeMappings[match[1]] = match[2];
      }
    }
    
    // 提取查询类型映射
    const queryTypeMappingMatch = content.match(/mapQueryTypeToStandardType[^{]*{[\s\S]*?const\s+mapping[^=]*=[\s\S]*?{([\s\S]*?)}[\s\S]*?return\s+mapping/);
    const queryTypeMappings: Record<string, string> = {};
    
    if (queryTypeMappingMatch) {
      const mappingContent = queryTypeMappingMatch[1];
      const mappingMatches = mappingContent.matchAll(/'([^']+)':\s*'([^']+)'/g);
      for (const match of mappingMatches) {
        queryTypeMappings[match[1]] = match[2];
      }
    }
    
    const languageName = this.extractLanguageFromFileName(path.basename(adapterPath));
    
    return {
      language: languageName,
      supportedQueryTypes,
      nodeTypeMappings,
      queryTypeMappings
    };
  }

  /**
   * 提取查询信息
   */
  private extractQueryInfo(queryPath: string): QueryInfo {
    const files = fs.readdirSync(queryPath).filter(file => file.endsWith('.ts'));
    const queryTypes: string[] = [];
    
    for (const file of files) {
      if (file === 'index.ts') continue;
      
      const content = fs.readFileSync(path.join(queryPath, file), 'utf-8');
      const typeName = path.basename(file, '.ts');
      queryTypes.push(typeName);
    }
    
    const languageName = path.basename(queryPath);
    
    return {
      language: languageName,
      queryFiles: files,
      queryTypes
    };
  }

  /**
   * 提取映射信息
   */
  private extractMappingInfo(languageName: string): MappingInfo {
    const content = fs.readFileSync(this.mappingFile, 'utf-8');
    
    // 查找特定语言的映射
    const languageMatch = content.match(new RegExp(`'${languageName}'\\s*:\\s*{([\\s\\S]*?)}`, ''));
    
    if (!languageMatch) {
      return { language: languageName, nodeMappings: {} };
    }
    
    const mappingContent = languageMatch[1];
    const nodeMappings: Record<string, string[]> = {};
    
    // 提取各个类别的映射
    const categoryMatches = mappingContent.matchAll(/(\w+):\s*\[([\s\S]*?)\]/g);
    for (const match of categoryMatches) {
      const category = match[1];
      const values = match[2].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(s => s);
      nodeMappings[category] = values;
    }
    
    return {
      language: languageName,
      nodeMappings
    };
  }

  /**
   * 从查询文件中提取节点类型
   */
  private extractNodeTypesFromQueries(queryPath: string): string[] {
    const nodeTypes: Set<string> = new Set();
    const files = fs.readdirSync(queryPath).filter(file => file.endsWith('.ts'));
    
    for (const file of files) {
      if (file === 'index.ts') continue;
      
      const content = fs.readFileSync(path.join(queryPath, file), 'utf-8');
      
      // 提取查询模式中的节点类型
      const nodeMatches = content.matchAll(/\(([^)]+)\)\s+@/g);
      for (const match of nodeMatches) {
        const nodePattern = match[1];
        // 提取节点类型（简化处理）
        const typeMatch = nodePattern.match(/(\w+)/);
        if (typeMatch) {
          nodeTypes.add(typeMatch[1]);
        }
      }
    }
    
    return Array.from(nodeTypes);
  }

  /**
   * 生成报告
   */
  private generateReport(issues: ConsistencyIssue[]): void {
    console.log('\n=== 一致性检查报告 ===');
    
    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');
    
    if (issues.length === 0) {
      console.log('✅ 未发现一致性问题');
      return;
    }
    
    console.log(`\n发现 ${issues.length} 个问题 (${errors.length} 个错误, ${warnings.length} 个警告)\n`);
    
    // 按语言分组显示问题
    const issuesByLanguage = issues.reduce((acc, issue) => {
      if (!acc[issue.language]) {
        acc[issue.language] = [];
      }
      acc[issue.language].push(issue);
      return acc;
    }, {} as Record<string, ConsistencyIssue[]>);
    
    for (const [language, langIssues] of Object.entries(issuesByLanguage)) {
      console.log(`\n📝 ${language.toUpperCase()} 语言:`);
      
      for (const issue of langIssues) {
        const icon = issue.severity === 'error' ? '❌' : '⚠️';
        console.log(`  ${icon} ${issue.details}`);
      }
    }
    
    // 总结
    console.log('\n=== 总结 ===');
    if (errors.length > 0) {
      console.error(`❌ 发现 ${errors.length} 个错误，需要修复`);
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
  
  for (const arg of args) {
    if (arg.startsWith('--language=')) {
      targetLanguage = arg.split('=')[1];
    } else if (arg.startsWith('-l=')) {
      targetLanguage = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
适配器、查询规则和图映射一致性检查脚本

使用方法:
  npx ts-node scripts/check-adapter-query-mapping-consistency.ts [选项]

选项:
  -l, --language=<语言名>    只检查指定语言的一致性
  -h, --help               显示帮助信息

示例:
  npx ts-node scripts/check-adapter-query-mapping-consistency.ts
  npx ts-node scripts/check-adapter-query-mapping-consistency.ts --language=javascript
  npx ts-node scripts/check-adapter-query-mapping-consistency.ts -l=typescript

支持的语言: javascript, typescript, python, java, go, rust, c, cpp, csharp, kotlin, html, css, vue
      `);
      process.exit(0);
    }
  }
  
  const checker = new ConsistencyChecker(targetLanguage);
  
  try {
    const issues = await checker.runAllChecks();
    
    // 根据问题严重程度设置退出码
    const hasErrors = issues.some(issue => issue.severity === 'error');
    process.exit(hasErrors ? 1 : 0);
  } catch (error) {
    console.error('检查脚本执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

export { ConsistencyChecker, ConsistencyIssue };