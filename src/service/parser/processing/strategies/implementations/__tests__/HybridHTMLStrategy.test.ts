import { HybridHTMLStrategy } from '../HybridHTMLStrategy';
import { IProcessingContext } from '../../../core/interfaces/IProcessingContext';

describe('HybridHTMLProcessor', () => {
  let strategy: HybridHTMLStrategy;
  let mockContext: IProcessingContext;

  beforeEach(() => {
    strategy = new HybridHTMLStrategy({
      name: 'layered-html',
      enabled: true,
      supportedLanguages: ['html', 'htm']
    });

    mockContext = {
      filePath: '/test/index.html',
      content: '',
      language: 'html',
      config: {} as any,
      features: {
        size: 0,
        lineCount: 0,
        isSmallFile: true,
        isCodeFile: true,
        isStructuredFile: false,
        complexity: 1,
        hasImports: false,
        hasExports: false,
        hasFunctions: false,
        hasClasses: false
      },
      metadata: {
        contentLength: 0,
        lineCount: 0,
        size: 0,
        isSmallFile: true,
        isCodeFile: true,
        isStructuredFile: false,
        complexity: 1,
        hasImports: false,
        hasExports: false,
        hasFunctions: false,
        hasClasses: false,
        timestamp: Date.now()
      }
    };
  });

  describe('缓存机制', () => {
    it('应该缓存脚本处理结果', async () => {
      const scriptContent = 'console.log("test");';
      const htmlContent = `<script>${scriptContent}</script>`;
      mockContext.content = htmlContent;

      // 第一次处理
      const result1 = await strategy.process(mockContext);
      expect(result1).toHaveLength(1);

      // 第二次处理应该使用缓存
      const result2 = await strategy.process(mockContext);
      expect(result2).toHaveLength(1);

      // 验证缓存统计
      const cacheStats = strategy.getCacheStats();
      expect(cacheStats.scriptCache).toBeGreaterThan(0);
    });

    it('应该缓存样式处理结果', async () => {
      const styleContent = 'body { margin: 0; }';
      const htmlContent = `<style>${styleContent}</style>`;
      mockContext.content = htmlContent;

      // 第一次处理
      const result1 = await strategy.process(mockContext);
      expect(result1).toHaveLength(1);

      // 第二次处理应该使用缓存
      const result2 = await strategy.process(mockContext);
      expect(result2).toHaveLength(1);

      // 验证缓存统计
      const cacheStats = strategy.getCacheStats();
      expect(cacheStats.styleCache).toBeGreaterThan(0);
    });

    it('应该能够清理缓存', async () => {
      const htmlContent = '<script>console.log("test");</script>';
      mockContext.content = htmlContent;

      await strategy.process(mockContext);

      let cacheStats = strategy.getCacheStats();
      expect(cacheStats.scriptCache).toBeGreaterThan(0);

      strategy.clearCache();

      cacheStats = strategy.getCacheStats();
      expect(cacheStats.scriptCache).toBe(0);
      expect(cacheStats.styleCache).toBe(0);
    });
  });

  describe('属性分析', () => {
    it('应该正确分析脚本属性', async () => {
      const htmlContent = `
        <script type="module" async src="./app.js"></script>
        <script lang="ts">
          interface Test { name: string; }
        </script>
        <script type="json">
          {"key": "value"}
        </script>
      `;
      mockContext.content = htmlContent;

      const result = await strategy.process(mockContext);

      // 验证第一个脚本的属性分析
      const scriptChunk1 = result.find((chunk: any) => chunk.metadata?.scriptId === 'script_0');
      expect(scriptChunk1?.metadata?.isModule).toBe(true);
      expect(scriptChunk1?.metadata?.isAsync).toBe(true);
      expect(scriptChunk1?.metadata?.hasSrc).toBe(true);
      expect(scriptChunk1?.metadata?.scriptAttributes?.type).toBe('module');

      // 验证第二个脚本的属性分析
      const scriptChunk2 = result.find((chunk: any) => chunk.metadata?.scriptId === 'script_1');
      expect(scriptChunk2?.metadata?.isTypeScript).toBe(true);
      expect(scriptChunk2?.metadata?.scriptLanguage).toBe('typescript');

      // 验证第三个脚本的属性分析
      const scriptChunk3 = result.find((chunk: any) => chunk.metadata?.scriptId === 'script_2');
      expect(scriptChunk3?.metadata?.isJSON).toBe(true);
      expect(scriptChunk3?.metadata?.scriptLanguage).toBe('json');
    });

    it('应该正确分析样式属性', async () => {
      const htmlContent = `
        <style lang="scss">
          $primary: #blue;
          .container { color: $primary; }
        </style>
        <style media="screen" scoped>
          .component { margin: 10px; }
        </style>
      `;
      mockContext.content = htmlContent;

      const result = await strategy.process(mockContext);

      // 验证第一个样式的属性分析
      const styleChunk1 = result.find((chunk: any) => chunk.metadata?.styleId === 'style_0');
      expect(styleChunk1?.metadata?.isSCSS).toBe(true);
      expect(styleChunk1?.metadata?.isPreprocessor).toBe(true);
      expect(styleChunk1?.metadata?.styleType).toBe('scss');

      // 验证第二个样式的属性分析
      const styleChunk2 = result.find((chunk: any) => chunk.metadata?.styleId === 'style_1');
      expect(styleChunk2?.metadata?.hasMedia).toBe(true);
      expect(styleChunk2?.metadata?.hasScope).toBe(true);
      expect(styleChunk2?.metadata?.styleType).toBe('css');
    });
  });

  describe('内容哈希', () => {
    it('应该为相同内容生成相同的哈希', async () => {
      const scriptContent = 'console.log("test");';
      const htmlContent1 = `<script>${scriptContent}</script>`;
      const htmlContent2 = `<script>${scriptContent}</script>`;

      mockContext.content = htmlContent1;
      const result1 = await strategy.process(mockContext);

      mockContext.content = htmlContent2;
      const result2 = await strategy.process(mockContext);

      const hash1 = result1[0]?.metadata.contentHash;
      const hash2 = result2[0]?.metadata.contentHash;

      expect(hash1).toBe(hash2);
      expect(hash1).toBeDefined();
    });

    it('应该为不同内容生成不同的哈希', async () => {
      const htmlContent1 = '<script>console.log("test1");</script>';
      const htmlContent2 = '<script>console.log("test2");</script>';

      mockContext.content = htmlContent1;
      const result1 = await strategy.process(mockContext);

      mockContext.content = htmlContent2;
      const result2 = await strategy.process(mockContext);

      const hash1 = result1[0]?.metadata.contentHash;
      const hash2 = result2[0]?.metadata.contentHash;

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('元数据增强', () => {
    it('应该包含丰富的元数据信息', async () => {
      const htmlContent = `
        <script type="module" src="./app.js" crossorigin="anonymous">
          console.log("test");
        </script>
      `;
      mockContext.content = htmlContent;

      const result = await strategy.process(mockContext);
      const chunk = result[0];

      expect(chunk?.metadata).toMatchObject({
        scriptAttributes: {
          type: 'module',
          src: './app.js',
          crossorigin: 'anonymous'
        },
        contentHash: expect.any(String),
        attributeCount: 3,
        hasExternalSource: true,
        isModule: true,
        hasCrossorigin: true,
        processingFromCache: false
      });
    });
  });

  describe('错误处理', () => {
    it('应该处理脚本处理错误', async () => {
      // 模拟一个会导致错误的脚本
      const htmlContent = '<script>invalid syntax <<<</script>';
      mockContext.content = htmlContent;

      // 应该不会抛出错误，而是返回降级结果
      const result = await strategy.process(mockContext);
      expect(result).toBeDefined();
    });

    it('应该处理样式处理错误', async () => {
      // 模拟一个会导致错误的样式
      const htmlContent = '<style>invalid css {</style>';
      mockContext.content = htmlContent;

      // 应该不会抛出错误，而是返回降级结果
      const result = await strategy.process(mockContext);
      expect(result).toBeDefined();
    });
  });
});