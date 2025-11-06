/**
 * 符号表管理器
 * 管理多个文件的符号表，提供跨文件符号解析功能
 */

import { SymbolTable, SymbolInfo } from '../types';

/**
 * 符号表管理器配置接口
 */
export interface SymbolTableManagerConfig {
  /** 是否启用缓存 */
  enableCache?: boolean;
  /** 缓存大小 */
  cacheSize?: number;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** 符号表过期时间（毫秒） */
  symbolTableTTL?: number;
}

/**
 * 符号解析结果接口
 */
export interface SymbolResolutionResult {
  /** 符号信息 */
  symbol: SymbolInfo | null;
  /** 解析路径 */
  resolutionPath: string[];
  /** 是否为导入符号 */
  isImported: boolean;
  /** 解析时间（毫秒） */
  resolutionTime: number;
}

/**
 * 符号表统计信息接口
 */
export interface SymbolTableStats {
  /** 文件数量 */
  fileCount: number;
  /** 总符号数量 */
  totalSymbols: number;
  /** 按类型分组的符号数量 */
  symbolsByType: Record<string, number>;
  /** 按作用域分组的符号数量 */
  symbolsByScope: Record<string, number>;
  /** 缓存统计 */
  cacheStats: {
    size: number;
    hitRate: number;
    hits: number;
    misses: number;
  };
}

/**
 * 符号表管理器
 */
export class SymbolTableManager {
  private symbolTables: Map<string, SymbolTable> = new Map();
  private config: SymbolTableManagerConfig;
  private cache: Map<string, SymbolResolutionResult> = new Map();
  private cacheStats: { hits: number; misses: number } = { hits: 0, misses: 0 };
  private debugMode: boolean;

  constructor(config: SymbolTableManagerConfig = {}) {
    this.config = {
      enableCache: config.enableCache ?? true,
      cacheSize: config.cacheSize ?? 1000,
      debug: config.debug ?? false,
      symbolTableTTL: config.symbolTableTTL ?? 300000 // 5分钟
    };
    this.debugMode = this.config.debug ?? false;
  }

  /**
   * 创建符号表
   */
  createSymbolTable(filePath: string): SymbolTable {
    const symbolTable: SymbolTable = {
      filePath,
      globalScope: {
        symbols: new Map()
      },
      imports: new Map()
    };

    this.symbolTables.set(filePath, symbolTable);
    this.logDebug(`Symbol table created for file: ${filePath}`);

    return symbolTable;
  }

  /**
   * 获取符号表
   */
  getSymbolTable(filePath: string): SymbolTable | undefined {
    return this.symbolTables.get(filePath);
  }

  /**
   * 更新符号表
   */
  updateSymbolTable(filePath: string, symbols: SymbolInfo[]): void {
    let symbolTable = this.symbolTables.get(filePath);

    if (!symbolTable) {
      symbolTable = this.createSymbolTable(filePath);
    }

    // 清空现有符号
    symbolTable.globalScope.symbols.clear();

    // 添加新符号
    for (const symbol of symbols) {
      symbolTable.globalScope.symbols.set(symbol.name, symbol);
    }

    // 清空相关缓存
    this.invalidateCacheForFile(filePath);

    this.logDebug(`Symbol table updated for file: ${filePath}`, {
      symbolCount: symbols.length
    });
  }

  /**
   * 添加符号
   */
  addSymbol(filePath: string, symbol: SymbolInfo): void {
    let symbolTable = this.symbolTables.get(filePath);

    if (!symbolTable) {
      symbolTable = this.createSymbolTable(filePath);
    }

    symbolTable.globalScope.symbols.set(symbol.name, symbol);

    // 清空相关缓存
    this.invalidateCacheForFile(filePath);

    this.logDebug(`Symbol added: ${symbol.name} in file: ${filePath}`);
  }

  /**
   * 移除符号
   */
  removeSymbol(filePath: string, symbolName: string): boolean {
    const symbolTable = this.symbolTables.get(filePath);

    if (!symbolTable) {
      return false;
    }

    const removed = symbolTable.globalScope.symbols.delete(symbolName);

    if (removed) {
      // 清空相关缓存
      this.invalidateCacheForFile(filePath);
      this.logDebug(`Symbol removed: ${symbolName} in file: ${filePath}`);
    }

    return removed;
  }

  /**
   * 添加导入
   */
  addImport(filePath: string, alias: string, importPath: string): void {
    let symbolTable = this.symbolTables.get(filePath);

    if (!symbolTable) {
      symbolTable = this.createSymbolTable(filePath);
    }

    symbolTable.imports.set(alias, importPath);

    // 清空相关缓存
    this.invalidateCacheForFile(filePath);

    this.logDebug(`Import added: ${alias} -> ${importPath} in file: ${filePath}`);
  }

