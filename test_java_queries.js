const Parser = require('tree-sitter');
const Java = require('tree-sitter-java');
const fs = require('fs');
const path = require('path');

// 读取查询规则文件
const classesInterfaces = fs.readFileSync(path.join(__dirname, 'src/service/parser/constants/queries/java/classes-interfaces.ts'), 'utf8');
const methodsVariables = fs.readFileSync(path.join(__dirname, 'src/service/parser/constants/queries/java/methods-variables.ts'), 'utf8');
const controlFlowPatterns = fs.readFileSync(path.join(__dirname, 'src/service/parser/constants/queries/java/control-flow-patterns.ts'), 'utf8');

// 提取查询字符串（去掉export default和反引号）
const extractQuery = (content) => {
  const match = content.match(/export default\s+`([^`]+)`/s);
  return match ? match[1] : '';
};

const javaQueries = `
${extractQuery(classesInterfaces)}

${extractQuery(methodsVariables)}

${extractQuery(controlFlowPatterns)}
`;

// 测试Java代码示例
const testCode = `
package com.example;

import java.util.List;
import java.util.ArrayList;
import static java.util.Collections.emptyList;

// Module declaration
module com.example.app {
    requires java.base;
    exports com.example;
}

/**
 * A sample class demonstrating various Java features
 */
public class SampleClass<T extends Comparable<T>> implements Runnable {
    private static final int CONSTANT = 42;
    private String name;
    private List<String> items;
    
    // Record declaration
    public record Person(String name, int age) {}
    
    // Enum declaration
    public enum Status {
        ACTIVE, INACTIVE, PENDING
    }
    
    // Constructor
    public SampleClass(String name) {
        this.name = name;
        this.items = new ArrayList<>();
    }
    
    // Method declaration
    public void processItems() {
        items.forEach(item -> System.out.println(item));
    }
    
    // Generic method
    public <U> List<U> convertList(List<U> source) {
        return new ArrayList<>(source);
    }
    
    // Lambda expression
    Runnable runnable = () -> {
        System.out.println("Lambda execution");
    };
    
    // Switch expression (Java 14+)
    public String getStatusDescription(Status status) {
        return switch (status) {
            case ACTIVE -> "Active status";
            case INACTIVE -> "Inactive status";
            case PENDING -> "Pending status";
        };
    }
    
    // Pattern matching with instanceof (Java 16+)
    public void processObject(Object obj) {
        if (obj instanceof String s) {
            System.out.println("String: " + s);
        } else if (obj instanceof Person(String name, int age)) {
            System.out.println("Person: " + name + ", " + age);
        }
    }
    
    // Try with resources
    public void readFile() {
        try (var reader = new java.io.BufferedReader(new java.io.StringReader("test"))) {
            String line = reader.readLine();
            System.out.println(line);
        } catch (java.io.IOException e) {
            System.err.println("Error reading: " + e.getMessage());
        }
    }
    
    // For loop
    public void iterateList() {
        for (int i = 0; i < 10; i++) {
            System.out.println("Index: " + i);
        }
        
        for (String item : items) {
            System.out.println("Item: " + item);
        }
    }
    
    // While loop
    public void whileLoop() {
        int count = 0;
        while (count < 5) {
            count++;
        }
        
        do {
            count--;
        } while (count > 0);
    }
    
    // If statement
    public void conditionalLogic(int value) {
        if (value > 0) {
            System.out.println("Positive");
        } else if (value < 0) {
            System.out.println("Negative");
        } else {
            System.out.println("Zero");
        }
    }
    
    // Synchronized block
    public void synchronizedMethod() {
        synchronized (this) {
            System.out.println("Synchronized block");
        }
    }
    
    // Annotation usage
    @Override
    @Deprecated
    public void run() {
        System.out.println("Running");
    }
    
    // Array operations
    public void arrayOperations() {
        int[] numbers = {1, 2, 3, 4, 5};
        String[][] matrix = new String[3][3];
        
        for (int num : numbers) {
            System.out.println(num);
        }
    }
    
