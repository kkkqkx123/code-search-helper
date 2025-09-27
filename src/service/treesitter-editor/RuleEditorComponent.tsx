import * as React from 'react';
import { useState, ChangeEvent } from 'react';
import { CustomRuleDefinition } from '../../models/CustomRuleTypes';
import { DSLParser } from '../treesitter-dsl/DSLParser';
import { RuleValidationService } from '../treesitter-dsl/RuleValidationService';

interface RuleEditorProps {
  onSave: (rule: CustomRuleDefinition) => void;
  onCancel: () => void;
}

const RuleEditorComponent: React.FC<RuleEditorProps> = ({ onSave, onCancel }) => {
  const [ruleName, setRuleName] = useState('');
  const [description, setDescription] = useState('');
  const [targetType, setTargetType] = useState('');
  const [dslText, setDslText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const parser = new DSLParser();
  const validator = new RuleValidationService();

  const handleSave = () => {
    try {
      // 验证DSL语法
      const syntaxValidation = validator.validateSyntax(dslText);
      if (!syntaxValidation.isValid) {
        setErrors(syntaxValidation.errors);
        setWarnings(syntaxValidation.warnings);
        return;
      }

      // 解析DSL
      const ruleDefinition = parser.parse(dslText);

      // 验证规则定义
      const ruleValidation = validator.validateRule(ruleDefinition);
      setErrors(ruleValidation.errors);
      setWarnings(ruleValidation.warnings);

      if (ruleValidation.isValid) {
        onSave(ruleDefinition);
      }
    } catch (error) {
      setErrors([`Error parsing DSL: ${(error as Error).message}`]);
    }
  };

  const handleValidate = () => {
    try {
      // 验证DSL语法
      const syntaxValidation = validator.validateSyntax(dslText);
      setErrors(syntaxValidation.errors);
      setWarnings(syntaxValidation.warnings);

      if (syntaxValidation.isValid) {
        // 解析DSL
        const ruleDefinition = parser.parse(dslText);

        // 验证规则定义
        const ruleValidation = validator.validateRule(ruleDefinition);
        setErrors((prev: string[]) => [...prev, ...ruleValidation.errors]);
        setWarnings((prev: string[]) => [...prev, ...ruleValidation.warnings]);
      }
    } catch (error) {
      setErrors([`Error parsing DSL: ${(error as Error).message}`]);
    }
  };

  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setter(e.currentTarget.value);
    };

  return (
    <div className="rule-editor">
      <h2>Tree-sitter 自定义规则编辑器</h2>

      <div className="form-group">
        <label htmlFor="ruleName">规则名称:</label>
        <input
          type="text"
          id="ruleName"
          value={ruleName}
          onChange={handleInputChange(setRuleName)}
          placeholder="输入规则名称"
        />
      </div>

      <div className="form-group">
        <label htmlFor="description">描述:</label>
        <textarea
          id="description"
          value={description}
          onChange={handleInputChange(setDescription)}
          placeholder="输入规则描述"
          rows={3}
        />
      </div>

      <div className="form-group">
        <label htmlFor="targetType">目标类型:</label>
        <input
          type="text"
          id="targetType"
          value={targetType}
          onChange={handleInputChange(setTargetType)}
          placeholder="输入目标AST节点类型"
        />
      </div>

      <div className="form-group">
        <label htmlFor="dslText">DSL规则定义:</label>
        <textarea
          id="dslText"
          value={dslText}
          onChange={handleInputChange(setDslText)}
          placeholder="在此处编写DSL规则"
          rows={15}
          className="dsl-editor"
        />
      </div>

      <div className="validation-results">
        {errors.length > 0 && (
          <div className="errors">
            <h4>错误:</h4>
            <ul>
              {errors.map((error, index: number) => (
                <li key={index} className="error">{error}</li>
              ))}
            </ul>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="warnings">
            <h4>警告:</h4>
            <ul>
              {warnings.map((warning, index: number) => (
                <li key={index} className="warning">{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="editor-actions">
        <button onClick={handleValidate} className="validate-btn">
          验证规则
        </button>
        <button onClick={handleSave} className="save-btn">
          保存规则
        </button>
        <button onClick={onCancel} className="cancel-btn">
          取消
        </button>
      </div>
    </div>
  );
};

export default RuleEditorComponent;