import { UniversalTextSplitter } from '../UniversalTextSplitter';
import { LoggerService } from '../../../../utils/LoggerService';
import { ConfigurationManager } from '../../universal/config/ConfigurationManager';
import { ProtectionCoordinator } from '../../universal/protection/ProtectionCoordinator';

// Mock LoggerService
jest.mock('../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

// Mock ConfigurationManager
jest.mock('../../universal/config/ConfigurationManager');
const MockConfigurationManager = ConfigurationManager as jest.MockedClass<typeof ConfigurationManager>;

// Mock ProtectionCoordinator
jest.mock('../../universal/protection/ProtectionCoordinator');
const MockProtectionCoordinator = ProtectionCoordinator as jest.MockedClass<typeof ProtectionCoordinator>;

describe('UniversalTextSplitter', () => {
  let splitter: UniversalTextSplitter;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockConfigManager: jest.Mocked<ConfigurationManager>;
  let mockProtectionCoordinator: jest.Mocked<ProtectionCoordinator>;

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();

    mockConfigManager = new MockConfigurationManager() as jest.Mocked<ConfigurationManager>;
    mockConfigManager.getDefaultOptions = jest.fn().mockReturnValue({
      maxChunkSize: 2000,
      overlapSize: 200,
      maxLinesPerChunk: 100,
      enableBracketBalance: true,
      enableSemanticDetection: true,
      enableCodeOverlap: false,
      enableStandardization: true,
      standardizationFallback: true,
      maxOverlapRatio: 0.3,
      errorThreshold: 5,
      memoryLimitMB: 100,
      strategyPriorities: {
        'markdown': 1,
        'standardization': 2,
        'semantic': 3,
        'bracket': 4,
        'line': 5
      },
      filterConfig: {
        enableSmallChunkFilter: true,
        enableChunkRebalancing: true,
        minChunkSize: 50,
        maxChunkSize: 3000
      },
      protectionConfig: {
        enableProtection: true,
        protectionLevel: 'medium'
      }
    });
    mockConfigManager.validateOptions = jest.fn().mockReturnValue(true);
    mockConfigManager.mergeOptions = jest.fn().mockImplementation((base, override) => ({ ...base, ...override }));

    mockProtectionCoordinator = new MockProtectionCoordinator() as jest.Mocked<ProtectionCoordinator>;
    mockProtectionCoordinator.setProtectionChain = jest.fn();
    mockProtectionCoordinator.checkProtection = jest.fn().mockResolvedValue(true);
    mockProtectionCoordinator.createProtectionContext = jest.fn().mockImplementation((operation, context, additionalMetadata) => ({
      operation,
      ...context,
      ...additionalMetadata
    }));

    splitter = new UniversalTextSplitter(mockLogger, mockConfigManager, mockProtectionCoordinator);
  });

  describe('chunkBySemanticBoundaries', () => {
    it('should chunk TypeScript code correctly', async () => {
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

      const chunks = await splitter.chunkBySemanticBoundaries(tsCode, 'test.ts', 'typescript');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.language).toBe('typescript');
      expect(chunks[0].metadata.type).toBe('semantic');
      expect(chunks[0].metadata.filePath).toBe('test.ts');
    });

    it('should chunk Python code correctly', async () => {
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

      const chunks = await splitter.chunkBySemanticBoundaries(pythonCode, 'test.py', 'python');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.language).toBe('python');
      expect(chunks[0].metadata.type).toBe('semantic');
    });

    it('should handle large files with memory protection', async () => {
      // Create a large content that would normally cause memory issues
      const largeContent = 'const x = 1;\n'.repeat(20000); // 20,000 lines

      const chunks = await splitter.chunkBySemanticBoundaries(largeContent, 'large.js', 'javascript');

      expect(chunks.length).toBeGreaterThan(0);
      // Should have limited the number of lines processed due to memory protection
      expect(chunks[0].metadata.endLine).toBeLessThanOrEqual(10000);
    });
  });

  describe('chunkByBracketsAndLines', () => {
    it('should chunk JavaScript code with bracket balance', async () => {
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

      const chunks = await splitter.chunkByBracketsAndLines(jsCode, 'cart.js', 'javascript');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.language).toBe('javascript');
      expect(chunks[0].metadata.type).toBe('bracket');
    });

    it('should chunk XML/HTML with tag balance', async () => {
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

      const chunks = await splitter.chunkByBracketsAndLines(xmlContent, 'test.xml', 'xml');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.language).toBe('xml');
    });
  });
});