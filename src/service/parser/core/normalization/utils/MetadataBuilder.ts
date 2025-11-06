/**
 * 元数据构建器工具
 * 提供便捷的元数据构建和管理功能
 */

import { ExtensibleMetadata, MetadataBuilder as BaseMetadataBuilder } from '../types/ExtensibleMetadata';
import { RelationshipCategory, RelationshipType } from '../types/RelationshipTypes';

/**
 * 增强的元数据构建器
 * 扩展基础元数据构建器，提供更多便捷方法
 */
export class MetadataBuilder extends BaseMetadataBuilder {
  private processingStartTime: number = Date.now();

  /**
   * 设置处理开始时间
   */
  setProcessingStartTime(startTime: number): this {
    this.processingStartTime = startTime;
    return this;
  }

  /**
   * 自动设置性能元数据
   */
  autoSetPerformance(): this {
    const processingTime = Date.now() - this.processingStartTime;
    const memoryUsage = this.getMemoryUsage();

    return this.setPerformance({
      processingTime,
      memoryUsage,
      cacheHitRate: 0, // 将由外部设置
      nodeCount: 0, // 将由外部设置
      phase: 'normalization',
      timestamp: Date.now()
    });
  }

  /**
   * 获取内存使用情况
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    
    // 浏览器环境的近似估算
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    
    return 0;
  }

  /**
   * 从现有元数据创建构建器并保留所有字段
   */
  static fromComplete(metadata: ExtensibleMetadata): MetadataBuilder {
    const builder = new MetadataBuilder();
    builder.metadata = JSON.parse(JSON.stringify(metadata));
    return builder;
  }

  /**
   * 批量添加依赖项
   */
  addDependencies(dependencies: string[]): this {
    if (!this.metadata.dependencies) {
      this.metadata.dependencies = [];
    }
    this.metadata.dependencies.push(...dependencies);
    return this;
  }

  /**
   * 批量添加修饰符
   */
  addModifiers(modifiers: string[]): this {
    if (!this.metadata.modifiers) {
      this.metadata.modifiers = [];
    }
    this.metadata.modifiers.push(...modifiers);
    return this;
  }

  /**
   * 设置关系类别
   */
  setRelationshipCategory(category: RelationshipCategory): this {
    return this.addCustomField('relationshipCategory', category);
  }

  /**
   * 设置关系类型
   */
  setRelationshipType(type: RelationshipType): this {
    return this.addCustomField('relationshipType', type);
  }

  /**
   * 添加位置信息
   */
  setLocation(filePath: string, lineNumber: number, columnNumber: number): this {
    return this.addCustomField('location', {
      filePath,
      lineNumber,
      columnNumber
    });
  }

  /**
   * 添加范围信息
   */
  setRange(startLine: number, endLine: number, startColumn: number = 0, endColumn: number = 0): this {
    return this.addCustomField('range', {
      startLine,
      endLine,
      startColumn,
      endColumn
    });
  }

  /**
   * 添加代码片段
   */
  setCodeSnippet(code: string, maxLines: number = 10): this {
    const lines = code.split('\n');
    const snippet = lines.slice(0, maxLines).join('\n');
    return this.addCustomField('codeSnippet', snippet);
  }

  /**
   * 添加标签
   */
  addTag(tag: string): this {
    if (!this.metadata.tags) {
      this.metadata.tags = [];
    }
    this.metadata.tags.push(tag);
    return this;
  }

  /**
   * 批量添加标签
   */
  addTags(tags: string[]): this {
    if (!this.metadata.tags) {
      this.metadata.tags = [];
    }
    this.metadata.tags.push(...tags);
    return this;
  }

  /**
   * 添加标记
   */
  setFlag(flag: string, value: boolean = true): this {
    if (!this.metadata.flags) {
      this.metadata.flags = {};
    }
    this.metadata.flags[flag] = value;
    return this;
  }

  /**
   * 添加计数器
   */
  incrementCounter(counterName: string, increment: number = 1): this {
    if (!this.metadata.counters) {
      this.metadata.counters = {};
    }
    this.metadata.counters[counterName] = (this.metadata.counters[counterName] || 0) + increment;
    return this;
  }

  /**
   * 设置计数器
   */
  setCounter(counterName: string, value: number): this {
    if (!this.metadata.counters) {
      this.metadata.counters = {};
    }
    this.metadata.counters[counterName] = value;
    return this;
  }

  /**
   * 添加时间戳
   */
  setTimestamp(timestampName: string, timestamp: number = Date.now()): this {
    if (!this.metadata.timestamps) {
      this.metadata.timestamps = {};
    }
    this.metadata.timestamps[timestampName] = timestamp;
    return this;
  }

  /**
   * 添加度量值
   */
  setMetric(metricName: string, value: number, unit?: string): this {
    if (!this.metadata.metrics) {
      this.metadata.metrics = {};
    }
    this.metadata.metrics[metricName] = { value, unit };
    return this;
  }

