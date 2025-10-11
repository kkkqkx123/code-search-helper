const fs = require('fs').promises;
const path = require('path');

async function testDeleteFix() {
  console.log('Testing delete functionality fix...');
  
  try {
    // 检查项目状态文件是否存在
    const projectStatesPath = path.join(__dirname, 'data', 'project-states.json');
    const projectMappingPath = path.join(__dirname, 'data', 'project-mapping.json');
    
    console.log('Checking project states file...');
    const statesData = await fs.readFile(projectStatesPath, 'utf8');
    const projectStates = JSON.parse(statesData);
    console.log(`Found ${projectStates.length} project states`);
    console.log('Project states:', projectStates.map(s => ({ 
      projectId: s.projectId, 
      projectPath: s.projectPath 
    })));
    
    console.log('Checking project mapping file...');
    const mappingData = await fs.readFile(projectMappingPath, 'utf8');
    const projectMapping = JSON.parse(mappingData);
    console.log('Project mapping:', {
      projectIdMap: projectMapping.projectIdMap,
      collectionMap: Object.keys(projectMapping.collectionMap),
      spaceMap: Object.keys(projectMapping.spaceMap)
    });
    
    // 检查两个文件中的项目是否一致
    const stateProjectIds = projectStates.map(s => s.projectId);
    const mappingProjectIds = Object.keys(projectMapping.collectionMap);
    
    console.log('State project IDs:', stateProjectIds);
    console.log('Mapping project IDs:', mappingProjectIds);
    
    const missingInStates = mappingProjectIds.filter(id => !stateProjectIds.includes(id));
    const missingInMapping = stateProjectIds.filter(id => !mappingProjectIds.includes(id));
    
    if (missingInStates.length > 0) {
      console.log('WARNING: Projects found in mapping but not in states:', missingInStates);
    }
    
    if (missingInMapping.length > 0) {
      console.log('WARNING: Projects found in states but not in mapping:', missingInMapping);
    }
    
    if (missingInStates.length === 0 && missingInMapping.length === 0) {
      console.log('✅ Project states and mapping are consistent');
    } else {
      console.log('❌ Project states and mapping are inconsistent');
    }
    
  } catch (error) {
    console.error('Error testing delete functionality:', error);
  }
}

// Run the test
testDeleteFix();