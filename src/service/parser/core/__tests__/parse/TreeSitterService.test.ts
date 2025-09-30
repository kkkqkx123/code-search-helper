import Parser from 'tree-sitter';
import { TreeSitterService } from '../../parse/TreeSitterService';
import { TreeSitterCoreService } from '../../parse/TreeSitterCoreService';

// Mock the dependency injection
jest.mock('../../parse/TreeSitterCoreService', () => {
  const originalModule = jest.requireActual('../../parse/TreeSitterCoreService');
  return {
    __esModule: true,
    ...originalModule,
    TreeSitterCoreService: jest.fn(() => ({
      getSupportedLanguages: jest.fn(() => []),
      detectLanguage: jest.fn(() => null),
      parseCode: jest.fn(() => Promise.resolve({ ast: {}, success: true, parseTime: 0 })),
      parseFile: jest.fn(() => Promise.resolve({ ast: {}, success: true, parseTime: 0 })),
      extractFunctions: jest.fn(() => []),
      extractClasses: jest.fn(() => []),
      extractImports: jest.fn(() => []),
      extractImportNodes: jest.fn(() => []),
      extractExports: jest.fn(() => []),
      isInitialized: jest.fn(() => true),
      getNodeText: jest.fn(() => ''),
      getNodeLocation: jest.fn(() => ({ startLine: 1, endLine: 1, startColumn: 1, endColumn: 1 })),
      getNodeName: jest.fn(() => ''),
      findNodeByType: jest.fn(() => []),
      queryTree: jest.fn(() => [])
    }))
  };
});

