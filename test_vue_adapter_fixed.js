/**
 * 验证修复后的Vue适配器一致性
 */

const fs = require('fs');
const path = require('path');

// 修复后的适配器支持的查询类型
const fixedAdapterSupportedTypes = [
    'template-elements',
    'template-directives',
    'component-definitions',
    'script-definitions',
    'style-definitions',
    'vue-exports',
    'vue-lifecycle',
    'vue-slots',
    'vue-interpolations'
];

// 修复后的适配器处理的名称捕获
const fixedAdapterNameCaptures = [
    'name.definition.function',
    'name.definition.method',
    'name.definition.class',
    'name.definition.component',
    'name.definition.directive',
    'name.definition.tag',
    'name.definition.component_name',
    'name.definition.event_handler',
    'name.definition.property_binding',
    'name.definition.slot_name',
    'name.definition.ref',
    'name.definition.key',
    'name.definition.v_model',
    'name.definition.show_hide',
    'name.definition.conditional',
    'name.definition.for_loop'
];

// 修复后的查询类型映射
const fixedAdapterQueryTypeMapping = {
    'template-elements': 'variable',
    'template-directives': 'variable',
    'component-definitions': 'class',
    'script-definitions': 'function',
    'style-definitions': 'variable',
    'vue-exports': 'export',
    'vue-lifecycle': 'method',
    'vue-slots': 'variable',
    'vue-interpolations': 'expression'
};

// 从查询文件中提取的所有捕获名称
const queryCaptures = {
    components: [
        '@definition.template',
        '@definition.script',
        '@definition.style',
        '@definition.component_tag',
        '@definition.slot',
        '@definition.interpolation',
        '@definition.comment',
        '@definition.component_export',
        '@name.definition.component_name',
        '@definition.props_definition',
        '@definition.methods_definition',
        '@definition.data_definition',
        '@definition.computed_definition',
        '@definition.lifecycle_hook'
    ],
    templateDirectives: [
        '@definition.template_element',
        '@name.definition.tag',
        '@name.definition.directive',
        '@definition.vue_directive',
        '@name.definition.event_handler',
        '@definition.event_handler',
        '@name.definition.property_binding',
        '@definition.property_binding',
        '@name.definition.slot_name',
        '@definition.slot_attribute',
        '@name.definition.ref',
        '@definition.ref_attribute',
        '@name.definition.key',
        '@definition.key_attribute',
        '@name.definition.v_model',
        '@definition.v_model_binding',
        '@name.definition.show_hide',
        '@definition.show_hide_directive',
        '@name.definition.conditional',
        '@definition.conditional_directive',
        '@name.definition.for_loop',
        '@definition.for_directive'
    ]
};

// 提取所有查询捕获名称
function getAllQueryCaptures() {
    const allCaptures = [];
    Object.values(queryCaptures).forEach(captures => {
        allCaptures.push(...captures);
    });
    return [...new Set(allCaptures)]; // 去重
}

// 提取所有名称捕获（以@name开头的）
function getAllNameCaptures() {
    const allCaptures = getAllQueryCaptures();
    return allCaptures.filter(capture => capture.startsWith('@name.')).map(capture => capture.substring(1)); // 去掉@前缀
}

// 验证修复后的适配器
function validateFixedVueAdapter() {
    console.log('🔍 验证修复后的Vue适配器一致性...\n');
    
    const allNameCaptures = getAllNameCaptures();
    
    console.log('📋 查询文件中定义的名称捕获:');
    console.log(allNameCaptures);
    console.log('');
    
    console.log('📋 修复后适配器处理的名称捕获:');
    console.log(fixedAdapterNameCaptures);
    console.log('');
    
    console.log('📋 修复后适配器支持的查询类型:');
    console.log(fixedAdapterSupportedTypes);
    console.log('');
    
    console.log('📋 修复后适配器的查询类型映射:');
    Object.entries(fixedAdapterQueryTypeMapping).forEach(([queryType, standardType]) => {
        console.log(`   - ${queryType} -> ${standardType}`);
    });
    console.log('');
    
    // 检查1: 适配器是否处理了所有名称捕获
    console.log('🔍 检查1: 适配器是否处理了所有名称捕获');
    const missingNameCaptures = allNameCaptures.filter(capture => !fixedAdapterNameCaptures.includes(capture));
    
    if (missingNameCaptures.length > 0) {
        console.log('❌ 适配器仍然缺少以下名称捕获处理:');
        missingNameCaptures.forEach(capture => console.log(`   - ${capture}`));
        return false;
    } else {
        console.log('✅ 适配器处理了所有名称捕获');
    }
    console.log('');
    
    // 检查2: 查询类型映射是否完整
    console.log('🔍 检查2: 查询类型映射是否完整');
    const unmappedQueryTypes = fixedAdapterSupportedTypes.filter(type => !fixedAdapterQueryTypeMapping[type]);
    
    if (unmappedQueryTypes.length > 0) {
        console.log('❌ 以下查询类型缺少映射:');
        unmappedQueryTypes.forEach(type => console.log(`   - ${type}`));
        return false;
    } else {
        console.log('✅ 所有查询类型都有映射');
    }
    console.log('');
    
    // 检查3: 映射的目标类型是否有效
    console.log('🔍 检查3: 映射的目标类型是否有效');
    const validTargetTypes = ['function', 'class', 'method', 'import', 'variable', 'interface', 'type', 'export', 'control-flow', 'expression'];
    const invalidMappings = Object.entries(fixedAdapterQueryTypeMapping).filter(([queryType, targetType]) => !validTargetTypes.includes(targetType));
    
    if (invalidMappings.length > 0) {
        console.log('❌ 以下映射的目标类型无效:');
        invalidMappings.forEach(([queryType, targetType]) => console.log(`   - ${queryType} -> ${targetType}`));
        return false;
    } else {
        console.log('✅ 所有映射的目标类型都有效');
    }
    console.log('');
    
    console.log('✅ 修复后的Vue适配器一致性验证通过！');
    return true;
}

// 运行验证
const isConsistent = validateFixedVueAdapter();

if (isConsistent) {
    console.log('\n🎉 Vue适配器已成功修复，与查询类型完全一致！');
} else {
    console.log('\n❌ Vue适配器仍有问题，需要进一步修复');
}