  /**
   * 添加错误信息
   */
  setError(error: Error | string, context?: any): this {
    const errorInfo = {
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'string' ? undefined : error.stack,
      context,
      timestamp: Date.now()
    };
    
    return this.addCustomField('error', errorInfo);
  }

  /**
   * 添加警告信息
   */
  setWarning(message: string, context?: any): this {
    if (!this.metadata.warnings) {
      this.metadata.warnings = [];
    }
    
    this.metadata.warnings.push({
      message,
      context,
      timestamp: Date.now()
    });
    
    return this;
  }

  /**
   * 批量添加警告信息
   */
  addWarnings(warnings: Array<{ message: string; context?: any }>): this {
    if (!this.metadata.warnings) {
      this.metadata.warnings = [];
    }
    
    for (const warning of warnings) {
      this.metadata.warnings.push({
        ...warning,
        timestamp: Date.now()
      });
    }
    
    return this;
  }

  /**
   * 设置版本信息
   */
  setVersion(version: string): this {
    return this.addCustomField('version', version);
  }

  /**
   * 设置作者信息
   */
  setAuthor(author: string): this {
    return this.addCustomField('author', author);
  }

  /**
   * 添加来源信息
   */
  setSource(source: string, version?: string): this {
    return this.addCustomField('source', { name: source, version });
  }

  /**
   * 设置许可证信息
   */
  setLicense(license: string): this {
    return this.addCustomField('license', license);
  }

  /**
   * 添加配置信息
   */
  setConfig(config: Record<string, any>): this {
    return this.addCustomField('config', config);
  }

  /**
   * 添加环境信息
   */
  setEnvironment(environment: string): this {
    return this.addCustomField('environment', environment);
  }

  /**
   * 添加构建信息
   */
  setBuildInfo(buildInfo: { buildNumber?: string; buildDate?: string; commitHash?: string }): this {
    return this.addCustomField('buildInfo', buildInfo);
  }

  /**
   * 添加验证结果
   */
  setValidationResult(isValid: boolean, errors?: string[], warnings?: string[]): this {
    return this.addCustomField('validation', {
      isValid,
      errors: errors || [],
      warnings: warnings || [],
      timestamp: Date.now()
    });
  }

  /**
   * 添加处理状态
   */
  setProcessingStatus(status: 'pending' | 'processing' | 'completed' | 'failed'): this {
    return this.addCustomField('processingStatus', status);
  }

  /**
   * 添加处理阶段
   */
  setProcessingPhase(phase: string): this {
    return this.addCustomField('processingPhase', phase);
  }

  /**
   * 添加处理进度
   */
  setProcessingProgress(current: number, total: number): this {
    return this.addCustomField('processingProgress', {
      current,
      total,
      percentage: total > 0 ? (current / total) * 100 : 0
    });
  }

  /**
   * 添加质量指标
   */
  setQualityMetrics(metrics: {
    maintainabilityIndex?: number;
    cyclomaticComplexity?: number;
    codeSmells?: number;
    technicalDebt?: number;
    testCoverage?: number;
  }): this {
    return this.addCustomField('qualityMetrics', metrics);
  }

  /**
   * 添加安全指标
   */
  setSecurityMetrics(metrics: {
    vulnerabilities?: number;
    securityScore?: number;
    sensitiveDataExposure?: number;
  }): this {
    return this.addCustomField('securityMetrics', metrics);
  }

  /**
   * 添加性能指标
   */
  setPerformanceMetrics(metrics: {
    responseTime?: number;
    throughput?: number;
    cpuUsage?: number;
    memoryUsage?: number;
  }): this {
    return this.addCustomField('performanceMetrics', metrics);
  }

  /**
   * 克隆构建器
   */
  clone(): MetadataBuilder {
    const cloned = new MetadataBuilder();
    cloned.metadata = JSON.parse(JSON.stringify(this.metadata));
    cloned.processingStartTime = this.processingStartTime;
    return cloned;
  }

  /**
   * 合并另一个构建器的元数据
   */
  merge(other: MetadataBuilder): this {
    const otherMetadata = other.build();
    
    // 合并数组字段
    const arrayFields = [
      'dependencies', 'modifiers', 'relationships', 'symbols',
      'annotations', 'calls', 'creations', 'dataFlows', 'controlFlows',
      'lifecycles', 'concurrencies', 'inheritances', 'references',
      'tags', 'warnings'
    ];

    for (const field of arrayFields) {
      if (otherMetadata[field] && Array.isArray(otherMetadata[field])) {
        if (!this.metadata[field]) {
          this.metadata[field] = [];
        }
        (this.metadata[field] as any[]).push(...otherMetadata[field]);
      }
    }

    // 合并对象字段
    const objectFields = [
      'flags', 'counters', 'timestamps', 'metrics', 'qualityMetrics',
      'securityMetrics', 'performanceMetrics'
    ];

    for (const field of objectFields) {
      if (otherMetadata[field] && typeof otherMetadata[field] === 'object') {
        if (!this.metadata[field]) {
          this.metadata[field] = {};
        }
        Object.assign(this.metadata[field], otherMetadata[field]);
      }
    }

    // 合并其他字段
    for (const key in otherMetadata) {
      if (!arrayFields.includes(key) && !objectFields.includes(key) && 
          otherMetadata[key] !== undefined && this.metadata[key] === undefined) {
        this.metadata[key] = otherMetadata[key];
      }
    }

    return this;
  }

