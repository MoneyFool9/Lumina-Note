//! 工具注册表
//! 
//! 管理工具的注册和执行

use crate::agent::types::*;
use regex::Regex;
use std::collections::HashMap;
use std::path::Path;
use walkdir::WalkDir;

/// 工具注册表
pub struct ToolRegistry {
    workspace_path: String,
}

impl ToolRegistry {
    pub fn new(workspace_path: String) -> Self {
        Self { workspace_path }
    }

    /// 执行工具
    pub async fn execute(&self, tool_call: &ToolCall) -> ToolResult {
        let result = match tool_call.name.as_str() {
            "read_note" => self.read_note(&tool_call.params).await,
            "edit_note" => self.edit_note(&tool_call.params).await,
            "create_note" => self.create_note(&tool_call.params).await,
            "list_notes" => self.list_notes(&tool_call.params).await,
            "search_notes" => self.search_notes(&tool_call.params).await,
            "grep_search" => self.grep_search(&tool_call.params).await,
            "semantic_search" => self.semantic_search(&tool_call.params).await,
            "move_note" => self.move_note(&tool_call.params).await,
            "delete_note" => self.delete_note(&tool_call.params).await,
            "query_database" => self.query_database(&tool_call.params).await,
            "add_database_row" => self.add_database_row(&tool_call.params).await,
            "get_backlinks" => self.get_backlinks(&tool_call.params).await,
            "ask_user" => self.ask_user(&tool_call.params).await,
            "attempt_completion" => self.attempt_completion(&tool_call.params).await,
            _ => Err(format!("Unknown tool: {}", tool_call.name)),
        };

        match result {
            Ok(content) => ToolResult {
                tool_call_id: tool_call.id.clone(),
                success: true,
                content,
                error: None,
            },
            Err(e) => ToolResult {
                tool_call_id: tool_call.id.clone(),
                success: false,
                content: String::new(),
                error: Some(e),
            },
        }
    }

    /// 获取完整路径
    fn get_full_path(&self, relative_path: &str) -> String {
        let base = Path::new(&self.workspace_path);
        let rel = relative_path.trim_start_matches('/').trim_start_matches('\\');
        base.join(rel).to_string_lossy().to_string()
    }

    /// 读取笔记
    async fn read_note(&self, params: &HashMap<String, serde_json::Value>) -> Result<String, String> {
        let path = params.get("path")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'path' parameter")?;

        let full_path = self.get_full_path(path);
        
        let content = tokio::fs::read_to_string(&full_path).await
            .map_err(|e| format!("Failed to read file: {}", e))?;

        // 添加行号
        let numbered = content.lines()
            .enumerate()
            .map(|(i, line)| format!("{:4} | {}", i + 1, line))
            .collect::<Vec<_>>()
            .join("\n");

        Ok(numbered)
    }

    /// 编辑笔记
    async fn edit_note(&self, params: &HashMap<String, serde_json::Value>) -> Result<String, String> {
        let path = params.get("path")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'path' parameter")?;
        let old_string = params.get("old_string")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'old_string' parameter")?;
        let new_string = params.get("new_string")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'new_string' parameter")?;

        let full_path = self.get_full_path(path);
        
        let content = tokio::fs::read_to_string(&full_path).await
            .map_err(|e| format!("Failed to read file: {}", e))?;

        // 检查 old_string 是否存在
        if !content.contains(old_string) {
            return Err(format!(
                "old_string not found in file. Make sure it matches exactly including whitespace."
            ));
        }

        // 替换
        let new_content = content.replacen(old_string, new_string, 1);
        
        tokio::fs::write(&full_path, &new_content).await
            .map_err(|e| format!("Failed to write file: {}", e))?;

        Ok(format!("Successfully edited {}", path))
    }

