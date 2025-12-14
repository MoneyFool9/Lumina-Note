/**
 * ToolRegistry 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all tool executors before importing ToolRegistry
vi.mock('./executors/ReadNoteTool', () => ({
  ReadNoteTool: { name: 'read_note', requiresApproval: false, execute: vi.fn() },
}));
vi.mock('./executors/EditNoteTool', () => ({
  EditNoteTool: { name: 'edit_note', requiresApproval: true, execute: vi.fn() },
}));
vi.mock('./executors/CreateNoteTool', () => ({
  CreateNoteTool: { name: 'create_note', requiresApproval: true, execute: vi.fn() },
}));
vi.mock('./executors/ListNotesTool', () => ({
  ListNotesTool: { name: 'list_notes', requiresApproval: false, execute: vi.fn() },
}));
vi.mock('./executors/CreateFolderTool', () => ({
  CreateFolderTool: { name: 'create_folder', requiresApproval: true, execute: vi.fn() },
}));
vi.mock('./executors/MoveFileTool', () => ({
  MoveFileTool: { name: 'move_file', requiresApproval: true, execute: vi.fn() },
}));
vi.mock('./executors/RenameFileTool', () => ({
  RenameFileTool: { name: 'rename_file', requiresApproval: true, execute: vi.fn() },
}));
vi.mock('./executors/SearchNotesTool', () => ({
  SearchNotesTool: { name: 'search_notes', requiresApproval: false, execute: vi.fn() },
}));
vi.mock('./executors/DeleteNoteTool', () => ({
  DeleteNoteTool: { name: 'delete_note', requiresApproval: true, execute: vi.fn() },
}));
vi.mock('./executors/GrepSearchTool', () => ({
  GrepSearchTool: { name: 'grep_search', requiresApproval: false, execute: vi.fn() },
}));
vi.mock('./executors/SemanticSearchTool', () => ({
  SemanticSearchTool: { name: 'semantic_search', requiresApproval: false, execute: vi.fn() },
}));
vi.mock('./executors/QueryDatabaseTool', () => ({
  QueryDatabaseTool: { name: 'query_database', requiresApproval: false, execute: vi.fn() },
}));
vi.mock('./executors/AddDatabaseRowTool', () => ({
  AddDatabaseRowTool: { name: 'add_database_row', requiresApproval: true, execute: vi.fn() },
}));
vi.mock('./executors/GetBacklinksTool', () => ({
  GetBacklinksTool: { name: 'get_backlinks', requiresApproval: false, execute: vi.fn() },
}));
vi.mock('./executors/GenerateFlashcardsTool', () => ({
  GenerateFlashcardsTool: { name: 'generate_flashcards', requiresApproval: false, execute: vi.fn() },
  CreateFlashcardTool: { name: 'create_flashcard', requiresApproval: true, execute: vi.fn() },
}));
vi.mock('./executors/ReadCachedOutputTool', () => ({
  ReadCachedOutputTool: { name: 'read_cached_output', requiresApproval: false, execute: vi.fn() },
}));
vi.mock('./executors/DeepSearchTool', () => ({
  DeepSearchTool: { name: 'deep_search', requiresApproval: false, execute: vi.fn() },
}));

import { ToolRegistry } from './ToolRegistry';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('constructor', () => {
    it('should register default tools', () => {
      const toolNames = registry.getToolNames();
      expect(toolNames.length).toBeGreaterThan(0);
    });
  });

  describe('has', () => {
    it('should return true for registered tools', () => {
      expect(registry.has('read_note')).toBe(true);
      expect(registry.has('edit_note')).toBe(true);
      expect(registry.has('list_notes')).toBe(true);
    });

    it('should return false for unregistered tools', () => {
      expect(registry.has('nonexistent_tool')).toBe(false);
    });
  });

  describe('get', () => {
    it('should return tool executor for registered tools', () => {
      const tool = registry.get('read_note');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('read_note');
    });

    it('should return undefined for unregistered tools', () => {
      const tool = registry.get('nonexistent_tool');
      expect(tool).toBeUndefined();
    });
  });

  describe('requiresApproval', () => {
    it('should return false for read-only tools', () => {
      expect(registry.requiresApproval('read_note')).toBe(false);
      expect(registry.requiresApproval('list_notes')).toBe(false);
      expect(registry.requiresApproval('search_notes')).toBe(false);
    });

    it('should return true for write tools', () => {
      expect(registry.requiresApproval('edit_note')).toBe(true);
      expect(registry.requiresApproval('create_note')).toBe(true);
      expect(registry.requiresApproval('delete_note')).toBe(true);
    });

    it('should default to true for unknown tools', () => {
      expect(registry.requiresApproval('unknown_tool')).toBe(true);
    });
  });

  describe('execute', () => {
    const mockContext = {
      workspacePath: '/test/workspace',
      activeNotePath: '/test/note.md',
    };

    it('should return error for unknown tool', async () => {
      const result = await registry.execute('unknown_tool', {}, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('未知工具');
      expect(result.error).toContain('unknown_tool');
    });

    it('should list available tools in error message', async () => {
      const result = await registry.execute('unknown_tool', {}, mockContext);
      
      expect(result.error).toContain('read_note');
      expect(result.error).toContain('edit_note');
      expect(result.error).toContain('create_note');
    });
  });

  describe('getToolNames', () => {
    it('should return array of tool names', () => {
      const names = registry.getToolNames();
      
      expect(Array.isArray(names)).toBe(true);
      expect(names).toContain('read_note');
      expect(names).toContain('edit_note');
      expect(names).toContain('search_notes');
    });
  });

  describe('register', () => {
    it('should allow registering custom tools', () => {
      const customTool = {
        name: 'custom_tool',
        requiresApproval: false,
        execute: vi.fn(),
      };
      
      registry.register(customTool);
      
      expect(registry.has('custom_tool')).toBe(true);
      expect(registry.get('custom_tool')).toBe(customTool);
    });

    it('should override existing tools', () => {
      const originalTool = registry.get('read_note');
      
      const newTool = {
        name: 'read_note',
        requiresApproval: true,
        execute: vi.fn(),
      };
      
      registry.register(newTool);
      
      expect(registry.get('read_note')).toBe(newTool);
      expect(registry.get('read_note')).not.toBe(originalTool);
    });
  });
});
