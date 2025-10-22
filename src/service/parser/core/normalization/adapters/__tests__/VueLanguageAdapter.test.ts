import { VueLanguageAdapter } from '../VueLanguageAdapter';

describe('VueLanguageAdapter', () => {
  let adapter: VueLanguageAdapter;

  beforeEach(async () => {
    adapter = new VueLanguageAdapter();
    await adapter.waitForInitialization(2000); // 等待初始化完成
  });

  test('should parse Vue file sections correctly', () => {
    const vueCode = `
<template>
  <div class="container">
    <h1>{{ title }}</h1>
    <button @click="handleClick">Click me</button>
  </div>
</template>

<script>
export default {
  name: 'MyComponent',
  data() {
    return {
      title: 'Hello World'
    }
  },
  methods: {
    handleClick() {
      console.log('clicked');
    }
  }
}
</script>

<style scoped>
.container {
  padding: 20px;
}
</style>
`;

    const sections = adapter.parseVueFile(vueCode);
    
    expect(sections.template).not.toBeNull();
    expect(sections.script.length).toBe(1);
    expect(sections.style.length).toBe(1);
    expect(sections.style[0].scoped).toBe(true);
 });

  test('should normalize Vue file structure', async () => {
    const vueCode = `
<template>
  <div class="container">
    <h1>{{ title }}</h1>
  </div>
</template>

<script>
export default {
  name: 'MyComponent',
  data() {
    return { title: 'Hello World' }
  }
}
</script>
`;

    // 分析Vue文件
    const analysis = await adapter.analyzeVueFile(vueCode);
    
    // 测试分析结果
    expect(analysis.summary.hasTemplate).toBe(true);
    expect(analysis.summary.scriptCount).toBe(1);
    expect(analysis.summary.styleCount).toBe(0);
    
    // 测试标准化
    const normalizedResults = adapter.normalize([{ analysis }], 'vue-file', 'vue');
    
    expect(Array.isArray(normalizedResults)).toBe(true);
 });

  test('should support Vue-specific query types', () => {
    const supportedTypes = adapter.getSupportedQueryTypes();
    
    expect(supportedTypes).toContain('components');
    expect(supportedTypes).toContain('template-elements');
    expect(supportedTypes).toContain('template-directives');
    expect(supportedTypes).toContain('style-rules');
  });

  test('should map Vue node types correctly', () => {
    expect(adapter.mapNodeType('template_element')).toBe('variable');
    expect(adapter.mapNodeType('script_element')).toBe('function');
    expect(adapter.mapNodeType('element')).toBe('variable');
    expect(adapter.mapNodeType('attribute')).toBe('variable');
  });
});