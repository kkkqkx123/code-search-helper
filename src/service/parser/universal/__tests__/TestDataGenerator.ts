
/**
 * 测试数据生成器
 * 用于生成各种测试用例需要的代码和文件内容
 */

export class TestDataGenerator {
  /**
   * 生成大型 JavaScript 文件
   */
  static generateLargeJavaScriptFile(lines: number): string {
    const functions = [
      `function calculateTotal(items) {
    let total = 0;
    for (const item of items) {
      total += item.price * item.quantity;
    }
    return total;
  }`,
      `function filterActiveUsers(users) {
    return users.filter(user => user.isActive && user.lastLogin > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  }`,
      `function formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  }`,
      `function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }`,
      `class DataProcessor {
    constructor(options = {}) {
      this.options = { batchSize: 100, ...options };
      this.processed = 0;
    }
    
    async process(data) {
      const results = [];
      for (let i = 0; i < data.length; i += this.options.batchSize) {
        const batch = data.slice(i, i + this.options.batchSize);
        const batchResults = await this.processBatch(batch);
        results.push(...batchResults);
        this.processed += batch.length;
      }
      return results;
    }
    
    async processBatch(batch) {
      return batch.map(item => this.transform(item));
    }
    
    transform(item) {
      return { ...item, processed: true, timestamp: new Date() };
    }
  }`
    ];

    const imports = [
      `import { useState, useEffect } from 'react';`,
      `import axios from 'axios';`,
      `import { format } from 'date-fns';`,
      `import lodash from 'lodash';`,
      `import { validate } from 'uuid';`
    ];

    const comments = [
      `// Utility function for calculations`,
      `// Component for displaying user data`,
      `// API service for handling requests`,
      `// Configuration object`,
      `// Error handling utility`
    ];

    let result = [];
    let lineCount = 0;

    // Add imports
    for (const importLine of imports) {
      if (lineCount >= lines) break;
      result.push(importLine);
      lineCount++;
    }

    // Add functions and classes
    while (lineCount < lines) {
      for (const func of functions) {
        if (lineCount >= lines) break;
        
        // Add a comment before the function
        if (lineCount < lines && Math.random() > 0.5) {
          result.push(comments[Math.floor(Math.random() * comments.length)]);
          lineCount++;
        }
        
        // Add the function
        const funcLines = func.split('\n');
        for (const funcLine of funcLines) {
          if (lineCount >= lines) break;
          result.push(funcLine);
          lineCount++;
        }
        
        // Add empty line
        if (lineCount < lines) {
          result.push('');
          lineCount++;
        }
      }
    }

    return result.join('\n');
  }

  /**
   * 生成大型 TypeScript 文件
   */
  static generateLargeTypeScriptFile(lines: number): string {
    const interfaces = [
      `interface User {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    lastLogin: Date;
    roles: Role[];
  }`,
      `interface Product {
    id: string;
    name: string;
    price: number;
    category: Category;
    tags: string[];
    inStock: boolean;
  }`,
      `interface ApiResponse<T> {
    data: T;
    success: boolean;
    message?: string;
    errors?: string[];
  }`
    ];

    const classes = [
      `class UserService {
    private apiClient: ApiClient;
    
    constructor(apiClient: ApiClient) {
      this.apiClient = apiClient;
    }
    
    async getUser(id: string): Promise<User | null> {
      try {
        const response = await this.apiClient.get<ApiResponse<User>>(\`/users/\${id}\`);
        return response.data.data;
      } catch (error) {
        this.logger?.error(\`Failed to get user \${id}:\`, error);
        return null;
      }
    }
    
    async createUser(user: Omit<User, 'id' | 'lastLogin'>): Promise<User | null> {
      try {
        const response = await this.apiClient.post<ApiResponse<User>>('/users', user);
        return response.data.data;
      } catch (error) {
        this.logger?.error('Failed to create user:', error);
        return null;
      }
    }
    
    async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
      try {
        const response = await this.apiClient.put<ApiResponse<User>>(\`/users/\${id}\`, updates);
        return response.data.data;
      } catch (error) {
        this.logger?.error(\`Failed to update user \${id}:\`, error);
        return null;
      }
    }
    
    async deleteUser(id: string): Promise<boolean> {
      try {
        await this.apiClient.delete(\`/users/\${id}\`);
        return true;
      } catch (error) {
        this.logger?.error(\`Failed to delete user \${id}:\`, error);
        return false;
      }
    }
  }`
    ];
      
      const functions = [
        `function calculateMetrics(data: any[]): MetricsData {
          const total = data.reduce((sum, item) => sum + item.value, 0);
          const average = total / data.length;
          const max = Math.max(...data.map(item => item.value));
          const min = Math.min(...data.map(item => item.value));
          
          return {
            total,
            average,
            max,
            min,
            count: data.length
          };
        }`,
        `function validateEmail(email: string): boolean {
          const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
          return emailRegex.test(email);
        }`,
        `function debounce<T extends (...args: any[]) => any>(
          func: T,
          wait: number
        ): (...args: Parameters<T>) => void {
          let timeout: NodeJS.Timeout;
          return (...args: Parameters<T>) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
          };
        }`
      ];

      // Combine interfaces, classes, and functions
      const allCodeBlocks = [...interfaces, ...classes, ...functions];
      let result = [];
      let lineCount = 0;

      // Add imports
      const imports = [
        `import { Injectable } from '@angular/core';`,
        `import { HttpClient } from '@angular/common/http';`,
        `import { Observable } from 'rxjs';`,
        `import { map, catchError } from 'rxjs/operators';`
      ];

      for (const importLine of imports) {
        if (lineCount >= lines) break;
        result.push(importLine);
        lineCount++;
      }

      // Add code blocks
      while (lineCount < lines) {
        for (const codeBlock of allCodeBlocks) {
          if (lineCount >= lines) break;
          
          const blockLines = codeBlock.split('\n');
          for (const line of blockLines) {
            if (lineCount >= lines) break;
            result.push(line);
            lineCount++;
          }
          
          // Add empty line
          if (lineCount < lines) {
            result.push('');
            lineCount++;
          }
        }
      }

      return result.join('\n');
    }
    
