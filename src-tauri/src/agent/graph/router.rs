//! 图路由器
//! 
//! 根据状态决定下一个节点

use crate::agent::types::*;

/// 根据当前状态路由到下一个节点
pub fn route(state: &GraphState) -> Option<String> {
    if !state.goto.is_empty() && state.goto != "end" {
        return Some(state.goto.clone());
    }
    None
}

/// 获取所有节点名称
pub fn get_node_names() -> Vec<&'static str> {
    vec![
        "coordinator",
        "planner",
        "executor",
        "editor",
        "researcher",
        "writer",
        "organizer",
        "reporter",
    ]
}
