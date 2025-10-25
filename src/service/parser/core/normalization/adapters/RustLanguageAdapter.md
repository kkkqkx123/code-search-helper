# Rust Language Adapter

## Overview
The Rust Language Adapter is responsible for normalizing Tree-sitter query results for Rust code into a standardized format that can be used by the code splitting and analysis system.

## Features

### Supported Query Types
- **Functions**: Function definitions, async functions, closures
- **Classes**: Structs, enums, unions, traits (treated as class-like constructs)
- **Methods**: Functions defined inside implementation blocks
- **Imports**: Use declarations, extern crate statements, module definitions
- **Variables**: Constants, static variables, let bindings
- **Control Flow**: Match expressions, loops, conditionals, unsafe blocks
- **Types**: Type aliases, generic parameters, associated types
- **Expressions**: Function calls, field access, various expression types
- **Macros**: Macro definitions and invocations
- **Modules**: Module declarations

### Node Type Mapping
The adapter maps Rust-specific Tree-sitter node types to standard types:

| Rust Node Type | Standard Type |
|----------------|---------------|
| `function_item` | function |
| `struct_item` | class |
| `enum_item` | class |
| `trait_item` | interface |
| `use_declaration` | import |
| `const_item` | variable |
| `type_item` | type |
| `match_expression` | control-flow |
| `macro_definition` | function |

### Special Rust Features Handled
- **Lifetimes**: Detected and included in extra information
- **Generic Parameters**: Identified and tracked
- **Trait Bounds**: Recognized and included in metadata
- **Visibility Modifiers**: `pub`, `pub(crate)`, etc. are extracted
- **Unsafe Code**: Marked with `unsafe` modifier
- **Async/Await**: Identified and marked with `async` modifier
- **Pattern Matching**: Match expressions and arm patterns are handled

## Usage

The adapter is automatically registered and used when processing Rust code files. When the `QueryResultNormalizer` processes Rust code, it will use this adapter to convert Tree-sitter query results into standardized format.

```typescript
import { getLanguageAdapter } from '../normalization';

const rustAdapter = await getLanguageAdapter('rust');
const normalizedResults = await rustAdapter.normalize(queryResults, 'functions', 'rust');
```

## Implementation Details

The adapter implements the `ILanguageAdapter` interface and provides:

1. **Normalization**: Converts Rust-specific query results to standard format
2. **Name Extraction**: Handles Rust-specific naming patterns
3. **Complexity Calculation**: Factors in Rust-specific complexity indicators
4. **Dependency Analysis**: Identifies Rust-specific dependencies (imports, type references)
5. **Modifier Extraction**: Recognizes Rust-specific modifiers and attributes
6. **Extra Information**: Captures Rust-specific features like lifetimes and trait bounds