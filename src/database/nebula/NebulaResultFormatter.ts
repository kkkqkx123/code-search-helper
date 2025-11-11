import { injectable, inject } from 'inversify';
import { NebulaQueryResult, ResultStats } from './NebulaTypes';
import { TYPES } from '../../types';

export interface FormatOptions {
  format?: 'json' | 'csv' | 'table' | 'raw';
  includeStats?: boolean;
  includeMetadata?: boolean;
  flatten?: boolean;
  maxRows?: number;
  dateFormat?: string;
}

export interface INebulaResultFormatter {
  formatResult(rawResult: any, options?: FormatOptions): NebulaQueryResult;
  formatError(error: Error, query?: string, options?: FormatOptions): NebulaQueryResult;
  formatBatchResults(results: any[], options?: FormatOptions): NebulaQueryResult[];
  toJSON(result: NebulaQueryResult, options?: FormatOptions): string;
  toCSV(result: NebulaQueryResult, options?: FormatOptions): string;
  toTable(result: NebulaQueryResult, options?: FormatOptions): string;
  normalizeData(data: any[]): any[];
  extractColumnNames(result: any): string[];
  calculateStats(result: any): ResultStats;
  setDefaultOptions(options: FormatOptions): void;
  getDefaultOptions(): FormatOptions;
}

@injectable()
export class NebulaResultFormatter implements INebulaResultFormatter {
  private defaultOptions: FormatOptions = {
    format: 'json',
    includeStats: true,
    includeMetadata: true,
    flatten: false,
    maxRows: 1000
  };

  formatResult(rawResult: any, options?: FormatOptions): NebulaQueryResult {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    try {
      // 验证输入
      this.validateInput(rawResult);

      // 标准化数据
      const normalizedData = this.normalizeData(rawResult.data || []);
      const normalizedRows = this.normalizeData(rawResult.rows || []);

      // 计算统计信息
      const stats = this.calculateStats(normalizedData);

      // 构建结果对象
      const result: NebulaQueryResult = {
        table: rawResult?.table || {},
        results: rawResult?.results || [],
        rows: normalizedRows,
        data: normalizedData,
        executionTime: rawResult?.executionTime || 0,
        timeCost: rawResult?.timeCost || 0,
        space: rawResult?.space,
        error: rawResult?.error,
        errorCode: rawResult?.code,
        errorDetails: rawResult?.errorDetails,
        stats: {
          rowCount: normalizedData.length,
          columnCount: this.extractColumnNames(rawResult).length,
          dataSize: this.calculateDataSize(normalizedData),
          processedTime: Date.now() - startTime
        }
      };

      // 应用格式选项
      return this.applyFormatOptions(result, mergedOptions);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.formatError(
        new Error(`Failed to format result: ${errorMessage}`),
        undefined,
        mergedOptions
      );
    }
  }

  formatError(error: Error, query?: string, options?: FormatOptions): NebulaQueryResult {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const errorResult: NebulaQueryResult = {
      table: {},
      results: [],
      rows: [],
      data: [],
      executionTime: 0,
      timeCost: 0,
      error: error.message,
      errorDetails: error.stack ? { stack: error.stack } : undefined,
      stats: {
        rowCount: 0,
        columnCount: 0,
        dataSize: 0,
        processedTime: 0
      }
    };

    if (query) {
      errorResult.query = query;
    }

    return this.applyFormatOptions(errorResult, mergedOptions);
  }

  formatBatchResults(results: any[], options?: FormatOptions): NebulaQueryResult[] {
    return results.map(result => this.formatResult(result, options));
  }

  private applyFormatOptions(result: NebulaQueryResult, options: FormatOptions): NebulaQueryResult {
    let formattedResult = { ...result };

    // 根据选项调整结果
    if (options.maxRows && result.data && result.data.length > options.maxRows) {
      formattedResult.data = result.data.slice(0, options.maxRows);
      if (formattedResult.stats) {
        formattedResult.stats.rowCount = options.maxRows;
      }
    }

    return formattedResult;
  }

  private validateInput(rawResult: any): void {
    if (!rawResult) {
      throw new Error('Raw result cannot be null or undefined');
    }
  }

