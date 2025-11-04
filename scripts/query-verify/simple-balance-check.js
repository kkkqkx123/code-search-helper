const fs = require('fs');
const path = require('path');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    filePath: null,
    language: null,
    verbose: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg.startsWith('--file=')) {
      options.filePath = arg.split('=')[1];
    } else if (arg.startsWith('--lang=')) {
      options.language = arg.split('=')[1];
    } else if (!options.filePath && !arg.startsWith('-')) {
      // First non-flag argument is treated as file path
      options.filePath = arg;
    }
  }

  return options;
}

// Show help information
function showHelp() {
  console.log(`
Tree-sitter Query Balance Checker

Usage: node simple-balance-check.js [options] [file-path]

Options:
  --file=<path>        Path to the query file to check
  --lang=<language>    Language code (cpp, javascript, python, java, c, csharp)
  --verbose, -v        Show detailed analysis
  --help, -h           Show this help message

Examples:
  node simple-balance-check.js --lang=cpp
  node simple-balance-check.js src/service/parser/constants/queries/cpp/data-flow.ts
  node simple-balance-check.js --file=src/service/parser/constants/queries/cpp/data-flow.ts --verbose

If no file is specified, the script will check the default C++ lifecycle-relationships file.
`);
}

// Get default file path based on language
function getDefaultFilePath(language) {
  const supportedLanguages = ['cpp', 'javascript', 'python', 'java', 'c', 'csharp', 'go'];
  const lang = language || 'cpp';
  
  if (!supportedLanguages.includes(lang)) {
    console.error(`Unsupported language: ${lang}. Supported languages: ${supportedLanguages.join(', ')}`);
    process.exit(1);
  }

  return `src/service/parser/constants/queries/${lang}/lifecycle-relationships.ts`;
}

// Extract query string from file content
function extractQueryString(content) {
  const startMarker = 'export default `';
  const startIndex = content.indexOf(startMarker);
  if (startIndex === -1) {
    console.error('Could not find export default marker');
    return null;
  }
  
  const query = content.substring(startIndex + startMarker.length);
  const lastBacktickIndex = query.lastIndexOf('`');
  if (lastBacktickIndex === -1) {
    console.error('Could not find closing backtick');
    return null;
  }
  
  return query.substring(0, lastBacktickIndex).trim();
}

// Find unbalanced parentheses with detailed reporting
function findUnbalancedParentheses(query, options = {}) {
  let balance = 0;
  let inString = false;
  let escapeNext = false;
  let lastParenPos = -1;
  let lastParenChar = '';
  let issues = [];
  let stringStartPos = -1;

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
      if (!inString) {
        inString = true;
        stringStartPos = i;
      } else {
        inString = false;
        stringStartPos = -1;
      }
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
            line: getLineNumber(query, i),
            context: getContext(query, i, 50)
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
      line: getLineNumber(query, lastParenPos),
      context: getContext(query, lastParenPos, 50)
    });
  }
  
  if (inString) {
    issues.push({
      type: 'unclosed_string',
      position: stringStartPos,
      line: getLineNumber(query, stringStartPos),
      context: getContext(query, stringStartPos, 50)
    });
  }
  
  return { balanced: issues.length === 0, issues };
}

// Get line number for a position in the query
function getLineNumber(query, position) {
  const lines = query.substring(0, position).split('\n');
  return lines.length;
}

// Get context around a position
function getContext(query, position, radius = 50) {
  const start = Math.max(0, position - radius);
  const end = Math.min(query.length, position + radius);
  return query.substring(start, end);
}

// Check query patterns and structure
function checkQueryPatterns(query, options = {}) {
  const lines = query.split('\n');
  let issues = [];
  let currentQuery = '';
  let parenBalance = 0;
  let queryStartLine = 0;
  let lineNumber = 0;

  for (const line of lines) {
    lineNumber++;
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith(';')) {
      // Skip empty lines and comments
      if (currentQuery.trim() && parenBalance === 0) {
        // Check complete query pattern
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

// Check predicates for common issues
function checkPredicates(query, options = {}) {
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

// Analyze a query file
function analyzeFile(filePath, options = {}) {
  console.log(`\n=== Analyzing ${filePath} ===`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const queryString = extractQueryString(content);
    
    if (!queryString) {
      console.log(`❌ Failed to extract query string from ${filePath}`);
      return false;
    }
    
    console.log(`✓ File loaded successfully (${queryString.length} characters)`);
    
    // Check for unbalanced parentheses
    const parenResult = findUnbalancedParentheses(queryString, options);
    if (!parenResult.balanced) {
      console.log(`❌ Found ${parenResult.issues.length} parenthesis issues:`);
      parenResult.issues.forEach(issue => {
        console.log(`  - ${issue.type} at line ${issue.line}, position ${issue.position}`);
        if (options.verbose) {
          console.log(`    Context: ${issue.context}`);
        }
      });
    } else {
      console.log(`✓ Parentheses are balanced`);
    }
    
    // Check query patterns
    const patternIssues = checkQueryPatterns(queryString, options);
    if (patternIssues.length > 0) {
      console.log(`❌ Found ${patternIssues.length} query pattern issues:`);
      patternIssues.forEach(issue => {
        console.log(`  - Lines ${issue.line}-${issue.endLine}: ${issue.context}`);
        if (options.verbose) {
          console.log(`    Query: ${issue.query.substring(0, 100)}...`);
        }
      });
    } else {
      console.log(`✓ Query patterns are valid`);
    }
    
    // Check predicates
    const predicateIssues = checkPredicates(queryString, options);
    if (predicateIssues.length > 0) {
      console.log(`⚠️  Found ${predicateIssues.length} potential predicate issues:`);
      predicateIssues.forEach(issue => {
        console.log(`  - Line ${issue.line}: ${issue.context}`);
      });
    } else {
      console.log(`✓ Predicates look good`);
    }
    
    // Statistics
    const queryCount = (queryString.match(/\) @[\w.-]+/g) || []).length;
    const predicateCount = (queryString.match(/#\w+\?/g) || []).length;
    const commentCount = (queryString.match(/;[^[\n]]*/g) || []).length;
    
    console.log(`📊 Statistics:`);
    console.log(`  - Total queries: ${queryCount}`);
    console.log(`  - Predicates: ${predicateCount}`);
    console.log(`  - Comments: ${commentCount}`);
    
    const totalIssues = parenResult.issues.length + patternIssues.length + predicateIssues.length;
    if (totalIssues === 0) {
      console.log(`🎉 No issues found!`);
      return true;
    } else {
      console.log(`⚠️  Found ${totalIssues} total issues`);
      return false;
    }
    
  } catch (error) {
    console.log(`❌ Error analyzing ${filePath}: ${error.message}`);
    return false;
  }
}

// Main execution
function main() {
  const options = parseArgs();
  
  if (options.help) {
    showHelp();
    return;
  }
  
  const filePath = options.filePath || getDefaultFilePath(options.language);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }
  
  console.log('Tree-sitter Query Balance Checker');
  console.log('=================================');
  
  const success = analyzeFile(filePath, options);
  process.exit(success ? 0 : 1);
}

// Run the analysis
main();