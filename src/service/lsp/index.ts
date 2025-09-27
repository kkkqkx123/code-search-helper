// LSP服务入口文件
export {
  LSPClient,
  LSPClientConfig,
  LSPMessage,
  LSPDiagnostic,
  LSPSymbol,
  LSPError,
} from './LSPClient';
export { LSPClientPool, PoolConfig, PooledClient } from './LSPClientPool';
export {
  LanguageServerRegistry,
  LanguageServerConfig,
  ProjectLanguage,
} from './LanguageServerRegistry';
export {
  LSPErrorHandler,
  ErrorHandlerConfig,
  ErrorContext,
  ErrorAction,
  globalErrorHandler,
} from './LSPErrorHandler';
export { LSPManager, LSPManagerConfig, LSPDiagnosticsResult, LSPSymbolsResult } from './LSPManager';

// 工具函数
export * from './utils';

// 创建默认实例
import { LSPManager } from './LSPManager';

export const lspManager = LSPManager.getInstance();

// 快捷访问函数
export async function initializeLSP(workspaceRoot: string): Promise<boolean> {
  return lspManager.initialize(workspaceRoot);
}

export async function getLSPDiagnostics(filePath: string, content?: string) {
  return lspManager.getDiagnostics(filePath, content);
}

export async function getLSPSymbols(filePath: string, content?: string) {
  return lspManager.getSymbols(filePath, content);
}

export function getLSPHealthStatus() {
  return lspManager.getHealthStatus();
}

export function getLSPStats() {
  return lspManager.getStats();
}

export function isLSPAvailable(filePath: string): boolean {
  return lspManager.isLSPAvailable(filePath);
}
