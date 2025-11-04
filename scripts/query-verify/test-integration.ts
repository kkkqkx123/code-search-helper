import { QueryLoader } from '../../src/service/parser/core/query/QueryLoader';

async function testQueryLoaderIntegration() {
  console.log('Testing QueryLoader integration...\n');

  // Preload common languages
  await QueryLoader.preloadCommonLanguages();

  console.log('Loaded languages:', QueryLoader.getLoadedLanguages());

  // Check JavaScript queries
  console.log('\nJavaScript query types:', QueryLoader.getQueryTypesForLanguage('javascript'));

  // Check Python queries
  console.log('Python query types:', QueryLoader.getQueryTypesForLanguage('python'));

  // Check Java queries
  console.log('Java query types:', QueryLoader.getQueryTypesForLanguage('java'));

  // Check C queries
  console.log('C query types:', QueryLoader.getQueryTypesForLanguage('c'));

  // Show stats
  console.log('\nQueryLoader Stats:', QueryLoader.getStats());

  console.log('\n✅ QueryLoader integration test completed successfully!');
}

// Run the integration test
testQueryLoaderIntegration().catch(console.error);