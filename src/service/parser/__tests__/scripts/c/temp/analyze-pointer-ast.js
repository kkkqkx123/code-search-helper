const axios = require('axios');

async function analyzeAST() {
    console.log('Analyzing AST for pointer vs regular member access...\n');
    
    // Test regular member access (obj.field)
    const regularCode = `#include <stdio.h>

struct Point {
    int x;
    int y;
};

int main() {
    struct Point p;
    p.x = 5;
    p.y = 10;
    return 0;
}`;

    // Test pointer member access (ptr->field)
    const pointerCode = `#include <stdio.h>

struct Point {
    int x;
    int y;
};

int main() {
    struct Point p;
    struct Point* ptr = &p;
    ptr->x = 5;
    ptr->y = 10;
    return 0;
}`;

    // Generic field expression query to capture all field expressions
    const query = `(field_expression) @field.expression`;

    console.log('Testing regular member access (obj.field):');
    try {
        const response1 = await axios.post('http://localhost:4001/api/parse', {
            language: 'c',
            code: regularCode,
            query: query
        });
        console.log(JSON.stringify(response1.data, null, 2));
    } catch (error) {
        console.error('Error in regular member access test:', error.message);
    }

    console.log('\nTesting pointer member access (ptr->field):');
    try {
        const response2 = await axios.post('http://localhost:4001/api/parse', {
            language: 'c',
            code: pointerCode,
            query: query
        });
        console.log(JSON.stringify(response2.data, null, 2));
    } catch (error) {
        console.error('Error in pointer member access test:', error.message);
    }
}

if (require.main === module) {
    analyzeAST().catch(console.error);
}