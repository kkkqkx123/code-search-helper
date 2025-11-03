import { SymbolResolver, SymbolType } from '../SymbolResolver';
import { TreeSitterService } from '../../../parser/core/parse/TreeSitterService';
import { LoggerService } from '../../../../utils/LoggerService';

describe('SymbolResolver', () => {
  let symbolResolver: SymbolResolver;
  let mockTreeSitterService: jest.Mocked<TreeSitterService>;
  let mockLoggerService: jest.Mocked<LoggerService>;

  beforeEach(() => {
    mockTreeSitterService = {
      findNodeByType: jest.fn(),
      getNodeText: jest.fn(),
      getNodeLocation: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    symbolResolver = new SymbolResolver(mockTreeSitterService, mockLoggerService);
  });

  describe('buildSymbolTable', () => {
    it('should create a symbol table for a file', async () => {
      const mockAST = {
        type: 'program',
        children: [
          {
            type: 'function_declaration',
            children: [
              { type: 'identifier', text: 'testFunction' }
            ]
          }
        ]
      } as any;

      mockTreeSitterService.findNodeByType.mockReturnValue([]);
      mockTreeSitterService.getNodeLocation.mockReturnValue({
        startLine: 1,
        startColumn: 0,
        endLine: 3,
        endColumn: 1
      });

      const symbolTable = await symbolResolver.buildSymbolTable('test.js', mockAST, 'javascript');

      expect(symbolTable).toBeDefined();
      expect(symbolTable.filePath).toBe('test.js');
      expect(symbolTable.globalScope).toBeDefined();
      expect(symbolTable.imports).toBeDefined();
      expect(mockLoggerService.info).toHaveBeenCalledWith('Building symbol table for test.js');
    });

    it('should handle unsupported languages gracefully', async () => {
      const mockAST = { type: 'program', children: [] } as any;

      const symbolTable = await symbolResolver.buildSymbolTable('test.unknown', mockAST, 'unknown');

      expect(symbolTable).toBeDefined();
      expect(symbolTable.globalScope.symbols.size).toBe(0);
    });
  });

  describe('resolveSymbol', () => {
    it('should resolve symbol from global scope', async () => {
      const mockAST = { type: 'program', children: [] } as any;
      const mockNode = { type: 'identifier', text: 'testFunction' } as any;

      // First build a symbol table
      await symbolResolver.buildSymbolTable('test.js', mockAST, 'javascript');
      
      // Manually add a symbol to test resolution
      const symbolTable = symbolResolver.getSymbolTable('test.js');
      if (symbolTable) {
        const testSymbol = {
          name: 'testFunction',
          type: SymbolType.FUNCTION,
          filePath: 'test.js',
          location: { startLine: 1, startColumn: 0, endLine: 3, endColumn: 1 }
        };
        symbolTable.globalScope.symbols.set('testFunction', testSymbol);
      }

      const resolvedSymbol = symbolResolver.resolveSymbol('testFunction', 'test.js', mockNode);

      expect(resolvedSymbol).toBeDefined();
      expect(resolvedSymbol?.name).toBe('testFunction');
      expect(resolvedSymbol?.type).toBe(SymbolType.FUNCTION);
    });

    it('should return null for non-existent symbols', async () => {
      const mockAST = { type: 'program', children: [] } as any;
      const mockNode = { type: 'identifier', text: 'nonExistent' } as any;

      await symbolResolver.buildSymbolTable('test.js', mockAST, 'javascript');

      const resolvedSymbol = symbolResolver.resolveSymbol('nonExistent', 'test.js', mockNode);

      expect(resolvedSymbol).toBeNull();
    });

    it('should return null for files without symbol tables', async () => {
      const mockNode = { type: 'identifier', text: 'testFunction' } as any;

      const resolvedSymbol = symbolResolver.resolveSymbol('testFunction', 'nonexistent.js', mockNode);

      expect(resolvedSymbol).toBeNull();
    });
  });

  describe('getSymbolTable', () => {
    it('should return existing symbol table', async () => {
      const mockAST = { type: 'program', children: [] } as any;

      await symbolResolver.buildSymbolTable('test.js', mockAST, 'javascript');
      const symbolTable = symbolResolver.getSymbolTable('test.js');

      expect(symbolTable).toBeDefined();
      expect(symbolTable?.filePath).toBe('test.js');
    });

    it('should return null for non-existent symbol table', () => {
      const symbolTable = symbolResolver.getSymbolTable('nonexistent.js');

      expect(symbolTable).toBeNull();
    });
  });
});