  normalizeData(data: any[]): any[] {
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map(item => {
      // 处理各种数据格式
      if (typeof item === 'object' && item !== null) {
        return this.normalizeObject(item);
      }

      return item;
    });
  }

  private normalizeObject(obj: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      // 处理 Nebula 的特殊数据类型
      if (this.isNebulaSpecialType(value)) {
        normalized[key] = this.convertNebulaType(value);
      } else if (Array.isArray(value)) {
        normalized[key] = value.map(v => this.normalizeValue(v));
      } else if (typeof value === 'object' && value !== null) {
        normalized[key] = this.normalizeObject(value);
      } else {
        normalized[key] = this.normalizeValue(value);
      }
    }

    return normalized;
  }

  private normalizeValue(value: any): any {
    // 根据不同类型进行标准化
    if (value === null || value === undefined) {
      return value;
    }

    // 如果是日期类型，可以根据需要进行处理
    if (value instanceof Date) {
      return value.toISOString();
    }

    return value;
  }

  private isNebulaSpecialType(value: any): boolean {
    // 检查是否是 Nebula Graph 的特殊数据类型
    // 这里可以根据实际的 Nebula 数据类型进行判断
    return false; // 简化版本，可以根据需要实现
  }

  private convertNebulaType(value: any): any {
    // 转换 Nebula Graph 特殊数据类型
    return value; // 简化版本，可以根据需要实现
  }

  extractColumnNames(result: any): string[] {
    if (!result || !result.data || !Array.isArray(result.data) || result.data.length === 0) {
      return [];
    }

    const firstRow = result.data[0];
    if (typeof firstRow !== 'object' || firstRow === null) {
      return [];
    }

    return Object.keys(firstRow);
  }

  calculateStats(result: any[]): ResultStats {
    return {
      rowCount: result.length,
      columnCount: result.length > 0 ? Object.keys(result[0]).length : 0,
      dataSize: this.calculateDataSize(result),
      processedTime: 0 // 通常在格式化函数中计算
    };
  }

  private calculateDataSize(data: any[]): number {
    // 计算数据大小的简化版本
    return JSON.stringify(data).length;
  }

  toJSON(result: NebulaQueryResult, options?: FormatOptions): string {
    return JSON.stringify(result, null, 2);
  }

  toCSV(result: NebulaQueryResult, options?: FormatOptions): string {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const formattedResult = this.applyFormatOptions(result, mergedOptions);

    if (!formattedResult.data || formattedResult.data.length === 0) {
      return '';
    }

    const columns = this.extractColumnNames(formattedResult);
    let csv = columns.join(',') + '\n';

    for (const row of formattedResult.data) {
      const values = columns.map(column => {
        const value = row[column];
        return this.escapeCSVValue(value);
      });

      csv += values.join(',') + '\n';
    }

    return csv;
  }

  private escapeCSVValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    const stringValue = String(value);

    // 如果包含逗号、引号或换行符，需要转义
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  toTable(result: NebulaQueryResult, options?: FormatOptions): string {
    // 简单的表格格式化实现
    if (!result.data || result.data.length === 0) {
      return 'No data';
    }

    const columns = this.extractColumnNames(result);
    if (columns.length === 0) {
      return 'No columns';
    }

    // 创建表格头部
    let table = '┌' + columns.map(col => '─'.repeat(Math.max(col.length, 10))).join('┬') + '┐\n';
    table += '│' + columns.map(col => col.padEnd(Math.max(col.length, 10))).join('│') + '│\n';
    table += '├' + columns.map(col => '─'.repeat(Math.max(col.length, 10))).join('┼') + '┤\n';

    // 添加数据行
    for (const row of result.data) {
      const values = columns.map(col => {
        const value = row[col] !== undefined ? String(row[col]) : '';
        return value.padEnd(Math.max(col.length, 10)).substring(0, Math.max(col.length, 10));
      });
      table += '│' + values.join('│') + '│\n';
    }

    table += '└' + columns.map(col => '─'.repeat(Math.max(col.length, 10))).join('┴') + '┘\n';

    return table;
  }

  setDefaultOptions(options: FormatOptions): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  getDefaultOptions(): FormatOptions {
    return { ...this.defaultOptions };
  }
}