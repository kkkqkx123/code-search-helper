const axios = require('axios');

async function testPointerQuery() {
    console.log('Testing specific pointer member access query...\n');
    
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

    // Current query in our constants file
    const query = `(field_expression
  argument: (identifier) @pointer.name
  field: (field_identifier) @field.name) @definition.pointer.member.access`;

    try {
        const response = await axios.post('http://localhost:4001/api/parse', {
            language: 'c',
            code: code,
            query: query
        });

        console.log('Pointer member access query result:');
        console.log(JSON.stringify(response.data, null, 2));
        
        if (response.data.data && response.data.data.length > 0) {
            console.log('\\nQuery matched successfully!');
        } else {
            console.log('\\nQuery did not match any results.');
            console.log('This could mean:');
            console.log('1. The AST structure is different than expected');
            console.log('2. Need to use a different query pattern');
        }
    } catch (error) {
        console.error('Error in pointer member access test:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
    }
}

// Test a more generic query to see what's happening
async function testGenericFieldExpression() {
    console.log('\\nTesting generic field expression query...');
    
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

    // Generic query to match any field expression
    const query = `(field_expression) @field.expression`;

    try {
        const response = await axios.post('http://localhost:4001/api/parse', {
            language: 'c',
            code: code,
            query: query
        });

        console.log('Generic field expression query result:');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error in generic field expression test:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
    }
}

async function main() {
    await testPointerQuery();
    await testGenericFieldExpression();
}

if (require.main === module) {
    main().catch(console.error);
}