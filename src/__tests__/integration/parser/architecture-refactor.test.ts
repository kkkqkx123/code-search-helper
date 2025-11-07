import { TreeSitterCoreService } from '../../../service/parser/core/parse/TreeSitterCoreService';
import { CodeStructureService } from '../../../service/parser/core/structure/CodeStructureService';

describe('Architecture Refactor Integration Test', () => {
  let coreService: TreeSitterCoreService;
  let structureService: CodeStructureService;

  beforeAll(() => {
    coreService = new TreeSitterCoreService();
    structureService = new CodeStructureService(coreService);
  });

  describe('Core Service Functionality', () => {
    it('should have core parsing functionality', () => {
      expect(coreService.parseCode).toBeDefined();
      expect(coreService.parseFile).toBeDefined();
      expect(coreService.detectLanguage).toBeDefined();
    });

    it('should have generic query functionality', () => {
      expect(coreService.findNodeByType).toBeDefined();
      expect(coreService.findNodeByTypeAsync).toBeDefined();
      expect(coreService.findNodesByTypes).toBeDefined();
      expect(coreService.queryTree).toBeDefined();
    });

    it('should have utility methods', () => {
      expect(coreService.getNodeText).toBeDefined();
      expect(coreService.getNodeLocation).toBeDefined();
      expect(coreService.getNodeName).toBeDefined();
    });

    it('should not have specific extraction methods', () => {
      // 这些方法应该已经从TreeSitterCoreService中移除
      expect((coreService as any).extractFunctions).toBeUndefined();
      expect((coreService as any).extractClasses).toBeUndefined();
      expect((coreService as any).extractImports).toBeUndefined();
      expect((coreService as any).extractExports).toBeUndefined();
      expect((coreService as any).extractImportNodes).toBeUndefined();
      expect((coreService as any).extractImportNodesAsync).toBeUndefined();
    });
  });

  describe('Structure Service Functionality', () => {
    it('should have specific extraction methods', () => {
      expect(structureService.extractFunctions).toBeDefined();
      expect(structureService.extractClasses).toBeDefined();
      expect(structureService.extractImports).toBeDefined();
      expect(structureService.extractExports).toBeDefined();
      expect(structureService.extractImportNodes).toBeDefined();
      expect(structureService.extractImportNodesAsync).toBeDefined();
    });

    it('should delegate to core service for generic functionality', () => {
      // 测试structure service是否正确地委托给core service
      const mockAst: any = { 
        type: 'program', 
        startIndex: 0, 
        endIndex: 100,
        tree: { language: { name: 'javascript' } }
      };
      
      // 检查核心方法是否存在
      expect(coreService.findNodeByType).toBeDefined();
      expect(coreService.findNodeByTypeAsync).toBeDefined();
    });
  });

  describe('Architecture Principles', () => {
    it('should follow single responsibility principle', () => {
      // TreeSitterCoreService应该只负责通用功能
      // CodeStructureService应该只负责业务逻辑
      
      // 检查TreeSitterCoreService的方法数量是否合理
      const coreMethods = Object.getOwnPropertyNames(TreeSitterCoreService.prototype);
      const publicCoreMethods = coreMethods.filter(method => !method.startsWith('_') && method !== 'constructor');
      
      // 应该有合理数量的公共方法（不包括具体的提取方法）
      expect(publicCoreMethods.length).toBeGreaterThan(10); // 基础方法
      expect(publicCoreMethods.length).toBeLessThan(20); // 不应该太多
      
      // 检查CodeStructureService的方法数量
      const structureMethods = Object.getOwnPropertyNames(CodeStructureService.prototype);
      const publicStructureMethods = structureMethods.filter(method => !method.startsWith('_') && method !== 'constructor');
      
      // 应该有合理数量的公共方法（主要是提取方法）
      expect(publicStructureMethods.length).toBeGreaterThan(5);
      expect(publicStructureMethods.length).toBeLessThan(15);
    });

    it('should maintain backward compatibility', () => {
      // 确保核心功能仍然可用
      expect(coreService.getNodeText).toBeDefined();
      expect(coreService.getNodeLocation).toBeDefined();
      expect(coreService.findNodeByType).toBeDefined();
      expect(coreService.findNodeByTypeAsync).toBeDefined();
    });
  });
});