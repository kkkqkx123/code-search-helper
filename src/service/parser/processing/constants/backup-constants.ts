/**
 * 文件处理相关常量定义
 */

// 备份文件模式常量
export const BACKUP_FILE_PATTERNS = [
  '.bak',
  '.backup',
 '.old',
  '.tmp',
  '.temp',
  '.orig',
  '.save',
  '.bak$', // Regex pattern for .bak at end
  '.backup$',
  '.old$',
 '.tmp$',
 '.temp$'
];

// 备份文件类型映射
export const BACKUP_FILE_TYPE_MAP = {
 '.bak': 'standard-backup',
  '.backup': 'full-backup',
  '.old': 'old-version',
  '.tmp': 'temporary',
  '.temp': 'temporary',
  '.orig': 'original',
  '.save': 'saved'
} as const;

// 小文件阈值 - 小于这个大小的文件直接作为一个块处理
export const SMALL_FILE_THRESHOLD = {
  CHARS: 300,    // 30字符以下
  LINES: 15      // 15行以下
} as const;

// 配置默认值常量
export const DEFAULT_CONFIG = {
 // 错误处理配置
  MAX_ERRORS: 5,
 ERROR_RESET_INTERVAL: 6000, // 1分钟

  // 内存限制配置
  MEMORY_LIMIT_MB: 500,
  MEMORY_CHECK_INTERVAL: 5000, // 5秒

  // 分段参数配置
 MAX_CHUNK_SIZE: 2000,
  CHUNK_OVERLAP: 200,
  MAX_LINES_PER_CHUNK: 50,

  // 文本分段器配置
  TEXT_SPLITTER_OPTIONS: {
    maxChunkSize: 2000,
    overlapSize: 200,
    maxLinesPerChunk: 50,
    errorThreshold: 5,
    memoryLimitMB: 500,
    enableBracketBalance: true,
    enableSemanticDetection: true
  },

  // 备份文件模式
  BACKUP_FILE_PATTERNS: ['.bak', '.backup', '.old', '.tmp', '.temp', '.orig', '.save']
} as const;

// Shebang模式常量
export const SHEBANG_PATTERNS: [string, string][] = [
  ['#!/bin/bash', 'shell'],
  ['#!/bin/sh', 'shell'],
  ['#!/usr/bin/env bash', 'shell'],
  ['#!/usr/bin/env sh', 'shell'],
  ['#!/usr/bin/env python', 'python'],
  ['#!/usr/bin/env python3', 'python'],
  ['#!/usr/bin/env python2', 'python'],
  ['#!/usr/bin/python', 'python'],
  ['#!/usr/bin/python3', 'python'],
  ['#!/usr/bin/env node', 'javascript'],
  ['#!/usr/bin/env nodejs', 'javascript'],
  ['#!/usr/bin/node', 'javascript'],
  ['#!/usr/bin/env ruby', 'ruby'],
  ['#!/usr/bin/env perl', 'perl'],
  ['#!/usr/bin/env php', 'php'],
  ['#!/usr/bin/env lua', 'lua'],
  ['#!/usr/bin/env awk', 'awk'],
  ['#!/usr/bin/env sed', 'sed'],
  ['#!/usr/bin/env tcl', 'tcl'],
  ['#!/usr/bin/env expect', 'expect'],
  ['#!/usr/bin/env fish', 'fish'],
  ['#!/usr/bin/env zsh', 'shell'],
  ['#!/usr/bin/env ksh', 'shell'],
  ['#!/usr/bin/env csh', 'shell'],
  ['#!/usr/bin/env tcsh', 'shell']
];