  /**
   * 过滤元数据
   */
  filter(predicate: (key: string, value: any) => boolean): this {
    const filtered: ExtensibleMetadata = {
      language: this.metadata.language,
      complexity: this.metadata.complexity,
      dependencies: this.metadata.dependencies,
      modifiers: this.metadata.modifiers
    };

    for (const key in this.metadata) {
      if (predicate(key, this.metadata[key])) {
        filtered[key] = this.metadata[key];
      }
    }

    this.metadata = filtered;
    return this;
  }

  /**
   * 选择特定字段
   */
  select(fields: string[]): this {
    return this.filter((key) => fields.includes(key));
  }

  /**
   * 排除特定字段
   */
  exclude(fields: string[]): this {
    return this.filter((key) => !fields.includes(key));
  }

  /**
   * 转换为JSON字符串
   */
  toJSON(indent?: number): string {
    return JSON.stringify(this.metadata, null, indent);
  }

  /**
   * 从JSON字符串创建构建器
   */
  static fromJSON(jsonString: string): MetadataBuilder {
    try {
      const metadata = JSON.parse(jsonString);
      return MetadataBuilder.fromComplete(metadata);
    } catch (error) {
      throw new Error(`Failed to parse JSON: ${error}`);
    }
  }

  /**
   * 验证元数据
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.metadata.language) {
      errors.push('Language is required');
    }

    if (typeof this.metadata.complexity !== 'number' || this.metadata.complexity < 1) {
      errors.push('Complexity must be a number greater than or equal to 1');
    }

    if (!Array.isArray(this.metadata.dependencies)) {
      errors.push('Dependencies must be an array');
    }

    if (!Array.isArray(this.metadata.modifiers)) {
      errors.push('Modifiers must be an array');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 获取元数据摘要
   */
  getSummary(): {
    fieldCount: number;
    arrayFieldCount: number;
    objectFieldCount: number;
    totalArrayItems: number;
    estimatedSize: number;
  } {
    let fieldCount = 0;
    let arrayFieldCount = 0;
    let objectFieldCount = 0;
    let totalArrayItems = 0;

    for (const key in this.metadata) {
      fieldCount++;
      const value = this.metadata[key];
      
      if (Array.isArray(value)) {
        arrayFieldCount++;
        totalArrayItems += value.length;
      } else if (typeof value === 'object' && value !== null) {
        objectFieldCount++;
      }
    }

    const estimatedSize = JSON.stringify(this.metadata).length;

    return {
      fieldCount,
      arrayFieldCount,
      objectFieldCount,
      totalArrayItems,
      estimatedSize
    };
  }
}

/**
 * 元数据工厂类
 */
export class MetadataFactory {
  /**
   * 创建基础元数据
   */
  static createBasic(language: string, complexity: number = 1): MetadataBuilder {
    return new MetadataBuilder()
      .setLanguage(language)
      .setComplexity(complexity);
  }

  /**
   * 创建函数元数据
   */
  static createFunction(
    name: string,
    language: string,
    filePath: string,
    startLine: number,
    parameters: string[] = [],
    returnType?: string
  ): MetadataBuilder {
    return new MetadataBuilder()
      .setLanguage(language)
      .setComplexity(1)
      .addModifier('function')
      .setLocation(filePath, startLine, 0)
      .addCustomField('functionName', name)
      .addCustomField('parameters', parameters)
      .addCustomField('returnType', returnType);
  }

  /**
   * 创建类元数据
   */
  static createClass(
    name: string,
    language: string,
    filePath: string,
    startLine: number,
    methods: string[] = [],
    properties: string[] = []
  ): MetadataBuilder {
    return new MetadataBuilder()
      .setLanguage(language)
      .setComplexity(1)
      .addModifier('class')
      .setLocation(filePath, startLine, 0)
      .addCustomField('className', name)
      .addCustomField('methods', methods)
      .addCustomField('properties', properties);
  }

  /**
   * 创建错误元数据
   */
  static createError(
    error: Error | string,
    language: string,
    filePath: string,
    context?: any
  ): MetadataBuilder {
    return new MetadataBuilder()
      .setLanguage(language)
      .setComplexity(1)
      .setError(error, context)
      .setLocation(filePath, 0, 0)
      .setProcessingStatus('failed');
  }

  /**
   * 创建性能元数据
   */
  static createPerformance(
    processingTime: number,
    memoryUsage: number,
    nodeCount: number,
    cacheHitRate: number = 0
  ): MetadataBuilder {
    return new MetadataBuilder()
      .setLanguage('performance')
      .setComplexity(1)
      .setPerformance({
        processingTime,
        memoryUsage,
        cacheHitRate,
        nodeCount,
        phase: 'performance_measurement',
        timestamp: Date.now()
      });
  }
}