describe('TreeSitterService', () => {
  let treeSitterService: TreeSitterService;
  let mockCoreService: jest.Mocked<TreeSitterCoreService>;

  beforeEach(() => {
    // Since TreeSitterService uses dependency injection, we need to create a mock
    // For this test, we'll test the methods that simply delegate to the core service
    mockCoreService = new TreeSitterCoreService() as jest.Mocked<TreeSitterCoreService>;
    treeSitterService = new TreeSitterService(mockCoreService);
  });

  describe('Constructor', () => {
    it('should initialize with TreeSitterCoreService', () => {
      expect(treeSitterService).toBeInstanceOf(TreeSitterService);
    });
  });

  describe('getSupportedLanguages', () => {
    it('should delegate to core service', () => {
      const mockLanguages = [{ name: 'TypeScript', supported: true, fileExtensions: ['.ts'], parser: {} }];
      (mockCoreService.getSupportedLanguages as jest.Mock).mockReturnValue(mockLanguages);

      const result = treeSitterService.getSupportedLanguages();
      expect(mockCoreService.getSupportedLanguages).toHaveBeenCalled();
      expect(result).toEqual(mockLanguages);
    });
  });

  describe('detectLanguage', () => {
    it('should delegate to core service', () => {
      const mockLanguage = { name: 'TypeScript', supported: true, fileExtensions: ['.ts'], parser: {} };
      (mockCoreService.detectLanguage as jest.Mock).mockReturnValue(mockLanguage);

      const result = treeSitterService.detectLanguage('test.ts');
      expect(mockCoreService.detectLanguage).toHaveBeenCalledWith('test.ts');
      expect(result).toEqual(mockLanguage);
    });
  });

  describe('parseCode', () => {
    it('should delegate to core service', async () => {
      const mockResult = { ast: {} as Parser.SyntaxNode, success: true, parseTime: 10 };
      (mockCoreService.parseCode as jest.Mock).mockResolvedValue(mockResult);

      const result = await treeSitterService.parseCode('test code', 'typescript');
      expect(mockCoreService.parseCode).toHaveBeenCalledWith('test code', 'typescript');
      expect(result).toEqual(mockResult);
    });
  });

  describe('parseFile', () => {
    it('should delegate to core service', async () => {
      const mockResult = { ast: {} as Parser.SyntaxNode, success: true, parseTime: 10 };
      (mockCoreService.parseFile as jest.Mock).mockResolvedValue(mockResult);

      const result = await treeSitterService.parseFile('test.ts', 'test code');
      expect(mockCoreService.parseFile).toHaveBeenCalledWith('test.ts', 'test code');
      expect(result).toEqual(mockResult);
    });
  });

  describe('extractFunctions', () => {
    it('should delegate to core service', () => {
      const mockNodes = [{} as Parser.SyntaxNode];
      (mockCoreService.extractFunctions as jest.Mock).mockReturnValue(mockNodes);

      const result = treeSitterService.extractFunctions({} as Parser.SyntaxNode);
      expect(mockCoreService.extractFunctions).toHaveBeenCalledWith({} as Parser.SyntaxNode);
      expect(result).toEqual(mockNodes);
    });
  });

  describe('extractClasses', () => {
    it('should delegate to core service', () => {
      const mockNodes = [{} as Parser.SyntaxNode];
      (mockCoreService.extractClasses as jest.Mock).mockReturnValue(mockNodes);

      const result = treeSitterService.extractClasses({} as Parser.SyntaxNode);
      expect(mockCoreService.extractClasses).toHaveBeenCalledWith({} as Parser.SyntaxNode);
      expect(result).toEqual(mockNodes);
    });
  });

  describe('extractImports', () => {
    it('should delegate to core service', () => {
      const mockImportNodes = [{} as Parser.SyntaxNode];
      (mockCoreService.extractImportNodes as jest.Mock).mockReturnValue(mockImportNodes);

      const result = treeSitterService.extractImports({} as Parser.SyntaxNode, 'source code');
      expect(mockCoreService.extractImportNodes).toHaveBeenCalledWith({} as Parser.SyntaxNode);
      expect(result).toEqual(mockImportNodes);
    });

    it('should work without source code', () => {
      const mockImportNodes: any[] = [];
      (mockCoreService.extractImportNodes as jest.Mock).mockReturnValue(mockImportNodes);

      const result = treeSitterService.extractImports({} as Parser.SyntaxNode);
      expect(mockCoreService.extractImportNodes).toHaveBeenCalledWith({} as Parser.SyntaxNode);
      expect(result).toEqual(mockImportNodes);
    });
  });

  describe('extractExports', () => {
    it('should delegate to core service', () => {
      const mockExports = ['export { test };'];
      (mockCoreService.extractExports as jest.Mock).mockReturnValue(mockExports);

      const result = treeSitterService.extractExports({} as Parser.SyntaxNode, 'source code');
      expect(mockCoreService.extractExports).toHaveBeenCalledWith({} as Parser.SyntaxNode, 'source code');
      expect(result).toEqual(mockExports);
    });

    it('should work without source code', () => {
      const mockExports: any[] = [];
      (mockCoreService.extractExports as jest.Mock).mockReturnValue(mockExports);

      const result = treeSitterService.extractExports({} as Parser.SyntaxNode);
      expect(mockCoreService.extractExports).toHaveBeenCalledWith({} as Parser.SyntaxNode, undefined);
      expect(result).toEqual(mockExports);
    });
  });

  describe('extractSnippets', () => {
    it('should return empty array', () => {
      const result = treeSitterService.extractSnippets({} as Parser.SyntaxNode, 'source code');
      expect(result).toEqual([]);
    });
  });

  describe('isInitialized', () => {
    it('should delegate to core service', () => {
      (mockCoreService.isInitialized as jest.Mock).mockReturnValue(true);

      const result = treeSitterService.isInitialized();
      expect(mockCoreService.isInitialized).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('getNodeText', () => {
    it('should delegate to core service', () => {
      (mockCoreService.getNodeText as jest.Mock).mockReturnValue('node text');

      const result = treeSitterService.getNodeText({} as Parser.SyntaxNode, 'source code');
      expect(mockCoreService.getNodeText).toHaveBeenCalledWith({} as Parser.SyntaxNode, 'source code');
      expect(result).toBe('node text');
    });
  });

  describe('getNodeLocation', () => {
    it('should delegate to core service', () => {
      const mockLocation = { startLine: 1, endLine: 2, startColumn: 1, endColumn: 5 };
      (mockCoreService.getNodeLocation as jest.Mock).mockReturnValue(mockLocation);

      const result = treeSitterService.getNodeLocation({} as Parser.SyntaxNode);
      expect(mockCoreService.getNodeLocation).toHaveBeenCalledWith({} as Parser.SyntaxNode);
      expect(result).toEqual(mockLocation);
    });
  });

  describe('findNodeByType', () => {
    it('should delegate to core service', () => {
      const mockNodes = [{} as Parser.SyntaxNode];
      (mockCoreService.findNodeByType as jest.Mock).mockReturnValue(mockNodes);

      const result = treeSitterService.findNodeByType({} as Parser.SyntaxNode, 'function_declaration');
      expect(mockCoreService.findNodeByType).toHaveBeenCalledWith({} as Parser.SyntaxNode, 'function_declaration');
      expect(result).toEqual(mockNodes);
    });
  });

  describe('queryTree', () => {
    it('should delegate to core service', () => {
      const mockResult = [{ captures: [] }];
      (mockCoreService.queryTree as jest.Mock).mockReturnValue(mockResult);

      const result = treeSitterService.queryTree({} as Parser.SyntaxNode, '(function_declaration) @function');
      expect(mockCoreService.queryTree).toHaveBeenCalledWith({} as Parser.SyntaxNode, '(function_declaration) @function');
      expect(result).toEqual(mockResult);
    });
  });
});