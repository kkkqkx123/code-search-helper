import { HTMLChunkFactory } from '../HTMLChunkFactory';
import { ChunkType } from '../../../core/types/ResultTypes';
import { IProcessingContext } from '../../../core/interfaces/IProcessingContext';
import { ScriptBlock, StyleBlock } from '../LayeredHTMLConfig';

describe('HTMLChunkFactory', () => {
  let factory: HTMLChunkFactory;

  beforeEach(() => {
    factory = new HTMLChunkFactory();
  });

  const createMockContext = (filePath: string = 'test.html'): IProcessingContext => ({
    filePath,
    content: '',
    language: 'html',
    config: {} as any,
    features: {} as any,
    metadata: {} as any
  });

  const createMockScriptBlock = (overrides?: Partial<ScriptBlock>): ScriptBlock => ({
    id: 'script_0',
    content: 'console.log("test");',
    language: 'javascript',
    position: { start: 0, end: 25, line: 1, column: 1 },
    attributes: { type: 'text/javascript' },
    contentHash: 'hash123',
    ...overrides
  });

  const createMockStyleBlock = (overrides?: Partial<StyleBlock>): StyleBlock => ({
    id: 'style_0',
    content: '.test { color: red; }',
    styleType: 'css',
    position: { start: 0, end: 21, line: 1, column: 1 },
    attributes: { type: 'text/css' },
    contentHash: 'hash456',
    ...overrides
  });

  describe('createScriptChunk', () => {
    it('should create a script chunk with correct metadata', () => {
      const script = createMockScriptBlock();
      const context = createMockContext();
      const strategy = 'layer1';

      const chunk = factory.createScriptChunk(script, context, strategy);

      expect(chunk.content).toBe(script.content);
      expect(chunk.metadata.language).toBe('javascript');
      expect(chunk.metadata.type).toBe(ChunkType.GENERIC);
      expect(chunk.metadata.strategy).toBe(strategy);
      expect(chunk.metadata.scriptId).toBe(script.id);
      expect(chunk.metadata.scriptLanguage).toBe('javascript');
    });

    it('should calculate correct line numbers', () => {
      const script = createMockScriptBlock({
        position: { start: 0, end: 50, line: 5, column: 1 },
        content: 'line1\nline2\nline3'
      });
      const context = createMockContext();

      const chunk = factory.createScriptChunk(script, context, 'test');

      expect(chunk.metadata.startLine).toBe(5);
      expect(chunk.metadata.endLine).toBe(7);
    });

    it('should preserve script attributes', () => {
      const attributes = { type: 'module', async: 'true' };
      const script = createMockScriptBlock({ attributes });
      const context = createMockContext();

      const chunk = factory.createScriptChunk(script, context, 'test');

      expect(chunk.metadata.scriptAttributes).toEqual(attributes);
    });

    it('should include content hash', () => {
      const contentHash = 'abc123def456';
      const script = createMockScriptBlock({ contentHash });
      const context = createMockContext();

      const chunk = factory.createScriptChunk(script, context, 'test');

      expect(chunk.metadata.contentHash).toBe(contentHash);
    });
  });

  describe('createStyleChunk', () => {
    it('should create a style chunk with correct metadata', () => {
      const style = createMockStyleBlock();
      const context = createMockContext();
      const strategy = 'layer1';

      const chunk = factory.createStyleChunk(style, context, strategy);

      expect(chunk.content).toBe(style.content);
      expect(chunk.metadata.language).toBe('css');
      expect(chunk.metadata.type).toBe(ChunkType.GENERIC);
      expect(chunk.metadata.strategy).toBe(strategy);
      expect(chunk.metadata.styleId).toBe(style.id);
      expect(chunk.metadata.styleType).toBe('css');
    });

    it('should handle SCSS style type', () => {
      const style = createMockStyleBlock({ styleType: 'scss' });
      const context = createMockContext();

      const chunk = factory.createStyleChunk(style, context, 'test');

      expect(chunk.metadata.language).toBe('scss');
      expect(chunk.metadata.styleType).toBe('scss');
    });

    it('should handle LESS style type', () => {
      const style = createMockStyleBlock({ styleType: 'less' });
      const context = createMockContext();

      const chunk = factory.createStyleChunk(style, context, 'test');

      expect(chunk.metadata.language).toBe('less');
      expect(chunk.metadata.styleType).toBe('less');
    });

    it('should preserve style attributes', () => {
      const attributes = { lang: 'scss', media: 'screen' };
      const style = createMockStyleBlock({ attributes });
      const context = createMockContext();

      const chunk = factory.createStyleChunk(style, context, 'test');

      expect(chunk.metadata.styleAttributes).toEqual(attributes);
    });
  });

  describe('createScriptChunksFromResult', () => {
    it('should create chunks from parse result', () => {
      const script = createMockScriptBlock();
      const result = {
        content: 'function test() {}',
        startLine: 1,
        endLine: 1,
        metadata: { complexity: 2 },
        nodeId: 'node_1',
        name: 'test'
      };
      const context = createMockContext();

      const chunks = factory.createScriptChunksFromResult(script, result, context, 'test');

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(result.content);
      expect(chunks[0].metadata.nodeId).toBe('node_1');
      expect(chunks[0].metadata.name).toBe('test');
      expect(chunks[0].metadata.scriptId).toBe(script.id);
    });

    it('should adjust line numbers correctly', () => {
      const script = createMockScriptBlock({
        position: { start: 0, end: 50, line: 10, column: 1 }
      });
      const result = {
        content: 'code',
        startLine: 2,
        endLine: 5,
        metadata: { complexity: 2 },
        nodeId: 'node_1',
        name: 'test'
      };
      const context = createMockContext();

      const chunks = factory.createScriptChunksFromResult(script, result, context, 'test');

      expect(chunks[0].metadata.startLine).toBe(11);
      expect(chunks[0].metadata.endLine).toBe(14);
    });

    it('should include timestamp and size metadata', () => {
      const script = createMockScriptBlock();
      const result = {
        content: 'test code',
        startLine: 1,
        endLine: 1,
        metadata: { complexity: 2 },
        nodeId: 'node_1',
        name: 'test'
      };
      const context = createMockContext();

      const chunks = factory.createScriptChunksFromResult(script, result, context, 'test');

      expect(chunks[0].metadata.timestamp).toBeDefined();
      expect(chunks[0].metadata.size).toBe('test code'.length);
      expect(chunks[0].metadata.lineCount).toBe(1);
    });
  });

  describe('createStyleChunksFromResult', () => {
    it('should create chunks from parse result', () => {
      const style = createMockStyleBlock();
      const result = {
        content: '.class { color: blue; }',
        startLine: 1,
        endLine: 1,
        metadata: { complexity: 1 },
        nodeId: 'node_2',
        name: 'class'
      };
      const context = createMockContext();

      const chunks = factory.createStyleChunksFromResult(style, result, context, 'test');

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(result.content);
      expect(chunks[0].metadata.styleId).toBe(style.id);
    });

    it('should adjust line numbers for style chunks', () => {
      const style = createMockStyleBlock({
        position: { start: 0, end: 50, line: 15, column: 1 }
      });
      const result = {
        content: 'css',
        startLine: 1,
        endLine: 3,
        metadata: { complexity: 1 },
        nodeId: 'node_2',
        name: 'test'
      };
      const context = createMockContext();

      const chunks = factory.createStyleChunksFromResult(style, result, context, 'test');

      expect(chunks[0].metadata.startLine).toBe(15);
      expect(chunks[0].metadata.endLine).toBe(17);
    });
  });

  describe('createHTMLChunksFromResult', () => {
    it('should create HTML chunks from result', () => {
      const result = {
        content: '<div>test</div>',
        startLine: 1,
        endLine: 1,
        metadata: { complexity: 1 },
        nodeId: 'node_3',
        name: 'div'
      };
      const context = createMockContext();

      const chunks = factory.createHTMLChunksFromResult(result, context, 'test');

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(result.content);
      expect(chunks[0].metadata.language).toBe('html');
      expect(chunks[0].metadata.nodeId).toBe('node_3');
    });

    it('should preserve start and end lines', () => {
      const result = {
        content: '<div>test</div>',
        startLine: 5,
        endLine: 10,
        metadata: { complexity: 1 },
        nodeId: 'node_3',
        name: 'div'
      };
      const context = createMockContext();

      const chunks = factory.createHTMLChunksFromResult(result, context, 'test');

      expect(chunks[0].metadata.startLine).toBe(5);
      expect(chunks[0].metadata.endLine).toBe(10);
    });
  });

  describe('metadata generation', () => {
    it('should calculate correct line count', () => {
      const script = createMockScriptBlock({
        content: 'line1\nline2\nline3\nline4'
      });
      const context = createMockContext();

      const chunk = factory.createScriptChunk(script, context, 'test');

      expect(chunk.metadata.lineCount).toBe(4);
    });

    it('should calculate correct size', () => {
      const content = 'test content';
      const script = createMockScriptBlock({ content });
      const context = createMockContext();

      const chunk = factory.createScriptChunk(script, context, 'test');

      expect(chunk.metadata.size).toBe(content.length);
    });

    it('should include file path in metadata', () => {
      const filePath = 'src/components/App.vue';
      const context = createMockContext(filePath);
      const script = createMockScriptBlock();

      const chunk = factory.createScriptChunk(script, context, 'test');

      expect(chunk.metadata.filePath).toBe(filePath);
    });

    it('should include strategy in metadata', () => {
      const script = createMockScriptBlock();
      const context = createMockContext();
      const strategy = 'custom-strategy';

      const chunk = factory.createScriptChunk(script, context, strategy);

      expect(chunk.metadata.strategy).toBe(strategy);
    });
  });
});
