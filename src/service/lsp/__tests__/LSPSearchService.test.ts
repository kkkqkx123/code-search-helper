import { Container } from 'inversify';
import { LSPSearchService } from '../LSPSearchService';
import { LSPManager } from '../LSPManager';
import { LoggerService } from '../../../core/LoggerService';
import { ErrorHandlerService } from '../../../core/ErrorHandlerService';
import { TYPES } from '../../../types';

// Mock implementations
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockErrorHandler = {
  handleError: jest.fn(),
};

const mockLSPManager = {
  getSymbols: jest.fn(),
  getDefinition: jest.fn(),
  getReferences: jest.fn(),
  getTypeDefinition: jest.fn(),
  getImplementation: jest.fn(),
  getWorkspaceSymbols: jest.fn(),
  initialize: jest.fn(),
};

describe('LSPSearchService', () => {
  let container: Container;
  let service: LSPSearchService;

  beforeEach(() => {
    container = new Container();

    // Bind mocks
    container.bind<LoggerService>(TYPES.LoggerService).toConstantValue(mockLogger as any);
    container
      .bind<ErrorHandlerService>(TYPES.ErrorHandlerService)
      .toConstantValue(mockErrorHandler as any);
    container.bind<LSPManager>(TYPES.LSPManager).toConstantValue(mockLSPManager as any);

    service = new LSPSearchService(
      mockLogger as any,
      mockErrorHandler as any,
      mockLSPManager as any
    );

    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should search for symbols successfully', async () => {
      const mockSymbols = [
        {
          name: 'calculateTotal',
          kind: 12, // SymbolKind.Function
          range: {
            start: { line: 10, character: 0 },
            end: { line: 20, character: 10 },
          },
          detail: 'function calculateTotal(items: Item[]): number',
          filePath: '/test/src/calculator.ts',
        },
      ];

      mockLSPManager.initialize.mockResolvedValue(true);
      mockLSPManager.getWorkspaceSymbols.mockResolvedValue(mockSymbols);

      const result = await service.search({
        query: 'calculateTotal',
        projectPath: '/test',
        searchTypes: ['symbol'],
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].name).toBe('calculateTotal');
      expect(result.results[0].type).toBe('symbol');
      expect(mockLSPManager.getWorkspaceSymbols).toHaveBeenCalledWith('calculateTotal', '/test');
    });

    it('should skip definitions search when not implemented', async () => {
      const result = await service.search({
        query: 'Item',
        projectPath: '/test',
        searchTypes: ['definition'],
      });

      expect(result.results).toHaveLength(0);
      expect(mockLSPManager.getDefinition).not.toHaveBeenCalled();
    });

    it('should skip references search when not implemented', async () => {
      const result = await service.search({
        query: 'Item',
        projectPath: '/test',
        searchTypes: ['reference'],
      });

      expect(result.results).toHaveLength(0);
      expect(mockLSPManager.getReferences).not.toHaveBeenCalled();
    });

    it('should handle empty results gracefully', async () => {
      mockLSPManager.initialize.mockResolvedValue(true);
      mockLSPManager.getWorkspaceSymbols.mockResolvedValue([]);
      mockLSPManager.getDefinition.mockResolvedValue([]);
      mockLSPManager.getReferences.mockResolvedValue([]);

      const result = await service.search({
        query: 'nonexistent',
        projectPath: '/test',
        searchTypes: ['symbol', 'definition', 'reference'],
      });

      expect(result.results).toHaveLength(0);
      expect(result.metrics.totalResults).toBe(0);
    });

    it('should handle LSP errors gracefully', async () => {
      mockLSPManager.initialize.mockResolvedValue(true);
      mockLSPManager.getWorkspaceSymbols.mockRejectedValue(new Error('LSP server not available'));

      const result = await service.search({
        query: 'test',
        projectPath: '/test',
        searchTypes: ['symbol'],
      });

      expect(result.results).toHaveLength(0);
      // 由于searchSymbols方法中的错误被捕获并记录为警告，不会触发错误处理器
      expect(mockErrorHandler.handleError).not.toHaveBeenCalled();
    });
  });
});
