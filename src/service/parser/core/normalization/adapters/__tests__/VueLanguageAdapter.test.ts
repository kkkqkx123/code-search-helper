import { VueLanguageAdapter } from '../VueLanguageAdapter';

describe('VueLanguageAdapter', () => {
 let adapter: VueLanguageAdapter;

  beforeEach(async () => {
    adapter = new VueLanguageAdapter();
  });

  test('should support Vue-specific query types', () => {
    const supportedTypes = adapter.getSupportedQueryTypes();
    
    expect(supportedTypes).toContain('template-elements');
    expect(supportedTypes).toContain('template-directives');
    expect(supportedTypes).toContain('component-definitions');
    expect(supportedTypes).toContain('script-definitions');
    expect(supportedTypes).toContain('style-definitions');
    expect(supportedTypes).toContain('vue-exports');
    expect(supportedTypes).toContain('vue-lifecycle');
    expect(supportedTypes).toContain('vue-slots');
    expect(supportedTypes).toContain('vue-interpolations');
  });

  test('should map Vue node types correctly', () => {
    expect(adapter.mapNodeType('template_element')).toBe('element');
    expect(adapter.mapNodeType('script_element')).toBe('function');
    expect(adapter.mapNodeType('element')).toBe('element');
    expect(adapter.mapNodeType('attribute')).toBe('attribute');
 });

  test('should extract name correctly', () => {
    // 模拟一个包含捕获的查询结果
    const mockResult = {
      captures: [
        {
          name: 'name.definition.function',
          node: {
            text: 'myFunction'
          }
        }
      ]
    };

    const name = adapter.extractName(mockResult);
    expect(name).toBe('myFunction');
  });

  test('should extract modifiers correctly', () => {
    const mockResult = {
      captures: [
        {
          name: 'test',
          node: {
            text: 'export default async function myFunction() { v-if="condition" }'
          }
        }
      ]
    };

    const modifiers = adapter.extractModifiers(mockResult);
    expect(modifiers).toContain('export');
    expect(modifiers).toContain('default');
    expect(modifiers).toContain('async');
    expect(modifiers).toContain('vue-directive');
  });

  test('should calculate complexity correctly', () => {
    const mockResult = {
      captures: [
        {
          name: 'test',
          node: {
            text: 'class MyClass { method() { v-for="item in items" } }'
          }
        }
      ]
    };

    const complexity = adapter.calculateComplexity(mockResult);
    expect(complexity).toBeGreaterThan(1);
  });
});