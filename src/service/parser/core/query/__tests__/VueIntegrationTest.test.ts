import { QueryResultNormalizer } from '../../normalization/QueryResultNormalizer';
import { TreeSitterCoreService } from '../../parse/TreeSitterCoreService';
import { VueLanguageAdapter } from '../../normalization/adapters/VueLanguageAdapter';

describe('Vue Integration Test', () => {
  let normalizer: QueryResultNormalizer;
  let treeSitterService: TreeSitterCoreService;
  let vueAdapter: VueLanguageAdapter;

  beforeAll(async () => {
    treeSitterService = new TreeSitterCoreService();
    normalizer = new QueryResultNormalizer();
    normalizer.setTreeSitterService(treeSitterService);
    vueAdapter = new VueLanguageAdapter();
    
    // 等待初始化完成
    await vueAdapter.waitForInitialization();
 });

  test('should handle Vue file parsing with分段 strategy', async () => {
    const vueCode = `
<template>
  <div class="container">
    <h1>{{ title }}</h1>
    <button @click="handleClick">Click me</button>
    <MyComponent :prop="value" />
  </div>
</template>

<script>
import MyComponent from './MyComponent.vue';

export default {
  name: 'MyComponent',
  components: { MyComponent },
  props: {
    value: {
      type: String,
      default: 'default value'
    }
 },
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
  background-color: #f0f0f0;
}
</style>
`;

    // 使用Vue适配器分析文件
    const analysis = await vueAdapter.analyzeVueFile(vueCode);
    
    // 验证分析结果
    expect(analysis.summary.hasTemplate).toBe(true);
    expect(analysis.summary.scriptCount).toBe(1);
    expect(analysis.summary.styleCount).toBe(1);
    expect(analysis.summary.hasScopedStyles).toBe(true);
    
    // 验证script部分分析
    const scriptAnalysis = analysis.script[0];
    expect(scriptAnalysis.lang).toBe('javascript');
    if (scriptAnalysis.typescriptInfo) {
      expect(scriptAnalysis.typescriptInfo.functionCount).toBeGreaterThanOrEqual(0);
    }
    
    // 验证style部分分析
    const styleAnalysis = analysis.style[0];
    expect(styleAnalysis.scoped).toBe(true);
    if (styleAnalysis.cssInfo) {
      expect(styleAnalysis.cssInfo.ruleSetCount).toBeGreaterThanOrEqual(1);
    }
  });

  test('should normalize Vue file content properly', async () => {
    const vueCode = `
<template>
  <div class="container">
    <h1>{{ title }}</h1>
  </div>
</template>

<script>
export default {
  name: 'TestComponent',
  data() {
    return { title: 'Test' }
  }
}
</script>
`;

    // 使用Vue适配器的标准化功能
    const analysis = await vueAdapter.analyzeVueFile(vueCode);
    const normalizedResults = vueAdapter.normalize([{ analysis }], 'vue-file', 'vue');
    
    expect(Array.isArray(normalizedResults)).toBe(true);
    expect(normalizedResults.length).toBeGreaterThan(0);
    
    // 验证标准化结果
    for (const result of normalizedResults) {
      expect(result.type).toBeDefined();
      expect(result.name).toBeDefined();
      expect(result.startLine).toBeGreaterThanOrEqual(1);
      expect(result.content).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.language).toBeDefined();
    }
 });

  test('should handle TypeScript in Vue files', async () => {
    const vueCode = `
<template>
  <div>{{ message }}</div>
</template>

<script setup lang="ts">
interface Props {
  message: string
}

const props = withDefaults(defineProps<Props>(), {
  message: 'default message'
});

const count = ref(0);
</script>
`;

    // 使用Vue适配器分析TypeScript Vue文件
    const analysis = await vueAdapter.analyzeVueFile(vueCode);
    
    // 验证TypeScript分析
    expect(analysis.summary.hasTypeScript).toBe(true);
    
    const tsScript = analysis.script.find(s => s.lang === 'ts');
    expect(tsScript).toBeDefined();
    
    if (tsScript && tsScript.typescriptInfo) {
      expect(tsScript.typescriptInfo.interfaceCount).toBeGreaterThanOrEqual(0);
      expect(tsScript.typescriptInfo.functionCount).toBeGreaterThanOrEqual(0);
    }
  });
});