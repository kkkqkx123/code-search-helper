import { QueryLoader } from '../../src/service/parser/core/query/QueryLoader';

async function testQueryDiscovery() {
  console.log('Testing Query Discovery...\n');

  // Test JavaScript
  console.log('JavaScript discovered query types:');
  try {
    const jsDiscovered = await QueryLoader.discoverQueryTypes('javascript');
    console.log(jsDiscovered);
  } catch (error: unknown) {
    console.log('Discovery failed for JavaScript:', (error as Error).message);
  }

  // Test Python
  console.log('\nPython discovered query types:');
  try {
    const pyDiscovered = await QueryLoader.discoverQueryTypes('python');
    console.log(pyDiscovered);
  } catch (error: unknown) {
    console.log('Discovery failed for Python:', (error as Error).message);
  }

  // Test Java
  console.log('\nJava discovered query types:');
  try {
    const javaDiscovered = await QueryLoader.discoverQueryTypes('java');
    console.log(javaDiscovered);
  } catch (error: unknown) {
    console.log('Discovery failed for Java:', (error as Error).message);
  }

  // Test C
  console.log('\nC discovered query types:');
  try {
    const cDiscovered = await QueryLoader.discoverQueryTypes('c');
    console.log(cDiscovered);
  } catch (error: unknown) {
    console.log('Discovery failed for C:', (error as Error).message);
  }

  console.log('\n✅ Query discovery test completed!');
}

testQueryDiscovery().catch(console.error);