  /**
   * 解析符号
   */
  resolveSymbol(
    name: string,
    filePath: string,
    searchPaths: string[] = []
  ): SymbolResolutionResult {
    const startTime = Date.now();

    // 生成缓存键
    const cacheKey = `${name}:${filePath}:${searchPaths.join(',')}`;

    // 检查缓存
    if (this.config.enableCache && this.cache.has(cacheKey)) {
      this.cacheStats.hits++;
      const result = this.cache.get(cacheKey)!;
      this.logDebug(`Symbol resolution cache hit: ${name}`, {
        filePath,
        resolutionTime: Date.now() - startTime
      });
      return result;
    }

    this.cacheStats.misses++;

    // 执行解析
    const result = this.performSymbolResolution(name, filePath, searchPaths);
    result.resolutionTime = Date.now() - startTime;

    // 存储到缓存
    if (this.config.enableCache) {
      this.manageCacheSize();
      this.cache.set(cacheKey, result);
    }

    this.logDebug(`Symbol resolved: ${name}`, {
      filePath,
      found: !!result.symbol,
      resolutionTime: result.resolutionTime
    });

    return result;
  }

  /**
   * 执行符号解析
   */
  private performSymbolResolution(
    name: string,
    filePath: string,
    searchPaths: string[]
  ): SymbolResolutionResult {
    const resolutionPath: string[] = [];

    // 1. 在当前文件中查找
    const currentFileTable = this.symbolTables.get(filePath);
    if (currentFileTable) {
      const symbol = currentFileTable.globalScope.symbols.get(name);
      if (symbol) {
        resolutionPath.push(filePath);
        return {
          symbol,
          resolutionPath,
          isImported: false,
          resolutionTime: 0
        };
      }
    }

    // 2. 在导入的模块中查找
    if (currentFileTable) {
      for (const [alias, importPath] of currentFileTable.imports) {
        const importedTable = this.symbolTables.get(importPath);
        if (importedTable) {
          const symbol = importedTable.globalScope.symbols.get(name);
          if (symbol) {
            resolutionPath.push(filePath, importPath);
            return {
              symbol,
              resolutionPath,
              isImported: true,
              resolutionTime: 0
            };
          }
        }
      }
    }

    // 3. 在搜索路径中查找
    for (const searchPath of searchPaths) {
      const searchTable = this.symbolTables.get(searchPath);
      if (searchTable) {
        const symbol = searchTable.globalScope.symbols.get(name);
        if (symbol) {
          resolutionPath.push(searchPath);
          return {
            symbol,
            resolutionPath,
            isImported: true,
            resolutionTime: 0
          };
        }
      }
    }

    // 4. 全局搜索
    for (const [path, table] of this.symbolTables) {
      if (path !== filePath) {
        const symbol = table.globalScope.symbols.get(name);
        if (symbol) {
          resolutionPath.push(path);
          return {
            symbol,
            resolutionPath,
            isImported: true,
            resolutionTime: 0
          };
        }
      }
    }

    // 未找到符号
    return {
      symbol: null,
      resolutionPath,
      isImported: false,
      resolutionTime: 0
    };
  }

  /**
   * 查找符号的所有引用
   */
  findSymbolReferences(name: string): Array<{ filePath: string; symbol: SymbolInfo }> {
    const references: Array<{ filePath: string; symbol: SymbolInfo }> = [];

    for (const [filePath, table] of this.symbolTables) {
      const symbol = table.globalScope.symbols.get(name);
      if (symbol) {
        references.push({ filePath, symbol });
      }
    }

    return references;
  }

  /**
   * 按类型查找符号
   */
  findSymbolsByType(type: SymbolInfo['type']): Array<{ filePath: string; symbol: SymbolInfo }> {
    const results: Array<{ filePath: string; symbol: SymbolInfo }> = [];

    for (const [filePath, table] of this.symbolTables) {
      for (const symbol of table.globalScope.symbols.values()) {
        if (symbol.type === type) {
          results.push({ filePath, symbol });
        }
      }
    }

    return results;
  }

  /**
   * 按作用域查找符号
   */
  findSymbolsByScope(scope: SymbolInfo['scope']): Array<{ filePath: string; symbol: SymbolInfo }> {
    const results: Array<{ filePath: string; symbol: SymbolInfo }> = [];

    for (const [filePath, table] of this.symbolTables) {
      for (const symbol of table.globalScope.symbols.values()) {
        if (symbol.scope === scope) {
          results.push({ filePath, symbol });
        }
      }
    }

    return results;
  }

  /**
   * 获取文件的所有符号
   */
  getFileSymbols(filePath: string): SymbolInfo[] {
    const table = this.symbolTables.get(filePath);
    return table ? Array.from(table.globalScope.symbols.values()) : [];
  }

