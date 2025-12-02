import { CodeStructureService } from '../CodeStructureService';
import { TreeSitterCoreService } from '../../parse/TreeSitterCoreService';

// Mock TreeSitterCoreService
jest.mock('../../parse/TreeSitterCoreService');

describe('CodeStructureService', () => {
  let codeStructureService: CodeStructureService;
  let mockCoreService: jest.Mocked<TreeSitterCoreService>;

  beforeEach(() => {
    // 创建mock的TreeSitterCoreService实例
    mockCoreService = new TreeSitterCoreService() as jest.Mocked<TreeSitterCoreService>;
    
    // 创建CodeStructureService实例
    codeStructureService = new CodeStructureService(mockCoreService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('extractFunctions', () => {
    it('should call coreService.findNodeByTypeAsync with correct parameters', async () => {
      // 准备mock数据
      const mockAst: any = {};
      const mockResult: any[] = [];
      mockCoreService.findNodeByTypeAsync = jest.fn().mockResolvedValue(mockResult);

      // 执行测试
      const result = await codeStructureService.extractFunctions(mockAst, 'javascript');

      // 验证结果
      expect(mockCoreService.findNodeByTypeAsync).toHaveBeenCalledWith(mockAst, 'functions');
      expect(result).toBe(mockResult);
    });

    it('should handle language detection fallback', async () => {
      // 准备mock数据
      const mockAst: any = {};
      const mockResult: any[] = [];
      mockCoreService.findNodeByTypeAsync = jest.fn().mockResolvedValue(mockResult);

      // 执行测试
      const result = await codeStructureService.extractFunctions(mockAst);

      // 验证结果
      expect(mockCoreService.findNodeByTypeAsync).toHaveBeenCalledWith(mockAst, 'functions');
      expect(result).toBe(mockResult);
    });
  });

  describe('extractClasses', () => {
    it('should call coreService.findNodeByTypeAsync with correct parameters', async () => {
      // 准备mock数据
      const mockAst: any = {};
      const mockResult: any[] = [];
      mockCoreService.findNodeByTypeAsync = jest.fn().mockResolvedValue(mockResult);

      // 执行测试
      const result = await codeStructureService.extractClasses(mockAst, 'javascript');

      // 验证结果
      expect(mockCoreService.findNodeByTypeAsync).toHaveBeenCalledWith(mockAst, 'classes');
      expect(result).toBe(mockResult);
    });
  });

  describe('extractImports', () => {
    it('should call coreService.findNodeByTypeAsync with correct parameters', async () => {
      // 准备mock数据
      const mockAst: any = {};
      const mockResult: any[] = [];
      mockCoreService.findNodeByTypeAsync = jest.fn().mockResolvedValue(mockResult);

      // 执行测试
      const result = await codeStructureService.extractImports(mockAst, 'javascript');

      // 验证结果
      expect(mockCoreService.findNodeByTypeAsync).toHaveBeenCalledWith(mockAst, 'imports');
      expect(result).toBe(mockResult);
    });
  });

  describe('extractExports', () => {
    it('should call coreService.findNodeByTypeAsync with correct parameters', async () => {
      // 准备mock数据
      const mockAst: any = {};
      const mockResult: any[] = [];
      mockCoreService.findNodeByTypeAsync = jest.fn().mockResolvedValue(mockResult);

      // 执行测试
      const result = await codeStructureService.extractExports(mockAst, 'javascript');

      // 验证结果
      expect(mockCoreService.findNodeByTypeAsync).toHaveBeenCalledWith(mockAst, 'exports');
      expect(result).toBe(mockResult);
    });
  });

  describe('extractImportNodes', () => {
    it('should call coreService.findNodeByType with correct parameters', () => {
      // 准备mock数据
      const mockAst: any = {};
      const mockResult: any[] = [];
      mockCoreService.findNodeByType = jest.fn().mockReturnValue(mockResult);

      // 执行测试
      const result = codeStructureService.extractImportNodes(mockAst);

      // 验证结果
      expect(mockCoreService.findNodeByType).toHaveBeenCalledWith(mockAst, 'import');
      expect(result).toBe(mockResult);
    });
  });

  describe('extractImportNodesAsync', () => {
    it('should call coreService.findNodeByTypeAsync with correct parameters', async () => {
      // 准备mock数据
      const mockAst: any = {};
      const mockResult: any[] = [];
      mockCoreService.findNodeByTypeAsync = jest.fn().mockResolvedValue(mockResult);

      // 执行测试
      const result = await codeStructureService.extractImportNodesAsync(mockAst);

      // 验证结果
      expect(mockCoreService.findNodeByTypeAsync).toHaveBeenCalledWith(mockAst, 'import');
      expect(result).toBe(mockResult);
    });
  });
});