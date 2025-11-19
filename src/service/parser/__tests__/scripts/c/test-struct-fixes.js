const axios = require('axios');

async function testPointerMemberAccess() {
    console.log('Testing pointer member access (test case 12)...');
    
    const code = `#include <stdio.h>

struct Point {
    int x;
    int y;
};

int main() {
    struct Point p = {5, 10};
    struct Point* ptr = &p;
    
    // 指针成员访问测试
    printf("X: %d, Y: %d\\n", ptr->x, ptr->y);
    
    // 修改通过指针访问的成员
    ptr->x = 15;
    ptr->y = 25;
    
    return 0;
}`;

    const query = `(field_expression
  argument: (identifier) @pointer.name
  field: (field_identifier) @field.name) @definition.pointer.member.access`;

    try {
        const response = await axios.post('http://localhost:4001/api/parse', {
            language: 'c',
            code: code,
            query: query
        });

        console.log('Pointer member access test result:');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error in pointer member access test:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
    }
}

async function testArrayAccess() {
    console.log('\\nTesting array access (test case 16)...');
    
    const code = `#include <stdio.h>

int main() {
    int arr[10];
    int matrix[5][5];
    
    // 数组访问测试
    arr[0] = 1;
    arr[1] = 2;
    arr[2] = arr[0] + arr[1];
    
    // 二维数组访问
    matrix[0][0] = 10;
    matrix[1][2] = 20;
    
    // 使用变量作为索引
    int i = 3;
    arr[i] = 30;
    
    return 0;
}`;

    const query = `(subscript_expression
  argument: (identifier) @array.name
  index: (_) @index) @definition.array.access`;

    try {
        const response = await axios.post('http://localhost:4001/api/parse', {
            language: 'c',
            code: code,
            query: query
        });

        console.log('Array access test result:');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error in array access test:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
    }
}

async function test2DArrayAccess() {
    console.log('\\nTesting 2D array access...');
    
    const code = `#include <stdio.h>

int main() {
    int matrix[5][5];
    
    // 二维数组访问
    matrix[0][0] = 10;
    matrix[1][2] = 20;
    
    return 0;
}`;

    const query = `(subscript_expression
  argument: (subscript_expression
    argument: (identifier) @array.name
    index: (_))
  index: (_) @index) @definition.array.access`;

    try {
        const response = await axios.post('http://localhost:4001/api/parse', {
            language: 'c',
            code: code,
            query: query
        });

        console.log('2D Array access test result:');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error in 2D array access test:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
    }
}

async function main() {
    console.log('Running struct query fixes verification tests...\\n');
    
    await testPointerMemberAccess();
    await testArrayAccess();
    await test2DArrayAccess();
    
    console.log('\\nAll tests completed.');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    testPointerMemberAccess,
    testArrayAccess,
    test2DArrayAccess
};