    /**
     * 生成大型 Python 文件
     */
    static generateLargePythonFile(lines: number): string {
      const imports = [
        `import os`,
        `import sys`,
        `import json`,
        `import datetime`,
        `from typing import List, Dict, Optional, Union`,
        `from dataclasses import dataclass`,
        `from abc import ABC, abstractmethod`
      ];

      const classes = [
        `@dataclass
class User:
    id: str
    name: str
    email: str
    created_at: datetime.datetime
    
    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'created_at': self.created_at.isoformat()
        }`,
        
        `class UserService:
    def __init__(self, db_connection):
        self.db = db_connection
    
    def get_user(self, user_id: str) -> Optional[User]:
        query = "SELECT * FROM users WHERE id = ?"
        result = self.db.execute(query, (user_id,))
        if result:
            return User(**result[0])
        return None
    
    def create_user(self, user_data: Dict) -> User:
        query = "INSERT INTO users (name, email, created_at) VALUES (?, ?, ?)"
        user_id = str(uuid.uuid4())
        now = datetime.datetime.now()
        self.db.execute(query, (user_data['name'], user_data['email'], now))
        return User(id=user_id, name=user_data['name'], email=user_data['email'], created_at=now)`
      ];

      const functions = [
        `def calculate_statistics(data: List[float]) -> Dict[str, float]:
    if not data:
        return {'mean': 0, 'median': 0, 'std': 0, 'min': 0, 'max': 0}
    
    n = len(data)
    mean = sum(data) / n
    sorted_data = sorted(data)
    median = sorted_data[n // 2] if n % 2 == 1 else (sorted_data[n // 2 - 1] + sorted_data[n // 2]) / 2
    variance = sum((x - mean) ** 2 for x in data) / n
    std = variance ** 0.5
    
    return {
        'mean': mean,
        'median': median,
        'std': std,
        'min': min(data),
        'max': max(data)
    }`,
        
        `def process_text(text: str, operations: List[str]) -> str:
    result = text
    for op in operations:
        if op == 'lower':
            result = result.lower()
        elif op == 'upper':
            result = result.upper()
        elif op == 'title':
            result = result.title()
        elif op == 'strip':
            result = result.strip()
    return result`
      ];

      let result = [];
      let lineCount = 0;

      // Add imports
      for (const importLine of imports) {
        if (lineCount >= lines) break;
        result.push(importLine);
        lineCount++;
      }

      // Add classes and functions
      const codeBlocks = [...classes, ...functions];
      while (lineCount < lines) {
        for (const codeBlock of codeBlocks) {
          if (lineCount >= lines) break;
          
          const blockLines = codeBlock.split('\n');
          for (const line of blockLines) {
            if (lineCount >= lines) break;
            result.push(line);
            lineCount++;
          }
          
          // Add empty line
          if (lineCount < lines) {
            result.push('');
            lineCount++;
          }
        }
      }

      return result.join('\n');
    }
    
    /**
     * 生成大型通用文本文件（用于性能测试）
     */
    static generateLargeTextFile(lines: number): string {
      const words = [
        'Lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
        'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
        'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
        'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo'
      ];
      
      const sentences = [
        'This is a test sentence for performance testing.',
        'The quick brown fox jumps over the lazy dog.',
        'Performance testing is essential for optimal user experience.',
        'Code should be efficient and maintainable.',
        'Testing helps identify bottlenecks and optimization opportunities.'
      ];
      
      let result = [];
      
      for (let i = 0; i < lines; i++) {
        if (i % 5 === 0) {
          // Add a sentence every 5 lines
          result.push(sentences[Math.floor(Math.random() * sentences.length)]);
        } else {
          // Add a random word or short phrase
          const wordCount = Math.floor(Math.random() * 8) + 3;
          const lineWords = [];
          for (let j = 0; j < wordCount; j++) {
            lineWords.push(words[Math.floor(Math.random() * words.length)]);
          }
          result.push(lineWords.join(' ') + '.');
        }
      }
      
      return result.join('\n');
    }
  }

// Interfaces for TypeScript
interface ApiClient {
  get<T>(url: string): Promise<{ data: T }>;
  post<T>(url: string, data: any): Promise<{ data: T }>;
  put<T>(url: string, data: any): Promise<{ data: T }>;
  delete(url: string): Promise<void>;
}

interface User {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  lastLogin: Date;
  roles: Role[];
}

interface Role {
  id: string;
  name: string;
  permissions: string[];
}

interface Category {
  id: string;
  name: string;
  parentId?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  category: Category;
  tags: string[];
  inStock: boolean;
}

interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

interface MetricsData {
  total: number;
  average: number;
  max: number;
  min: number;
  count: number;
}