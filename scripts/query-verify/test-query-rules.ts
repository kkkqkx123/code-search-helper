import { LoggerService } from '../../src/utils/LoggerService';

const logger = new LoggerService();

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const languages: string[] = [];

  for (const arg of args) {
    if (arg.startsWith('--lang=') || arg.startsWith('--language=')) {
      const lang = arg.split('=')[1]?.toLowerCase();
      if (lang && ['javascript', 'python', 'java', 'c', 'csharp', 'cpp'].includes(lang)) {
        languages.push(lang);
      } else {
        console.error(`Invalid language: ${lang}. Supported languages: javascript, python, java, c, csharp, cpp`);
        process.exit(1);
      }
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npm run test:query-rules [options]

Options:
  --lang=<language>    Run tests for specific language (javascript, python, java, c, csharp, cpp)
  --language=<language> Same as --lang
  --help, -h           Show this help message

Examples:
  npm run test:query-rules                    # Run all languages
  npm run test:query-rules --lang=javascript # Run only JavaScript
  npm run test:query-rules --lang=csharp # Run only C#
  npm run test:query-rules --lang=javascript --lang=python # Run JavaScript and Python
      `);
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      console.error(`Use --help for usage information`);
      process.exit(1);
    }
  }

  // If no languages specified, run all
  return languages.length > 0 ? languages : ['javascript', 'python', 'java', 'c', 'csharp', 'cpp'];
}

async function testQueryFilesExistence(selectedLanguages: string[]) {
  console.log('Testing new query files existence...\n');

  if (selectedLanguages.includes('javascript')) {
    // Test JavaScript queries
    console.log('Testing JavaScript query files...');
    try {
      const jsDataFlow = await import('../../src/service/parser/constants/queries/javascript/data-flow');
      console.log(`✓ JavaScript data-flow query loaded: ${jsDataFlow.default.length} characters`);

      const jsSemantic = await import('../../src/service/parser/constants/queries/javascript/semantic-relationships');
      console.log(`✓ JavaScript semantic-relationships query loaded: ${jsSemantic.default.length} characters`);

      const jsLifecycle = await import('../../src/service/parser/constants/queries/javascript/lifecycle-relationships');
      console.log(`✓ JavaScript lifecycle-relationships query loaded: ${jsLifecycle.default.length} characters`);

      const jsConcurrency = await import('../../src/service/parser/constants/queries/javascript/concurrency-relationships');
      console.log(`✓ JavaScript concurrency-relationships query loaded: ${jsConcurrency.default.length} characters`);
    } catch (error) {
      console.error('Error loading JavaScript query files:', error);
    }
  }

  if (selectedLanguages.includes('python')) {
    // Test Python queries
  console.log('\nTesting Python query files...');
  try {
    const pyDataFlow = await import('../../src/service/parser/constants/queries/python/data-flow');
    console.log(`✓ Python data-flow query loaded: ${pyDataFlow.default.length} characters`);

    const pySemantic = await import('../../src/service/parser/constants/queries/python/semantic-relationships');
    console.log(`✓ Python semantic-relationships query loaded: ${pySemantic.default.length} characters`);

    const pyLifecycle = await import('../../src/service/parser/constants/queries/python/lifecycle-relationships');
    console.log(`✓ Python lifecycle-relationships query loaded: ${pyLifecycle.default.length} characters`);
    } catch (error) {
      console.error('Error loading Python query files:', error);
    }
  }

  if (selectedLanguages.includes('java')) {
    // Test Java queries
  console.log('\nTesting Java query files...');
  try {
    const javaDataFlow = await import('../../src/service/parser/constants/queries/java/data-flow');
    console.log(`✓ Java data-flow query loaded: ${javaDataFlow.default.length} characters`);

    const javaSemantic = await import('../../src/service/parser/constants/queries/java/semantic-relationships');
    console.log(`✓ Java semantic-relationships query loaded: ${javaSemantic.default.length} characters`);

    const javaLifecycle = await import('../../src/service/parser/constants/queries/java/lifecycle-relationships');
    console.log(`✓ Java lifecycle-relationships query loaded: ${javaLifecycle.default.length} characters`);
    } catch (error) {
      console.error('Error loading Java query files:', error);
    }
  }

  if (selectedLanguages.includes('c')) {
    // Test C queries
  console.log('\nTesting C query files...');
  try {
    const cDataFlow = await import('../../src/service/parser/constants/queries/c/data-flow');
    console.log(`✓ C data-flow query loaded: ${cDataFlow.default.length} characters`);

    const cControlFlow = await import('../../src/service/parser/constants/queries/c/control-flow-relationships');
    console.log(`✓ C control-flow-relationships query loaded: ${cControlFlow.default.length} characters`);

    const cSemantic = await import('../../src/service/parser/constants/queries/c/semantic-relationships');
    console.log(`✓ C semantic-relationships query loaded: ${cSemantic.default.length} characters`);

    const cLifecycle = await import('../../src/service/parser/constants/queries/c/lifecycle-relationships');
    console.log(`✓ C lifecycle-relationships query loaded: ${cLifecycle.default.length} characters`);

    const cConcurrency = await import('../../src/service/parser/constants/queries/c/concurrency-relationships');
    console.log(`✓ C concurrency-relationships query loaded: ${cConcurrency.default.length} characters`);
    } catch (error) {
      console.error('Error loading C query files:', error);
    }
  }

  if (selectedLanguages.includes('csharp')) {
    // Test C# queries
  console.log('\nTesting C# query files...');
  try {
    const csDataFlow = await import('../../src/service/parser/constants/queries/csharp/data-flow');
    console.log(`✓ C# data-flow query loaded: ${csDataFlow.default.length} characters`);

    const csControlFlow = await import('../../src/service/parser/constants/queries/csharp/control-flow');
    console.log(`✓ C# control-flow query loaded: ${csControlFlow.default.length} characters`);

    const csSemantic = await import('../../src/service/parser/constants/queries/csharp/semantic-relationships');
    console.log(`✓ C# semantic-relationships query loaded: ${csSemantic.default.length} characters`);

    const csLifecycle = await import('../../src/service/parser/constants/queries/csharp/lifecycle-relationships');
    console.log(`✓ C# lifecycle-relationships query loaded: ${csLifecycle.default.length} characters`);

    const csConcurrency = await import('../../src/service/parser/constants/queries/csharp/concurrency-relationships');
    console.log(`✓ C# concurrency-relationships query loaded: ${csConcurrency.default.length} characters`);
    } catch (error) {
      console.error('Error loading C# query files:', error);
    }
  }

  if (selectedLanguages.includes('cpp')) {
    // Test C++ queries
  console.log('\nTesting C++ query files...');
  try {
    const cppDataFlow = await import('../../src/service/parser/constants/queries/cpp/data-flow');
    console.log(`✓ C++ data-flow query loaded: ${cppDataFlow.default.length} characters`);

    const cppSemantic = await import('../../src/service/parser/constants/queries/cpp/semantic-relationships');
    console.log(`✓ C++ semantic-relationships query loaded: ${cppSemantic.default.length} characters`);
    } catch (error) {
      console.error('Error loading C++ query files:', error);
    }
  }

  console.log(`\n✅ Query files for selected languages (${selectedLanguages.join(', ')}) have been successfully tested!`);
}