    /// 创建笔记
    async fn create_note(&self, params: &HashMap<String, serde_json::Value>) -> Result<String, String> {
        let path = params.get("path")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'path' parameter")?;
        let content = params.get("content")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'content' parameter")?;

        let full_path = self.get_full_path(path);
        
        // 检查文件是否已存在
        if Path::new(&full_path).exists() {
            return Err(format!("File already exists: {}", path));
        }

        // 创建父目录
        if let Some(parent) = Path::new(&full_path).parent() {
            tokio::fs::create_dir_all(parent).await
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }

        tokio::fs::write(&full_path, content).await
            .map_err(|e| format!("Failed to write file: {}", e))?;

        Ok(format!("Successfully created {}", path))
    }

    /// 列出笔记
    async fn list_notes(&self, params: &HashMap<String, serde_json::Value>) -> Result<String, String> {
        let path = params.get("path")
            .and_then(|v| v.as_str())
            .unwrap_or(".");
        
        // 是否递归列出
        let recursive = params.get("recursive")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        
        // 最大深度限制
        let max_depth = if recursive {
            params.get("max_depth")
                .and_then(|v| v.as_i64())
                .unwrap_or(3) as usize
        } else {
            1
        };

        let full_path = self.get_full_path(path);
        let base_path = Path::new(&full_path);
        
        let mut entries = Vec::new();
        
        let walker = WalkDir::new(&full_path)
            .max_depth(max_depth)
            .into_iter()
            .filter_map(|e| e.ok());

        for entry in walker {
            let entry_path = entry.path();
            if entry_path == base_path {
                continue;
            }

            let name = entry.file_name().to_string_lossy().to_string();
            
            // 跳过隐藏文件
            if name.starts_with('.') {
                continue;
            }

            let is_dir = entry.file_type().is_dir();
            let prefix = if is_dir { "📁 " } else { "📄 " };
            
            // 递归模式下显示相对路径
            if recursive {
                let rel_path = entry_path.strip_prefix(base_path)
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|_| name.clone());
                let indent = "  ".repeat(entry.depth().saturating_sub(1));
                entries.push(format!("{}{}{}", indent, prefix, rel_path));
            } else {
                entries.push(format!("{}{}", prefix, name));
            }
        }

        if !recursive {
            entries.sort();
        }
        
