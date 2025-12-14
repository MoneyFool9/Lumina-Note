/**
 * MessageParser 测试
 */
import { describe, it, expect, vi } from 'vitest';
import { parseResponse, formatToolResult } from './MessageParser';

// Mock locale store
vi.mock('@/stores/useLocaleStore', () => ({
  getCurrentTranslations: () => ({
    prompts: {
      agent: {
        messageParser: {
          contentTruncated: '... 内容已截断 (原长度: {length})',
          noToolUsed: '请使用工具完成任务',
        },
      },
    },
  }),
}));

describe('parseResponse', () => {
  describe('text extraction', () => {
    it('should return original text', () => {
      const content = 'Hello, this is a test message';
      const result = parseResponse(content);
      expect(result.text).toBe(content);
    });
  });

  describe('tool call parsing', () => {
    it('should parse single tool call', () => {
      const content = '<read_note><paths>["test.md"]</paths></read_note>';
      const result = parseResponse(content);
      
      expect(result.toolCalls.length).toBe(1);
      expect(result.toolCalls[0].name).toBe('read_note');
      expect(result.toolCalls[0].params.paths).toEqual(['test.md']);
    });

    it('should parse multiple tool calls', () => {
      const content = `
        <read_note><paths>["note1.md"]</paths></read_note>
        <list_notes><directory>docs</directory></list_notes>
      `;
      const result = parseResponse(content);
      
      expect(result.toolCalls.length).toBe(2);
      expect(result.toolCalls[0].name).toBe('read_note');
      expect(result.toolCalls[1].name).toBe('list_notes');
    });

    it('should parse tool with multiple parameters', () => {
      const content = `
        <edit_note>
          <path>test.md</path>
          <original>old content</original>
          <modified>new content</modified>
        </edit_note>
      `;
      const result = parseResponse(content);
      
      expect(result.toolCalls.length).toBe(1);
      expect(result.toolCalls[0].params.path).toBe('test.md');
      expect(result.toolCalls[0].params.original).toBe('old content');
      expect(result.toolCalls[0].params.modified).toBe('new content');
    });

    it('should parse JSON parameter values', () => {
      const content = '<search_notes><query>test</query><limit>10</limit></search_notes>';
      const result = parseResponse(content);
      
      expect(result.toolCalls[0].params.query).toBe('test');
      expect(result.toolCalls[0].params.limit).toBe(10);
    });

    it('should parse array parameter values', () => {
      const content = '<read_note><paths>["a.md", "b.md", "c.md"]</paths></read_note>';
      const result = parseResponse(content);
      
      expect(result.toolCalls[0].params.paths).toEqual(['a.md', 'b.md', 'c.md']);
    });
  });

  describe('non-tool tag filtering', () => {
    it('should skip thinking tags', () => {
      const content = '<thinking>Let me think about this...</thinking>';
      const result = parseResponse(content);
      expect(result.toolCalls.length).toBe(0);
    });

    it('should skip HTML tags', () => {
      const content = '<p>Some paragraph</p><strong>Bold</strong>';
      const result = parseResponse(content);
      expect(result.toolCalls.length).toBe(0);
    });

    it('should skip description tags', () => {
      const content = '<description>This is a description</description>';
      const result = parseResponse(content);
      expect(result.toolCalls.length).toBe(0);
    });

    it('should skip edit marker tags', () => {
      const content = '<original>old</original><modified>new</modified>';
      const result = parseResponse(content);
      expect(result.toolCalls.length).toBe(0);
    });
  });

  describe('completion detection', () => {
    it('should detect attempt_completion', () => {
      const content = '<attempt_completion><result>Task completed</result></attempt_completion>';
      const result = parseResponse(content);
      
      expect(result.isCompletion).toBe(true);
      expect(result.toolCalls.length).toBe(1);
      expect(result.toolCalls[0].name).toBe('attempt_completion');
    });

    it('should not be completion for regular tools', () => {
      const content = '<read_note><paths>["test.md"]</paths></read_note>';
      const result = parseResponse(content);
      expect(result.isCompletion).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty content', () => {
      const result = parseResponse('');
      expect(result.text).toBe('');
      expect(result.toolCalls).toEqual([]);
      expect(result.isCompletion).toBe(false);
    });

    it('should handle content with no tools', () => {
      const result = parseResponse('Just some text without any tool calls');
      expect(result.toolCalls).toEqual([]);
    });

    it('should handle malformed XML gracefully', () => {
      const content = '<read_note><paths>not closed properly';
      const result = parseResponse(content);
      // Should not crash, may not find the tool
      expect(result.text).toBe(content);
    });

    it('should preserve raw XML in tool call', () => {
      const content = '<read_note><paths>["test.md"]</paths></read_note>';
      const result = parseResponse(content);
      expect(result.toolCalls[0].raw).toBe(content);
    });
  });
});

describe('formatToolResult', () => {
  const mockToolCall = {
    name: 'read_note',
    params: { paths: ['test.md'] },
    raw: '<read_note><paths>["test.md"]</paths></read_note>',
  };

  it('should format successful result', () => {
    const result = formatToolResult(mockToolCall, {
      success: true,
      content: 'File content here',
    });

    expect(result).toContain('<tool_result');
    expect(result).toContain('name="read_note"');
    expect(result).toContain('File content here');
    expect(result).toContain('</tool_result>');
  });

  it('should format error result', () => {
    const result = formatToolResult(mockToolCall, {
      success: false,
      content: '',
      error: 'File not found',
    });

    expect(result).toContain('<tool_error');
    expect(result).toContain('File not found');
    expect(result).toContain('</tool_error>');
  });

  it('should truncate long content', () => {
    const longContent = 'x'.repeat(10000);
    const result = formatToolResult(mockToolCall, {
      success: true,
      content: longContent,
    });

    expect(result.length).toBeLessThan(10000);
    expect(result).toContain('内容已截断');
  });

  it('should include params signature', () => {
    const result = formatToolResult(mockToolCall, {
      success: true,
      content: 'test',
    });

    expect(result).toContain('params="');
  });
});
