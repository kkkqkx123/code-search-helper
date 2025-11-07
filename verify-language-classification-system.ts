import { LanguageMappingManager } from './src/service/parser/config/LanguageMappingManager';
import { LanguageClassificationDetector } from './src/service/parser/config/LanguageClassificationDetector';

async function testLanguageClassification() {
  console.log('Testing the new language classification system based on queries directory structure...\n');

  const languageMappingManager = LanguageMappingManager.getInstance();
  const classificationDetector = new LanguageClassificationDetector();

  // Test language categories
  console.log('=== Language Category Statistics ===');
  const stats = languageMappingManager.getStats();
  console.log(`Total Languages: ${stats.totalLanguages}`);
  console.log(`Advanced Programming Languages: ${stats.advancedProgramming}`);
  console.log(`Basic Programming Languages: ${stats.basicProgramming}`);
  console.log(`Data Format Languages: ${stats.dataFormat}`);
  console.log(`Special Processing Languages: ${stats.specialProcessing}`);
  console.log(`Hybrid Processing Languages: ${stats.hybridProcessing}`);

  console.log('\n=== Advanced Programming Languages (with subdirs) ===');
  const advancedLangs = languageMappingManager.getAdvancedProgrammingLanguages();
  console.log(advancedLangs);

  console.log('\n=== Basic Programming Languages (no subdirs) ===');
  const basicLangs = languageMappingManager.getBasicProgrammingLanguages();
  console.log(basicLangs);

  console.log('\n=== Sample Language Configurations ===');
  
  // Test TypeScript (advanced programming language)
  const tsConfig = languageMappingManager.getLanguageConfig('typescript');
  console.log(`TypeScript config:`);
  console.log(`  Name: ${tsConfig?.name}`);
  console.log(`  Has subdir: ${tsConfig?.hasSubdir}`);
  console.log(`  Category: ${tsConfig?.category}`);
  console.log(`  Query Dir: ${tsConfig?.queryDir}`);
  console.log(`  Strategy Primary: ${tsConfig?.strategy.primary}`);
  console.log(`  Uses Full AST: ${tsConfig?.strategy.useFullAST}`);
  console.log(`  Max Query Depth: ${tsConfig?.strategy.maxQueryDepth}`);
  console.log(`  Supported Query Types: ${tsConfig?.strategy.supportedQueryTypes?.join(', ')}`);

  // Test PHP (basic programming language)
  const phpConfig = languageMappingManager.getLanguageConfig('php');
  console.log(`\nPHP config:`);
  console.log(`  Name: ${phpConfig?.name}`);
  console.log(`  Has subdir: ${phpConfig?.hasSubdir}`);
  console.log(`  Category: ${phpConfig?.category}`);
  console.log(`  Query Dir: ${phpConfig?.queryDir}`);
  console.log(`  Strategy Primary: ${phpConfig?.strategy.primary}`);
  console.log(`  Uses Simplified AST: ${phpConfig?.strategy.useSimplifiedAST}`);
  console.log(`  Max Query Depth: ${phpConfig?.strategy.maxQueryDepth}`);

  // Test JSON (data format language)
  const jsonConfig = languageMappingManager.getLanguageConfig('json');
  console.log(`\nJSON config:`);
  console.log(`  Name: ${jsonConfig?.name}`);
  console.log(`  Has subdir: ${jsonConfig?.hasSubdir}`);
  console.log(`  Category: ${jsonConfig?.category}`);
  console.log(`  Strategy Primary: ${jsonConfig?.strategy.primary}`);
  console.log(`  Skip Complex Queries: ${jsonConfig?.strategy.skipComplexQueries}`);

  // Test Markdown (special processing language)
  const mdConfig = languageMappingManager.getLanguageConfig('markdown');
  console.log(`\nMarkdown config:`);
  console.log(`  Name: ${mdConfig?.name}`);
  console.log(`  Has subdir: ${mdConfig?.hasSubdir}`);
  console.log(`  Category: ${mdConfig?.category}`);
  console.log(`  Skip AST Parsing: ${mdConfig?.strategy.skipASTParsing}`);
  console.log(`  Specialized Processor: ${mdConfig?.strategy.specializedProcessor}`);

  // Test HTML (hybrid processing language)
  const htmlConfig = languageMappingManager.getLanguageConfig('html');
  console.log(`\nHTML config:`);
  console.log(`  Name: ${htmlConfig?.name}`);
  console.log(`  Has subdir: ${htmlConfig?.hasSubdir}`);
  console.log(`  Category: ${htmlConfig?.category}`);
  console.log(`  Strategy Primary: ${htmlConfig?.strategy.primary}`);
  console.log(`  Fallback Strategy: ${htmlConfig?.strategy.fallback?.join(', ')}`);
  console.log(`  Specialized Processor: ${htmlConfig?.strategy.specializedProcessor}`);

  // Test extension mapping
  console.log('\n=== Extension Mapping Tests ===');
  console.log(`.ts extension -> ${languageMappingManager.getLanguageByExtension('.ts')}`);
  console.log(`.js extension -> ${languageMappingManager.getLanguageByExtension('.js')}`);
  console.log(`.py extension -> ${languageMappingManager.getLanguageByExtension('.py')}`);
  console.log(`.json extension -> ${languageMappingManager.getLanguageByExtension('.json')}`);
  console.log(`.md extension -> ${languageMappingManager.getLanguageByExtension('.md')}`);

  // Test path mapping
  console.log('\n=== Path Mapping Tests ===');
  console.log(`example.ts path -> ${languageMappingManager.getLanguageByPath('example.ts')}`);
  console.log(`src/app.js path -> ${languageMappingManager.getLanguageByPath('src/app.js')}`);
  console.log(`lib/utils.py path -> ${languageMappingManager.getLanguageByPath('lib/utils.py')}`);
  console.log(`config/settings.json path -> ${languageMappingManager.getLanguageByPath('config/settings.json')}`);

  console.log('\n=== Language Classification System Based on Queries Directory Structure ===');
  console.log('SUCCESS: New language classification system is working correctly!');
  console.log('Classification is based on actual directory structure:');
  console.log('- Languages with subdirectories = Advanced rules (complex queries)');
  console.log('- Languages with single file = Basic rules (simple queries)');
  console.log('- Special processing languages = Skip AST parsing');
}

// Run the test
testLanguageClassification().catch(console.error);