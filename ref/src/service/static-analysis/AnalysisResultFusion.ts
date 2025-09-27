import { inject, injectable } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../core/LoggerService';
import { SemgrepFinding } from '../../models/StaticAnalysisTypes';

/**
 * 分析结果融合服务
 * 负责将静态分析结果与其他数据源融合，提供更丰富的代码洞察
 */
@injectable()
export class AnalysisResultFusion {
  constructor(@inject(TYPES.LoggerService) private logger: LoggerService) {}

  /**
   * 融合静态分析结果与图数据库信息
   */
  async fuseWithGraphData(findings: SemgrepFinding[], graphData: any): Promise<EnhancedFinding[]> {
    try {
      const enhancedFindings: EnhancedFinding[] = [];

      for (const finding of findings) {
        const enhanced = await this.enrichFindingWithGraph(finding, graphData);
        enhancedFindings.push(enhanced);
      }

      return enhancedFindings;
    } catch (error) {
      this.logger.error('Error fusing with graph data:', error);
      return findings.map(f => ({ ...f, graphContext: {} }));
    }
  }

  /**
   * 融合静态分析结果与向量搜索信息
   */
  async fuseWithVectorData(
    findings: SemgrepFinding[],
    vectorData: any
  ): Promise<EnhancedFinding[]> {
    try {
      const enhancedFindings: EnhancedFinding[] = [];

      for (const finding of findings) {
        const enhanced = await this.enrichFindingWithVector(finding, vectorData);
        enhancedFindings.push(enhanced);
      }

      return enhancedFindings;
    } catch (error) {
      this.logger.error('Error fusing with vector data:', error);
      return findings.map(f => ({ ...f, vectorContext: {} }));
    }
  }

  /**
   * 生成融合报告
   */
  async generateFusionReport(
    findings: SemgrepFinding[],
    contextData: {
      graph?: any;
      vector?: any;
      metrics?: any;
    }
  ): Promise<FusionReport> {
    try {
      const enhancedFindings = await this.fuseAllData(findings, contextData);

      return {
        summary: this.generateSummary(enhancedFindings),
        findings: enhancedFindings,
        riskAssessment: this.assessRisks(enhancedFindings),
        recommendations: this.generateRecommendations(enhancedFindings),
        trends: this.analyzeTrends(enhancedFindings),
      };
    } catch (error) {
      this.logger.error('Error generating fusion report:', error);
      return this.createBasicReport(findings);
    }
  }

  /**
   * 用图数据库信息增强发现项
   */
  private async enrichFindingWithGraph(
    finding: SemgrepFinding,
    graphData: any
  ): Promise<EnhancedFinding> {
    const graphContext = {
      // 查找相关文件
      relatedFiles: await this.findRelatedFiles(finding.location.file, graphData),

      // 查找调用关系
      callGraph: await this.buildCallGraph(
        finding.location.file,
        finding.location.start.line,
        graphData
      ),

      // 查找依赖关系
      dependencies: await this.findDependencies(finding.location.file, graphData),

      // 查找相似模式
      similarPatterns: await this.findSimilarPatterns(finding, graphData),
    };

    return {
      ...finding,
      graphContext,
    };
  }

  /**
   * 用向量搜索信息增强发现项
   */
  private async enrichFindingWithVector(
    finding: SemgrepFinding,
    vectorData: any
  ): Promise<EnhancedFinding> {
    const vectorContext = {
      // 查找相似代码
      similarCode: await this.findSimilarCode(finding, vectorData),

      // 查找相关文档
      relatedDocs: await this.findRelatedDocumentation(finding, vectorData),

      // 查找修复示例
      fixExamples: await this.findFixExamples(finding, vectorData),

      // 上下文相似度
      contextSimilarity: await this.calculateContextSimilarity(finding, vectorData),
    };

    return {
      ...finding,
      vectorContext,
    };
  }

  /**
   * 融合所有数据源
   */
  private async fuseAllData(
    findings: SemgrepFinding[],
    contextData: any
  ): Promise<EnhancedFinding[]> {
    let enhancedFindings: EnhancedFinding[] = findings.map(f => ({ ...f }));

    if (contextData.graph) {
      enhancedFindings = await this.fuseWithGraphData(enhancedFindings, contextData.graph);
    }

    if (contextData.vector) {
      enhancedFindings = await this.fuseWithVectorData(enhancedFindings, contextData.vector);
    }

    return enhancedFindings;
  }

  /**
   * 查找相关文件
   */
  private async findRelatedFiles(filePath: string, graphData: any): Promise<string[]> {
    try {
      // 在图数据库中查找相关文件
      const query = `
        MATCH (file:file {path: $filePath})-[:imports|depends_on|includes]-(related:file)
        RETURN related.path as relatedPath
        LIMIT 10
      `;

      const results = await graphData.executeQuery(query, { filePath });
      return results.map((r: any) => r.relatedPath);
    } catch {
      return [];
    }
  }

