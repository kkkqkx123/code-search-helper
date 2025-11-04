const fs = require('fs');

// C++查询文件列表
const cppQueryFiles = [
  'src/service/parser/constants/queries/cpp/data-flow.ts',
  'src/service/parser/constants/queries/cpp/semantic-relationships.ts',
  'src/service/parser/constants/queries/cpp/lifecycle-relationships.ts',
  'src/service/parser/constants/queries/cpp/concurrency-relationships.ts'
];

function extractQueryString(content) {
  const startMarker = 'export default `';
  const startIndex = content.indexOf(startMarker);
  if (startIndex === -1) {
    console.error('Could not find export default marker');
    return null;
  }
  const query = content.substring(startIndex + startMarker.length);
  // Find the last backtick that closes the string
  const lastBacktickIndex = query.lastIndexOf('`');
  if (lastBacktickIndex === -1) {
    console.error('Could not find closing backtick');
    return null;
  }
  const trimmedQuery = query.substring(0, lastBacktickIndex).trim();
  return trimmedQuery;
}

function findUnbalancedParentheses(query, fileName) {
  let balance = 0;
  let inString = false;
  let escapeNext = false;
  let lastParenPos = -1;
  let lastParenChar = '';
  let issues = [];

  for (let i = 0; i < query.length; i++) {
    const char = query[i];

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
        lastParenPos = i;
        lastParenChar = char;
      } else if (char === ')') {
        balance--;
        lastParenPos = i;
        lastParenChar = char;
        
        if (balance < 0) {
          issues.push({
            type: 'too_many_closing',
            position: i,
            context: query.substring(Math.max(0, i-50), Math.min(query.length, i+50))
          });
        }
      }
    }
  }
  
  if (balance > 0) {
    issues.push({
      type: 'missing_closing',
      count: balance,
      position: lastParenPos,
      context: query.substring(Math.max(0, lastParenPos-50), Math.min(query.length, lastParenPos+50))
    });
  }
  
  if (inString) {
    issues.push({
      type: 'unclosed_string',
      context: 'String not properly closed'
    });
  }
  
  return issues;
}

function checkQueryPatterns(query, fileName) {
  const lines = query.split('\n');
  let issues = [];
  let currentQuery = '';
  let parenBalance = 0;
  let lineNumber = 0;
  let queryStartLine = 0;

  for (const line of lines) {
    lineNumber++;
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith(';')) {
      // Skip empty lines and comments
      if (currentQuery.trim() && parenBalance === 0) {
        // Check complete query pattern - only if it contains actual content
        if (currentQuery.trim() && !currentQuery.includes('(') && !currentQuery.includes(')')) {
          issues.push({
            type: 'invalid_query_pattern',
            line: queryStartLine,
            endLine: lineNumber - 1,
            query: currentQuery.trim(),
            context: 'Query missing parentheses'
          });
        }
        currentQuery = '';
        queryStartLine = 0;
      }
      continue;
    }

    if (!currentQuery) {
      queryStartLine = lineNumber;
    }
    currentQuery += (currentQuery ? ' ' : '') + trimmed;

    // Count parentheses balance
    parenBalance += (trimmed.match(/\(/g) || []).length;
    parenBalance -= (trimmed.match(/\)/g) || []).length;

    // If parentheses balanced, check query pattern
    if (parenBalance === 0) {
      if (currentQuery.trim() && !currentQuery.includes('(') && !currentQuery.includes(')')) {
        issues.push({
          type: 'invalid_query_pattern',
          line: queryStartLine,
          endLine: lineNumber,
          query: currentQuery.trim(),
          context: 'Query missing parentheses'
        });
      }
      currentQuery = '';
      queryStartLine = 0;
    }
  }

  // Check last incomplete query
  if (currentQuery.trim() && parenBalance === 0) {
    if (!currentQuery.includes('(') || !currentQuery.includes(')')) {
      issues.push({
        type: 'invalid_query_pattern',
        line: queryStartLine,
        endLine: lineNumber,
        query: currentQuery.trim(),
        context: 'Query missing parentheses'
      });
    }
  }

  return issues;
}

