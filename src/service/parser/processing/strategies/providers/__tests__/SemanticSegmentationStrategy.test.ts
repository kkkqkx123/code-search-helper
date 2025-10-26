import { SemanticSegmentationStrategy } from '../strategies/SemanticSegmentationStrategy';
import { LoggerService } from '../../../../../../utils/LoggerService';
import { ISegmentationStrategy, SegmentationContext } from '../../types/SegmentationTypes';
import { CodeChunk } from '../../../../splitting';

// Mock LoggerService
jest.mock('../../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

describe('SemanticSegmentationStrategy', () => {
  let strategy: SemanticSegmentationStrategy;
  let mockLogger: jest.Mocked<LoggerService>;

  // Create mock chunks for testing
  const createMockChunk = (content: string, startLine: number, endLine: number, type: 'function' | 'class' | 'interface' | 'method' | 'code' | 'import' | 'generic' | 'semantic' | 'bracket' | 'line' | 'overlap' | 'merged' | 'sub_function' | 'heading' | 'paragraph' | 'table' | 'list' | 'blockquote' | 'code_block' | 'markdown' | 'standardization' | 'section' | 'content' = 'semantic'): CodeChunk => ({
    content,
    metadata: {
      startLine,
      endLine,
      language: 'javascript',
      filePath: 'test.js',
      type,
      complexity: 1
    }
  });

  // Create mock context
  const createMockContext = (language = 'javascript', enableSemanticDetection = true): SegmentationContext => ({
    content: 'test content',
    options: {
      maxChunkSize: 2000,
      overlapSize: 200,
      maxLinesPerChunk: 50,
      enableBracketBalance: true,
      enableSemanticDetection,
      enableCodeOverlap: false,
      enableStandardization: true,
      standardizationFallback: true,
      maxOverlapRatio: 0.3,
      errorThreshold: 5,
      memoryLimitMB: 500,
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

    // Create a mock complexity calculator
    const mockComplexityCalculator = {
      calculate: jest.fn().mockReturnValue(1)
    };

    strategy = new SemanticSegmentationStrategy(mockComplexityCalculator, mockLogger);
  });

  describe('getName', () => {
    it('should return the strategy name', () => {
      expect(strategy.getName()).toBe('semantic');
    });
  });

  describe('getPriority', () => {
    it('should return the strategy priority', () => {
      expect(strategy.getPriority()).toBe(3);
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return supported languages', () => {
      const languages = strategy.getSupportedLanguages();
      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBeGreaterThan(0);
      expect(languages).toContain('javascript');
      expect(languages).toContain('typescript');
      expect(languages).toContain('python');
      expect(languages).toContain('java');
      expect(languages).toContain('cpp');
      expect(languages).toContain('go');
      expect(languages).toContain('rust');
    });
  });

  describe('canHandle', () => {
    it('should return true for code files with semantic detection enabled', () => {
      const context = createMockContext('javascript', true);
      expect(strategy.canHandle(context)).toBe(true);
    });

    it('should return false when semantic detection is disabled', () => {
      const context = createMockContext('javascript', false);
      expect(strategy.canHandle(context)).toBe(false);
    });

    it('should return false for markdown files', () => {
      const context = createMockContext('markdown', true);
      expect(strategy.canHandle(context)).toBe(false);
    });

    it('should return true for supported programming languages', () => {
      const jsContext = createMockContext('javascript', true);
      const pyContext = createMockContext('python', true);
      const javaContext = createMockContext('java', true);

      expect(strategy.canHandle(jsContext)).toBe(true);
      expect(strategy.canHandle(pyContext)).toBe(true);
      expect(strategy.canHandle(javaContext)).toBe(true);
    });
  });

  describe('segment', () => {
    it('should segment JavaScript code by semantic boundaries', async () => {
      const content = `
        import React from 'react';
        
        function Component() {
          const [count, setCount] = React.useState(0);
          
          const handleClick = () => {
            setCount(prevCount => prevCount + 1);
          };
          
          return (
            <div>
              <h1>Count: {count}</h1>
              <button onClick={handleClick}>
                Click me
              </button>
            </div>
          );
        }
        
        export default Component;
      `;

      const context = createMockContext('javascript', true);
      context.content = content;
      context.filePath = 'Component.jsx';
      context.language = 'javascript';
      const chunks = await strategy.segment(context);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.type).toBe('semantic');
      expect(chunks[0].metadata.language).toBe('javascript');
      expect(chunks[0].metadata.filePath).toBe('Component.jsx');
    });

    it('should segment Python code by semantic boundaries', async () => {
      const content = `
        import os
        import sys
        from typing import List, Dict
        
        class DataProcessor:
            def __init__(self, config: Dict[str, Any]):
                self.config = config
                self.data = []
                
            def process_data(self, input_data: List[str]) -> List[Dict[str, Any]]:
                processed = []
                for item in input_data:
                    if self._validate_item(item):
                        processed_item = self._transform_item(item)
                        processed.append(processed_item)
                    else:
                        self._log_error(f"Invalid item: {item}")
                
                return processed
                
            def _validate_item(self, item: str) -> bool:
                return len(item) > 0 and item.strip() != ""
                
            def _transform_item(self, item: str) -> Dict[str, Any]:
                return {
                    'original': item,
                    'processed': item.upper(),
                    'length': len(item)
                }
                
            def _log_error(self, message: str) -> None:
                print(f"ERROR: {message}")
      `;

      const context = createMockContext('python', true);
      context.content = content;
      context.filePath = 'data_processor.py';
      context.language = 'python';
      const chunks = await strategy.segment(context);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.metadata.type === 'semantic')).toBe(true);
      expect(chunks.every(chunk => chunk.metadata.language === 'python'));
    });

    it('should segment Java code by semantic boundaries', async () => {
      const content = `
        package com.example;
        
        import java.util.List;
        import java.util.ArrayList;
        
        public class DataProcessor {
            private List<String> data;
            
            public DataProcessor() {
                this.data = new ArrayList<>();
            }
            
            public void addData(String item) {
                if (validateItem(item)) {
                    data.add(item);
                } else {
                    logError("Invalid item: " + item);
                }
            }
            
            public List<String> getData() {
                return new ArrayList<>(data);
            }
            
            private boolean validateItem(String item) {
                return item != null && !item.trim().isEmpty();
            }
            
            private void logError(String message) {
                System.err.println("ERROR: " + message);
            }
        }
      `;

      const context = createMockContext('java', true);
      context.content = content;
      context.filePath = 'DataProcessor.java';
      context.language = 'java';
      const chunks = await strategy.segment(context);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.metadata.type === 'semantic')).toBe(true);
      expect(chunks.every(chunk => chunk.metadata.language === 'java'));
    });

    it('should segment TypeScript code by semantic boundaries', async () => {
      const content = `
        import { Injectable } from '@angular/core';
        import { HttpClient } from '@angular/common/http';
        import { Observable } from 'rxjs';
        
        interface DataItem {
          id: number;
          name: string;
          value: number;
        }
        
        @Injectable({
          providedIn: 'root'
        })
        export class DataService {
          private apiUrl = 'https://api.example.com/data';
          
          constructor(private http: HttpClient) {}
          
          getData(): Observable<DataItem[]> {
            return this.http.get<DataItem[]>(this.apiUrl);
          }
          
          getItem(id: number): Observable<DataItem> {
            return this.http.get<DataItem>(\`\${this.apiUrl}/\${id}\`);
          }
          
          createItem(item: Omit<DataItem, 'id'>): Observable<DataItem> {
            return this.http.post<DataItem>(this.apiUrl, item);
          }
          
          updateItem(id: number, item: Partial<DataItem>): Observable<DataItem> {
            return this.http.put<DataItem>(\`\${this.apiUrl}/\${id}\`, item);
          }
          
          deleteItem(id: number): Observable<void> {
            return this.http.delete<void>(\`\${this.apiUrl}/\${id}\`);
          }
        }
      `;

      const context = createMockContext('typescript', true);
      context.content = content;
      context.filePath = 'data.service.ts';
      context.language = 'typescript';
      const chunks = await strategy.segment(context);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.metadata.type === 'semantic')).toBe(true);
      expect(chunks.every(chunk => chunk.metadata.language === 'typescript'));
    });

    it('should respect max chunk size limit', async () => {
      const content = `
        function largeFunction() {
          ${Array.from({ length: 100 }, (_, i) => `console.log("Line ${i + 1}");`).join('\n')}
        }
        
        function anotherLargeFunction() {
          ${Array.from({ length: 100 }, (_, i) => `console.log("Another line ${i + 1}");`).join('\n')}
        }
      `;

      const context = createMockContext('javascript', true);
      context.options.maxChunkSize = 1000;

      context.content = content;
      context.filePath = 'large.js';
      context.language = 'javascript';
      const chunks = await strategy.segment(context);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(1100); // maxChunkSize * 1.1
      });
    });

    it('should handle empty content', async () => {
      const content = '';
      const context = createMockContext('javascript', true);

      context.content = content;
      context.filePath = 'test.js';
      context.language = 'javascript';
      const chunks = await strategy.segment(context);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('');
      expect(chunks[0].metadata.startLine).toBe(1);
      expect(chunks[0].metadata.endLine).toBe(0);
    });

    it('should handle single line content', async () => {
      const content = 'console.log("test");';
      const context = createMockContext('javascript', true);

      context.content = content;
      context.filePath = 'test.js';
      context.language = 'javascript';
      const chunks = await strategy.segment(context);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('console.log("test")');
      expect(chunks[0].metadata.startLine).toBe(1);
      expect(chunks[0].metadata.endLine).toBe(1);
    });

    it('should log segmentation progress', async () => {
      const content = 'function test() { return 1; }';
      const context = createMockContext('javascript', true);

      context.content = content;
      context.filePath = 'test.js';
      context.language = 'javascript';
      await strategy.segment(context);

      expect(mockLogger.debug).toHaveBeenCalledWith('Starting semantic-based segmentation for test.js');
    });

    it('should handle errors gracefully', async () => {
      const content = 'function test() { throw new Error("Test error"); }';
      const context = createMockContext('javascript', true);

      // Mock the segment method to throw an error
      (strategy as any).segment = jest.fn().mockRejectedValue(new Error('Segmentation failed'));

      context.content = content;
      context.filePath = 'test.js';
      context.language = 'javascript';
      await expect(strategy.segment(context)).rejects.toThrow('Segmentation failed');
    });

    it('should validate context when available', async () => {
      const content = 'function test() { return 1; }';
      const context = createMockContext('javascript', true);

      // Mock validateContext method
      (strategy as any).validateContext = jest.fn().mockReturnValue(true);

      context.content = content;
      context.filePath = 'test.js';
      context.language = 'javascript';
      const chunks = await strategy.segment(context);

      expect(chunks.length).toBeGreaterThan(0);
      expect(mockLogger.debug).toHaveBeenCalledWith('Context validation passed for semantic strategy');
    });

    it('should skip validation when not available', async () => {
      const content = 'function test() { return 1; }';
      const context = createMockContext('javascript', true);

      // Mock validateContext method to return false
      (strategy as any).validateContext = jest.fn().mockReturnValue(false);

      context.content = content;
      context.filePath = 'test.js';
      context.language = 'javascript';
      const chunks = await strategy.segment(context);

      expect(chunks.length).toBeGreaterThan(0);
      expect(mockLogger.warn).toHaveBeenCalledWith('Context validation failed for semantic strategy, proceeding anyway');
    });
  });

  describe('Integration Tests', () => {
    it('should work with complex JavaScript code', async () => {
      const jsCode = `
        import React, { useState, useEffect, useCallback } from 'react';
        import { connect } from 'react-redux';
        import { fetchData, updateData } from './actions';
        
        // Types
        interface DataItem {
          id: number;
          name: string;
          value: number;
        }
        
        interface Props {
          data: DataItem[];
          loading: boolean;
          error: string | null;
          fetchData: () => void;
          updateData: (id: number, data: Partial<DataItem>) => void;
        }
        
        // Component
        const DataComponent: React.FC<Props> = ({ 
          data, 
          loading, 
          error, 
          fetchData, 
          updateData 
        }) => {
          const [selectedItem, setSelectedItem] = useState<DataItem | null>(null);
          const [isEditing, setIsEditing] = useState(false);
          
          useEffect(() => {
            fetchData();
          }, [fetchData]);
          
          const handleItemClick = useCallback((item: DataItem) => {
            setSelectedItem(item);
            setIsEditing(false);
          }, []);
          
          const handleEditClick = useCallback(() => {
            setIsEditing(true);
          }, []);
          
          const handleSaveClick = useCallback((updatedData: Partial<DataItem>) => {
            if (selectedItem) {
              updateData(selectedItem.id, updatedData);
              setIsEditing(false);
            }
          }, [selectedItem, updateData]);
          
          if (loading) {
            return <div>Loading...</div>;
          }
          
          if (error) {
            return <div>Error: {error}</div>;
          }
          
          return (
            <div>
              <h1>Data List</h1>
              <ul>
                {data.map(item => (
                  <li 
                    key={item.id} 
                    onClick={() => handleItemClick(item)}
                    style={{ 
                      cursor: 'pointer',
                      backgroundColor: selectedItem?.id === item.id ? '#f0f0f0' : 'transparent'
                    }}
                  >
                    {item.name}: {item.value}
                  </li>
                ))}
              </ul>
              
              {selectedItem && (
                <div>
                  <h2>Selected Item</h2>
                  {isEditing ? (
                    <EditForm 
                      item={selectedItem} 
                      onSave={handleSaveClick} 
                      onCancel={() => setIsEditing(false)} 
                    />
                  ) : (
                    <div>
                      <p>Name: {selectedItem.name}</p>
                      <p>Value: {selectedItem.value}</p>
                      <button onClick={handleEditClick}>Edit</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        };
        
        // Edit Form Component
        interface EditFormProps {
          item: DataItem;
          onSave: (data: Partial<DataItem>) => void;
          onCancel: () => void;
        }
        
        const EditForm: React.FC<EditFormProps> = ({ item, onSave, onCancel }) => {
          const [name, setName] = useState(item.name);
          const [value, setValue] = useState(item.value.toString());
          
          const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            onSave({
              name,
              value: parseInt(value, 10)
            });
          };
          
          return (
            <form onSubmit={handleSubmit}>
              <div>
                <label>Name:</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                />
              </div>
              <div>
                <label>Value:</label>
                <input 
                  type="number" 
                  value={value} 
                  onChange={(e) => setValue(e.target.value)} 
                />
              </div>
              <button type="submit">Save</button>
              <button type="button" onClick={onCancel}>Cancel</button>
            </form>
          );
        };
        
        // Redux connection
        const mapStateToProps = (state: any) => ({
          data: state.data.items,
          loading: state.data.loading,
          error: state.data.error
        });
        
        const mapDispatchToProps = {
          fetchData,
          updateData
        };
        
        export default connect(mapStateToProps, mapDispatchToProps)(DataComponent);
      `;

      const context = createMockContext('javascript', true);
      context.content = jsCode;
      context.filePath = 'DataComponent.jsx';
      context.language = 'javascript';
      const chunks = await strategy.segment(context);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.metadata.type === 'semantic')).toBe(true);
      expect(chunks.every(chunk => chunk.metadata.language === 'javascript'));
    });

    it('should work with complex Python code', async () => {
      const pythonCode = `
        import os
        import sys
        import json
        import logging
        from typing import List, Dict, Any, Optional, Union
        from dataclasses import dataclass
        from abc import ABC, abstractmethod
        
        # Configure logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        logger = logging.getLogger(__name__)
        
        # Data classes
        @dataclass
        class DataItem:
            id: int
            name: str
            value: float
            metadata: Dict[str, Any] = None
            
            def __post_init__(self):
                if self.metadata is None:
                    self.metadata = {}
        
        @dataclass
        class ProcessingResult:
            success: bool
            items: List[DataItem]
            errors: List[str] = None
            
            def __post_init__(self):
                if self.errors is None:
                    self.errors = []
        
        # Abstract base class
        class DataProcessor(ABC):
            @abstractmethod
            def process(self, items: List[DataItem]) -> ProcessingResult:
                pass
        
        # Concrete implementation
        class StandardDataProcessor(DataProcessor):
            def __init__(self, config: Dict[str, Any]):
                self.config = config
                self.min_value = config.get('min_value', 0)
                self.max_value = config.get('max_value', 100)
                
            def process(self, items: List[DataItem]) -> ProcessingResult:
                logger.info(f"Processing {len(items)} items")
                
                processed_items = []
                errors = []
                
                for item in items:
                    try:
                        processed_item = self._process_item(item)
                        if processed_item:
                            processed_items.append(processed_item)
                    except Exception as e:
                        error_msg = f"Error processing item {item.id}: {str(e)}"
                        logger.error(error_msg)
                        errors.append(error_msg)
                
                result = ProcessingResult(
                    success=len(errors) == 0,
                    items=processed_items,
                    errors=errors
                )
                
                logger.info(f"Processing complete: {len(processed_items)} items processed, {len(errors)} errors")
                return result
                
            def _process_item(self, item: DataItem) -> Optional[DataItem]:
                # Validate value range
                if not (self.min_value <= item.value <= self.max_value):
                    raise ValueError(f"Value {item.value} out of range [{self.min_value}, {self.max_value}]")
                
                # Apply transformations
                transformed_value = self._transform_value(item.value)
                
                # Update metadata
                new_metadata = item.metadata.copy()
                new_metadata['processed'] = True
                new_metadata['original_value'] = item.value
                
                return DataItem(
                    id=item.id,
                    name=item.name,
                    value=transformed_value,
                    metadata=new_metadata
                )
                
            def _transform_value(self, value: float) -> float:
                # Apply some transformation logic
                if value < 50:
                    return value * 1.1
                else:
                    return value * 0.9
        
        # Factory function
        def create_processor(processor_type: str, config: Dict[str, Any]) -> DataProcessor:
            if processor_type == 'standard':
                return StandardDataProcessor(config)
            else:
                raise ValueError(f"Unknown processor type: {processor_type}")
        
        # Main function
        def main():
            # Load configuration
            config_path = os.environ.get('PROCESSOR_CONFIG', 'config.json')
            try:
                with open(config_path, 'r') as f:
                    config = json.load(f)
            except FileNotFoundError:
                logger.error(f"Configuration file not found: {config_path}")
                sys.exit(1)
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON in configuration file: {str(e)}")
                sys.exit(1)
            
            # Create processor
            processor_type = config.get('processor_type', 'standard')
            try:
                processor = create_processor(processor_type, config)
            except ValueError as e:
                logger.error(str(e))
                sys.exit(1)
            
            # Load data
            data_path = config.get('data_path', 'data.json')
            try:
                with open(data_path, 'r') as f:
                    data = json.load(f)
                
                items = [DataItem(**item_data) for item_data in data]
            except FileNotFoundError:
                logger.error(f"Data file not found: {data_path}")
                sys.exit(1)
            except Exception as e:
                logger.error(f"Error loading data: {str(e)}")
                sys.exit(1)
            
            # Process data
            result = processor.process(items)
            
            # Save results
            output_path = config.get('output_path', 'output.json')
            try:
                output_data = {
                    'success': result.success,
                    'items': [
                        {
                            'id': item.id,
                            'name': item.name,
                            'value': item.value,
                            'metadata': item.metadata
                        }
                        for item in result.items
                    ],
                    'errors': result.errors
                }
                
                with open(output_path, 'w') as f:
                    json.dump(output_data, f, indent=2)
                
                logger.info(f"Results saved to {output_path}")
            except Exception as e:
                logger.error(f"Error saving results: {str(e)}")
                sys.exit(1)
            
            # Exit with appropriate code
            sys.exit(0 if result.success else 1)
        
        if __name__ == '__main__':
            main()
      `;

      const context = createMockContext('python', true);
      context.content = pythonCode;
      context.filePath = 'data_processor.py';
      context.language = 'python';
      const chunks = await strategy.segment(context);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.metadata.type === 'semantic')).toBe(true);
      expect(chunks.every(chunk => chunk.metadata.language === 'python'));
    });

    it('should handle edge cases', async () => {
      // Empty content
      const context = createMockContext('javascript', true);
      context.content = '';
      context.filePath = 'test.js';
      context.language = 'javascript';
      const emptyResult = await strategy.segment(context);
      expect(emptyResult).toHaveLength(1);
      expect(emptyResult[0].content).toBe('');

      // Single line content
      const singleLineContext = createMockContext('javascript', true);
      singleLineContext.content = 'console.log("test");';
      singleLineContext.filePath = 'test.js';
      singleLineContext.language = 'javascript';
      const singleLineResult = await strategy.segment(singleLineContext);
      expect(singleLineResult).toHaveLength(1);
      expect(singleLineResult[0].content).toBe('console.log("test")');

      // Very large content
      const largeContent = Array.from({ length: 1000 }, (_, i) => `console.log("Line ${i + 1}");`).join('\n');
      const largeContext = createMockContext('javascript', true);
      largeContext.content = largeContent;
      largeContext.filePath = 'large.js';
      largeContext.language = 'javascript';
      const largeResult = await strategy.segment(largeContext);
      expect(largeResult.length).toBeGreaterThan(1);
    });
  });
});