import { TreeSitterCoreService } from '../../core/parse/TreeSitterCoreService';
import { DynamicParserManager } from '../../core/parse/DynamicParserManager';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { CodeStructureService } from '../../core/structure/CodeStructureService';

/**
 * 解析器性能基准测试
 * 用于对比优化前后的性能差异
 */
describe('Parser Performance Benchmark', () => {
  const testCodeSamples = {
    javascript: `
function calculateSum(a, b) {
  return a + b;
}

class Calculator {
  constructor() {
    this.result = 0;
  }
  
  add(value) {
    this.result += value;
    return this;
  }
  
  multiply(value) {
    this.result *= value;
    return this;
  }
}

export { Calculator };
    `,
    typescript: `
interface User {
  id: number;
  name: string;
  email: string;
}

class UserService {
  private users: User[] = [];
  
  addUser(user: User): void {
    this.users.push(user);
  }
  
  findUserById(id: number): User | undefined {
    return this.users.find(user => user.id === id);
  }
}

export { UserService, User };
    `,
    python: `
def calculate_sum(a, b):
    return a + b

class Calculator:
    def __init__(self):
        self.result = 0
    
    def add(self, value):
        self.result += value
        return self
    
    def multiply(self, value):
        self.result *= value
        return self

class UserService:
    def __init__(self):
        self.users = []
    
    def add_user(self, user):
        self.users.append(user)
    
    def find_user_by_id(self, user_id):
        return next((user for user in self.users if user['id'] == user_id), None)
    `,
    java: `
public class Calculator {
    private int result = 0;
    
    public Calculator add(int value) {
        this.result += value;
        return this;
    }
    
    public Calculator multiply(int value) {
        this.result *= value;
        return this;
    }
    
    public int getResult() {
        return this.result;
    }
}

public interface UserService {
    void addUser(User user);
    User findUserById(int id);
}

public class UserServiceImpl implements UserService {
    private List<User> users = new ArrayList<>();
    
    @Override
    public void addUser(User user) {
        users.add(user);
    }
    
    @Override
    public User findUserById(int id) {
        return users.stream()
                   .filter(user -> user.getId() == id)
                   .findFirst()
                   .orElse(null);
    }
}
    `
  };

  let originalService: TreeSitterCoreService;
  let dynamicManager: DynamicParserManager;
  let treeSitterService: TreeSitterService;
  let structureService: CodeStructureService;

  beforeAll(async () => {
    // 初始化原始服务
    originalService = new TreeSitterCoreService();
    treeSitterService = new TreeSitterService(originalService);
    structureService = new CodeStructureService(originalService);

    // 初始化动态管理器
    dynamicManager = new DynamicParserManager();

    // 等待初始化完成
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('初始化性能对比', () => {
    test('原始服务初始化时间', async () => {
      const startTime = performance.now();
      const service = new TreeSitterCoreService();
      const initTime = performance.now() - startTime;

      console.log(`原始服务初始化时间: ${initTime.toFixed(2)}ms`);
      expect(service.isInitialized()).toBe(true);
      expect(initTime).toBeLessThan(1000); // 应该在1秒内完成
    });

    test('动态管理器初始化时间', async () => {
      const startTime = performance.now();
      const manager = new DynamicParserManager();
      const initTime = performance.now() - startTime;

      console.log(`动态管理器初始化时间: ${initTime.toFixed(2)}ms`);
      expect(initTime).toBeLessThan(500); // 应该比原始服务更快
    });
  });

  describe('解析性能对比', () => {
    test.each(Object.keys(testCodeSamples))('解析 %s 代码性能对比', async (language) => {
      const code = testCodeSamples[language as keyof typeof testCodeSamples];

      // 测试原始服务性能
      const originalStartTime = performance.now();
      const originalResult = await originalService.parseCode(code, language);
      const originalTime = performance.now() - originalStartTime;

      // 测试动态管理器性能
      const dynamicStartTime = performance.now();
      const dynamicResult = await dynamicManager.parseCode(code, language);
      const dynamicTime = performance.now() - dynamicStartTime;

      console.log(`${language} 解析性能:`);
      console.log(`  原始服务: ${originalTime.toFixed(2)}ms`);
      console.log(`  动态管理器: ${dynamicTime.toFixed(2)}ms`);
      console.log(`  性能差异: ${((originalTime - dynamicTime) / originalTime * 100).toFixed(1)}%`);

      // 验证结果一致性
      expect(originalResult.success).toBe(true);
      expect(dynamicResult.success).toBe(true);

      // 性能差异应该在可接受范围内（动态管理器可能稍慢，但不应超过50%）
      const performanceDiff = Math.abs(originalTime - dynamicTime) / originalTime;
      expect(performanceDiff).toBeLessThan(0.5);
    });
  });

  describe('函数提取性能对比', () => {
    test.each(Object.keys(testCodeSamples))('提取 %s 函数性能对比', async (language) => {
      const code = testCodeSamples[language as keyof typeof testCodeSamples];

      // 解析代码
      const originalParse = await originalService.parseCode(code, language);
      const dynamicParse = await dynamicManager.parseCode(code, language);

      // 测试函数提取性能
      const originalStartTime = performance.now();
      const originalFunctions = await structureService.extractFunctions(originalParse.ast, language);
      const originalTime = performance.now() - originalStartTime;

      const dynamicStartTime = performance.now();
      const dynamicFunctions = await dynamicManager.extractFunctions(dynamicParse.ast, language);
      const dynamicTime = performance.now() - dynamicStartTime;

      console.log(`${language} 函数提取性能:`);
      console.log(`  原始服务: ${originalTime.toFixed(2)}ms`);
      console.log(`  动态管理器: ${dynamicTime.toFixed(2)}ms`);
      console.log(`  提取函数数: ${originalFunctions.length} vs ${dynamicFunctions.length}`);

      // 验证结果一致性
      expect(originalFunctions.length).toBe(dynamicFunctions.length);
    });
  });

  describe('类提取性能对比', () => {
    test.each(Object.keys(testCodeSamples))('提取 %s 类性能对比', async (language) => {
      const code = testCodeSamples[language as keyof typeof testCodeSamples];

      // 解析代码
      const originalParse = await originalService.parseCode(code, language);
      const dynamicParse = await dynamicManager.parseCode(code, language);

      // 测试类提取性能
      const originalStartTime = performance.now();
      const originalClasses = await structureService.extractClasses(originalParse.ast, language);
      const originalTime = performance.now() - originalStartTime;

      const dynamicStartTime = performance.now();
      const dynamicClasses = await dynamicManager.extractClasses(dynamicParse.ast, language);
      const dynamicTime = performance.now() - dynamicStartTime;

      console.log(`${language} 类提取性能:`);
      console.log(`  原始服务: ${originalTime.toFixed(2)}ms`);
      console.log(`  动态管理器: ${dynamicTime.toFixed(2)}ms`);
      console.log(`  提取类数: ${originalClasses.length} vs ${dynamicClasses.length}`);

      // 验证结果一致性
      expect(originalClasses.length).toBe(dynamicClasses.length);
    });
  });

  describe('内存使用对比', () => {
    test('内存使用情况对比', async () => {
      // 强制垃圾回收
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage();

      // 创建多个原始服务实例
      const originalServices = [];
      for (let i = 0; i < 10; i++) {
        originalServices.push(new TreeSitterCoreService());
      }

      const afterOriginalMemory = process.memoryUsage();

      // 创建多个动态管理器实例
      const dynamicManagers = [];
      for (let i = 0; i < 10; i++) {
        dynamicManagers.push(new DynamicParserManager());
      }

      const afterDynamicMemory = process.memoryUsage();

      const originalMemoryIncrease = afterOriginalMemory.heapUsed - initialMemory.heapUsed;
      const dynamicMemoryIncrease = afterDynamicMemory.heapUsed - afterOriginalMemory.heapUsed;

      console.log('内存使用对比:');
      console.log(`  原始服务增加: ${(originalMemoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  动态管理器增加: ${(dynamicMemoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  内存节省: ${((originalMemoryIncrease - dynamicMemoryIncrease) / originalMemoryIncrease * 100).toFixed(1)}%`);

      // 动态管理器应该使用更少内存
      expect(dynamicMemoryIncrease).toBeLessThan(originalMemoryIncrease);
    });
  });

  describe('缓存性能对比', () => {
    test('缓存命中率对比', async () => {
      const code = testCodeSamples.javascript;
      const iterations = 50;

      // 测试原始服务缓存性能
      let originalTotalTime = 0;
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await originalService.parseCode(code, 'javascript');
        originalTotalTime += performance.now() - startTime;
      }

      const originalStats = originalService.getCacheStats();

      // 测试动态管理器缓存性能
      let dynamicTotalTime = 0;
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await dynamicManager.parseCode(code, 'javascript');
        dynamicTotalTime += performance.now() - startTime;
      }

      const dynamicStats = dynamicManager.getCacheStats();

      console.log('缓存性能对比:');
      console.log(`  原始服务平均时间: ${(originalTotalTime / iterations).toFixed(2)}ms`);
      console.log(`  动态管理器平均时间: ${(dynamicTotalTime / iterations).toFixed(2)}ms`);
      console.log(`  原始服务缓存命中率: ${originalStats.hitRate}`);
      console.log(`  动态管理器缓存命中率: ${dynamicStats.hitRate}`);

      // 缓存命中率应该都很高
      const originalHitRate = parseFloat(originalStats.hitRate);
      const dynamicHitRate = parseFloat(dynamicStats.hitRate);

      expect(originalHitRate).toBeGreaterThan(80);
      expect(dynamicHitRate).toBeGreaterThan(80);
    });
  });

  describe('并发性能对比', () => {
    test('并发解析性能', async () => {
      const code = testCodeSamples.javascript;
      const concurrency = 20;
      const iterations = 10;

      // 测试原始服务并发性能
      const originalStartTime = performance.now();
      const originalPromises = [];
      for (let i = 0; i < concurrency; i++) {
        for (let j = 0; j < iterations; j++) {
          originalPromises.push(originalService.parseCode(code, 'javascript'));
        }
      }
      await Promise.all(originalPromises);
      const originalTime = performance.now() - originalStartTime;

      // 测试动态管理器并发性能
      const dynamicStartTime = performance.now();
      const dynamicPromises = [];
      for (let i = 0; i < concurrency; i++) {
        for (let j = 0; j < iterations; j++) {
          dynamicPromises.push(dynamicManager.parseCode(code, 'javascript'));
        }
      }
      await Promise.all(dynamicPromises);
      const dynamicTime = performance.now() - dynamicStartTime;

      const totalOperations = concurrency * iterations;

      console.log('并发性能对比:');
      console.log(`  总操作数: ${totalOperations}`);
      console.log(`  原始服务总时间: ${originalTime.toFixed(2)}ms`);
      console.log(`  动态管理器总时间: ${dynamicTime.toFixed(2)}ms`);
      console.log(`  原始服务平均时间: ${(originalTime / totalOperations).toFixed(2)}ms/op`);
      console.log(`  动态管理器平均时间: ${(dynamicTime / totalOperations).toFixed(2)}ms/op`);

      // 性能差异应该在可接受范围内
      const performanceDiff = Math.abs(originalTime - dynamicTime) / originalTime;
      expect(performanceDiff).toBeLessThan(0.5);
    });
  });
});