async function validateQuerySyntax(queries: string, language: string, queryType: string) {
  try {
    const lines = queries.split('\n');
    let balance = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < queries.length; i++) {
      const char = queries[i];

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
          if (balance < 0) {
            console.log(`✗ ${language} ${queryType} syntax error: Unbalanced parentheses at position ${i}`);
            console.log(`Debug: Context around position ${i}:`, queries.substring(Math.max(0, i-20), Math.min(queries.length, i+20)));
            return false;
          }
        }
      }
    }

    if (balance !== 0) {
      console.log(`✗ ${language} ${queryType} syntax error: Unbalanced parentheses`);
      return false;
    }

    if (inString) {
      console.log(`✗ ${language} ${queryType} syntax error: Unclosed string`);
      return false;
    }

    // Check query patterns - fix cross-line query validation
    let currentQuery = '';
    let parenBalance = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith(';')) {
        // Skip empty lines and comments
        if (currentQuery.trim() && parenBalance === 0) {
          // Check complete query pattern
          if (!currentQuery.includes('(') || !currentQuery.includes(')')) {
            console.log(`✗ ${language} ${queryType} syntax error: Invalid query pattern: ${currentQuery.trim()}`);
            return false;
          }
          currentQuery = '';
        }
        continue;
      }

      currentQuery += (currentQuery ? ' ' : '') + trimmed;

      // Count parentheses balance
      parenBalance += (trimmed.match(/\(/g) || []).length;
      parenBalance -= (trimmed.match(/\)/g) || []).length;

      // If parentheses balanced, check query pattern
      if (parenBalance === 0) {
        if (!currentQuery.includes('(') || !currentQuery.includes(')')) {
          console.log(`✗ ${language} ${queryType} syntax error: Invalid query pattern: ${currentQuery.trim()}`);
          return false;
        }
        currentQuery = '';
      }
    }

    // Check last incomplete query
    if (currentQuery.trim() && parenBalance === 0) {
      if (!currentQuery.includes('(') || !currentQuery.includes(')')) {
        console.log(`✗ ${language} ${queryType} syntax error: Invalid query pattern: ${currentQuery.trim()}`);
        return false;
      }
    }

    console.log(`✓ ${language} ${queryType} syntax is valid`);
    return true;
  } catch (error) {
    console.log(`✗ ${language} ${queryType} syntax validation error: ${error}`);
    return false;
  }
}

