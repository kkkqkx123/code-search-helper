/**
 * 基于查询规则的语言检测和评分系统
 * 根据实际的查询目录结构进行语言分类和评分
 */

import fs from 'fs';
import path from 'path';
import { LoggerService } from '../../../utils/LoggerService';
import { languageMappingManager } from './LanguageMappingManager';

export interface QueryAnalysisResult {
  language: string;
  confidence: number;
  queryMatches: number;
  totalQueries: number;
  matchedQueries: string[];
  analysisMethod: 'directory_structure' | 'query_content' | 'hybrid';
}

export class QueryBasedLanguageDetector {
  private logger: LoggerService;
  private queriesBaseDir: string;

  constructor(queriesDir?: string) {
    this.logger = new LoggerService();
    this.queriesBaseDir = queriesDir || path.join(__dirname, '..', 'constants', 'queries');
  }

  /**
   * 根据文件内容和查询规则进行语言检测
   */
  async detectLanguageByQueries(filePath: string, content: string): Promise<QueryAnalysisResult[]> {
    const results: QueryAnalysisResult[] = [];
    
    // 获取所有语言的查询目录
    const allLanguages = languageMappingManager.getAllSupportedLanguages();
    
    for (const language of allLanguages) {
      const queryResult = await this.analyzeLanguageQueries(language, content);
      if (queryResult.confidence > 0) {
        results.push(queryResult);
      }
    }

    // 按置信度排序
    results.sort((a, b) => b.confidence - a.confidence);
    
    return results;
  }

  /**
   * 分析特定语言的查询规则
   */
  async analyzeLanguageQueries(language: string, content: string): Promise<QueryAnalysisResult> {
    const config = languageMappingManager.getLanguageConfig(language);
    if (!config) {
      return {
        language,
        confidence: 0,
        queryMatches: 0,
        totalQueries: 0,
        matchedQueries: [],
        analysisMethod: 'directory_structure'
      };
    }

    // 检查查询目录是否存在
    const queryDirPath = path.join(this.queriesBaseDir, config.queryDir);
    let totalQueries = 0;
    let matchedQueries: string[] = [];

    if (config.hasSubdir) {
      // 高级规则语言 - 有子目录
      if (fs.existsSync(queryDirPath) && fs.statSync(queryDirPath).isDirectory()) {
        const queryFiles = this.getQueryFilesInSubdirs(queryDirPath);
        totalQueries = queryFiles.length;
        
        for (const queryFile of queryFiles) {
          if (await this.executeQueryMatch(queryFile, content)) {
            matchedQueries.push(path.basename(queryFile));
          }
        }
      }
    } else {
      // 基本规则语言 - 单个文件
      const queryFilePath = `${queryDirPath}.ts`;
      if (fs.existsSync(queryFilePath)) {
        totalQueries = 1;
        if (await this.executeQueryMatch(queryFilePath, content)) {
          matchedQueries.push(path.basename(queryFilePath));
        }
      }
    }

    // 计算置信度 (匹配的查询数 / 总查询数)
    const confidence = totalQueries > 0 ? matchedQueries.length / totalQueries : 0;

    return {
      language,
      confidence,
      queryMatches: matchedQueries.length,
      totalQueries,
      matchedQueries,
      analysisMethod: config.hasSubdir ? 'directory_structure' : 'query_content'
    };
  }

  /**
   * 获取子目录中的查询文件
   */
  private getQueryFilesInSubdirs(dirPath: string): string[] {
    const files: string[] = [];
    
    if (!fs.existsSync(dirPath)) {
      return files;
    }

    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        // 递归获取子目录中的查询文件
        files.push(...this.getQueryFilesInSubdirs(itemPath));
      } else if (stat.isFile() && (item.endsWith('.scm') || item.endsWith('.ts') || item.endsWith('.js'))) {
        files.push(itemPath);
      }
    }
    
    return files;
  }

  /**
   * 执行查询匹配
   * 这里我们模拟查询匹配过程，实际实现可能需要调用 Tree-sitter 查询引擎
   */
  private async executeQueryMatch(queryFilePath: string, content: string): Promise<boolean> {
    try {
      // 读取查询文件内容
      const queryContent = fs.readFileSync(queryFilePath, 'utf8');
      
      // 简单的模拟查询匹配
      // 在实际应用中，这里需要使用 Tree-sitter 查询引擎执行查询
      return this.simulateQueryMatch(queryContent, content);
    } catch (error) {
      this.logger.error(`执行查询匹配时出错 ${queryFilePath}:`, error);
      return false;
    }
  }

  /**
   * 模拟查询匹配
   * 在实际实现中，这将使用 Tree-sitter 查询引擎
   */
  private simulateQueryMatch(queryContent: string, fileContent: string): boolean {
    // 简单的模拟实现
    // 检查查询内容中的关键标识符是否在文件内容中
    const lowerFileContent = fileContent.toLowerCase();
    
    // 提取查询中的关键词（简化版）
    const keywords = this.extractKeywordsFromQuery(queryContent);
    
    // 检查是否有关键词匹配
    return keywords.some(keyword => lowerFileContent.includes(keyword.toLowerCase()));
  }

  /**
   * 从查询内容中提取关键词
   */
  private extractKeywordsFromQuery(queryContent: string): string[] {
    // 在实际实现中，这将解析 .scm 查询文件并提取模式
    // 这里是一个简化的版本
    const lines = queryContent.split('\n');
    const keywords: string[] = [];
    
    for (let line of lines) {
      line = line.trim();
      if (line && !line.startsWith(';')) { // 忽略注释
        // 提取可能的关键词
        const matches = line.match(/\w+/g) || [];
        keywords.push(...matches);
      }
    }
    
    return [...new Set(keywords)]; // 去重
  }

  /**
   * 综合评分 - 结合扩展名、内容和查询匹配
   */
  async comprehensiveLanguageDetection(filePath: string, content: string): Promise<QueryAnalysisResult[]> {
    const queryResults = await this.detectLanguageByQueries(filePath, content);
    
    // 获取基于扩展名的检测结果
    const languageByExt = languageMappingManager.getLanguageByPath(filePath);
    
    // 调整评分，如果扩展名匹配则增加权重
    const adjustedResults = queryResults.map(result => {
      const adjustedConfidence = languageByExt === result.language 
        ? Math.min(result.confidence + 0.2, 1.0) // 扩展名匹配增加0.2的置信度
        : result.confidence;
        
      return {
        ...result,
        confidence: adjustedConfidence
      };
    });
    
    // 按调整后的置信度排序
    adjustedResults.sort((a, b) => b.confidence - a.confidence);
    
    return adjustedResults;
  }

  /**
   * 获取语言的查询目录是否存在
   */
  getLanguageQueryDirExists(language: string): boolean {
    const config = languageMappingManager.getLanguageConfig(language);
    if (!config) return false;
    
    const queryDirPath = path.join(this.queriesBaseDir, config.queryDir);
    return fs.existsSync(queryDirPath);
  }

  /**
   * 获取语言的查询复杂度
   */
  getLanguageQueryComplexity(language: string): 'simple' | 'complex' | 'none' {
    const config = languageMappingManager.getLanguageConfig(language);
    if (!config) return 'none';
    
    if (!this.getLanguageQueryDirExists(language)) {
      return 'none';
    }
    
    if (config.hasSubdir) {
      return 'complex'; // 有子目录表示复杂的高级查询
    } else {
      return 'simple'; // 单个文件表示简单的查询
    }
  }
}