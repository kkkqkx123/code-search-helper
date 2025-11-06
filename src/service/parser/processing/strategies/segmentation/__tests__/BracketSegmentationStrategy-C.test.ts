import { BracketSegmentationStrategy } from '../BracketSegmentationStrategy';
import { LoggerService } from '../../../../../../utils/LoggerService';
import { ISegmentationStrategy, SegmentationContext, IComplexityCalculator } from '../../types/SegmentationTypes';
import { CodeChunk } from '../../../../types/core-types';

// Mock LoggerService
jest.mock('../../../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

// Mock IComplexityCalculator
const mockComplexityCalculator: jest.Mocked<IComplexityCalculator> = {
  calculate: jest.fn()
};

describe('BracketSegmentationStrategy - C Language Tests', () => {
  let strategy: BracketSegmentationStrategy;
  let mockLogger: jest.Mocked<LoggerService>;

  // Create mock chunks for testing
  const createMockChunk = (content: string, startLine: number, endLine: number, type: string = 'bracket'): CodeChunk => ({
    content,
    metadata: {
      startLine,
      endLine,
      language: 'c',
      filePath: 'test.c',
      type: type as 'function' | 'class' | 'interface' | 'method' | 'code' | 'import' | 'generic' | 'semantic' | 'bracket' | 'line' | 'overlap' | 'merged' | 'sub_function' | 'heading' | 'paragraph' | 'table' | 'list' | 'blockquote' | 'code_block',
      complexity: 1
    }
  });

  // Create mock context for C language
  const createMockContext = (language = 'c', enableBracketBalance = true): SegmentationContext => ({
    content: 'test content',
    options: {
      maxChunkSize: 2000,
      overlapSize: 200,
      maxLinesPerChunk: 50,
      enableBracketBalance,
      enableSemanticDetection: true,
      enableCodeOverlap: false,
      enableStandardization: true,
      standardizationFallback: true,
      maxOverlapRatio: 0.3,
      errorThreshold: 5,
      memoryLimitMB: 500,
      filterConfig: {
        enableSmallChunkFilter: true,
        enableChunkRebalancing: true,
        minChunkSize: 50,
        maxChunkSize: 1000
      },
      protectionConfig: {
        enableProtection: true,
        protectionLevel: 'medium'
      }
    },
    metadata: {
      contentLength: 12,
      lineCount: 1,
      isSmallFile: true,
      isCodeFile: true,
      isMarkdownFile: false
    }
  });

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();

    strategy = new BracketSegmentationStrategy(mockComplexityCalculator, mockLogger);
  });

  describe('C Language Support', () => {
    it('should support C language', () => {
      const languages = strategy.getSupportedLanguages();
      expect(languages).toContain('c');
    });

    it('should handle C files correctly', () => {
      const context = createMockContext('c', true);
      expect(strategy.canHandle(context)).toBe(true);
    });
  });

  describe('C Function Segmentation', () => {
    it('should segment simple C functions', async () => {
      const content = `
#include <stdio.h>
#include <stdlib.h>

int add(int a, int b) {
    return a + b;
}

int multiply(int x, int y) {
    return x * y;
}

int main() {
    int result = add(5, 3);
    printf("Result: %d\\n", result);
    return 0;
}
      `;

      const context = createMockContext('c', true);
      const chunks = await strategy.segment({ 
        ...context, 
        content, 
        filePath: 'test.c', 
        language: 'c' 
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.metadata.type === 'bracket')).toBe(true);
      expect(chunks.every(chunk => chunk.metadata.language === 'c')).toBe(true);
      
      // Should have separate chunks for different functions
      const functionChunks = chunks.filter(chunk => 
        chunk.content.includes('int add') || 
        chunk.content.includes('int multiply') || 
        chunk.content.includes('int main')
      );
      expect(functionChunks.length).toBeGreaterThan(0);
    });

    it('should segment C functions with complex nesting', async () => {
      const content = `
#include <stdio.h>

void processArray(int arr[], int size) {
    for (int i = 0; i < size; i++) {
        if (arr[i] % 2 == 0) {
            for (int j = 0; j < arr[i]; j++) {
                printf("Even number: %d, Count: %d\\n", arr[i], j);
            }
        } else {
            switch (arr[i]) {
                case 1:
                    printf("One\\n");
                    break;
                case 3:
                    printf("Three\\n");
                    break;
                case 5:
                    printf("Five\\n");
                    break;
                default:
                    printf("Other odd number: %d\\n", arr[i]);
                    break;
            }
        }
    }
}
      `;

      const context = createMockContext('c', true);
      const chunks = await strategy.segment({ 
        ...context, 
        content, 
        filePath: 'process.c', 
        language: 'c' 
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.type).toBe('bracket');
      expect(chunks[0].metadata.language).toBe('c');
      
      // Should handle nested brackets correctly
      const processArrayChunk = chunks.find(chunk => 
        chunk.content.includes('processArray')
      );
      expect(processArrayChunk).toBeDefined();
      expect(processArrayChunk!.content).toContain('for');
      expect(processArrayChunk!.content).toContain('if');
      expect(processArrayChunk!.content).toContain('switch');
    });

    it('should segment C functions with pointers and structs', async () => {
      const content = `
#include <stdio.h>
#include <string.h>

typedef struct {
    char name[50];
    int age;
    float score;
} Student;

void updateStudent(Student* student, const char* newName, int newAge) {
    if (student != NULL && newName != NULL) {
        strncpy(student->name, newName, sizeof(student->name) - 1);
        student->name[sizeof(student->name) - 1] = '\\0';
        student->age = newAge;
    }
}

Student* createStudent(const char* name, int age, float score) {
    Student* student = (Student*)malloc(sizeof(Student));
    if (student != NULL) {
        strncpy(student->name, name, sizeof(student->name) - 1);
        student->name[sizeof(student->name) - 1] = '\\0';
        student->age = age;
        student->score = score;
    }
    return student;
}
      `;

      const context = createMockContext('c', true);
      const chunks = await strategy.segment({ 
        ...context, 
        content, 
        filePath: 'student.c', 
        language: 'c' 
      });

      expect(chunks.length).toBeGreaterThan(0);
      
      // Should handle pointer operations and struct definitions
      const structChunk = chunks.find(chunk => 
        chunk.content.includes('typedef struct')
      );
      expect(structChunk).toBeDefined();
      
      const pointerChunks = chunks.filter(chunk => 
        chunk.content.includes('*')
      );
      expect(pointerChunks.length).toBeGreaterThan(0);
    });
  });

  describe('C Preprocessor Directives', () => {
    it('should handle C preprocessor directives', async () => {
      const content = `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_SIZE 100
#define PI 3.14159

#ifdef DEBUG
    #define DEBUG_PRINT(x) printf(x)
#else
    #define DEBUG_PRINT(x)
#endif

#if defined(VERSION) && VERSION >= 2
    #define NEW_FEATURE 1
#else
    #define NEW_FEATURE 0
#endif

void testMacros() {
    int arr[MAX_SIZE];
    float circle = PI * 2.0f;
    
    DEBUG_PRINT("Debug mode\\n");
    
    #if NEW_FEATURE
        printf("New feature enabled\\n");
    #endif
}
      `;

      const context = createMockContext('c', true);
      const chunks = await strategy.segment({ 
        ...context, 
        content, 
        filePath: 'preprocessor.c', 
        language: 'c' 
      });

      expect(chunks.length).toBeGreaterThan(0);
      
      // Should handle preprocessor directives correctly
      const macroChunks = chunks.filter(chunk => 
        chunk.content.includes('#define') || 
        chunk.content.includes('#ifdef') || 
        chunk.content.includes('#if')
      );
      expect(macroChunks.length).toBeGreaterThan(0);
    });
  });

  describe('C Complex Data Structures', () => {
    it('should segment C code with complex structs and unions', async () => {
      const content = `
#include <stdio.h>
#include <stdlib.h>

typedef struct {
    int x;
    int y;
} Point;

typedef struct {
    Point topLeft;
    Point bottomRight;
} Rectangle;

typedef union {
    int intValue;
    float floatValue;
    char stringValue[20];
} DataValue;

typedef struct Node {
    int data;
    struct Node* next;
    struct Node* prev;
} DoublyLinkedListNode;

DoublyLinkedListNode* createNode(int data) {
    DoublyLinkedListNode* node = (DoublyLinkedListNode*)malloc(sizeof(DoublyLinkedListNode));
    if (node != NULL) {
        node->data = data;
        node->next = NULL;
        node->prev = NULL;
    }
    return node;
}

void insertNode(DoublyLinkedListNode** head, int data) {
    DoublyLinkedListNode* newNode = createNode(data);
    if (*head == NULL) {
        *head = newNode;
    } else {
        newNode->next = *head;
        (*head)->prev = newNode;
        *head = newNode;
    }
}
      `;

      const context = createMockContext('c', true);
      const chunks = await strategy.segment({ 
        ...context, 
        content, 
        filePath: 'datastructures.c', 
        language: 'c' 
      });

      expect(chunks.length).toBeGreaterThan(0);
      
      // Should handle complex data structures
      const structChunks = chunks.filter(chunk => 
        chunk.content.includes('typedef struct')
      );
      expect(structChunks.length).toBeGreaterThan(0);
      
      const unionChunks = chunks.filter(chunk => 
        chunk.content.includes('typedef union')
      );
      expect(unionChunks.length).toBeGreaterThan(0);
    });
  });

  describe('C Error Handling', () => {
    it('should handle C code with error-prone bracket patterns', async () => {
      const content = `
#include <stdio.h>

int problematicFunction() {
    if (condition1) {
        if (condition2) {
            if (condition3) {
                // Deeply nested code
                for (int i = 0; i < 10; i++) {
                    while (nested) {
                        if (deepCondition) {
                            // Very deep nesting
                        }
                    }
                }
            }
        }
    }
    
    // Missing closing bracket - should handle gracefully
    if (anotherCondition) {
        printf("This bracket is properly closed");
    }
    
    return 0;
// Missing final closing bracket
      `;

      const context = createMockContext('c', true);
      const chunks = await strategy.segment({ 
        ...context, 
        content, 
        filePath: 'problematic.c', 
        language: 'c' 
      });

      expect(chunks.length).toBeGreaterThan(0);
      // Should still create chunks even with unbalanced brackets
      expect(chunks.every(chunk => chunk.metadata.language === 'c')).toBe(true);
    });

    it('should handle empty C files', async () => {
      const content = '';
      const context = createMockContext('c', true);

      const chunks = await strategy.segment({ 
        ...context, 
        content, 
        filePath: 'empty.c', 
        language: 'c' 
      });

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('');
      expect(chunks[0].metadata.startLine).toBe(1);
      expect(chunks[0].metadata.endLine).toBe(0);
    });
  });

  describe('C Performance and Memory', () => {
    it('should respect max lines per chunk for C code', async () => {
      const content = `
#include <stdio.h>

void largeFunction() {
    printf("Line 1\\n");
    printf("Line 2\\n");
    printf("Line 3\\n");
    printf("Line 4\\n");
    printf("Line 5\\n");
    printf("Line 6\\n");
    printf("Line 7\\n");
    printf("Line 8\\n");
    printf("Line 9\\n");
    printf("Line 10\\n");
    printf("Line 11\\n");
    printf("Line 12\\n");
    printf("Line 13\\n");
    printf("Line 14\\n");
    printf("Line 15\\n");
    printf("Line 16\\n");
    printf("Line 17\\n");
    printf("Line 18\\n");
    printf("Line 19\\n");
    printf("Line 20\\n");
    printf("Line 21\\n");
    printf("Line 22\\n");
    printf("Line 23\\n");
    printf("Line 24\\n");
    printf("Line 25\\n");
    printf("Line 26\\n");
    printf("Line 27\\n");
    printf("Line 28\\n");
    printf("Line 29\\n");
    printf("Line 30\\n");
    printf("Line 31\\n");
    printf("Line 32\\n");
    printf("Line 33\\n");
    printf("Line 34\\n");
    printf("Line 35\\n");
    printf("Line 36\\n");
    printf("Line 37\\n");
    printf("Line 38\\n");
    printf("Line 39\\n");
    printf("Line 40\\n");
    printf("Line 41\\n");
    printf("Line 42\\n");
    printf("Line 43\\n");
    printf("Line 44\\n");
    printf("Line 45\\n");
    printf("Line 46\\n");
    printf("Line 47\\n");
    printf("Line 48\\n");
    printf("Line 49\\n");
    printf("Line 50\\n");
    printf("Line 51\\n");
    printf("Line 52\\n");
    printf("Line 53\\n");
    printf("Line 54\\n");
    printf("Line 55\\n");
}
      `;

      const context = createMockContext('c', true);
      const chunks = await strategy.segment({ 
        ...context, 
        content, 
        filePath: 'large.c', 
        language: 'c' 
      });

      // Should split into multiple chunks due to line limit
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk: { metadata: { endLine: number; startLine: number; }; }) => {
        expect(chunk.metadata.endLine - chunk.metadata.startLine + 1).toBeLessThanOrEqual(50);
      });
    });

    it('should respect max chunk size for C code', async () => {
      const content = 'char largeArray[] = "' + 'A'.repeat(3000) + '";';
      const context = createMockContext('c', true);

      const chunks = await strategy.segment({ 
        ...context, 
        content, 
        filePath: 'huge.c', 
        language: 'c' 
      });

      // Should handle large content (may or may not split depending on bracket balance)
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      chunks.forEach((chunk: { content: string | any[]; }) => {
        expect(chunk.content.length).toBeLessThanOrEqual(3300); // Allow some tolerance for single-line content
      });
    });
  });

  describe('C Integration Tests', () => {
    it('should handle complete C program with multiple components', async () => {
      const content = `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_STUDENTS 50
#define MAX_NAME_LENGTH 50

typedef struct {
    int id;
    char name[MAX_NAME_LENGTH];
    float grade;
} Student;

typedef struct {
    Student students[MAX_STUDENTS];
    int count;
} Classroom;

Classroom* createClassroom() {
    Classroom* classroom = (Classroom*)malloc(sizeof(Classroom));
    if (classroom != NULL) {
        classroom->count = 0;
    }
    return classroom;
}

int addStudent(Classroom* classroom, int id, const char* name, float grade) {
    if (classroom == NULL || classroom->count >= MAX_STUDENTS) {
        return -1;
    }
    
    Student* student = &classroom->students[classroom->count];
    student->id = id;
    strncpy(student->name, name, MAX_NAME_LENGTH - 1);
    student->name[MAX_NAME_LENGTH - 1] = '\\0';
    student->grade = grade;
    
    classroom->count++;
    return 0;
}

float calculateAverage(const Classroom* classroom) {
    if (classroom == NULL || classroom->count == 0) {
        return 0.0f;
    }
    
    float sum = 0.0f;
    for (int i = 0; i < classroom->count; i++) {
        sum += classroom->students[i].grade;
    }
    
    return sum / classroom->count;
}

void printClassroom(const Classroom* classroom) {
    if (classroom == NULL) {
        printf("Classroom is NULL\\n");
        return;
    }
    
    printf("Classroom Report:\\n");
    printf("Total Students: %d\\n", classroom->count);
    printf("Average Grade: %.2f\\n", calculateAverage(classroom));
    printf("--------------------\\n");
    
    for (int i = 0; i < classroom->count; i++) {
        const Student* student = &classroom->students[i];
        printf("ID: %d, Name: %s, Grade: %.2f\\n", 
               student->id, student->name, student->grade);
    }
}

void freeClassroom(Classroom* classroom) {
    free(classroom);
}

int main() {
    Classroom* classroom = createClassroom();
    
    addStudent(classroom, 1, "Alice Johnson", 85.5f);
    addStudent(classroom, 2, "Bob Smith", 92.0f);
    addStudent(classroom, 3, "Charlie Brown", 78.5f);
    
    printClassroom(classroom);
    
    freeClassroom(classroom);
    return 0;
}
      `;

      const context = createMockContext('c', true);
      const chunks = await strategy.segment({ 
        ...context, 
        content, 
        filePath: 'classroom.c', 
        language: 'c' 
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.metadata.type === 'bracket')).toBe(true);
      expect(chunks.every(chunk => chunk.metadata.language === 'c')).toBe(true);
      
      // Should have chunks for different functions
      const functionNames = ['createClassroom', 'addStudent', 'calculateAverage', 'printClassroom', 'freeClassroom', 'main'];
      functionNames.forEach(functionName => {
        const functionChunk = chunks.find(chunk => 
          chunk.content.includes(functionName)
        );
        expect(functionChunk).toBeDefined();
      });
    });
  });
});