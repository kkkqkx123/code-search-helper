#!/usr/bin/env ts-node

/**
 * 修复nebula-nodejs库中undefined space问题的脚本
 *
 * 问题：当space配置为undefined时，库会尝试执行"USE undefined"命令
 * 解决方案：在执行USE命令前检查space是否为有效值
 */

import * as fs from 'fs';
import * as path from 'path';

const SOURCE_DIR = path.join(__dirname, '..', '@nebula-contrib', 'nebula-nodejs');
const TARGET_DIR = path.join(__dirname, '..', 'node_modules', '@nebula-contrib', 'nebula-nodejs');
const CONNECTION_FILE = 'nebula/Connection.js';

interface PatchResult {
  success: boolean;
  message: string;
  backupCreated?: boolean;
}

function applyFix(): PatchResult {
  try {
    // 检查源目录和目标目录
    if (!fs.existsSync(SOURCE_DIR)) {
      return {
        success: false,
        message: `Source directory not found: ${SOURCE_DIR}`
      };
    }

    if (!fs.existsSync(TARGET_DIR)) {
      return {
        success: false,
        message: `Target directory not found: ${TARGET_DIR}`
      };
    }

    const sourceFile = path.join(SOURCE_DIR, CONNECTION_FILE);
    const targetFile = path.join(TARGET_DIR, CONNECTION_FILE);

    if (!fs.existsSync(sourceFile)) {
      return {
        success: false,
        message: `Source file not found: ${sourceFile}`
      };
    }

    if (!fs.existsSync(targetFile)) {
      return {
        success: false,
        message: `Target file not found: ${targetFile}`
      };
    }

    // 读取目标文件内容
    const content = fs.readFileSync(targetFile, 'utf8');

    // 检查是否已经修复过
    if (content.includes('No valid space specified, marking connection as ready without space switching.')) {
      return {
        success: true,
        message: 'Patch already applied'
      };
    }

    // 查找要替换的代码块
    const oldPattern = /return new Promise\(\(resolve, reject\) => \{\s*this\.run\(\{\s*command: `Use \${this\.connectionOption\.space}`,\s*returnOriginalData: false,\s*resolve,\s*reject: \(err\) => \{\s*\/\/ 修复：如果 USE 命令失败，仍然标记连接为就绪\s*console\.warn\(`Failed to switch to space '\$\{this\.connectionOption\.space\}':`, err\.message\);\s*console\.warn\('Marking connection as ready anyway\. Space switching will be handled by explicit queries\.'\);\s*this\.isReady = true;\s*this\.isBusy = false;\s*this\.emit\('ready', \{\s*sender: this\s*\}\);\s*this\.emit\('free', \{\s*sender: this\s*\}\);\s*resolve\(\);\s*\}\s*\}\);\s*\}\);/gs;

    const newCode = `return new Promise((resolve, reject) => {
        // 检查是否定义了有效的空间名称
        if (this.connectionOption.space && this.connectionOption.space !== 'undefined' && this.connectionOption.space !== '') {
          this.run({
            command: \`Use \${this.connectionOption.space}\`,
            returnOriginalData: false,
            resolve,
            reject: (err) => {
              // 修复：如果 USE 命令失败，仍然标记连接为就绪
              console.warn(\`Failed to switch to space '\${this.connectionOption.space}':\`, err.message);
              console.warn('Marking connection as ready anyway. Space switching will be handled by explicit queries.');
              this.isReady = true;
              this.isBusy = false;
              this.emit('ready', {
                sender: this
              });
              this.emit('free', {
                sender: this
              });
              resolve();
            }
          });
        } else {
          // 没有定义空间或空间无效，直接标记为就绪
          console.log('No valid space specified, marking connection as ready without space switching.');
          this.isReady = true;
          this.isBusy = false;
          this.emit('ready', {
            sender: this
          });
          this.emit('free', {
            sender: this
          });
          resolve();
        }
      });`;

    // 检查是否找到要替换的模式
    if (!oldPattern.test(content)) {
      return {
        success: false,
        message: 'Could not find the target pattern to patch. The file may have been already modified or has different structure.'
      };
    }

    // 重置正则表达式的lastIndex
    oldPattern.lastIndex = 0;

    // 应用修复
    const fixedContent = content.replace(oldPattern, newCode);

    // 创建备份
    const backupFile = targetFile + '.backup.' + Date.now();
    fs.writeFileSync(backupFile, content);

    // 写入修复后的内容
    fs.writeFileSync(targetFile, fixedContent);

    return {
      success: true,
      message: 'Successfully applied undefined space fix',
      backupCreated: true
    };

  } catch (error) {
    return {
      success: false,
      message: `Error applying patch: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

function main() {
  console.log('🔧 Applying nebula-nodejs undefined space fix...\n');

  const result = applyFix();

  if (result.success) {
    console.log('✅ Fix applied successfully!');
    console.log(`✨ ${result.message}`);

    if (result.backupCreated) {
      console.log('📁 Backup files created');
    }

    console.log('\n📝 Summary of changes:');
    console.log('- Modified nebula/Connection.js to check for undefined space before executing USE command');
    console.log('- Added validation to prevent "USE undefined" commands');
    console.log('- Connections will now be marked ready immediately when no valid space is specified');

    console.log('\n🔄 Next steps:');
    console.log('1. Restart your application with npm run dev');
    console.log('2. The undefined space errors should be resolved');
    console.log('3. Connections will work without requiring a default space');

  } else {
    console.error('❌ Failed to apply fix!');
    console.error(`Error: ${result.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}