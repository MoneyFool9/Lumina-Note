/**
 * FlashcardView - 闪卡主视图
 * 
 * 整合牌组列表和复习界面
 */

import React, { useState, useEffect, useCallback } from 'react';
import { DeckList } from './DeckList';
import { FlashcardReview } from './FlashcardReview';
import { useFlashcardStore } from '../../stores/useFlashcardStore';
import { useFileStore } from '../../stores/useFileStore';
import { Loader2 } from 'lucide-react';

interface FlashcardViewProps {
  deckId?: string;
}

export const FlashcardView: React.FC<FlashcardViewProps> = ({ deckId }) => {
  const [reviewingDeckId, setReviewingDeckId] = useState<string | null>(deckId || null);
  const [showCreateCard, setShowCreateCard] = useState(false);
  const [createDeckId, setCreateDeckId] = useState<string>('Default');
  const { currentSession, endReview, loadCards, isLoading } = useFlashcardStore();
  const { fileTree } = useFileStore();

  // 加载闪卡
  const refreshCards = useCallback(() => {
    loadCards();
  }, [loadCards]);

  // 初始加载
  useEffect(() => {
    refreshCards();
  }, [refreshCards]);

  // 监听文件树变化（文件创建/删除时会更新 fileTree）
  useEffect(() => {
    // 当文件树变化时，重新加载闪卡
    // 这样可以捕获到文件的创建和删除
    refreshCards();
  }, [fileTree, refreshCards]);

  // 开始复习
  const handleStartReview = (id: string) => {
    setReviewingDeckId(id);
  };

  // 创建卡片
  const handleCreateCard = (id: string) => {
    setCreateDeckId(id);
    setShowCreateCard(true);
  };

  // 关闭复习
  const handleCloseReview = () => {
    setReviewingDeckId(null);
    endReview();
  };

  // 如果正在复习，显示复习界面
  if (reviewingDeckId || currentSession) {
    return (
      <FlashcardReview 
        deckId={reviewingDeckId || undefined} 
        onClose={handleCloseReview} 
      />
    );
  }

  // 加载中
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 显示牌组列表
  return (
    <div className="flex-1 overflow-auto">
      <DeckList 
        onStartReview={handleStartReview}
        onCreateCard={handleCreateCard}
      />
      
      {/* 创建卡片对话框 - 简化版，后续可扩展 */}
      {showCreateCard && (
        <CreateCardDialog
          deckId={createDeckId}
          onClose={() => setShowCreateCard(false)}
        />
      )}
    </div>
  );
};

// ==================== 创建卡片对话框 ====================

interface CreateCardDialogProps {
  deckId: string;
  onClose: () => void;
}

const CreateCardDialog: React.FC<CreateCardDialogProps> = ({ deckId, onClose }) => {
  const { addCard } = useFlashcardStore();
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!front.trim() || !back.trim()) return;
    
    setIsSubmitting(true);
    try {
      await addCard({
        type: 'basic',
        front: front.trim(),
        back: back.trim(),
        deck: deckId,
        tags: [],
      });
      onClose();
    } catch (error) {
      console.error('创建卡片失败:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border rounded-xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-semibold mb-4">创建新卡片</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">正面（问题）</label>
            <textarea
              value={front}
              onChange={(e) => setFront(e.target.value)}
              className="w-full p-3 border rounded-lg bg-background resize-none"
              rows={3}
              placeholder="输入问题..."
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">背面（答案）</label>
            <textarea
              value={back}
              onChange={(e) => setBack(e.target.value)}
              className="w-full p-3 border rounded-lg bg-background resize-none"
              rows={3}
              placeholder="输入答案..."
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-muted-foreground hover:text-foreground"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!front.trim() || !back.trim() || isSubmitting}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
          >
            {isSubmitting ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FlashcardView;