function checkPredicates(query, fileName) {
  const lines = query.split('\n');
  let issues = [];
  let lineNumber = 0;

  for (const line of lines) {
    lineNumber++;
    const trimmed = line.trim();
    
    // Check for predicate patterns
    if (trimmed.includes('#match?') || trimmed.includes('#eq?') || trimmed.includes('#not-eq?')) {
      const predicateMatch = trimmed.match(/(#\w+\?\s+@[\w.]+\s+"([^"]*)")/);
      if (predicateMatch) {
        const predicate = predicateMatch[1];
        const pattern = predicateMatch[2];
        
        // Check for regex patterns that might be malformed
        if (pattern.includes('\\') && !pattern.includes('\\\\')) {
          issues.push({
            type: 'potential_regex_escape',
            line: lineNumber,
            context: `Potential unescaped backslash in predicate: ${predicate}`
          });
        }
        
        // Check for common regex errors
        if (pattern.includes('[') && !pattern.includes('\\[') && !pattern.includes('[]')) {
          issues.push({
            type: 'potential_unescaped_bracket',
            line: lineNumber,
            context: `Potential unescaped bracket in regex: ${predicate}`
          });
        }
      }
    }
  }

  return issues;
}

function analyzeFile(filePath) {
  console.log(`\n=== Analyzing ${filePath} ===`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const queryString = extractQueryString(content);
    
    if (!queryString) {
      console.log(`❌ Failed to extract query string from ${filePath}`);
      return;
    }
    
    console.log(`✓ File loaded successfully (${queryString.length} characters)`);
    
    // Check for unbalanced parentheses
    const parenIssues = findUnbalancedParentheses(queryString, filePath);
    if (parenIssues.length > 0) {
      console.log(`❌ Found ${parenIssues.length} parenthesis issues:`);
      parenIssues.forEach(issue => {
        console.log(`  - ${issue.type} at position ${issue.position}: ${issue.context}`);
      });
    } else {
      console.log(`✓ Parentheses are balanced`);
    }
    
    // Check query patterns
    const patternIssues = checkQueryPatterns(queryString, filePath);
    if (patternIssues.length > 0) {
      console.log(`❌ Found ${patternIssues.length} query pattern issues:`);
      patternIssues.forEach(issue => {
        console.log(`  - Lines ${issue.line}-${issue.endLine}: ${issue.context}`);
        console.log(`    Full query: ${issue.query}`);
      });
    } else {
      console.log(`✓ Query patterns are valid`);
    }
    
    // Check predicates
    const predicateIssues = checkPredicates(queryString, filePath);
    if (predicateIssues.length > 0) {
      console.log(`⚠️  Found ${predicateIssues.length} potential predicate issues:`);
      predicateIssues.forEach(issue => {
        console.log(`  - Line ${issue.line}: ${issue.context}`);
      });
    } else {
      console.log(`✓ Predicates look good`);
    }
    
    // Count different types of queries
    const queryCount = (queryString.match(/\) @[\w.-]+/g) || []).length;
    const predicateCount = (queryString.match(/#\w+\?/g) || []).length;
    const commentCount = (queryString.match(/;[^[\n]]*/g) || []).length;
    
    console.log(`📊 Statistics:`);
    console.log(`  - Total queries: ${queryCount}`);
    console.log(`  - Predicates: ${predicateCount}`);
    console.log(`  - Comments: ${commentCount}`);
    
    return {
      parenIssues,
      patternIssues,
      predicateIssues,
      queryCount,
      predicateCount,
      commentCount
    };
    
  } catch (error) {
    console.log(`❌ Error analyzing ${filePath}: ${error.message}`);
    return null;
  }
}

// Main execution
console.log('C++ Query Files Analysis Tool');
console.log('=============================');

const results = {};
cppQueryFiles.forEach(filePath => {
  results[filePath] = analyzeFile(filePath);
});

// Summary
console.log('\n=== SUMMARY ===');
let totalIssues = 0;
cppQueryFiles.forEach(filePath => {
  const result = results[filePath];
  if (result) {
    const issueCount = result.parenIssues.length + result.patternIssues.length + result.predicateIssues.length;
    totalIssues += issueCount;
    console.log(`${filePath}: ${issueCount} issues (${result.queryCount} queries)`);
  }
});

console.log(`\nTotal issues found: ${totalIssues}`);
if (totalIssues === 0) {
  console.log('🎉 All C++ query files look good!');
} else {
  console.log('⚠️  Some issues found that may need attention.');
}