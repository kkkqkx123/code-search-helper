#!/usr/bin/env node

const fs = require('fs');
const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node fix-code-blocks.js <file-path>');
  process.exit(1);
}

try {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fixedContent = content.replace(/```cpp/g, '```c');
  fs.writeFileSync(filePath, fixedContent);
  console.log(`✓ Fixed code blocks in ${filePath}`);
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}