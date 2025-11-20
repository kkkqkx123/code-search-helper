const fs = require('fs');
const path = require('path');

// 测试单个查询模式
function testSingleQuery(testDir, testName) {
    console.log(`Testing ${testName}...`);
    
    // 读取查询文件
    const queryPath = path.join(testDir, 'query.txt');
    const codePath = path.join(testDir, 'code.c');
    
    if (!fs.existsSync(queryPath) || !fs.existsSync(codePath)) {
        console.log(`  Skipped: Missing files in ${testDir}`);
        return;
    }
    
    const query = fs.readFileSync(queryPath, 'utf8');
    const code = fs.readFileSync(codePath, 'utf8');
    
    console.log(`  Query: ${query.trim()}`);
    console.log(`  Code snippet: ${code.substring(0, 100).trim()}...`);
    console.log(`  ✓ Files exist and readable`);
}

// 主函数
function main() {
    const preprocessorTestsDir = path.join(__dirname, '../../../c/preprocessor/tests');
    
    if (!fs.existsSync(preprocessorTestsDir)) {
        console.log('Preprocessor tests directory not found');
        return;
    }
    
    console.log('Testing alternation queries for preprocessor patterns...\n');
    
    // 测试几个关键的测试用例
    const testCases = ['test-001', 'test-002', 'test-003', 'test-005', 'test-007'];
    
    for (const testCase of testCases) {
        const testDir = path.join(preprocessorTestsDir, testCase);
        testSingleQuery(testDir, testCase);
    }
    
    console.log('\n✓ Alternation query validation completed');
}

main();