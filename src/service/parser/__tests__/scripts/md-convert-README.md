# Test Case Conversion Scripts

This directory contains scripts for converting Markdown test case files into structured directory formats.

## Overview

The `convert-markdown-to-structure` script transforms Markdown files containing test cases (with code examples and TreeSitter queries) into a standardized directory structure with organized test files.

### Input Format

The script expects Markdown files with the following naming convention:
```
{language}-{category}-queries-test-cases.md
```

Example: `c-concurrency-queries-test-cases.md`

### Input File Structure

The Markdown file should follow this pattern:

```markdown
# Title

Description of test cases...

## 1. Section Title

### 测试用例 (or similar)
\`\`\`c
// C code here
\`\`\`

### 查询规则 (or similar)
\`\`\`
// TreeSitter query here
\`\`\`

## 2. Next Section Title

### 查询规则
\`\`\`
// Query here
\`\`\`

### 测试用例
\`\`\`c
// Code here
\`\`\`

...
```

### Output Directory Structure

The script generates the following structure:

```
output-directory/
├── {category}.json              # Index file (with reference format)
├── tests/
│   ├── test-001/
│   │   ├── code.{ext}           # Source code file
│   │   ├── query.txt            # TreeSitter query
│   │   └── metadata.json        # Metadata
│   ├── test-002/
│   │   ├── code.{ext}
│   │   ├── query.txt
│   │   └── metadata.json
│   └── ...
└── results/                      # Placeholder for API response results
    ├── result-001.json
    ├── result-002.json
    └── ...
```

## Usage

### Using Node.js (Recommended)

```bash
node src/service/parser/__tests__/scripts/convert-markdown-to-structure.js <source-file> <output-directory>
```

### Example

Convert the concurrency test cases for C:

```bash
cd /path/to/code-search-helper

node src/service/parser/__tests__/scripts/convert-markdown-to-structure.js \
  src/service/parser/__tests__/c/concurrency/c-concurrency-queries-test-cases.md \
  src/service/parser/__tests__/c/concurrency
```

### Using TypeScript (Optional)

If you prefer to run the TypeScript version:

```bash
npx ts-node src/service/parser/__tests__/scripts/convert-markdown-to-structure.ts <source-file> <output-directory>
```

## File Naming Convention

- **Source file**: `{language}-{category}-queries-test-cases.md`
  - Example: `c-concurrency-queries-test-cases.md`, `c-functions-test-cases.md`

- **Language detection**: Extracted from the first part of the filename
  - `c-` → C language
  - `cpp-` → C++ language
  - `py-` → Python language
  - etc.

- **Category detection**: Extracted from the second part of the filename
  - `c-concurrency-...` → concurrency category
  - `c-functions-...` → functions category
  - etc.

## Code File Extension Mapping

The script automatically determines the code file extension based on language:

- `c` → `.c`
- `cpp` → `.cpp`
- `h` → `.h`
- `hpp` → `.hpp`
- `java` → `.java`
- `py` → `.py`
- `js` → `.js`
- `ts` → `.ts`
- `go` → `.go`
- `rust` → `.rs`

## Index File Format

The generated `{category}.json` file has the following structure:

```json
{
  "category": "concurrency",
  "totalTests": 28,
  "requests": [
    {
      "id": "concurrency-001",
      "language": "c",
      "codeFile": "tests/test-001/code.c",
      "queryFile": "tests/test-001/query.txt",
      "metadataFile": "tests/test-001/metadata.json",
      "description": "Test case 001: 线程创建并发关系"
    },
    ...
  ]
}
```

## Metadata File Format

Each test case includes a `metadata.json` file:

```json
{
  "id": "concurrency-001",
  "section": "线程创建并发关系",
  "description": "Test case 001: 线程创建并发关系",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Error Handling

The script will report errors in these cases:

1. **File not found**: Source Markdown file doesn't exist
   - Message: `Error: Source file not found: {path}`

2. **Invalid filename**: File doesn't match the expected naming pattern
   - Message: `Invalid filename format. Expected: {language}-{category}-queries-test-cases.md`

3. **No test cases found**: Markdown file contains no test cases
   - Message: `Error: No test cases found in the markdown file`

## Tips

1. **Preserve the Markdown structure**: Ensure your Markdown file follows the expected format with `## N. Title` sections and code blocks.

2. **Query placement**: The script is flexible about query placement - it will find queries either before or after the code block.

3. **Dry run**: First, check the total number of test cases detected by the script output.

4. **Batch conversion**: You can create a shell script to convert multiple files:

```bash
#!/bin/bash
# batch-convert.sh

for md_file in src/service/parser/__tests__/c/*/*.md; do
  echo "Converting: $md_file"
  # Extract language and category from filename
  language=$(basename "$md_file" | cut -d- -f1)
  category=$(basename "$md_file" | cut -d- -f2)
  output_dir="src/service/parser/__tests__/$language/$category"
  
  node src/service/parser/__tests__/scripts/convert-markdown-to-structure.js "$md_file" "$output_dir"
done
```

## Development

If you need to modify the script:

1. **Node.js version**: Edit `convert-markdown-to-structure.js` (pure JavaScript, no dependencies)
2. **TypeScript version**: Edit `convert-markdown-to-structure.ts` (for type safety)

Both versions implement the same logic and can be used interchangeably.