        if entries.is_empty() {
            Ok("(empty directory)".to_string())
        } else {
            Ok(entries.join("\n"))
        }
    }

    /// 搜索笔记
    async fn search_notes(&self, params: &HashMap<String, serde_json::Value>) -> Result<String, String> {
        let query = params.get("query")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'query' parameter")?;
        let limit = params.get("limit")
            .and_then(|v| v.as_i64())
            .unwrap_or(10) as usize;

        let query_lower = query.to_lowercase();
        let mut results = Vec::new();

        let walker = WalkDir::new(&self.workspace_path)
            .into_iter()
            .filter_map(|e| e.ok());

        for entry in walker {
            if results.len() >= limit {
                break;
            }

            let path = entry.path();
            
            // 只搜索 .md 文件
            if !path.extension().map(|e| e == "md").unwrap_or(false) {
                continue;
            }

            // 跳过隐藏文件
            if path.to_string_lossy().contains("/.") || path.to_string_lossy().contains("\\.") {
                continue;
            }

            if let Ok(content) = std::fs::read_to_string(path) {
                if content.to_lowercase().contains(&query_lower) {
                    let relative = path.strip_prefix(&self.workspace_path)
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_else(|_| path.to_string_lossy().to_string());
                    
                    // 找到匹配的行
                    let mut matches = Vec::new();
                    for (i, line) in content.lines().enumerate() {
                        if line.to_lowercase().contains(&query_lower) {
                            matches.push(format!("  Line {}: {}", i + 1, line.trim()));
                            if matches.len() >= 3 {
                                break;
                            }
                        }
                    }
                    
                    results.push(format!("📄 {}\n{}", relative, matches.join("\n")));
                }
            }
        }

        if results.is_empty() {
            Ok(format!("No notes found containing '{}'", query))
        } else {
            Ok(results.join("\n\n"))
        }
    }

    /// 移动笔记
    async fn move_note(&self, params: &HashMap<String, serde_json::Value>) -> Result<String, String> {
        let from_path = params.get("from_path")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'from_path' parameter")?;
        let to_path = params.get("to_path")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'to_path' parameter")?;

        let full_from = self.get_full_path(from_path);
        let full_to = self.get_full_path(to_path);

        // 创建目标目录
        if let Some(parent) = Path::new(&full_to).parent() {
            tokio::fs::create_dir_all(parent).await
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }

        tokio::fs::rename(&full_from, &full_to).await
            .map_err(|e| format!("Failed to move file: {}", e))?;

        Ok(format!("Successfully moved {} to {}", from_path, to_path))
    }

    /// 删除笔记
    async fn delete_note(&self, params: &HashMap<String, serde_json::Value>) -> Result<String, String> {
        let path = params.get("path")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'path' parameter")?;

        let full_path = self.get_full_path(path);

        // 移动到回收站
        trash::delete(&full_path)
            .map_err(|e| format!("Failed to delete file: {}", e))?;

        Ok(format!("Successfully deleted {} (moved to trash)", path))
    }

    /// 询问用户
    async fn ask_user(&self, params: &HashMap<String, serde_json::Value>) -> Result<String, String> {
        let question = params.get("question")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'question' parameter")?;

        // 这个工具会触发前端显示问题，等待用户回复
        // 实际的回复会通过 continueWithAnswer 传入
        Ok(format!("[WAITING_FOR_USER] {}", question))
    }

    /// 完成任务
    async fn attempt_completion(&self, params: &HashMap<String, serde_json::Value>) -> Result<String, String> {
        let result = params.get("result")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'result' parameter")?;

        Ok(format!("[TASK_COMPLETED] {}", result))
    }

    /// Grep 搜索（正则表达式搜索）
    async fn grep_search(&self, params: &HashMap<String, serde_json::Value>) -> Result<String, String> {
        let pattern = params.get("pattern")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'pattern' parameter")?;
        let search_path = params.get("path")
            .and_then(|v| v.as_str())
            .unwrap_or(".");
        let case_sensitive = params.get("case_sensitive")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let limit = params.get("limit")
            .and_then(|v| v.as_i64())
            .unwrap_or(20) as usize;

        // 构建正则表达式
        let regex = if case_sensitive {
            Regex::new(pattern)
        } else {
            Regex::new(&format!("(?i){}", pattern))
        }.map_err(|e| format!("Invalid regex pattern: {}", e))?;

        let full_path = self.get_full_path(search_path);
        let mut results = Vec::new();

        let walker = WalkDir::new(&full_path)
            .into_iter()
            .filter_map(|e| e.ok());

        for entry in walker {
            if results.len() >= limit {
                break;
            }

            let path = entry.path();
            
            // 只搜索 .md 文件
            if !path.extension().map(|e| e == "md").unwrap_or(false) {
                continue;
            }

            // 跳过隐藏文件
            let path_str = path.to_string_lossy();
            if path_str.contains("/.") || path_str.contains("\\.") {
                continue;
            }

            if let Ok(content) = std::fs::read_to_string(path) {
                let mut file_matches = Vec::new();
                
                for (i, line) in content.lines().enumerate() {
                    if regex.is_match(line) {
                        file_matches.push(format!("  {}:{} {}", i + 1, ":", line.trim()));
                        if file_matches.len() >= 5 {
                            break;
                        }
                    }
                }

                if !file_matches.is_empty() {
                    let relative = path.strip_prefix(&self.workspace_path)
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_else(|_| path.to_string_lossy().to_string());
                    
                    results.push(format!("📄 {}\n{}", relative, file_matches.join("\n")));
                }
            }
        }

        if results.is_empty() {
            Ok(format!("No matches found for pattern '{}'", pattern))
        } else {
            Ok(format!("Found {} files matching '{}':\n\n{}", results.len(), pattern, results.join("\n\n")))
        }
    }

    /// 语义搜索（向量搜索）
    async fn semantic_search(&self, params: &HashMap<String, serde_json::Value>) -> Result<String, String> {
        let query = params.get("query")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'query' parameter")?;
        let limit = params.get("limit")
            .and_then(|v| v.as_i64())
            .unwrap_or(5) as usize;

        // TODO: 调用 vector_db 进行语义搜索
        // 目前先返回提示信息，后续集成 RAG 系统
        Ok(format!(
            "[SEMANTIC_SEARCH] Query: '{}', Limit: {}\n\
            Note: Semantic search requires RAG indexing. Please use search_notes or grep_search for now.",
            query, limit
        ))
    }

    /// 查询数据库
    async fn query_database(&self, params: &HashMap<String, serde_json::Value>) -> Result<String, String> {
        let database_id = params.get("database_id")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'database_id' parameter")?;
        let filter = params.get("filter")
            .and_then(|v| v.as_object());
        let limit = params.get("limit")
            .and_then(|v| v.as_i64())
            .unwrap_or(50) as usize;

        // 读取数据库定义文件
        let db_file = format!("{}.db.json", database_id);
        let db_path = self.get_full_path(&db_file);
        
        let db_content = tokio::fs::read_to_string(&db_path).await
            .map_err(|e| format!("Failed to read database '{}': {}", database_id, e))?;
        
        let db: serde_json::Value = serde_json::from_str(&db_content)
            .map_err(|e| format!("Failed to parse database: {}", e))?;

        // 获取列定义
        let columns = db.get("columns")
            .and_then(|v| v.as_array())
            .ok_or("Invalid database format: missing columns")?;

        let column_names: Vec<String> = columns.iter()
            .filter_map(|c| c.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
            .collect();

        // 扫描笔记库查找属于此数据库的笔记
        let mut rows = Vec::new();
        let walker = WalkDir::new(&self.workspace_path)
            .into_iter()
            .filter_map(|e| e.ok());

        for entry in walker {
            if rows.len() >= limit {
                break;
            }

            let path = entry.path();
            if !path.extension().map(|e| e == "md").unwrap_or(false) {
                continue;
            }

            if let Ok(content) = std::fs::read_to_string(path) {
                // 解析 frontmatter
                if let Some(fm) = Self::parse_frontmatter(&content) {
                    // 检查是否属于此数据库
                    if fm.get("db").and_then(|v| v.as_str()) == Some(database_id) {
                        // 应用过滤器
                        let mut matches = true;
                        if let Some(filter_obj) = filter {
                            for (key, value) in filter_obj {
                                if let Some(fm_value) = fm.get(key) {
                                    if fm_value != value {
                                        matches = false;
                                        break;
                                    }
                                } else {
                                    matches = false;
                                    break;
                                }
                            }
                        }

                        if matches {
                            let title = fm.get("title")
                                .and_then(|v| v.as_str())
                                .unwrap_or("Untitled");
                            
                            let mut row_data = vec![title.to_string()];
                            for col in &column_names {
                                let value = fm.get(col)
                                    .map(|v| match v {
                                        serde_json::Value::String(s) => s.clone(),
                                        _ => v.to_string(),
                                    })
                                    .unwrap_or_else(|| "-".to_string());
                                row_data.push(value);
                            }
                            rows.push(row_data);
                        }
                    }
                }
            }
        }

        // 格式化输出
        if rows.is_empty() {
            Ok(format!("Database '{}' has no matching rows.", database_id))
        } else {
            let header = format!("| Title | {} |", column_names.join(" | "));
            let separator = format!("|{}|", vec!["---"; column_names.len() + 1].join("|"));
            let body: Vec<String> = rows.iter()
                .map(|row| format!("| {} |", row.join(" | ")))
                .collect();
            
            Ok(format!("{}\n{}\n{}", header, separator, body.join("\n")))
        }
    }

    /// 添加数据库行
    async fn add_database_row(&self, params: &HashMap<String, serde_json::Value>) -> Result<String, String> {
        let database_id = params.get("database_id")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'database_id' parameter")?;
        let title = params.get("title")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'title' parameter")?;
        let cells = params.get("cells")
            .and_then(|v| v.as_object());

        // 构建 frontmatter
        let mut frontmatter = format!("---\ndb: {}\ntitle: {}\n", database_id, title);
        
        if let Some(cells_obj) = cells {
            for (key, value) in cells_obj {
                let value_str = match value {
                    serde_json::Value::String(s) => s.clone(),
                    _ => value.to_string(),
                };
                frontmatter.push_str(&format!("{}: {}\n", key, value_str));
            }
        }
        frontmatter.push_str("---\n\n");

        // 创建笔记文件
        let safe_title = title.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
        let note_path = format!("{}.md", safe_title);
        let full_path = self.get_full_path(&note_path);

        if Path::new(&full_path).exists() {
            return Err(format!("Note '{}' already exists", note_path));
        }

        let content = format!("{}# {}\n\n", frontmatter, title);
        tokio::fs::write(&full_path, &content).await
            .map_err(|e| format!("Failed to create note: {}", e))?;

        Ok(format!("Successfully added row '{}' to database '{}'", title, database_id))
    }

    /// 获取反向链接
    async fn get_backlinks(&self, params: &HashMap<String, serde_json::Value>) -> Result<String, String> {
        let path = params.get("path")
            .and_then(|v| v.as_str())
            .ok_or("Missing 'path' parameter")?;

        // 获取笔记名（不含路径和扩展名）
        let note_name = Path::new(path)
            .file_stem()
            .and_then(|s| s.to_str())
            .ok_or("Invalid path")?;

        // 构建匹配模式：[[note_name]] 或 [[note_name|alias]]
        let pattern = format!(r"\[\[{}(\|[^\]]+)?\]\]", regex::escape(note_name));
        let regex = Regex::new(&pattern).map_err(|e| format!("Regex error: {}", e))?;

        let mut backlinks = Vec::new();

        let walker = WalkDir::new(&self.workspace_path)
            .into_iter()
            .filter_map(|e| e.ok());

        for entry in walker {
            let entry_path = entry.path();
            
            // 只搜索 .md 文件，且不是自己
            if !entry_path.extension().map(|e| e == "md").unwrap_or(false) {
                continue;
            }

            let entry_relative = entry_path.strip_prefix(&self.workspace_path)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            // 跳过自己
            if entry_relative == path {
                continue;
            }

            // 跳过隐藏文件
            if entry_relative.contains("/.") || entry_relative.contains("\\.") {
                continue;
            }

            if let Ok(content) = std::fs::read_to_string(entry_path) {
                if regex.is_match(&content) {
                    // 找到包含链接的行
                    let mut context_lines = Vec::new();
                    for (i, line) in content.lines().enumerate() {
                        if regex.is_match(line) {
                            context_lines.push(format!("  Line {}: {}", i + 1, line.trim()));
                            if context_lines.len() >= 2 {
                                break;
                            }
                        }
                    }
                    
                    backlinks.push(format!("📄 {}\n{}", entry_relative, context_lines.join("\n")));
                }
            }
        }

        if backlinks.is_empty() {
            Ok(format!("No backlinks found for '{}'", note_name))
        } else {
            Ok(format!("Found {} notes linking to '{}':\n\n{}", backlinks.len(), note_name, backlinks.join("\n\n")))
        }
    }

    /// 解析 YAML frontmatter
    fn parse_frontmatter(content: &str) -> Option<serde_json::Map<String, serde_json::Value>> {
        let content = content.trim();
        if !content.starts_with("---") {
            return None;
        }

        let rest = &content[3..];
        let end_pos = rest.find("\n---")?;
        let yaml_str = &rest[..end_pos];

        // 简单解析 YAML
        let mut map = serde_json::Map::new();
        for line in yaml_str.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some(colon_pos) = line.find(':') {
                let key = line[..colon_pos].trim().to_string();
                let value = line[colon_pos + 1..].trim().to_string();
                map.insert(key, serde_json::Value::String(value));
            }
        }

        Some(map)
    }
}
