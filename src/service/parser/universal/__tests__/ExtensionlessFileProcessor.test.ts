import { ExtensionlessFileProcessor } from '../ExtensionlessFileProcessor';
import { LoggerService } from '../../../../utils/LoggerService';

// Mock LoggerService
jest.mock('../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

describe('ExtensionlessFileProcessor', () => {
  let processor: ExtensionlessFileProcessor;
  let mockLogger: jest.Mocked<LoggerService>;

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();
    
    processor = new ExtensionlessFileProcessor(mockLogger);
  });

  describe('detectLanguageByContent', () => {
    describe('Shebang Detection', () => {
      it('should detect Python from shebang', () => {
        const content = '#!/usr/bin/env python\nprint("Hello, World!")';
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('python');
        expect(result.confidence).toBe(0.9);
        expect(result.indicators).toContain('shebang: #!/usr/bin/env python');
      });

      it('should detect Bash from shebang', () => {
        const content = '#!/bin/bash\necho "Hello, World!"';
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('shell');
        expect(result.confidence).toBe(0.9);
        expect(result.indicators).toContain('shebang: #!/bin/bash');
      });

      it('should detect Node.js from shebang', () => {
        const content = '#!/usr/bin/env node\nconsole.log("Hello, World!");';
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('javascript');
        expect(result.confidence).toBe(0.9);
        expect(result.indicators).toContain('shebang: #!/usr/bin/env node');
      });

      it('should detect Ruby from shebang', () => {
        const content = '#!/usr/bin/env ruby\nputs "Hello, World!"';
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('ruby');
        expect(result.confidence).toBe(0.9);
        expect(result.indicators).toContain('shebang: #!/usr/bin/env ruby');
      });

      it('should return unknown when no shebang is present', () => {
        const content = 'print("Hello, World!")';
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('unknown');
        expect(result.confidence).toBe(0);
        expect(result.indicators).toEqual([]);
      });
    });

    describe('Syntax Pattern Detection', () => {
      it('should detect Python from syntax patterns', () => {
        const content = `
import os
import sys
from typing import List

def main():
    """Main function"""
    print("Hello, World!")
    
class MyClass:
    def __init__(self):
        self.value = 42
        `.trim();
        
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('python');
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.indicators.length).toBeGreaterThan(0);
      });

      it('should detect JavaScript from syntax patterns', () => {
        const content = `
import { Component } from 'react';
const x = 10;
let y = 20;
var z = 30;

function test() {
  console.log("Hello");
  return x + y;
}

export default test;
        `.trim();
        
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('javascript');
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.indicators.length).toBeGreaterThan(0);
      });

      it('should detect TypeScript from syntax patterns', () => {
        const content = `
import { Component } from 'react';

interface TestInterface {
  name: string;
  value: number;
}

type TestType = string | number;

class TestClass implements TestInterface {
  private name: string;
  public value: number;
  
  constructor() {
    this.name = "test";
    this.value = 42;
  }
}
        `.trim();
        
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('typescript');
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.indicators.length).toBeGreaterThan(0);
      });

      it('should detect Java from syntax patterns', () => {
        const content = `
package com.example;

import java.util.List;

public class TestClass {
  private static final int CONSTANT = 42;
  
  public static void main(String[] args) {
    System.out.println("Hello, World!");
  }
  
  @Override
  public String toString() {
    return "TestClass";
  }
}
        `.trim();
        
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('java');
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.indicators.length).toBeGreaterThan(0);
      });

      it('should detect C++ from syntax patterns', () => {
        const content = `
#include <iostream>
#include <vector>
#include <string>

using namespace std;

class TestClass {
private:
  int value;
  
public:
  TestClass(int v) : value(v) {}
  
  void print() {
    cout << "Value: " << value << endl;
  }
};

int main() {
  TestClass obj(42);
  obj.print();
  return 0;
}
        `.trim();
        
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('cpp');
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.indicators.length).toBeGreaterThan(0);
      });

      it('should detect Go from syntax patterns', () => {
        const content = `
package main

import (
  "fmt"
  "os"
)

func main() {
  fmt.Println("Hello, World!")
  
  ch := make(chan int)
  go func() {
    ch <- 42
  }()
  
  value := <-ch
  fmt.Printf("Received: %d\n", value)
}
        `.trim();
        
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('go');
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.indicators.length).toBeGreaterThan(0);
      });

      it('should detect Rust from syntax patterns', () => {
        const content = `
use std::collections::HashMap;

fn main() {
  let mut map = HashMap::new();
  map.insert("key", 42);
  
  let result = match map.get("key") {
    Some(value) => *value,
    None => 0,
  };
  
  println!("Result: {}", result);
  
  let numbers = vec![1, 2, 3, 4, 5];
  let doubled: Vec<i32> = numbers.iter().map(|x| x * 2).collect();
}
        `.trim();
        
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('rust');
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.indicators.length).toBeGreaterThan(0);
      });

      it('should detect JSON from syntax patterns', () => {
        const content = `
{
  "name": "test",
  "value": 42,
  "items": [1, 2, 3],
  "nested": {
    "enabled": true,
    "count": null
  }
}
        `.trim();
        
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('json');
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.indicators.length).toBeGreaterThan(0);
      });

      it('should detect YAML from syntax patterns', () => {
        const content = `
name: test
value: 42
items:
  - item1
  - item2
  - item3
nested:
  enabled: true
  count: null
# This is a comment
        `.trim();
        
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('yaml');
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.indicators.length).toBeGreaterThan(0);
      });

      it('should detect HTML from syntax patterns', () => {
        const content = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Page</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app">
    <h1>Hello, World!</h1>
    <script src="app.js"></script>
  </div>
</body>
</html>
        `.trim();
        
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('html');
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.indicators.length).toBeGreaterThan(0);
      });

      it('should detect CSS from syntax patterns', () => {
        const content = `
.container {
  display: flex;
  margin: 10px;
  padding: 20px;
}

#header {
  background-color: #333;
  color: white;
}

.button {
  border-radius: 5px;
  transition: all 0.3s ease;
}

@media (max-width: 768px) {
  .container {
    flex-direction: column;
  }
}
        `.trim();
        
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('css');
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.indicators.length).toBeGreaterThan(0);
      });

      it('should detect SQL from syntax patterns', () => {
        const content = `
SELECT users.name, COUNT(orders.id) as order_count
FROM users
LEFT JOIN orders ON users.id = orders.user_id
WHERE users.created_at >= '2023-01-01'
GROUP BY users.id, users.name
HAVING COUNT(orders.id) > 5
ORDER BY order_count DESC
LIMIT 10;

-- This is a comment
INSERT INTO users (name, email) VALUES ('test', 'test@example.com');
        `.trim();
        
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('sql');
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.indicators.length).toBeGreaterThan(0);
      });

      it('should detect Dockerfile from syntax patterns', () => {
        const content = `
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
USER node
CMD ["node", "server.js"]
        `.trim();
        
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('dockerfile');
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.indicators.length).toBeGreaterThan(0);
      });

      it('should detect Markdown from syntax patterns', () => {
        const content = `
# Test Document

This is a **test** document with *italic* text.

## Code Example

\`\`\`javascript
function test() {
  return "Hello, World!";
}
\`\`\`

## List

- Item 1
- Item 2
- Item 3

## Table

| Column 1 | Column 2 |
|----------|----------|
| Cell 1   | Cell 2   |

> This is a quote
        `.trim();
        
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('markdown');
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.indicators.length).toBeGreaterThan(0);
      });
    });

    describe('File Structure Detection', () => {
      it('should detect Dockerfile from structure', () => {
        const content = `
FROM node:16
COPY . .
RUN npm install
EXPOSE 3000
        `.trim();
        
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('dockerfile');
        expect(result.confidence).toBe(0.7);
        expect(result.indicators).toContain('structure: /^(FROM|RUN|COPY|ADD|CMD|ENTRYPOINT|ENV|EXPOSE|VOLUME|WORKDIR|USER)/i');
      });

      it('should detect Makefile from structure', () => {
        const content = `
all: build

build:
  gcc -o program main.c

clean:
  rm -f program

install: build
  cp program /usr/local/bin/
        `.trim();
        
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('makefile');
        expect(result.confidence).toBe(0.7);
        expect(result.indicators).toContain('structure: /^[a-zA-Z_][a-zA-Z0-9_]*\s*:/m');
      });

      it('should detect CMake from structure', () => {
        const content = `
cmake_minimum_required(VERSION 3.10)
project(MyProject)

add_executable(myapp main.c)
find_package(OpenGL REQUIRED)
target_link_libraries(myapp OpenGL::GL)
        `.trim();
        
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('cmake');
        expect(result.confidence).toBe(0.7);
        expect(result.indicators).toContain('structure: /^(cmake_minimum_required|project|add_executable|add_library)/i');
      });
    });

    describe('Priority and Confidence', () => {
      it('should prioritize shebang over syntax patterns', () => {
        const content = `#!/usr/bin/env python
// This looks like JavaScript comment
print("Hello, World!")`;
        
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('python');
        expect(result.confidence).toBe(0.9); // Shebang has higher confidence
        expect(result.indicators).toContain('shebang: #!/usr/bin/env python');
      });

      it('should handle ambiguous content gracefully', () => {
        const content = `
// This could be many languages
function test() {
  return "Hello";
}
        `.trim();
        
        const result = processor.detectLanguageByContent(content);
        
        // Should detect JavaScript due to function keyword and syntax
        expect(result.language).toBe('javascript');
        expect(result.confidence).toBeGreaterThan(0);
      });

      it('should return unknown for completely ambiguous content', () => {
        const content = `
This is just some plain text
with no specific programming language
patterns or indicators.
        `.trim();
        
        const result = processor.detectLanguageByContent(content);
        
        expect(result.language).toBe('unknown');
        expect(result.confidence).toBe(0);
        expect(result.indicators).toEqual([]);
      });
    });

    describe('Error Handling', () => {
      it('should handle detector errors gracefully', () => {
        // Mock a detector that throws an error
        const originalDetectBySyntaxPatterns = processor['detectBySyntaxPatterns'];
        processor['detectBySyntaxPatterns'] = jest.fn().mockImplementation(() => {
          throw new Error('Detector error');
        });
        
        const content = `
import os
print("Hello, World!")
        `.trim();
        
        // Should not throw, but should log warning
        const result = processor.detectLanguageByContent(content);
        
        expect(mockLogger.warn).toHaveBeenCalledWith('Error in language detector: Error: Detector error');
        expect(result.language).toBe('unknown'); // Should fallback to unknown
      });
    });
  });

  describe('isLikelyCodeFile', () => {
    it('should return true for code files', () => {
      const pythonContent = `
import os
def main():
    print("Hello, World!")
      `.trim();
      
      expect(processor.isLikelyCodeFile(pythonContent)).toBe(true);
    });

    it('should return false for non-code files', () => {
      const plainText = `
This is just some plain text
with no specific programming language
patterns or indicators.
      `.trim();
      
      expect(processor.isLikelyCodeFile(plainText)).toBe(false);
    });

    it('should return false for low confidence detections', () => {
      const ambiguousContent = `
function test() {
  // This looks like code but might not be detected with high confidence
  return "Hello";
}
      `.trim();
      
      // Mock a low confidence result
      jest.spyOn(processor, 'detectLanguageByContent').mockReturnValue({
        language: 'unknown',
        confidence: 0.3,
        indicators: []
      });
      
      expect(processor.isLikelyCodeFile(ambiguousContent)).toBe(false);
    });
  });

  describe('Custom Pattern Management', () => {
    it('should add custom syntax pattern', () => {
      const customPattern = /custom_keyword\s*\(/g;
      processor.addSyntaxPattern('customlang', customPattern);
      
      const content = `
custom_keyword test() {
  return "Hello";
}
      `.trim();
      
      const result = processor.detectLanguageByContent(content);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Added syntax pattern for customlang: custom_keyword\\s*\\('
      );
    });

    it('should add custom shebang pattern', () => {
      processor.addShebangPattern('#!/usr/bin/custom', 'customlang');
      
      const content = '#!/usr/bin/custom\nprint("Hello")';
      const result = processor.detectLanguageByContent(content);
      
      expect(result.language).toBe('customlang');
      expect(result.confidence).toBe(0.9);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Added shebang pattern: #!/usr/bin/custom -> customlang'
      );
    });

    it('should add custom file structure pattern', () => {
      const customPattern = /^CustomStructure:/m;
      processor.addFileStructurePattern('customlang', customPattern);
      
      const content = 'CustomStructure: test';
      const result = processor.detectLanguageByContent(content);
      
      expect(result.language).toBe('customlang');
      expect(result.confidence).toBe(0.7);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Added file structure pattern for customlang: ^CustomStructure:/m'
      );
    });

    it('should add multiple patterns to existing language', () => {
      const pattern1 = /pattern1/g;
      const pattern2 = /pattern2/g;
      
      processor.addSyntaxPattern('testlang', pattern1);
      processor.addSyntaxPattern('testlang', pattern2);
      
      const content = `
pattern1
pattern2
      `.trim();
      
      const result = processor.detectLanguageByContent(content);
      
      expect(result.language).toBe('testlang');
      expect(result.indicators.length).toBeGreaterThan(0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complex real-world examples', () => {
      const reactComponent = `
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const MyComponent = ({ initialValue }) => {
  const [count, setCount] = useState(initialValue || 0);
  
  useEffect(() => {
    console.log('Component mounted');
    return () => {
      console.log('Component unmounted');
    };
  }, []);
  
  const handleClick = () => {
    setCount(prevCount => prevCount + 1);
  };
  
  return (
    <div className="my-component">
      <h1>Count: {count}</h1>
      <button onClick={handleClick}>Increment</button>
    </div>
  );
};

MyComponent.propTypes = {
  initialValue: PropTypes.number
};

export default MyComponent;
      `.trim();
      
      const result = processor.detectLanguageByContent(reactComponent);
      
      expect(result.language).toBe('typescript');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should handle mixed content files', () => {
      const mixedContent = `
#!/bin/bash

# This script processes data
echo "Starting data processing..."

# SQL query to extract data
query="SELECT * FROM users WHERE active = 1"

# Execute the query
mysql -u user -p database -e "$query"

# Process results with Python
python3 << EOF
import json
import sys

results = sys.stdin.read()
data = json.loads(results)
print(f"Processed {len(data)} records")
EOF

echo "Processing complete"
      `.trim();
      
      const result = processor.detectLanguageByContent(mixedContent);
      
      // Should detect shell due to shebang
      expect(result.language).toBe('shell');
      expect(result.confidence).toBe(0.9);
    });
  });
});