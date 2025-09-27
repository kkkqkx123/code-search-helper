import * as React from 'react';
import { useState, ChangeEvent } from 'react';
import { CustomRuleDefinition } from '../../models/CustomRuleTypes';
import { DSLCompiler } from '../treesitter-dsl/DSLCompiler';

interface RuleTestingProps {
  rule: CustomRuleDefinition;
}

const RuleTestingComponent: React.FC<RuleTestingProps> = ({ rule }) => {
  const [sourceCode, setSourceCode] = useState('');
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  const handleTestRule = () => {
    setIsTesting(true);
    setTestResults([]);

    try {
      // 编译规则
      const compiler = new DSLCompiler();
      const compiledRule = compiler.compile(rule);

      // 这里应该使用Tree-sitter解析源代码并测试规则
      // 由于我们没有实际的Tree-sitter解析器实例，我们只是模拟测试过程

      // 模拟测试结果
      const results = [
        {
          id: 'test-1',
          passed: true,
          message: '规则匹配成功',
          matchedCode: 'async function fetchData() { ... }',
          lineNumber: 10
        },
        {
          id: 'test-2',
          passed: false,
          message: '规则未匹配：复杂度不够',
          matchedCode: 'function simpleFunc() { return 1; }',
          lineNumber: 25
        }
      ];

      setTestResults(results);
    } catch (error) {
      setTestResults([{
        id: 'error',
        passed: false,
        message: `测试错误: ${(error as Error).message}`,
        matchedCode: '',
        lineNumber: 0
      }]);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="rule-testing">
      <h3>规则测试</h3>

      <div className="test-input">
        <h4>测试代码</h4>
        <textarea
          value={sourceCode}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setSourceCode(e.currentTarget.value)}
          placeholder="在此处输入要测试的代码"
          rows={10}
          className="code-input"
        />
        <button
          onClick={handleTestRule}
          disabled={isTesting}
          className="test-btn"
        >
          {isTesting ? '测试中...' : '测试规则'}
        </button>
      </div>

      <div className="test-results">
        <h4>测试结果</h4>
        {testResults.length > 0 ? (
          <ul className="results-list">
            {testResults.map((result) => (
              <li
                key={result.id}
                className={`result-item ${result.passed ? 'passed' : 'failed'}`}
              >
                <div className="result-header">
                  <span className={`status ${result.passed ? 'success' : 'error'}`}>
                    {result.passed ? '✓' : '✗'}
                  </span>
                  <span className="message">{result.message}</span>
                </div>
                {result.matchedCode && (
                  <div className="matched-code">
                    <pre><code>{result.matchedCode}</code></pre>
                    <span className="line-number">行 {result.lineNumber}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>运行测试以查看结果</p>
        )}
      </div>
    </div>
  );
};

export default RuleTestingComponent;