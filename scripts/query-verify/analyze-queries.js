const fs = require('fs');

function analyzeQueryPatterns(content) {
  const lines = content.split('\n');
  let currentPattern = '';
  let currentPatternStartLine = 0;
  let patterns = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Start of a new pattern
    if (line.startsWith('(') && !currentPattern) {
      currentPattern = line;
      currentPatternStartLine = i + 1;
    } 
    // Continuation of a pattern
    else if (currentPattern && (line.startsWith('(') || line.startsWith('  ') || line.startsWith('\t'))) {
      currentPattern += '\n' + line;
    }
    // End of a pattern
    else if (currentPattern && line.includes(')') && !line.trim().startsWith('(')) {
      currentPattern += '\n' + line;
      
      // Check if this looks like the end of a pattern
      if (line.includes('@') || line.includes('#set!')) {
        patterns.push({
          startLine: currentPatternStartLine,
          endLine: i + 1,
          content: currentPattern
        });
        currentPattern = '';
        currentPatternStartLine = 0;
      }
    }
    // Comment line or empty line - might end a pattern
    else if (currentPattern && (line.startsWith(';') || line === '')) {
      if (currentPattern.includes('@') || currentPattern.includes('#set!')) {
        patterns.push({
          startLine: currentPatternStartLine,
          endLine: i,
          content: currentPattern
        });
      }
      currentPattern = '';
      currentPatternStartLine = 0;
    }
  }
  
  // Handle the last pattern if file doesn't end with a comment
  if (currentPattern) {
    patterns.push({
      startLine: currentPatternStartLine,
      endLine: lines.length,
      content: currentPattern
    });
  }
  
  return patterns;
}

function checkPatternBalance(pattern) {
  let balance = 0;
  let inString = false;
  let escapeNext = false;
  
  for (let i = 0; i < pattern.content.length; i++) {
    const char = pattern.content[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '(') {
        balance++;
      } else if (char === ')') {
        balance--;
      }
    }
  }
  
  return balance;
}

// Read the file
const filePath = 'src/service/parser/constants/queries/cpp/lifecycle-relationships.ts';
const content = fs.readFileSync(filePath, 'utf8');

// Analyze query patterns
const patterns = analyzeQueryPatterns(content);

console.log(`Found ${patterns.length} query patterns:\n`);

patterns.forEach((pattern, index) => {
  const balance = checkPatternBalance(pattern);
  const status = balance === 0 ? '✓' : '✗';
  console.log(`${status} Pattern ${index + 1} (lines ${pattern.startLine}-${pattern.endLine}): Balance = ${balance}`);
  
  if (balance !== 0) {
    console.log('  Content:');
    console.log('  ' + pattern.content.split('\n').map(line => '  ' + line).join('\n'));
  }
});