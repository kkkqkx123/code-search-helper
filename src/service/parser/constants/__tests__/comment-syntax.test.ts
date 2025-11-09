/**
 * 注释语法工具测试
 */

import { CommentSyntaxUtils } from '../comment-syntax';

describe('Comment Syntax Utils', () => {
  test('should get JavaScript comment syntax', () => {
    const syntax = CommentSyntaxUtils.getDefaultCommentSyntax('javascript');
    expect(syntax.singleLine).toEqual(['//']);
    expect(syntax.multiLineStart).toBe('/*');
    expect(syntax.multiLineEnd).toBe('*/');
    expect(syntax.docStart).toBe('/**');
    expect(syntax.docEnd).toBe('*/');
  });

  test('should get TypeScript comment syntax (same as JavaScript)', () => {
    const syntax = CommentSyntaxUtils.getDefaultCommentSyntax('typescript');
    expect(syntax.singleLine).toEqual(['//']);
    expect(syntax.multiLineStart).toBe('/*');
    expect(syntax.multiLineEnd).toBe('*/');
    expect(syntax.docStart).toBe('/**');
    expect(syntax.docEnd).toBe('*/');
  });

  test('should get Python comment syntax with single quote support', () => {
    const syntax = CommentSyntaxUtils.getDefaultCommentSyntax('python');
    expect(syntax.singleLine).toEqual(['#', "'''", '"""']);
    expect(syntax.multiLineStart).toBe('"""');
    expect(syntax.multiLineEnd).toBe('"""');
    expect(syntax.docStart).toBe('"""');
    expect(syntax.docEnd).toBe('"""');
  });

  test('should get C# comment syntax (specific language override)', () => {
    const syntax = CommentSyntaxUtils.getDefaultCommentSyntax('csharp');
    expect(syntax.singleLine).toEqual(['//']);
    expect(syntax.multiLineStart).toBe('/*');
    expect(syntax.multiLineEnd).toBe('*/');
    expect(syntax.docStart).toBe('///');
    expect(syntax.docEnd).toBe('');
  });

  test('should get default comment syntax for unknown language', () => {
    const syntax = CommentSyntaxUtils.getDefaultCommentSyntax('unknown');
    expect(syntax.singleLine).toEqual(['//']);
    expect(syntax.multiLineStart).toBe('/*');
    expect(syntax.multiLineEnd).toBe('*/');
  });

  test('should handle case insensitive language names', () => {
    const syntax1 = CommentSyntaxUtils.getDefaultCommentSyntax('JavaScript');
    const syntax2 = CommentSyntaxUtils.getDefaultCommentSyntax('JAVASCRIPT');
    expect(syntax1).toEqual(syntax2);
  });
});