const { Parser } = require('tree-sitter');
const Cpp = require('tree-sitter-cpp');

async function debugCppClassAST() {
    const parser = new Parser();
    parser.setLanguage(Cpp);

    // 测试字段声明的代码
    const code = `class Fields {
public:
    int publicField;
    static int staticField;
private:
    int privateField;
};`;

    console.log('=== 调试C++类字段AST结构 ===');
    console.log('代码:');
    console.log(code);
    console.log('');

    try {
        const tree = parser.parse(code);
        const rootNode = tree.rootNode;
        
        console.log('根节点:', rootNode.type);
        console.log('');
        
        // 递归遍历所有节点并按类型分组
        const nodesByType = {};
        
        function traverse(node, depth = 0) {
            const indent = '  '.repeat(depth);
            // console.log(`${indent}${node.type}: "${node.text.replace(/\n/g, '\\n')}" (行 ${node.startPosition.row + 1}, 列 ${node.startPosition.column + 1})`);
            
            if (!nodesByType[node.type]) {
                nodesByType[node.type] = [];
            }
            nodesByType[node.type].push({
                text: node.text.replace(/\n/g, '\\n'),
                position: `行 ${node.startPosition.row + 1}, 列 ${node.startPosition.column + 1}`
            });
            
            for (let child of node.children) {
                traverse(child, depth + 1);
            }
        }
        
        traverse(rootNode);
        
        console.log('按类型分组的节点:');
        for (const [type, nodes] of Object.entries(nodesByType)) {
            console.log(`${type} (${nodes.length}个):`);
            nodes.forEach((node, index) => {
                console.log(`  - "${node.text}" (${node.position})`);
            });
        }
        
        console.log('');
        console.log('=== 搜索可能的字段声明相关节点 ===');
        
        // 特别关注字段声明相关节点
        const fieldRelatedTypes = [
            'field_declaration', 'declaration', 'member_declaration', 
            'member_declarator', 'field_declarator', 'field_identifier',
            'type_identifier', 'primitive_type'
        ];
        
        for (const type of fieldRelatedTypes) {
            if (nodesByType[type]) {
                console.log(`${type}:`);
                nodesByType[type].forEach((node, index) => {
                    console.log(`  - "${node.text}" (${node.position})`);
                });
                console.log('');
            }
        }
        
    } catch (error) {
        console.error('解析错误:', error);
    }
}

debugCppClassAST().catch(console.error);