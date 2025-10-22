const Parser = require('tree-sitter');
const Go = require('tree-sitter-go');
const fs = require('fs');
const path = require('path');

// 读取查询规则文件
const functionsTypes = fs.readFileSync(path.join(__dirname, 'src/service/parser/constants/queries/go/functions-types.ts'), 'utf8');
const variablesImports = fs.readFileSync(path.join(__dirname, 'src/service/parser/constants/queries/go/variables-imports.ts'), 'utf8');
const expressionsControlFlow = fs.readFileSync(path.join(__dirname, 'src/service/parser/constants/queries/go/expressions-control-flow.ts'), 'utf8');

// 提取查询字符串（去掉export default和反引号）
const extractQuery = (content) => {
  const match = content.match(/export default\s+`([^`]+)`/s);
  return match ? match[1] : '';
};

const goQueries = `
${extractQuery(functionsTypes)}

${extractQuery(variablesImports)}

${extractQuery(expressionsControlFlow)}
`;

// 测试Go代码示例
const testCode = `
package main

import (
	"fmt"
	"net/http"
	. "some/dsl"
	_ "os"
	alias "some/package"
)

// Person struct represents a person
type Person struct {
	Name string
	Age  int
}

// Interface example
type Reader interface {
	Read(p []byte) (n int, err error)
}

// Generic type example
type Container[T any] struct {
	data []T
}

// Function with parameters and return value
func add(a, b int) int {
	return a + b
}

// Method example
func (p *Person) Greet() string {
	return "Hello, " + p.Name
}

// Generic function
func GenericFunc[T any](value T) T {
	return value
}

// Test function
func TestAdd(t *testing.T) {
	result := add(2, 3)
	if result != 5 {
		t.Errorf("Expected 5, got %d", result)
	}
}

// Main function
func main() {
	// Variable declarations
	var x int = 10
	y := 20
	
	// Constants
	const pi = 3.14159
	
	// Array and slice
	arr := [5]int{1, 2, 3, 4, 5}
	slice := []int{1, 2, 3}
	
	// Map
	m := map[string]int{
		"one": 1,
		"two": 2,
	}
	
	// Channel operations
	ch := make(chan int)
	ch <- 42
	value := <-ch
	
	// Type assertion
	var iface interface{} = "hello"
	str := iface.(string)
	
	// Control flow
	if x > 5 {
		fmt.Println("x is greater than 5")
	}
	
	for i := 0; i < 10; i++ {
		fmt.Println(i)
	}
	
	switch y {
	case 20:
		fmt.Println("y is 20")
	default:
		fmt.Println("y is something else")
	}
	
	// Function call
	result := add(x, y)
	fmt.Printf("Result: %d\n", result)
	
	// Goroutine
	go func() {
		fmt.Println("Hello from goroutine")
	}()
	
	// Defer
	defer fmt.Println("Deferred call")
	
	// Panic and recover
	defer func() {
		if r := recover(); r != nil {
			fmt.Println("Recovered from panic:", r)
		}
	}()
	
	// Select statement
	select {
	case msg := <-ch:
		fmt.Println("Received:", msg)
	default:
		fmt.Println("No message received")
	}
}
`;

// 初始化解析器
const parser = new Parser();
parser.setLanguage(Go);

// 解析测试代码
const tree = parser.parse(testCode);

// 创建查询
try {
	const query = new Parser.Query(Go, goQueries);
	
	// 执行查询
	const matches = query.matches(tree.rootNode);
	
	// 统计结果
	const stats = {};
	matches.forEach(match => {
		const captureName = match.captures[0].name;
		stats[captureName] = (stats[captureName] || 0) + 1;
	});
	
	// 输出结果
	console.log('Go查询规则验证结果:');
	console.log('====================');
	console.log(`总共匹配到 ${matches.length} 个节点`);
	console.log('\n按类型统计:');
	Object.entries(stats)
		.sort((a, b) => b[1] - a[1])
		.forEach(([name, count]) => {
			console.log(`  ${name}: ${count}`);
		});
	
	// 验证关键节点是否被正确匹配
	const keyNodes = [
		'name.definition.function',
		'name.definition.method',
		'name.definition.type',
		'name.definition.interface',
		'name.definition.struct',
		'name.definition.import',
		'name.definition.var',
		'name.definition.const',
		'name.definition.if',
		'name.definition.for',
		'name.definition.switch',
		'name.definition.call',
		'name.definition.select',
		'name.definition.goroutine',
		'name.definition.test'
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
	if (!stats['name.definition.function']) {
		errors.push('未匹配到函数声明');
	}
	if (!stats['name.definition.type']) {
		errors.push('未匹配到类型声明');
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
			const query = new Parser.Query(Go, queryString);
			const matches = query.matches(tree.rootNode);
			console.log(`✓ ${queryName}: ${matches.length} 个匹配`);
		} catch (error) {
			console.log(`✗ ${queryName}: ${error.message}`);
		}
	};
	
	testSingleQuery('functions-types', extractQuery(functionsTypes));
	testSingleQuery('variables-imports', extractQuery(variablesImports));
	testSingleQuery('expressions-control-flow', extractQuery(expressionsControlFlow));
}