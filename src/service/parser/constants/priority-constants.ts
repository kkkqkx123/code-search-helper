/**
 * 默认策略优先级配置
 */
export const DEFAULT_PRIORITIES: Record<string, number> = {
  'markdown_specialized': 0,
  'xml_specialized': 0,
  'structure_aware': 1,
  'syntax_aware': 2,
  'hierarchical': 3,
  'module': 4,
  'treesitter_ast': 5,
  'function': 6,
  'class': 7,
  'intelligent': 8,
  'universal_bracket': 9,
  'semantic': 10,
  'universal_line': 11,
  'minimal_fallback': 12
};

/**
 * 不同语言的特定优先级配置
 */
export const LANGUAGE_SPECIFIC_PRIORITIES: Record<string, Record<string, number>> = {
  "typescript": {
    "structure_aware": 1,
    "syntax_aware": 2,
    "treesitter_ast": 3,
    "hierarchical": 4,
    "module": 5,
    "function": 6,
    "class": 7,
    "intelligent": 8,
    "universal_bracket": 9,
    "semantic": 10,
    "universal_line": 11
  },
  "javascript": {
    "structure_aware": 1,
    "syntax_aware": 2,
    "treesitter_ast": 3,
    "hierarchical": 4,
    "module": 5,
    "function": 6,
    "class": 7,
    "intelligent": 8,
    "universal_bracket": 9,
    "semantic": 10,
    "universal_line": 11
  },
  "python": {
    "syntax_aware": 1,
    "treesitter_ast": 2,
    "hierarchical": 3,
    "function": 4,
    "class": 5,
    "intelligent": 6,
    "universal_bracket": 7,
    "semantic": 8,
    "universal_line": 9
  },
  "java": {
    "hierarchical": 1,
    "class": 2,
    "treesitter_ast": 3,
    "function": 4,
    "syntax_aware": 5,
    "intelligent": 6,
    "universal_bracket": 7,
    "semantic": 8,
    "universal_line": 9
  },
  "cpp": {
    "hierarchical": 1,
    "class": 2,
    "treesitter_ast": 3,
    "function": 4,
    "syntax_aware": 5,
    "intelligent": 6,
    "universal_bracket": 7,
    "semantic": 8,
    "universal_line": 9
  },
  "c": {
    "function": 1,
    "treesitter_ast": 2,
    "syntax_aware": 3,
    "universal_bracket": 4,
    "intelligent": 5,
    "semantic": 6,
    "universal_line": 7
  },
  "go": {
    "function": 1,
    "treesitter_ast": 2,
    "syntax_aware": 3,
    "universal_bracket": 4,
    "intelligent": 5,
    "semantic": 6,
    "universal_line": 7
  },
  "rust": {
    "function": 1,
    "treesitter_ast": 2,
    "syntax_aware": 3,
    "universal_bracket": 4,
    "intelligent": 5,
    "semantic": 6,
    "universal_line": 7
  },
  "kotlin": {
    "class": 1,
    "function": 2,
    "treesitter_ast": 3,
    "syntax_aware": 4,
    "hierarchical": 5,
    "intelligent": 6,
    "universal_bracket": 7,
    "semantic": 8,
    "universal_line": 9
  },
  "css": {
    "universal_bracket": 1,
    "universal_line": 2,
    "semantic": 3
  },
  "html": {
    "xml_specialized": 0,
    "universal_bracket": 1,
    "universal_line": 2
  },
  "vue": {
    "xml_specialized": 1,
    "treesitter_ast": 2,
    "syntax_aware": 3,
    "universal_bracket": 4,
    "universal_line": 5
  },
  "markdown": {
    "markdown_specialized": 0,
    "universal_line": 1
  },
  "json": {
    "treesitter_ast": 1,
    "universal_line": 2
  },
  "yaml": {
    "treesitter_ast": 1,
    "universal_line": 2
  },
  "toml": {
    "treesitter_ast": 1,
    "universal_line": 2
  }
};

/**
 * 特定文件类型的优先级配置
 */
export const FILE_TYPE_PRIORITIES: Record<string, Record<string, number>> = {
  ".test.js": {
    "function": 1,
    "universal_line": 2
  },
  ".spec.ts": {
    "function": 1,
    "universal_line": 2
  },
  ".json": {
    "treesitter_ast": 1,
    "universal_line": 2
  }
};

/**
 * 策略降级路径配置
 */
export const FALLBACK_PATHS: Record<string, string[]> = {
  "structure_aware": [
    "syntax_aware", "hierarchical", "module", "treesitter_ast", 
    "function", "class", "intelligent", "universal_bracket", 
    "semantic", "universal_line"
  ],
  "syntax_aware": [
    "hierarchical", "module", "treesitter_ast", "function", 
    "class", "intelligent", "universal_bracket", "semantic", 
    "universal_line"
  ],
  "hierarchical": [
    "module", "treesitter_ast", "function", "class", 
    "intelligent", "universal_bracket", "semantic", "universal_line"
  ],
  "module": [
    "treesitter_ast", "function", "class", "intelligent", 
    "universal_bracket", "semantic", "universal_line"
  ],
  "treesitter_ast": [
    "universal_bracket", "universal_line", "minimal_fallback"
  ],
  "function": [
    "class", "intelligent", "universal_bracket", "semantic", 
    "universal_line"
  ],
  "class": [
    "intelligent", "universal_bracket", "semantic", "universal_line"
  ],
  "intelligent": [
    "universal_bracket", "semantic", "universal_line"
  ],
  "universal_bracket": [
    "semantic", "universal_line"
  ],
  "semantic": [
    "universal_line"
  ],
  "universal_line": [
    "minimal_fallback"
  ],
  "minimal_fallback": []
};

/**
 * 自适应权重配置
 */
export const ADAPTIVE_WEIGHTS = {
  performanceWeight: 0.6,
  successRateWeight: 0.4,
  complexityWeight: 0.2
};