const fs = require('fs');
const path = require('path');

// 读取测试用例文件
const testCasesPath = path.join(__dirname, '../../../c/lifecycle-relationships/c-lifecycle-relationships.json');
const testCases = JSON.parse(fs.readFileSync(testCasesPath, 'utf8'));

// 验证每个查询的括号平衡
testCases.requests.forEach((testCase, index) => {
    const query = testCase.query;
    let openCount = 0;
    let closeCount = 0;
    
    for (let i = 0; i < query.length; i++) {
        if (query[i] === '(') {
            openCount++;
        } else if (query[i] === ')') {
            closeCount++;
        }
    }
    
    console.log(`测试用例 ${index + 1}:`);
    console.log(`  开括号数量: ${openCount}`);
    console.log(`  闭括号数量: ${closeCount}`);
    console.log(`  括号是否平衡: ${openCount === closeCount ? '是' : '否'}`);
    
    if (openCount !== closeCount) {
        console.log(`  不平衡: ${openCount - closeCount > 0 ? '缺少' : '多余'} ${Math.abs(openCount - closeCount)} 个括号`);
        console.log(`  查询内容: ${query}`);
    }
    console.log('');
});