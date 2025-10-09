
import { UniversalTextSplitter } from '../UniversalTextSplitter';
import { LoggerService } from '../../../../utils/LoggerService';

// Mock LoggerService
jest.mock('../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

describe('UniversalTextSplitter', () => {
  let splitter: UniversalTextSplitter;
  let mockLogger: jest.Mocked<LoggerService>;

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();
    
    splitter = new UniversalTextSplitter(mockLogger);
  });

  describe('chunkBySemanticBoundaries', () => {
    it('should chunk TypeScript code correctly', () => {
      const tsCode = `
import { Component } from '@angular/core';

@Component({
  selector: 'app-test',
  template: '<div>Hello World</div>'
})
export class TestComponent {
  private title: string = 'Test';
  
  constructor() {}
  
  ngOnInit(): void {
    console.log('Component initialized');
  }
  
  private helperMethod(): void {
    const data = [1, 2, 3];
    return data.map(x => x * 2);
  }
}
      `.trim();

      const chunks = splitter.chunkBySemanticBoundaries(tsCode, 'test.ts', 'typescript');
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.language).toBe('typescript');
      expect(chunks[0].metadata.type).toBe('semantic');
      expect(chunks[0].metadata.filePath).toBe('test.ts');
    });

    it('should chunk Python code correctly', () => {
      const pythonCode = `
import os
import sys
from typing import List, Dict

def main():
    """Main function"""
    print("Hello, World!")
    
    data = process_data([1, 2, 3, 4, 5])
    print(f"Processed: {data}")

def process_data(items: List[int]) -> List[int]:
    """Process the input data"""
    return [item * 2 for item in items]

class DataProcessor:
    def __init__(self, name: str):
        self.name = name
    
    def process(self, items: List[int]) -> Dict[str, int]:
        return {
            'count': len(items),
            'sum': sum(items)
        }

if __name__ == "__main__":
    main()
      `.trim();

      const chunks = splitter.chunkBySemanticBoundaries(pythonCode, 'test.py', 'python');
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.language).toBe('python');
      expect(chunks[0].metadata.type).toBe('semantic');
    });

    it('should handle large files with memory protection', () => {
      // Create a large content that would normally cause memory issues
      const largeContent = 'const x = 1;\n'.repeat(20000); // 20,000 lines
      
      const chunks = splitter.chunkBySemanticBoundaries(largeContent, 'large.js', 'javascript');
      
      expect(chunks.length).toBeGreaterThan(0);
      // Should have limited the number of lines processed due to memory protection
      expect(chunks[0].metadata.endLine).toBeLessThanOrEqual(10000);
    });
  });

  describe('chunkByBracketsAndLines', () => {
    it('should chunk JavaScript code with bracket balance', () => {
      const jsCode = `
function calculateTotal(items) {
  let total = 0;
  
  for (const item of items) {
    if (item.price > 0) {
      total += item.price * item.quantity;
    }
  }
  
  return total;
}

class ShoppingCart {
  constructor() {
    this.items = [];
  }
  
  addItem(item) {
    this.items.push(item);
  }
  
  getTotal() {
    return calculateTotal(this.items);
  }
}
      `.trim();

      const chunks = splitter.chunkByBracketsAndLines(jsCode, 'cart.js', 'javascript');
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.language).toBe('javascript');
      expect(chunks[0].metadata.type).toBe('bracket');
    });

    it('should chunk XML/HTML with tag balance', () => {
      const xmlContent = `
<?xml version="1.0" encoding="UTF-8"?>
<root>
  <item id="1">
    <name>Test Item</name>
    <value>123</value>
  </item>
  <item id="2">
    <name>Another Item</name>
    <value>456</value>
  </item>
</root>
      `.trim();

      const chunks = splitter.chunkByBracketsAndLines(xmlContent, 'test.xml', 'xml');
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.language).toBe('xml');
    });
  });
});