import { ParseResult } from '../parser/core/parse/ParserService';

export interface LSPSymbol {
  name: string;
  kind: SymbolKind;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  detail?: string;
  documentation?: string;
  containerName?: string;
}

export interface LSPDiagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity: DiagnosticSeverity;
  message: string;
  source?: string;
  code?: string | number;
}

export interface LSPTypeDefinition {
  name: string;
  type: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  filePath: string;
}

export interface LSPReference {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export interface LSPEnhancedParseResult extends ParseResult {
  lspSymbols?: LSPSymbol[];
  lspDiagnostics?: LSPDiagnostic[];
  typeDefinitions?: LSPTypeDefinition[];
  references?: LSPReference[];
  lspMetadata?: {
    languageServer?: string;
    processingTime?: number;
    hasErrors?: boolean;
    symbolCount?: number;
    diagnosticCount?: number;
  };
}

export interface LSPParseOptions {
  enableLSP?: boolean;
  lspTimeout?: number;
  includeTypes?: boolean;
  includeReferences?: boolean;
  includeDiagnostics?: boolean;
  cacheLSP?: boolean;
}

export enum SymbolKind {
  File = 1,
  Module = 2,
  Namespace = 3,
  Package = 4,
  Class = 5,
  Method = 6,
  Property = 7,
  Field = 8,
  Constructor = 9,
  Enum = 10,
  Interface = 11,
  Function = 12,
  Variable = 13,
  Constant = 14,
  String = 15,
  Number = 16,
  Boolean = 17,
  Array = 18,
  Object = 19,
  Key = 20,
  Null = 21,
  EnumMember = 22,
  Struct = 23,
  Event = 24,
  Operator = 25,
  TypeParameter = 26,
}

export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}
