#!/usr/bin/env node

/**
 * Test runner script for the codebase index MCP project
 * This script runs all tests and provides a summary of results
 */

import { spawn } from 'child_process';
import path from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

async function runCommand(command: string, args: string[], cwd?: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, shell: true });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ code: code || 0, stdout, stderr });
    });
  });
}

async function runTests(): Promise<void> {
  console.log('🧪 Running all tests...\n');

  const testSuites = [
    { name: 'Utils Tests', command: 'npm', args: ['test', '--', 'src/utils'] },
    { name: 'API Tests', command: 'npm', args: ['test', '--', 'src/api'] },
    { name: 'MCP Tests', command: 'npm', args: ['test', '--', 'src/mcp'] },
  ];

  const results: TestResult[] = [];

  for (const suite of testSuites) {
    console.log(`\n🔍 Running ${suite.name}...`);
    console.log('-'.repeat(40));

    try {
      const { code, stdout, stderr } = await runCommand(suite.command, suite.args);
      
      if (code === 0) {
        console.log('✅ Passed');
        console.log(stdout);
        results.push({ name: suite.name, passed: true });
      } else {
        console.log('❌ Failed');
        console.log(stderr || stdout);
        results.push({ name: suite.name, passed: false, error: stderr || stdout });
      }
    } catch (error) {
      console.log('❌ Failed with exception');
      console.log(error);
      results.push({ name: suite.name, passed: false, error: (error as Error).message });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📋 TEST SUMMARY');
  console.log('='.repeat(50));

  let passedCount = 0;
  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${result.name}`);
    if (result.passed) passedCount++;
  }

  console.log('-'.repeat(50));
  console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${results.length - passedCount}`);

  if (passedCount === results.length) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please check the output above.');
    process.exit(1);
  }
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch((error) => {
    console.error('Error running tests:', error);
    process.exit(1);
  });
}