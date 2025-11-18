const fs = require('fs');
const path = require('path');

// 修复文件格式
function fixFileFormat(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    let fixedLines = [];
    let i = 0;
    
    while (i < lines.length) {
        const line = lines[i];
        
        // 跳过重复的标题行
        if (line.match(/^## \d+\./)) {
            fixedLines.push(line);
            fixedLines.push(''); // 添加空行
            i++;
            continue;
        }
        
        // 跳过空的"### 查询规则"和"### 测试用例"行
        if (line === '### 查询规则' || line === '### 测试用例') {
            // 检查下一行是否也是相同的标题
            if (i + 1 < lines.length && lines[i + 1] === line) {
                i++; // 跳过重复的标题
                continue;
            }
        }
        
        // 跳过连续的空行
        if (line === '' && i + 1 < lines.length && lines[i + 1] === '') {
            i++;
            continue;
        }
        
        fixedLines.push(line);
        i++;
    }
    
    // 确保文件以正确的格式结束
    const lastLines = fixedLines.slice(-3);
    if (!lastLines.includes('### 查询结果')) {
        fixedLines.push('### 查询结果');
        fixedLines.push('```');
        fixedLines.push('```');
    }
    
    const fixedContent = fixedLines.join('\n');
    fs.writeFileSync(filePath, fixedContent, 'utf8');
    console.log(`修复文件: ${filePath}`);
}

// 获取所有需要修复的文件
function getFilesToFix() {
    const files = [];
    
    // 结构体文件
    const structDir = 'src/service/parser/__tests__/c/structs';
    for (let i = 3; i <= 11; i++) {
        files.push(`${structDir}/c-${i}-*.md`);
    }
    
    // 并发文件
    const concurrencyDir = 'src/service/parser/__tests__/c/concurrency';
    for (let i = 13; i <= 28; i++) {
        files.push(`${concurrencyDir}/c-${i}-*.md`);
    }
    
    return files;
}

// 主函数
function main() {
    console.log('开始修复测试用例文件格式...');
    
    // 修复结构体文件
    const structFiles = [
        'src/service/parser/__tests__/c/structs/c-3-数组声明查询.md',
        'src/service/parser/__tests__/c/structs/c-4-指针声明查询.md',
        'src/service/parser/__tests__/c/structs/c-5-成员访问查询.md',
        'src/service/parser/__tests__/c/structs/c-6-指针成员访问查询.md',
        'src/service/parser/__tests__/c/structs/c-7-数组访问查询.md',
        'src/service/parser/__tests__/c/structs/c-8-嵌套结构体查询.md',
        'src/service/parser/__tests__/c/structs/c-9-前向声明查询.md'
    ];
    
    // 修复并发文件
    const concurrencyFiles = [
        'src/service/parser/__tests__/c/concurrency/c-13-条件变量信号同步关系.md',
        'src/service/parser/__tests__/c/concurrency/c-14-条件变量广播同步关系.md',
        'src/service/parser/__tests__/c/concurrency/c-15-条件变量销毁同步关系.md',
        'src/service/parser/__tests__/c/concurrency/c-16-读写锁初始化同步关系.md',
        'src/service/parser/__tests__/c/concurrency/c-17-读写锁读锁同步关系.md',
        'src/service/parser/__tests__/c/concurrency/c-18-读写锁写锁同步关系.md',
        'src/service/parser/__tests__/c/concurrency/c-19-读写锁解锁同步关系.md',
        'src/service/parser/__tests__/c/concurrency/c-20-读写锁销毁同步关系.md',
        'src/service/parser/__tests__/c/concurrency/c-21-信号量初始化同步关系.md',
        'src/service/parser/__tests__/c/concurrency/c-22-信号量等待同步关系.md',
        'src/service/parser/__tests__/c/concurrency/c-23-信号量尝试等待同步关系.md',
        'src/service/parser/__tests__/c/concurrency/c-24-信号量信号同步关系.md',
        'src/service/parser/__tests__/c/concurrency/c-25-信号量销毁同步关系.md',
        'src/service/parser/__tests__/c/concurrency/c-26-内存屏障并发关系.md',
        'src/service/parser/__tests__/c/concurrency/c-27-编译器屏障并发关系.md',
        'src/service/parser/__tests__/c/concurrency/c-28-线程本地变量声明.md'
    ];
    
    const allFiles = [...structFiles, ...concurrencyFiles];
    
    for (const file of allFiles) {
        if (fs.existsSync(file)) {
            fixFileFormat(file);
        } else {
            console.log(`文件不存在: ${file}`);
        }
    }
    
    console.log('\n所有文件格式修复完成！');
}

main();