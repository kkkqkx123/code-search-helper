import Parser from 'tree-sitter';
import C from 'tree-sitter-c';
import { QueryLoader } from '../../core/query/QueryLoader';

// 初始化解析器
const parser = new Parser();
const language = C as any;
parser.setLanguage(language);

describe('C语言并发关系查询模式分析测试', () => {
  beforeAll(async () => {
    // 确保C语言查询已加载
    await QueryLoader.loadLanguageQueries('c');
  });

  test('分析tree-sitter并发关系查询捕获的实际行为', async () => {
    const code = `
      #include <pthread.h>
      #include <semaphore.h>
      
      // 线程相关变量
      pthread_t thread1, thread2;
      pthread_mutex_t mutex1;
      pthread_cond_t cond1;
      pthread_rwlock_t rwlock1;
      sem_t semaphore1;
      
      // 线程函数
      void* thread_func(void* arg) {
        return NULL;
      }
      
      int main() {
        // 线程操作
        pthread_create(&thread1, NULL, thread_func, NULL);  // 线程创建
        pthread_join(thread1, NULL);                        // 线程等待
        pthread_detach(thread1);                            // 线程分离
        pthread_exit(NULL);                                 // 线程退出
        pthread_t current_thread = pthread_self();          // 获取线程ID
        
        // 互斥锁操作
        pthread_mutex_init(&mutex1, NULL);                  // 互斥锁初始化
        pthread_mutex_lock(&mutex1);                        // 互斥锁加锁
        pthread_mutex_trylock(&mutex1);                     // 互斥锁尝试加锁
        pthread_mutex_unlock(&mutex1);                      // 互斥锁解锁
        pthread_mutex_destroy(&mutex1);                     // 互斥锁销毁
        
        // 条件变量操作
        pthread_cond_init(&cond1, NULL);                    // 条件变量初始化
        pthread_cond_wait(&cond1, &mutex1);                 // 条件变量等待
        pthread_cond_signal(&cond1);                        // 条件变量信号
        pthread_cond_broadcast(&cond1);                     // 条件变量广播
        pthread_cond_destroy(&cond1);                       // 条件变量销毁
        
        // 读写锁操作
        pthread_rwlock_init(&rwlock1, NULL);                // 读写锁初始化
        pthread_rwlock_rdlock(&rwlock1);                    // 读写锁读锁
        pthread_rwlock_wrlock(&rwlock1);                    // 读写锁写锁
        pthread_rwlock_unlock(&rwlock1);                    // 读写锁解锁
        pthread_rwlock_destroy(&rwlock1);                   // 读写锁销毁
        
        // 信号量操作
        sem_init(&semaphore1, 0, 1);                        // 信号量初始化
        sem_wait(&semaphore1);                              // 信号量等待
        sem_trywait(&semaphore1);                           // 信号量尝试等待
        sem_post(&semaphore1);                              // 信号量信号
        sem_destroy(&semaphore1);                           // 信号量销毁
        
        // 原子操作
        atomic_thread_fence(memory_order_seq_cst);          // 内存屏障
        __atomic_thread_fence(__ATOMIC_SEQ_CST);            // 编译器屏障
        
        return 0;
      }
      
      // 线程本地存储
      __thread int tls_var;                                 // 线程本地变量
      _Thread_local int tls_var2;                           // 线程本地变量2
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('c', 'concurrency-relationships');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    console.log('=== 并发关系查询模式 ===');
    console.log(queryPattern);
    
    console.log('\n=== 捕获结果分析 ===');
    const captureGroups: Record<string, any[]> = {};
    
    captures.forEach((capture, index) => {
      const captureName = capture.name;
      const text = capture.node.text;
      
      if (!captureGroups[captureName]) {
        captureGroups[captureName] = [];
      }
      
      captureGroups[captureName].push({
        index,
        text: text.trim(),
        startPosition: capture.node.startPosition,
        endPosition: capture.node.endPosition,
        nodeType: capture.node.type
      });
    });

    // 分析每个捕获组
    Object.entries(captureGroups).forEach(([captureName, captures]) => {
      console.log(`\n--- ${captureName} (${captures.length}个) ---`);
      captures.forEach(capture => {
        console.log(`  [${capture.index}] ${capture.text}`);
        console.log(`    类型: ${capture.nodeType}`);
        console.log(`    位置: ${capture.startPosition.row + 1}:${capture.startPosition.column} - ${capture.endPosition.row + 1}:${capture.endPosition.column}`);
      });
    });

    // 验证关键问题：相同的节点是否被多个查询模式捕获？
    console.log('\n=== 重复捕获分析 ===');
    const nodeTexts = new Map<string, string[]>();
    
    captures.forEach(capture => {
      const nodeText = capture.node.text;
      const captureName = capture.name;
      
      if (!nodeTexts.has(nodeText)) {
        nodeTexts.set(nodeText, []);
      }
      nodeTexts.get(nodeText)!.push(captureName);
    });

    let duplicateCount = 0;
    nodeTexts.forEach((captureNames, text) => {
      if (captureNames.length > 1) {
        duplicateCount++;
        console.log(`重复捕获 (${captureNames.length}次): ${text.trim()}`);
        console.log(`  捕获名称: ${captureNames.join(', ')}`);
      }
    });

    console.log(`\n总捕获数: ${captures.length}`);
    console.log(`唯一节点数: ${nodeTexts.size}`);
    console.log(`重复捕获数: ${duplicateCount}`);
    
    // 验证查询模式是否真的能区分不同类型的并发操作
    console.log('\n=== 查询模式有效性分析 ===');
    
    // 检查是否有特定的查询模式能匹配到特定的并发操作类型
    const expectedPatterns = {
      'concurrency.relationship.thread.creation': ['pthread_create'],
      'concurrency.relationship.thread.wait': ['pthread_join'],
      'concurrency.relationship.thread.detach': ['pthread_detach'],
      'concurrency.relationship.thread.exit': ['pthread_exit'],
      'concurrency.relationship.thread.id': ['pthread_self'],
      'concurrency.relationship.mutex.init': ['pthread_mutex_init'],
      'concurrency.relationship.mutex.lock': ['pthread_mutex_lock'],
      'concurrency.relationship.mutex.trylock': ['pthread_mutex_trylock'],
      'concurrency.relationship.mutex.unlock': ['pthread_mutex_unlock'],
      'concurrency.relationship.mutex.destroy': ['pthread_mutex_destroy'],
      'concurrency.relationship.condition.init': ['pthread_cond_init'],
      'concurrency.relationship.condition.wait': ['pthread_cond_wait'],
      'concurrency.relationship.condition.signal': ['pthread_cond_signal'],
      'concurrency.relationship.condition.broadcast': ['pthread_cond_broadcast'],
      'concurrency.relationship.condition.destroy': ['pthread_cond_destroy'],
      'concurrency.relationship.rwlock.init': ['pthread_rwlock_init'],
      'concurrency.relationship.rwlock.readlock': ['pthread_rwlock_rdlock'],
      'concurrency.relationship.rwlock.writelock': ['pthread_rwlock_wrlock'],
      'concurrency.relationship.rwlock.unlock': ['pthread_rwlock_unlock'],
      'concurrency.relationship.rwlock.destroy': ['pthread_rwlock_destroy'],
      'concurrency.relationship.semaphore.init': ['sem_init'],
      'concurrency.relationship.semaphore.wait': ['sem_wait'],
      'concurrency.relationship.semaphore.trywait': ['sem_trywait'],
      'concurrency.relationship.semaphore.post': ['sem_post'],
      'concurrency.relationship.semaphore.destroy': ['sem_destroy'],
      'concurrency.relationship.memory.barrier': ['atomic_thread_fence'],
      'concurrency.relationship.compiler.barrier': ['__atomic_thread_fence'],
      'concurrency.relationship.thread.local': ['__thread', '_Thread_local']
    };

    Object.entries(expectedPatterns).forEach(([pattern, expectedTexts]) => {
      const patternCaptures = captureGroups[pattern] || [];
      const matchedTexts = patternCaptures.map(c => c.text);
      
      console.log(`\n${pattern}:`);
      console.log(` 期望匹配: ${expectedTexts.join(', ')}`);
      console.log(`  实际捕获数: ${patternCaptures.length}`);
      
      if (patternCaptures.length > 0) {
        console.log(`  匹配的节点:`);
        matchedTexts.forEach(text => {
          console.log(`    - ${text.trim()}`);
        });
        
        // 检查是否匹配到期望的文本
        const matchedExpected = expectedTexts.some(expected => 
          matchedTexts.some(text => text.includes(expected))
        );
        console.log(`  匹配期望: ${matchedExpected ? '✅' : '❌'}`);
      } else {
        console.log(`  ⚠️  未找到匹配的节点`);
      }
    });

    // 检查查询模式之间的冲突
    console.log('\n=== 查询模式冲突分析 ===');
    const conflictingPatterns = new Set<string>();
    
    Object.keys(expectedPatterns).forEach(pattern1 => {
      Object.keys(expectedPatterns).forEach(pattern2 => {
        if (pattern1 !== pattern2) {
          const captures1 = captureGroups[pattern1] || [];
          const captures2 = captureGroups[pattern2] || [];
          
          // 检查是否有相同的节点被两个模式捕获
          const commonNodes = captures1.filter(c1 => 
            captures2.some(c2 => c1.text === c2.text)
          );
          
          if (commonNodes.length > 0) {
            conflictingPatterns.add(`${pattern1} <-> ${pattern2}`);
            console.log(`冲突: ${pattern1} 和 ${pattern2}`);
            commonNodes.forEach(node => {
              console.log(`  共同节点: ${node.text.trim()}`);
            });
          }
        }
      });
    });

    console.log(`\n总冲突数: ${conflictingPatterns.size}`);
    
    // 结论
    console.log('\n=== 结论 ===');
    if (duplicateCount > 0) {
      console.log('⚠️  发现重复捕获：相同的节点被多个查询模式匹配');
      console.log('   这意味着tree-sitter查询模式无法真正区分并发关系类型');
    } else {
      console.log('✅ 没有重复捕获：每个查询模式匹配不同的节点');
    }
    
    if (conflictingPatterns.size > 0) {
      console.log('⚠️  发现查询模式冲突：某些模式捕获了相同的节点');
    } else {
      console.log('✅ 没有查询模式冲突：各模式独立工作');
    }
  });

  test('验证并发关系查询模式的语法正确性', async () => {
    const queryPattern = await QueryLoader.getQuery('c', 'concurrency-relationships');
    const validation = QueryLoader.validateQuerySyntax(queryPattern);
    
    console.log('\n=== 并发关系查询语法验证 ===');
    console.log(`验证结果: ${validation.valid ? '✅ 有效' : '❌ 无效'}`);
    
    if (!validation.valid) {
      console.log('语法错误:');
      validation.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }
    
    expect(validation.valid).toBe(true);
  });

  test('测试并发关系查询模式的区分能力', async () => {
    // 测试各种并发操作的区分能力
    const testCases = [
      {
        name: '线程创建',
        code: 'pthread_create(&thread, NULL, func, NULL);',
        expectedPatterns: ['concurrency.relationship.thread.creation', 'thread.create.function', 'thread.handle', 'thread.start.function', 'thread.argument']
      },
      {
        name: '互斥锁加锁',
        code: 'pthread_mutex_lock(&mutex);',
        expectedPatterns: ['concurrency.relationship.mutex.lock', 'mutex.lock.function', 'mutex.handle']
      },
      {
        name: '条件变量等待',
        code: 'pthread_cond_wait(&cond, &mutex);',
        expectedPatterns: ['concurrency.relationship.condition.wait', 'cond.wait.function', 'cond.handle', 'mutex.handle']
      },
      {
        name: '信号量等待',
        code: 'sem_wait(&sem);',
        expectedPatterns: ['concurrency.relationship.semaphore.wait', 'semaphore.wait.function', 'semaphore.handle']
      },
      {
        name: '内存屏障',
        code: 'atomic_thread_fence(memory_order_seq_cst);',
        expectedPatterns: ['concurrency.relationship.memory.barrier', 'memory.barrier.function', 'memory.order']
      },
      {
        name: '线程本地存储',
        code: '__thread int tls_var;',
        expectedPatterns: ['concurrency.relationship.thread.local', 'thread.local.specifier', 'thread.local.type', 'thread.local.variable']
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n=== 测试: ${testCase.name} ===`);
      console.log(`代码: ${testCase.code}`);
      
      const tree = parser.parse(testCase.code);
      const queryPattern = await QueryLoader.getQuery('c', 'concurrency-relationships');
      const query = new Parser.Query(language, queryPattern);
      const captures = query.captures(tree.rootNode);

      const captureNames = [...new Set(captures.map(c => c.name))];
      console.log(`捕获的模式: ${captureNames.join(', ')}`);
      
      const missingPatterns = testCase.expectedPatterns.filter(pattern => 
        !captureNames.includes(pattern)
      );
      
      if (missingPatterns.length > 0) {
        console.log(`❌ 缺失模式: ${missingPatterns.join(', ')}`);
      } else {
        console.log('✅ 所有期望模式都匹配成功');
      }
      
      // 验证没有意外的捕获模式
      const unexpectedPatterns = captureNames.filter(pattern => 
        !testCase.expectedPatterns.includes(pattern)
      );
      
      if (unexpectedPatterns.length > 0) {
        console.log(`⚠️  意外模式: ${unexpectedPatterns.join(', ')}`);
      }
    }
 });

  test('检测查询模式中的冗余和冲突', async () => {
    const queryPattern = await QueryLoader.getQuery('c', 'concurrency-relationships');
    
    // 检查是否存在可能的冲突或冗余模式
    console.log('\n=== 检测冗余和冲突模式 ===');
    
    // 检查正则表达式中的潜在冲突
    const lines = queryPattern.split('\n');
    const functionPatterns: { [key: string]: string[] } = {};
    
    lines.forEach((line, index) => {
      if (line.includes('(#match?') && line.includes('function')) {
        // 提取正则表达式模式
        const regexMatch = line.match(/(#match\? [^"]+ "([^"]+)")/);
        if (regexMatch) {
          const pattern = regexMatch[2];
          const captureName = line.match(/@(\w+\.\w+)/)?.[1] || `line_${index}`;
          
          if (!functionPatterns[pattern]) {
            functionPatterns[pattern] = [];
          }
          functionPatterns[pattern].push(captureName);
        }
      }
    });
    
    console.log('函数模式分析:');
    Object.entries(functionPatterns).forEach(([pattern, captures]) => {
      console.log(`  模式 "${pattern}": ${captures.join(', ')}`);
      
      // 检查是否可能存在冲突的模式
      if (captures.length > 1) {
        console.log(`    ⚠️  多个捕获使用相同模式: ${captures.join(', ')}`);
      }
    });
    
    // 检查可能的重叠正则表达式
    const allPatterns = Object.keys(functionPatterns);
    for (let i = 0; i < allPatterns.length; i++) {
      for (let j = i + 1; j < allPatterns.length; j++) {
        const pattern1 = allPatterns[i];
        const pattern2 = allPatterns[j];
        
        // 简单检查是否有重叠的函数名
        const funcs1 = pattern1.substring(1, pattern1.length - 1).split('|');
        const funcs2 = pattern2.substring(1, pattern2.length - 1).split('|');
        
        const commonFuncs = funcs1.filter(func => funcs2.includes(func));
        if (commonFuncs.length > 0) {
          console.log(`⚠️  模式重叠: "${pattern1}" 和 "${pattern2}" 都包含: ${commonFuncs.join(', ')}`);
        }
      }
    }
  });
});