  /**
   * 构建调用图
   */
  private async buildCallGraph(filePath: string, line: number, graphData: any): Promise<any> {
    try {
      const query = `
        MATCH (func:function)-[:defined_in]->(file:file {path: $filePath})
        WHERE func.startLine <= $line AND func.endLine >= $line
        OPTIONAL MATCH (func)-[:calls]->(callee:function)
        OPTIONAL MATCH (caller:function)-[:calls]->(func)
        RETURN {
          function: func.name,
          calls: collect(DISTINCT callee.name),
          calledBy: collect(DISTINCT caller.name)
        } as callGraph
      `;

      const results = await graphData.executeQuery(query, { filePath, line });
      return results.length > 0 ? results[0].callGraph : null;
    } catch {
      return null;
    }
  }

  /**
   * 查找依赖关系
   */
  private async findDependencies(filePath: string, graphData: any): Promise<string[]> {
    try {
      const query = `
        MATCH (file:file {path: $filePath})-[:imports|depends_on]->(dep:dependency)
        RETURN dep.name as dependency
      `;

      const results = await graphData.executeQuery(query, { filePath });
      return results.map((r: any) => r.dependency);
    } catch {
      return [];
    }
  }

  /**
   * 查找相似模式
   */
  private async findSimilarPatterns(finding: SemgrepFinding, graphData: any): Promise<any[]> {
    try {
      const query = `
        MATCH (issue:static_analysis_issue {ruleId: $ruleId})-[:found_in]->(file:file)
        WHERE file.path <> $filePath
        RETURN {
          file: file.path,
          line: issue.line,
          message: issue.message
        } as similarPattern
        LIMIT 5
      `;

      const results = await graphData.executeQuery(query, {
        ruleId: finding.ruleId,
        filePath: finding.location.file,
      });

      return results.map((r: any) => r.similarPattern);
    } catch {
      return [];
    }
  }

  /**
   * 查找相似代码
   */
  private async findSimilarCode(finding: SemgrepFinding, vectorData: any): Promise<any[]> {
    try {
      const query = `${finding.ruleId} ${finding.message}`;
      const similar = await vectorData.searchSimilar(query, 5);
      return similar;
    } catch {
      return [];
    }
  }

  /**
   * 查找相关文档
   */
  private async findRelatedDocumentation(finding: SemgrepFinding, vectorData: any): Promise<any[]> {
    try {
      const query = `${finding.ruleId} documentation security best practices`;
      const docs = await vectorData.searchSimilar(query, 3);
      return docs;
    } catch {
      return [];
    }
  }

  /**
   * 查找修复示例
   */
  private async findFixExamples(finding: SemgrepFinding, vectorData: any): Promise<any[]> {
    try {
      const query = `${finding.ruleId} fix example remediation`;
      const examples = await vectorData.searchSimilar(query, 3);
      return examples;
    } catch {
      return [];
    }
  }

  /**
   * 计算上下文相似度
   */
  private async calculateContextSimilarity(
    finding: SemgrepFinding,
    vectorData: any
  ): Promise<number> {
    try {
      const query = `${finding.location.lines.join('\n') || finding.message}`;
      const results = await vectorData.searchSimilar(query, 1);
      return results.length > 0 ? results[0].score || 0 : 0;
    } catch {
      return 0;
    }
  }

  /**
   * 生成摘要
   */
  private generateSummary(enhancedFindings: EnhancedFinding[]): any {
    const total = enhancedFindings.length;
    const bySeverity = this.groupBySeverity(enhancedFindings);
    const byRule = this.groupByRule(enhancedFindings);

    return {
      totalFindings: total,
      bySeverity: Object.fromEntries(bySeverity),
      topRules: Object.entries(byRule)
        .sort(([, a], [, b]) => b.length - a.length)
        .slice(0, 5)
        .map(([rule, findings]) => ({ rule, count: findings.length })),
    };
  }

  /**
   * 评估风险
   */
  private assessRisks(enhancedFindings: EnhancedFinding[]): RiskAssessment {
    const criticalCount = enhancedFindings.filter(f => f.severity === 'ERROR').length;
    const highRiskFiles = this.identifyHighRiskFiles(enhancedFindings);

    return {
      overallRisk: this.calculateOverallRisk(criticalCount, enhancedFindings.length),
      criticalIssues: criticalCount,
      highRiskFiles,
      riskFactors: this.identifyRiskFactors(enhancedFindings),
    };
  }

  /**
   * 生成建议
   */
  private generateRecommendations(enhancedFindings: EnhancedFinding[]): string[] {
    const recommendations: string[] = [];

    // 基于严重性的建议
    const criticalFindings = enhancedFindings.filter(f => f.severity === 'ERROR');
    if (criticalFindings.length > 0) {
      recommendations.push(`Address ${criticalFindings.length} critical issues immediately`);
    }

    // 基于模式频率的建议
    const ruleCounts = this.groupByRule(enhancedFindings);
    const topRule = Object.entries(ruleCounts).sort(([, a], [, b]) => b.length - a.length)[0];
    if (topRule && topRule[1].length > 5) {
      recommendations.push(`Focus on fixing ${topRule[0]} - appears ${topRule[1].length} times`);
    }

    // 基于上下文的建议
    const hasFixExamples = enhancedFindings.some(
      f => f.vectorContext?.fixExamples && f.vectorContext.fixExamples.length > 0
    );
    if (hasFixExamples) {
      recommendations.push('Use available fix examples to speed up remediation');
    }

    return recommendations;
  }

