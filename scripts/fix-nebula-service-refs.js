const fs = require('fs');
const path = require('path');

// 需要修复的文件列表
const filesToFix = [
  'src/__tests__/integration/nebula-connection.test.ts',
  'src/__tests__/integration/nebula-reconnect.test.ts',
  'src/api/__tests__/ApiServer.test.ts',
  'src/database/__tests__/nebula/NebulaGraphOperations.test.ts',
  'src/database/__tests__/nebula/NebulaSpaceManager.test.ts',
  'src/service/graph/performance/NebulaConnectionMonitor.ts',
  'src/service/graph/utils/GraphPersistenceUtils.ts',
  'src/service/index/__tests__/IndexingLogicService.test.ts',
  'src/service/index/GraphIndexService.ts',
  'src/service/index/IndexingLogicService.ts',
  'src/service/index/IndexService.ts',
  'src/service/project/__tests__/CoreStateService.test.ts'
];

// 替换规则
const replacements = [
  {
    from: /import.*NebulaService.*from.*nebula\/NebulaService/g,
    to: 'import { NebulaClient } from \'../../nebula/client/NebulaClient\''
  },
  {
    from: /import.*INebulaService.*from.*nebula\/NebulaService/g,
    to: 'import { INebulaClient } from \'../../nebula/client/NebulaClient\''
  },
  {
    from: /NebulaService/g,
    to: 'NebulaClient'
  },
  {
    from: /INebulaService/g,
    to: 'INebulaClient'
  },
  {
    from: /TYPES\.INebulaService/g,
    to: 'TYPES.INebulaClient'
  },
  {
    from: /TYPES\.NebulaService/g,
    to: 'TYPES.INebulaClient'
  }
];

filesToFix.forEach(filePath => {
  try {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      replacements.forEach(replacement => {
        content = content.replace(replacement.from, replacement.to);
      });
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed: ${filePath}`);
    } else {
      console.log(`File not found: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error fixing ${filePath}:`, error.message);
  }
});

console.log('NebulaService reference fixing completed!');