const fs = require('fs');
const path = require('path');

// 测试数组格式存储
function testArrayFormat() {
    console.log('=== 测试数组格式存储 ===');
    
    // 创建测试数据
    const testData = [
        {
            projectPath: 'D:/code/Go/dataStructure',
            projectId: '86b62e2ebce0231b',
            collectionName: 'project-86b62e2ebce0231b',
            spaceName: 'project_86b62e2ebce0231b',
            lastUpdateTime: new Date().toISOString()
        },
        {
            projectPath: 'D:/ide/tool/code-search-helper/test-files',
            projectId: '7de244c5109905ee',
            collectionName: 'project-7de244c5109905ee',
            spaceName: 'project_7de244c5109905ee',
            lastUpdateTime: new Date().toISOString()
        }
    ];
    
    // 保存为数组格式
    const testFilePath = path.join(__dirname, 'data', 'project-mapping-test.json');
    fs.writeFileSync(testFilePath, JSON.stringify(testData, null, 2));
    console.log('✓ 已保存数组格式测试数据');
    
    // 读取并验证
    const readData = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
    console.log('✓ 读取的数组格式数据:', JSON.stringify(readData, null, 2));
    
    // 验证数据结构
    if (Array.isArray(readData) && readData.length > 0) {
        console.log('✓ 数据格式正确：是数组格式');
        console.log(`✓ 包含 ${readData.length} 个项目映射`);
        
        for (let i = 0; i < readData.length; i++) {
            const item = readData[i];
            if (item.projectPath && item.projectId && item.collectionName && item.spaceName && item.lastUpdateTime) {
                console.log(`✓ 项目 ${i+1} 数据完整`);
            } else {
                console.log(`✗ 项目 ${i+1} 数据不完整`);
            }
        }
    } else {
        console.log('✗ 数据格式错误：不是数组格式');
    }
    
    // 清理测试文件
    fs.unlinkSync(testFilePath);
    console.log('✓ 已清理测试文件');
}

// 模拟从对象格式转换为数组格式
function testFormatConversion() {
    console.log('\n=== 测试格式转换 ===');
    
    // 模拟旧格式数据
    const oldFormatData = {
        projectIdMap: {
            "D:/code/Go/dataStructure": "86b62e2ebce0231b",
            "D:/ide/tool/code-search-helper/test-files": "7de24c5109905ee"
        },
        collectionMap: {
            "86b62e2ebce0231b": "project-86b62e2ebce0231b",
            "7de244c5109905ee": "project-7de244c5109905ee"
        },
        spaceMap: {
            "86b62e2ebce0231b": "project_86b62e2ebce0231b",
            "7de244c5109905ee": "project_7de244c5109905ee"
        },
        pathToProjectMap: {
            "86b62e2ebce0231b": "D:/code/Go/dataStructure",
            "7de244c5109905ee": "D:/ide/tool/code-search-helper/test-files"
        },
        projectUpdateTimes: {
            "86b62e2ebce0231b": "2025-10-12T05:01:19.62Z",
            "7de244c5109905ee": "2025-10-12T05:36:19.373Z"
        }
    };
    
    console.log('旧格式数据:', JSON.stringify(oldFormatData, null, 2));
    
    // 转换为新格式
    const newFormatData = [];
    for (const [projectPath, projectId] of Object.entries(oldFormatData.projectIdMap)) {
        newFormatData.push({
            projectPath: projectPath,
            projectId: projectId,
            collectionName: oldFormatData.collectionMap[projectId],
            spaceName: oldFormatData.spaceMap[projectId],
            lastUpdateTime: new Date(oldFormatData.projectUpdateTimes[projectId])
        });
    }
    
    console.log('新格式数据:', JSON.stringify(newFormatData, null, 2));
    
    // 验证转换结果
    if (Array.isArray(newFormatData) && newFormatData.length > 0) {
        console.log('✓ 格式转换成功：数据为数组格式');
        console.log(`✓ 转换了 ${newFormatData.length} 个项目`);
    } else {
        console.log('✗ 格式转换失败');
    }
}

// 执行测试
testArrayFormat();
testFormatConversion();

console.log('\n=== 测试完成 ===');