  /**
   * 分析趋势
   */
  private analyzeTrends(enhancedFindings: EnhancedFinding[]): any {
    // 这里可以分析历史趋势，暂时返回基础统计
    return {
      totalFindings: enhancedFindings.length,
      severityDistribution: this.groupBySeverity(enhancedFindings),
      fileDistribution: this.groupByFile(enhancedFindings),
    };
  }

  /**
   * 创建基础报告（当融合失败时）
   */
  private createBasicReport(findings: SemgrepFinding[]): FusionReport {
    return {
      summary: {
        totalFindings: findings.length,
        bySeverity: this.groupBySeverity(findings),
        topRules: [],
      },
      findings: findings.map(f => ({ ...f })),
      riskAssessment: {
        overallRisk: 'medium',
        criticalIssues: findings.filter(f => f.severity === 'ERROR').length,
        highRiskFiles: [],
        riskFactors: [],
      },
      recommendations: ['Review all findings manually'],
      trends: {
        totalFindings: findings.length,
        severityDistribution: this.groupBySeverity(findings),
        fileDistribution: this.groupByFile(findings),
      },
    };
  }

  /**
   * 按严重性分组
   */
  private groupBySeverity(findings: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();

    for (const finding of findings) {
      const severity = finding.severity || 'INFO';
      if (!groups.has(severity)) {
        groups.set(severity, []);
      }
      groups.get(severity)!.push(finding);
    }

    return groups;
  }

  /**
   * 按规则分组
   */
  private groupByRule(findings: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();

    for (const finding of findings) {
      const ruleId = finding.ruleId || 'unknown';
      if (!groups.has(ruleId)) {
        groups.set(ruleId, []);
      }
      groups.get(ruleId)!.push(finding);
    }

    return groups;
  }

  /**
   * 按文件分组
   */
  private groupByFile(findings: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();

    for (const finding of findings) {
      const file = finding.location.file || 'unknown';
      if (!groups.has(file)) {
        groups.set(file, []);
      }
      groups.get(file)!.push(finding);
    }

    return groups;
  }

  /**
   * 识别高风险文件
   */
  private identifyHighRiskFiles(findings: EnhancedFinding[]): string[] {
    const fileCounts = new Map<string, number>();

    for (const finding of findings) {
      if (finding.severity === 'ERROR') {
        const count = fileCounts.get(finding.location.file) || 0;
        fileCounts.set(finding.location.file, count + 1);
      }
    }

    return Array.from(fileCounts.entries())
      .filter(([, count]) => count >= 3)
      .map(([file]) => file);
  }

  /**
   * 计算整体风险
   */
  private calculateOverallRisk(criticalCount: number, totalCount: number): string {
    const ratio = criticalCount / totalCount;

    if (ratio > 0.2) return 'high';
    if (ratio > 0.1) return 'medium-high';
    if (ratio > 0.05) return 'medium';
    if (ratio > 0.01) return 'low-medium';
    return 'low';
  }

  /**
   * 识别风险因素
   */
  private identifyRiskFactors(findings: EnhancedFinding[]): string[] {
    const factors: string[] = [];

    const hasCritical = findings.some(f => f.severity === 'ERROR');
    if (hasCritical) factors.push('critical_issues');

    const hasMultipleRules = new Set(findings.map(f => f.ruleId)).size > 5;
    if (hasMultipleRules) factors.push('diverse_issues');

    const hasFixable = findings.some(f => f.fix);
    if (hasFixable) factors.push('fixable_issues');

    return factors;
  }
}

/**
 * 增强的发现项类型
 */
export interface EnhancedFinding extends SemgrepFinding {
  graphContext?: {
    relatedFiles?: string[];
    callGraph?: any;
    dependencies?: string[];
    similarPatterns?: any[];
  };

  vectorContext?: {
    similarCode?: any[];
    relatedDocs?: any[];
    fixExamples?: any[];
    contextSimilarity?: number;
  };
}

/**
 * 融合报告类型
 */
export interface FusionReport {
  summary: {
    totalFindings: number;
    bySeverity: Map<string, any[]>;
    topRules: Array<{ rule: string; count: number }>;
  };

  findings: EnhancedFinding[];

  riskAssessment: RiskAssessment;

  recommendations: string[];

  trends: any;
}

/**
 * 风险评估类型
 */
export interface RiskAssessment {
  overallRisk: string;
  criticalIssues: number;
  highRiskFiles: string[];
  riskFactors: string[];
}
