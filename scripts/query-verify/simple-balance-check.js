const fs = require('fs');

// Read the file
const filePath = 'src/service/parser/constants/queries/c/lifecycle-relationships.ts';
const content = fs.readFileSync(filePath, 'utf8');

// Remove the export wrapper and comments
const queryContent = content.replace(/export default `/, '').replace(/`$/, '');

let balance = 0;
let inString = false;
let escapeNext = false;
let lineNum = 1;
let charNum = 1;

for (let i = 0; i < queryContent.length; i++) {
  const char = queryContent[i];
  
  if (char === '\n') {
    lineNum++;
    charNum = 1;
    continue;
  }
  
  if (escapeNext) {
    escapeNext = false;
    charNum++;
    continue;
  }

  if (char === '\\') {
    escapeNext = true;
    charNum++;
    continue;
  }

  if (char === '"' && !escapeNext) {
    inString = !inString;
    charNum++;
    continue;
  }

  if (!inString) {
    if (char === '(') {
      balance++;
      console.log(`Line ${lineNum}, Col ${charNum}: Found '(', balance = ${balance}`);
    } else if (char === ')') {
      balance--;
      console.log(`Line ${lineNum}, Col ${charNum}: Found ')', balance = ${balance}`);
      if (balance < 0) {
        console.log(`ERROR: Unmatched closing parenthesis at line ${lineNum}, col ${charNum}`);
      }
    }
  }
  
  charNum++;
}

console.log(`\nFinal balance: ${balance}`);
if (balance !== 0) {
  console.log(`ERROR: Unbalanced parentheses - ${balance} more opening than closing`);
} else {
  console.log('SUCCESS: All parentheses are balanced');
}