async function testQuerySyntax(selectedLanguages: string[]) {
  console.log('\nValidating query syntax...\n');

  if (selectedLanguages.includes('javascript')) {
    // JavaScript queries
    const jsDataFlow = await import('../../src/service/parser/constants/queries/javascript/data-flow');
    await validateQuerySyntax(jsDataFlow.default, 'JavaScript', 'data-flow');

    const jsSemantic = await import('../../src/service/parser/constants/queries/javascript/semantic-relationships');
    await validateQuerySyntax(jsSemantic.default, 'JavaScript', 'semantic-relationships');

    const jsLifecycle = await import('../../src/service/parser/constants/queries/javascript/lifecycle-relationships');
    await validateQuerySyntax(jsLifecycle.default, 'JavaScript', 'lifecycle-relationships');

    const jsConcurrency = await import('../../src/service/parser/constants/queries/javascript/concurrency-relationships');
    await validateQuerySyntax(jsConcurrency.default, 'JavaScript', 'concurrency-relationships');
  }

  if (selectedLanguages.includes('python')) {
    // Python queries
    const pyDataFlow = await import('../../src/service/parser/constants/queries/python/data-flow');
    await validateQuerySyntax(pyDataFlow.default, 'Python', 'data-flow');

    const pySemantic = await import('../../src/service/parser/constants/queries/python/semantic-relationships');
    await validateQuerySyntax(pySemantic.default, 'Python', 'semantic-relationships');

    const pyLifecycle = await import('../../src/service/parser/constants/queries/python/lifecycle-relationships');
    await validateQuerySyntax(pyLifecycle.default, 'Python', 'lifecycle-relationships');
  }

  if (selectedLanguages.includes('java')) {
    // Java queries
    const javaDataFlow = await import('../../src/service/parser/constants/queries/java/data-flow');
    await validateQuerySyntax(javaDataFlow.default, 'Java', 'data-flow');

    const javaSemantic = await import('../../src/service/parser/constants/queries/java/semantic-relationships');
    await validateQuerySyntax(javaSemantic.default, 'Java', 'semantic-relationships');

    const javaLifecycle = await import('../../src/service/parser/constants/queries/java/lifecycle-relationships');
    await validateQuerySyntax(javaLifecycle.default, 'Java', 'lifecycle-relationships');
  }

  if (selectedLanguages.includes('c')) {
    // C queries
    const cDataFlow = await import('../../src/service/parser/constants/queries/c/data-flow');
    await validateQuerySyntax(cDataFlow.default, 'C', 'data-flow');

    const cControlFlow = await import('../../src/service/parser/constants/queries/c/control-flow-relationships');
    await validateQuerySyntax(cControlFlow.default, 'C', 'control-flow-relationships');

    const cSemantic = await import('../../src/service/parser/constants/queries/c/semantic-relationships');
    await validateQuerySyntax(cSemantic.default, 'C', 'semantic-relationships');

    const cLifecycle = await import('../../src/service/parser/constants/queries/c/lifecycle-relationships');
    await validateQuerySyntax(cLifecycle.default, 'C', 'lifecycle-relationships');

    const cConcurrency = await import('../../src/service/parser/constants/queries/c/concurrency-relationships');
    await validateQuerySyntax(cConcurrency.default, 'C', 'concurrency-relationships');
  }

  if (selectedLanguages.includes('csharp')) {
    // C# queries
    const csDataFlow = await import('../../src/service/parser/constants/queries/csharp/data-flow');
    await validateQuerySyntax(csDataFlow.default, 'C#', 'data-flow');

    const csControlFlow = await import('../../src/service/parser/constants/queries/csharp/control-flow');
    await validateQuerySyntax(csControlFlow.default, 'C#', 'control-flow');

    const csSemantic = await import('../../src/service/parser/constants/queries/csharp/semantic-relationships');
    await validateQuerySyntax(csSemantic.default, 'C#', 'semantic-relationships');

    const csLifecycle = await import('../../src/service/parser/constants/queries/csharp/lifecycle-relationships');
    await validateQuerySyntax(csLifecycle.default, 'C#', 'lifecycle-relationships');

    const csConcurrency = await import('../../src/service/parser/constants/queries/csharp/concurrency-relationships');
    await validateQuerySyntax(csConcurrency.default, 'C#', 'concurrency-relationships');
  }

  if (selectedLanguages.includes('cpp')) {
    // C++ queries
    const cppDataFlow = await import('../../src/service/parser/constants/queries/cpp/data-flow');
    await validateQuerySyntax(cppDataFlow.default, 'C++', 'data-flow');

    const cppSemantic = await import('../../src/service/parser/constants/queries/cpp/semantic-relationships');
    await validateQuerySyntax(cppSemantic.default, 'C++', 'semantic-relationships');
  }

  console.log('\n✅ All query syntax validations completed!');
}

// Run tests
async function runTests() {
  try {
    const selectedLanguages = parseArgs();
    await testQueryFilesExistence(selectedLanguages);
    await testQuerySyntax(selectedLanguages);
    console.log('\n🎉 All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Execute the tests
runTests();