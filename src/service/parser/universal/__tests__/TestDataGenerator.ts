
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
       