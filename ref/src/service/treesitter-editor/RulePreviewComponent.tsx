import * as React from 'react';
import { CustomRuleDefinition } from '../../models/CustomRuleTypes';

interface RulePreviewProps {
  rule: CustomRuleDefinition;
}

const RulePreviewComponent: React.FC<RulePreviewProps> = ({ rule }) => {
  return (
    <div className="rule-preview">
      <h3>规则预览</h3>

      <div className="rule-details">
        <h4>基本信息</h4>
        <p><strong>名称:</strong> {rule.name}</p>
        <p><strong>描述:</strong> {rule.description}</p>
        <p><strong>目标类型:</strong> {rule.targetType}</p>
      </div>

      <div className="rule-conditions">
        <h4>条件</h4>
        {rule.conditions.length > 0 ? (
          <ul>
            {rule.conditions.map((condition, index: number) => (
              <li key={index}>
                <strong>{condition.type}:</strong> {condition.value} ({condition.operator})
              </li>
            ))}
          </ul>
        ) : (
          <p>无条件</p>
        )}
      </div>

      <div className="rule-actions">
        <h4>动作</h4>
        {rule.actions.length > 0 ? (
          <ul>
            {rule.actions.map((action, index: number) => (
              <li key={index}>
                <strong>类型:</strong> {action.type}
                {Object.keys(action.parameters).length > 0 && (
                  <div className="action-parameters">
                    <strong>参数:</strong>
                    <ul>
                      {Object.entries(action.parameters).map(([key, value]) => (
                        <li key={key}>{key}: {String(value)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>无动作</p>
        )}
      </div>

      <div className="rule-dsl">
        <h4>DSL表示</h4>
        <pre className="dsl-preview">
{`rule "${rule.name}" {
  description: "${rule.description}"
  target: "${rule.targetType}"

  condition {
${rule.conditions.map((condition) => `    ${condition.type}: ${condition.operator === 'equals' ? `"${condition.value}"` : `${condition.operator}(${condition.value})`}`).join('\n')}
  }

  action {
${rule.actions.map((action) => `    type: ${action.type}${Object.keys(action.parameters).length > 0 ? `\n    parameters: {\n${Object.entries(action.parameters).map(([key, value]) => `      ${key}: ${typeof value === 'string' ? `"${value}"` : value}`).join('\n')}\n    }` : ''}`).join('\n  }\n\n  action {\n')}
  }
}`}
        </pre>
      </div>
    </div>
  );
};

export default RulePreviewComponent;