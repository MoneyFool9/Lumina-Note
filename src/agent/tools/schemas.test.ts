/**
 * 工具 Schema 测试
 */
import { describe, it, expect, vi } from 'vitest';
import { getToolSchemas, getAllToolSchemas } from './schemas';

// Mock locale store
vi.mock('@/stores/useLocaleStore', () => ({
  getCurrentTranslations: () => ({
    prompts: {
      fcSchemas: {
        read_note: {
          desc: 'Read a note',
          params: { path: 'Note path' },
        },
        edit_note: {
          desc: 'Edit a note',
          params: { path: 'Note path', edits: 'Edit operations', new_name: 'New name' },
        },
        create_note: {
          desc: 'Create a note',
          params: { path: 'Note path', content: 'Content' },
        },
        list_notes: {
          desc: 'List notes',
          params: { directory: 'Directory', recursive: 'Recursive' },
        },
        search_notes: {
          desc: 'Search notes',
          params: { query: 'Query', directory: 'Directory', limit: 'Limit' },
        },
      },
    },
  }),
}));

describe('Tool Schemas', () => {
  describe('getAllToolSchemas', () => {
    it('should return all tool schemas', () => {
      const schemas = getAllToolSchemas();
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('should have correct schema structure', () => {
      const schemas = getAllToolSchemas();
      schemas.forEach(schema => {
        expect(schema.type).toBe('function');
        expect(schema.function).toBeDefined();
        expect(schema.function.name).toBeTruthy();
        expect(schema.function.description).toBeTruthy();
        expect(schema.function.parameters).toBeDefined();
        expect(schema.function.parameters.type).toBe('object');
      });
    });

    it('should include common tools', () => {
      const schemas = getAllToolSchemas();
      const toolNames = schemas.map(s => s.function.name);
      
      expect(toolNames).toContain('read_note');
      expect(toolNames).toContain('edit_note');
      expect(toolNames).toContain('create_note');
      expect(toolNames).toContain('list_notes');
      expect(toolNames).toContain('search_notes');
    });
  });

  describe('getToolSchemas', () => {
    it('should filter tools by name', () => {
      const schemas = getToolSchemas(['read_note', 'list_notes']);
      
      expect(schemas.length).toBe(2);
      expect(schemas[0].function.name).toBe('read_note');
      expect(schemas[1].function.name).toBe('list_notes');
    });

    it('should return empty array for no matches', () => {
      const schemas = getToolSchemas(['nonexistent_tool']);
      expect(schemas.length).toBe(0);
    });

    it('should return empty array for empty input', () => {
      const schemas = getToolSchemas([]);
      expect(schemas.length).toBe(0);
    });

    it('should preserve required parameters', () => {
      const schemas = getToolSchemas(['read_note']);
      
      expect(schemas[0].function.parameters.required).toContain('path');
    });
  });

  describe('schema details', () => {
    it('read_note should have path parameter', () => {
      const schemas = getToolSchemas(['read_note']);
      const readNote = schemas[0];
      
      expect(readNote.function.parameters.properties.path).toBeDefined();
      expect(readNote.function.parameters.properties.path.type).toBe('string');
    });

    it('edit_note should have required path and edits', () => {
      const schemas = getToolSchemas(['edit_note']);
      const editNote = schemas[0];
      
      expect(editNote.function.parameters.required).toContain('path');
      expect(editNote.function.parameters.required).toContain('edits');
    });

    it('list_notes should have optional recursive', () => {
      const schemas = getToolSchemas(['list_notes']);
      const listNotes = schemas[0];
      
      expect(listNotes.function.parameters.properties.recursive).toBeDefined();
      expect(listNotes.function.parameters.properties.recursive.type).toBe('boolean');
    });

    it('search_notes should have required query', () => {
      const schemas = getToolSchemas(['search_notes']);
      const searchNotes = schemas[0];
      
      expect(searchNotes.function.parameters.required).toContain('query');
    });
  });

  describe('localization', () => {
    it('should use localized descriptions', () => {
      const schemas = getToolSchemas(['read_note']);
      
      expect(schemas[0].function.description).toBe('Read a note');
      expect(schemas[0].function.parameters.properties.path.description).toBe('Note path');
    });
  });
});
