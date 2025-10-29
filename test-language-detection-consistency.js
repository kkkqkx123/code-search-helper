const { DIContainer } = require('./src/core/DIContainer');
const { TYPES } = require('./src/types');

async function testLanguageDetectionConsistency() {
  console.log('Testing language detection consistency...');
  
  try {
    // 初始化DI容器
    const diContainer = new DIContainer();
    diContainer.initialize();
    
    // 获取检测服务
    const detectionService = diContainer.get(TYPES.UnifiedDetectionService);
    
    // 测试文件
    const testFiles = [
      {
        path: 'test-files/dataStructure/bt.go',
        content: `package main

type Node struct {
	data       int
	leftChild  *Node
	rightChild *Node
}

type Tree struct {
}`
      },
      {
        path: 'test-files/dataStructure/datastructure/linked_list.go',
        content: `package datastructure

import "fmt"

type node struct {
	value int
	next  *node
}

type linkedList struct {
	head   *node
	tail   *node
	length int
}

func NewLinkedList() *linkedList {
	L := new(linkedList)
	L.head = nil
	L.tail = nil
	L.length = 0
	return L
}

func ListIsEmpty(L *linkedList) bool {
	if L.head == nil {
		return true
	} else {
		return false
	}
}

func Append(L *linkedList, value int, position int) bool {
	newNode := new(node)
	newNode.value = value
    if position < 0 || position > L.length {
        return fmt.Errorf("无效的位置参数")
    }
	if position == 0 {
		newNode.next = L.head
		L.head = newNode
		if L.tail == nil {
			L.tail = newNode
		}
		L.length++
		return true
	}
	current := L.head
	for i := 0; i < position-1; i++ {
		current = current.next
	}
	newNode.next = current.next
	current.next = newNode

	if newNode.next == nil {
		L.tail = newNode
	}

	if L.tail == current {
		L.tail = newNode
	}
	L.length++

	return true
}

func PrintList(L *linkedList) {
	currentNode := L.head
	for currentNode != nil {
		fmt.Println(currentNode.value)
		currentNode = currentNode.next
	}
}

func DeleteNode(L *linkedList, position int) error {
    if position < 0 || position >= L.length {
        return fmt.Errorf("无效的位置参数")
    }
    if position == 0 {
        L.head = L.head.next
        if L.head == nil {
            L.tail = nil
        }
        L.length--
        return nil
    }
    current := L.head
    for i := 0; i < position-1; i++ {
        current = current.next
    }
    current.next = current.next.next
    if current.next == nil {
        L.tail = current
    }
    L.length--
    return nil
}


func main() {
	L := NewLinkedList()
	Append(L, 1, 0)
	Append(L, 2, 1)
	Append(L, 3, 2)
	Append(L, 4, 3)
	PrintList(L)
}`
      }
    ];
    
    console.log('\n=== Language Detection Consistency Test ===\n');
    
    for (const testFile of testFiles) {
      console.log(`Testing file: ${testFile.path}`);
      
      // 多次检测同一文件，验证一致性
      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = await detectionService.detectFile(testFile.path, testFile.content);
        results.push({
          language: result.language,
          confidence: result.confidence,
          strategy: result.metadata.processingStrategy,
          detectionMethod: result.detectionMethod
        });
      }
      
      // 检查一致性
      const firstResult = results[0];
      const isConsistent = results.every(r => 
        r.language === firstResult.language &&
        r.strategy === firstResult.strategy &&
        r.detectionMethod === firstResult.detectionMethod
      );
      
      console.log(`  Language: ${firstResult.language}`);
      console.log(`  Strategy: ${firstResult.strategy}`);
      console.log(`  Confidence: ${firstResult.confidence}`);
      console.log(`  Detection Method: ${firstResult.detectionMethod}`);
      console.log(`  Consistency: ${isConsistent ? '✅ PASS' : '❌ FAIL'}`);
      
      if (!isConsistent) {
        console.log('  Inconsistent results:');
        results.forEach((r, i) => {
          console.log(`    Run ${i + 1}: ${JSON.stringify(r)}`);
        });
      }
      
      console.log('');
    }
    
    // 测试缓存功能
    console.log('=== Cache Test ===');
    const cacheStats = detectionService.getCacheStats();
    console.log(`Cache size: ${cacheStats.size}/${cacheStats.limit}`);
    
    console.log('\nLanguage detection consistency test completed!');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// 运行测试
testLanguageDetectionConsistency().catch(console.error);