  /**
   * 获取文件的所有导入
   */
  getFileImports(filePath: string): Map<string, string> {
    const table = this.symbolTables.get(filePath);
    return table ? new Map(table.imports) : new Map();
  }

  /**
   * 检查符号是否存在
   */
  hasSymbol(name: string, filePath?: string): boolean {
    if (filePath) {
      const table = this.symbolTables.get(filePath);
      return table ? table.globalScope.symbols.has(name) : false;
    }

    // 全局搜索
    for (const table of this.symbolTables.values()) {
      if (table.globalScope.symbols.has(name)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 删除符号表
   */
  removeSymbolTable(filePath: string): boolean {
    const removed = this.symbolTables.delete(filePath);

    if (removed) {
      // 清空相关缓存
      this.invalidateCacheForFile(filePath);
      this.logDebug(`Symbol table removed for file: ${filePath}`);
    }

    return removed;
  }

  /**
   * 清空所有符号表
   */
  clearAllSymbolTables(): void {
    this.symbolTables.clear();
    this.cache.clear();
    this.cacheStats = { hits: 0, misses: 0 };
    this.logDebug('All symbol tables cleared');
  }

  /**
   * 管理缓存大小
   */
  private manageCacheSize(): void {
    if (this.cache.size >= this.config.cacheSize!) {
      // 简单的LRU：删除第一个元素
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  /**
   * 清空文件的缓存
   */
  private invalidateCacheForFile(filePath: string): void {
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.includes(`:${filePath}:`) || key.endsWith(`:${filePath}`)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheStats = { hits: 0, misses: 0 };
    this.logDebug('Symbol resolution cache cleared');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; hitRate: number; hits: number; misses: number } {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? this.cacheStats.hits / total : 0;

    return {
      size: this.cache.size,
      hitRate,
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses
    };
  }

  /**
   * 获取统计信息
   */
  getStats(): SymbolTableStats {
    const symbolsByType: Record<string, number> = {};
    const symbolsByScope: Record<string, number> = {};
    let totalSymbols = 0;

    for (const table of this.symbolTables.values()) {
      for (const symbol of table.globalScope.symbols.values()) {
        totalSymbols++;
        symbolsByType[symbol.type] = (symbolsByType[symbol.type] || 0) + 1;
        symbolsByScope[symbol.scope] = (symbolsByScope[symbol.scope] || 0) + 1;
      }
    }

    return {
      fileCount: this.symbolTables.size,
      totalSymbols,
      symbolsByType,
      symbolsByScope,
      cacheStats: this.getCacheStats()
    };
  }

  /**
   * 导出符号表
   */
  exportSymbolTables(): Record<string, SymbolTable> {
    const exported: Record<string, SymbolTable> = {};

    for (const [filePath, table] of this.symbolTables) {
      exported[filePath] = {
        filePath: table.filePath,
        globalScope: {
          symbols: new Map(table.globalScope.symbols)
        },
        imports: new Map(table.imports)
      };
    }

    return exported;
  }

  /**
   * 导入符号表
   */
  importSymbolTables(exported: Record<string, SymbolTable>): void {
    this.clearAllSymbolTables();

    for (const [filePath, table] of Object.entries(exported)) {
      this.symbolTables.set(filePath, {
        filePath: table.filePath,
        globalScope: {
          symbols: new Map(table.globalScope.symbols)
        },
        imports: new Map(table.imports)
      });
    }

    this.logDebug('Symbol tables imported', {
      fileCount: Object.keys(exported).length
    });
  }

  /**
   * 验证符号表完整性
   */
  validateSymbolTables(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [filePath, table] of this.symbolTables) {
      // 检查文件路径一致性
      if (table.filePath !== filePath) {
        errors.push(`File path mismatch in symbol table: ${filePath} != ${table.filePath}`);
      }

      // 检查符号完整性
      for (const [symbolName, symbol] of table.globalScope.symbols) {
        if (!symbol.name) {
          errors.push(`Symbol missing name in file: ${filePath}`);
        }
        if (symbol.filePath !== filePath) {
          errors.push(`Symbol file path mismatch: ${symbolName} in ${filePath} but points to ${symbol.filePath}`);
        }
      }

      // 检查导入完整性
      for (const [alias, importPath] of table.imports) {
        if (!alias || !importPath) {
          errors.push(`Invalid import in file: ${filePath}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 记录调试信息
   */
  private logDebug(message: string, data?: any): void {
    if (this.debugMode) {
      console.log(`[SymbolTableManager] ${message}`, data);
    }
  }

  /**
   * 记录错误信息
   */
  private logError(message: string, error?: Error): void {
    console.error(`[SymbolTableManager] ${message}`, error);
  }

  /**
   * 记录警告信息
   */
  private logWarning(message: string, data?: any): void {
    console.warn(`[SymbolTableManager] ${message}`, data);
  }
}