    // Class literal
    public void classLiteral() {
        Class<?> stringClass = String.class;
        System.out.println("String class: " + stringClass);
    }
    
    // Cast and instanceof
    public void typeOperations(Object obj) {
        if (obj instanceof List) {
            List<?> list = (List<?>) obj;
            System.out.println("List size: " + list.size());
        }
    }
}

// Interface declaration
interface Drawable {
    void draw();
    
    default void defaultMethod() {
        System.out.println("Default implementation");
    }
}

// Annotation declaration
@interface MyAnnotation {
    String value() default "";
    int count() default 0;
}
`;

// 初始化解析器
const parser = new Parser();
parser.setLanguage(Java);

// 解析测试代码
const tree = parser.parse(testCode);

// 创建查询
try {
  const query = new Parser.Query(Java, javaQueries);
  
  // 执行查询
  const matches = query.matches(tree.rootNode);
  
  // 统计结果
  const stats = {};
  matches.forEach(match => {
    const captureName = match.captures[0].name;
    stats[captureName] = (stats[captureName] || 0) + 1;
  });
  
  // 输出结果
  console.log('Java查询规则验证结果:');
  console.log('=====================');
  console.log(`总共匹配到 ${matches.length} 个节点`);
  console.log('\n按类型统计:');
  Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => {
      console.log(`  ${name}: ${count}`);
    });
  
  // 验证关键节点是否被正确匹配
  const keyNodes = [
    'name.definition.class',
    'name.definition.interface',
    'name.definition.enum',
    'name.definition.record',
    'name.definition.annotation',
    'name.definition.method',
    'name.definition.constructor',
    'name.definition.field',
    'name.definition.local_variable',
    'name.definition.package',
    'name.definition.import',
    'name.definition.switch_expression',
    'name.definition.for_statement',
    'name.definition.while_statement',
    'name.definition.if_statement',
    'name.definition.try_statement',
    'name.definition.lambda',
    'name.definition.record_pattern',
    'name.definition.type_pattern'
  ];
  
  console.log('\n关键节点验证:');
  keyNodes.forEach(nodeType => {
    const count = stats[nodeType] || 0;
    console.log(`  ${nodeType}: ${count} ${count > 0 ? '✓' : '✗'}`);
  });
  
  // 检查是否有错误
  const errors = [];
  if (!stats['name.definition.package']) {
    errors.push('未匹配到package声明');
  }
  if (!stats['name.definition.import']) {
    errors.push('未匹配到import声明');
  }
  if (!stats['name.definition.class']) {
    errors.push('未匹配到类声明');
  }
  if (!stats['name.definition.method']) {
    errors.push('未匹配到方法声明');
  }
  
  if (errors.length > 0) {
    console.log('\n发现的问题:');
    errors.forEach(error => console.log(`  - ${error}`));
  } else {
    console.log('\n✓ 所有关键节点都正确匹配');
  }
  
  // 输出一些具体的匹配示例
  console.log('\n匹配示例:');
  const examples = matches.slice(0, 5);
  examples.forEach((match, index) => {
    const capture = match.captures[0];
    const node = capture.node;
    const text = testCode.slice(node.startIndex, node.endIndex);
    console.log(`  ${index + 1}. ${capture.name}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
  });
  
  console.log('\n验证完成!');
  
} catch (error) {
  console.error('查询执行失败:', error.message);
  console.error('错误详情:', error);
  
  // 尝试逐个测试查询文件
  console.log('\n尝试单独测试每个查询文件...');
  
  const testSingleQuery = (queryName, queryString) => {
    try {
      const query = new Parser.Query(Java, queryString);
      const matches = query.matches(tree.rootNode);
      console.log(`✓ ${queryName}: ${matches.length} 个匹配`);
    } catch (error) {
      console.log(`✗ ${queryName}: ${error.message}`);
    }
  };
  
  testSingleQuery('classes-interfaces', extractQuery(classesInterfaces));
  testSingleQuery('methods-variables', extractQuery(methodsVariables));
  testSingleQuery('control-flow-patterns', extractQuery(controlFlowPatterns));
}