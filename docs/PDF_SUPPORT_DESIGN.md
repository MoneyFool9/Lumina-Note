# PDF 智能阅读器设计文档

> 目标：实现类似豆包浏览器的 PDF 阅读体验，支持元素级交互和 AI 对话
> 
> 更新时间：2025-12-01

## 一、核心功能

### 1.1 元素级交互（核心亮点）

像前端 DevTools 一样，用户可以：
- **悬停高亮** - 鼠标移到图表/表格/公式上自动高亮
- **点击选择** - 点击元素添加到右侧引用栏
- **AI 对话** - 基于选中元素与 AI 讨论

```
┌────────────────────────┬──────────────────┐
│      PDF 查看器         │     AI 侧栏      │
│                        │                  │
│   ┌──────────────┐     │   📎 引用列表    │
│   │   📊 图表    │←悬停 │   ┌──────────┐  │
│   │   (高亮边框)  │  高亮│   │ 📊 图1   │  │
│   └──────────────┘     │   │ 📋 表2   │  │
│                        │   │ 📐 公式3  │  │
│   ┌──────────────┐     │   └──────────┘  │
│   │   📋 表格    │     │                  │
│   └──────────────┘     │   💬 对话区域    │
│                        │   ┌──────────┐  │
│   E = mc²  ← 公式      │   │ 分析图1  │  │
│                        │   │ 中的趋势 │  │
│                        │   └──────────┘  │
└────────────────────────┴──────────────────┘
```

### 1.2 基础 PDF 功能

- 打开/渲染 PDF
- 翻页导航
- 缩放控制
- 文本搜索
- 目录/大纲
- 缩略图侧边栏

### 1.3 使用场景区分

| 场景 | PDF 类型 | 需要智能解析？ |
|------|---------|---------------|
| 阅读文献 | 学术论文（< 50页） | ✅ 需要（图表、公式多） |
| 阅读书籍 | 电子书（300+ 页） | ❌ 不需要（纯文字为主） |
| 查看文档 | 技术文档、手册 | 🔶 可选 |

**策略**：按需解析，用户主动触发智能模式，而非自动解析所有 PDF。

---

## 二、技术方案对比

### 2.1 方案对比总览

| 特性 | DeepSeek-OCR | PP-Structure | MinerU |
|------|-------------|--------------|--------|
| **推荐度** | ⭐⭐⭐ 首选 | ⭐⭐ 轻量备选 | ⭐ 功能全但重 |
| 模型架构 | 单模型端到端 | 多模型组合 | 多模型组合 |
| 参数量 | **3B** | - | - |
| 模型大小 | ~6GB (FP16) | ~500MB | ~1-2GB |
| bbox 坐标 | ✅ (grounding) | ✅ | ✅ |
| 表格识别 | ✅ | ✅ | ✅ |
| 公式识别 | ✅ LaTeX | ✅ | ✅ |
| 图片定位 | ✅ | ✅ | ✅ |
| 理解能力 | **强**（VLM） | 中 | 中 |
| 显存要求 | 8GB+ | 2-4GB | 4-8GB |
| CPU 可用 | 可行但慢 | ✅ | 可行 |
| 部署难度 | 简单 | 简单 | 中等 |

### 2.2 首选方案：DeepSeek-OCR

[DeepSeek-OCR](https://github.com/deepseek-ai/DeepSeek-OCR) 是深度求索推出的视觉语言模型，专注于 OCR 与"上下文光学压缩"。

#### 核心优势

1. **单模型端到端** - 不需要多个模型配合
2. **支持 Grounding** - 输出元素的 bbox 坐标
3. **3B 参数** - 大小适中，消费级显卡可跑
4. **理解能力强** - VLM 架构，不只是 OCR
5. **官方支持 vLLM** - 高效推理

#### Prompt 模式

```python
# 文档转 Markdown + bbox 定位 ✅ 推荐
"<image>\n<|grounding|>Convert the document to markdown."

# 图片 OCR + 定位
"<image>\n<|grounding|>OCR this image."

# 纯 OCR（无布局信息）
"<image>\nFree OCR."

# 解析图表
"<image>\nParse the figure."

# 定位特定文本（高级功能）
"<image>\nLocate <|ref|>先天下之忧而忧<|/ref|> in the image."
```

#### 分辨率支持

| 模式 | 分辨率 | Vision Tokens | 适用场景 |
|------|--------|---------------|---------|
| Tiny | 512×512 | 64 | 快速预览 |
| Small | 640×640 | 100 | 一般文档 |
| Base | 1024×1024 | 256 | 高清文档 |
| Large | 1280×1280 | 400 | 复杂图表 |
| Dynamic | n×640 + 1024 | 动态 | 长文档 |

#### 硬件要求

```
推荐配置：
├── GPU: RTX 4070+ (12GB+)
├── RAM: 16GB+
└── 速度: A100-40G 约 2500 tokens/s

最低配置（量化后）：
├── GPU: RTX 3060 (8GB) - INT8 量化
├── 或 CPU: 32GB RAM - 很慢但可用
└── 量化版: INT4 约 1.5GB
```

#### 部署方式

```python
# 方式 1: vLLM（高性能，推荐）
from vllm import LLM, SamplingParams
from vllm.model_executor.models.deepseek_ocr import NGramPerReqLogitsProcessor

llm = LLM(
    model="deepseek-ai/DeepSeek-OCR",
    enable_prefix_caching=False,
)

prompt = "<image>\n<|grounding|>Convert the document to markdown."
# ... 推理代码

# 方式 2: Transformers（简单）
from transformers import AutoModel, AutoTokenizer
import torch

model = AutoModel.from_pretrained(
    "deepseek-ai/DeepSeek-OCR",
    trust_remote_code=True
).eval().cuda().to(torch.bfloat16)

prompt = "<image>\n<|grounding|>Convert the document to markdown."
res = model.infer(tokenizer, prompt=prompt, image_file=image_path)
```

### 2.3 轻量备选：PP-Structure

[PP-Structure](https://github.com/PaddlePaddle/PaddleOCR/tree/main/ppstructure) 是 PaddleOCR 的文档分析模块。

#### 适用场景

- 用户设备没有独立显卡
- 需要快速轻量的解析
- 不需要深度语义理解

#### 输出格式

```json
{
  "layout": [
    {
      "type": "table",
      "bbox": [34, 303, 553, 520],
      "html": "<table>...</table>"
    },
    {
      "type": "figure", 
      "bbox": [34, 55, 552, 288]
    },
    {
      "type": "text",
      "bbox": [34, 525, 552, 580],
      "text": "图1显示了..."
    }
  ]
}
```

### 2.4 其他参考项目

| 项目 | 特点 | 是否考虑 |
|------|------|---------|
| MinerU | 功能全，多模型组合 | 作为参考 |
| GOT-OCR | 端到端 OCR | 待评估 |
| Nougat | Meta 出品，学术 PDF 转 LaTeX | 特定场景 |

### 2.5 推荐策略

```
┌─────────────────────────────────────────────────────────────┐
│                    多后端智能选择                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   用户打开 PDF                                              │
│        ↓                                                    │
│   询问："启用智能阅读模式？"                                 │
│        ↓                                                    │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  选择解析后端：                                      │  │
│   │                                                     │  │
│   │  🚀 DeepSeek-OCR（推荐）                            │  │
│   │     - 需要 GPU 8GB+                                 │  │
│   │     - 首次需下载模型 (~6GB)                         │  │
│   │                                                     │  │
│   │  ⚡ PP-Structure（轻量）                            │  │
│   │     - CPU 可运行                                    │  │
│   │     - 模型较小 (~500MB)                             │  │
│   │                                                     │  │
│   │  ☁️ 云端 API                                        │  │
│   │     - 无需本地模型                                   │  │
│   │     - 需要联网                                       │  │
│   │                                                     │  │
│   │  📦 跳过（仅基础阅读）                              │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、前端组件设计

### 3.1 组件结构

```
src/components/pdf/
├── PDFViewer.tsx          # 主组件
├── PDFCanvas.tsx          # PDF 渲染层 (react-pdf)
├── InteractiveLayer.tsx   # 交互覆盖层
├── ElementOverlay.tsx     # 单个元素覆盖
├── PDFToolbar.tsx         # 工具栏（翻页、缩放等）
├── PDFOutline.tsx         # 目录大纲
├── PDFThumbnails.tsx      # 缩略图侧边栏
├── ReferenceSidebar.tsx   # 引用 + AI 对话侧边栏
└── hooks/
    ├── usePDFDocument.ts  # PDF 文档状态
    ├── usePDFStructure.ts # 结构化数据
    └── useElementSelection.ts # 元素选择
```

### 3.2 核心组件

#### PDFViewer.tsx

```tsx
interface PDFViewerProps {
  filePath: string;
  onElementSelect?: (element: PDFElement) => void;
}

function PDFViewer({ filePath, onElementSelect }: PDFViewerProps) {
  const { document, loading } = usePDFDocument(filePath);
  const { structure, parsing } = usePDFStructure(filePath);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [selectedElements, setSelectedElements] = useState<PDFElement[]>([]);

  return (
    <div className="pdf-viewer">
      <PDFToolbar 
        currentPage={currentPage}
        totalPages={document?.numPages}
        scale={scale}
        onPageChange={setCurrentPage}
        onScaleChange={setScale}
      />
      
      <div className="pdf-content">
        <PDFThumbnails 
          document={document}
          currentPage={currentPage}
          onPageClick={setCurrentPage}
        />
        
        <div className="pdf-main">
          <PDFCanvas 
            document={document}
            page={currentPage}
            scale={scale}
          />
          
          {structure && (
            <InteractiveLayer
              pageStructure={structure.pages[currentPage - 1]}
              scale={scale}
              onElementClick={(el) => {
                setSelectedElements([...selectedElements, el]);
                onElementSelect?.(el);
              }}
            />
          )}
        </div>
        
        <ReferenceSidebar 
          elements={selectedElements}
          onRemove={(el) => setSelectedElements(
            selectedElements.filter(e => e !== el)
          )}
        />
      </div>
    </div>
  );
}
```

#### InteractiveLayer.tsx

```tsx
interface InteractiveLayerProps {
  pageStructure: PageStructure;
  scale: number;
  onElementClick: (element: PDFElement) => void;
}

function InteractiveLayer({ pageStructure, scale, onElementClick }: InteractiveLayerProps) {
  const [hoveredElement, setHoveredElement] = useState<PDFElement | null>(null);

  return (
    <div className="interactive-layer absolute inset-0 pointer-events-none">
      {pageStructure.blocks
        .filter(block => ['image', 'table', 'equation'].includes(block.type))
        .map((block, index) => (
          <ElementOverlay
            key={index}
            element={block}
            scale={scale}
            isHovered={hoveredElement === block}
            onMouseEnter={() => setHoveredElement(block)}
            onMouseLeave={() => setHoveredElement(null)}
            onClick={() => onElementClick(block)}
          />
        ))}
    </div>
  );
}
```

#### ElementOverlay.tsx

```tsx
interface ElementOverlayProps {
  element: PDFElement;
  scale: number;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}

function ElementOverlay({ element, scale, isHovered, ...handlers }: ElementOverlayProps) {
  const [x, y, x2, y2] = element.bbox;
  
  const style: CSSProperties = {
    position: 'absolute',
    left: x * scale,
    top: y * scale,
    width: (x2 - x) * scale,
    height: (y2 - y) * scale,
    border: isHovered ? '2px solid #3b82f6' : '2px solid transparent',
    backgroundColor: isHovered ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
    cursor: 'pointer',
    pointerEvents: 'auto',
    transition: 'all 0.15s ease',
  };

  const iconMap = {
    image: '📊',
    table: '📋',
    equation: '📐',
  };

  return (
    <div style={style} {...handlers}>
      {isHovered && (
        <div className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded">
          {iconMap[element.type]} 点击添加到引用
        </div>
      )}
    </div>
  );
}
```

---

## 四、数据流设计

### 4.1 状态管理

```typescript
// stores/usePDFStore.ts
interface PDFState {
  // 当前打开的 PDF
  currentFile: string | null;
  
  // 解析状态
  parseStatus: 'idle' | 'parsing' | 'done' | 'error';
  
  // 结构化数据
  structure: PDFStructure | null;
  
  // 选中的元素引用
  selectedElements: PDFElement[];
  
  // 动作
  openPDF: (path: string) => Promise<void>;
  closePDF: () => void;
  addElement: (element: PDFElement) => void;
  removeElement: (element: PDFElement) => void;
  clearElements: () => void;
}
```

### 4.2 PDF 元素类型

```typescript
interface PDFElement {
  type: 'text' | 'image' | 'table' | 'equation';
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  pageIndex: number;
  
  // 内容（根据类型不同）
  content?: string;      // 文本/Markdown
  latex?: string;        // 公式的 LaTeX
  imagePath?: string;    // 图片路径
  caption?: string;      // 图/表标题
}

interface PageStructure {
  pageIndex: number;
  width: number;
  height: number;
  blocks: PDFElement[];
}

interface PDFStructure {
  pageCount: number;
  pages: PageStructure[];
}
```

---

## 五、AI 集成

### 5.1 引用发送给 AI

当用户选中元素后，可以在对话中引用：

```typescript
interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  
  // PDF 引用
  references?: PDFElement[];
}

// 构建带引用的提示词
function buildPromptWithReferences(
  userMessage: string, 
  references: PDFElement[]
): string {
  let prompt = userMessage;
  
  if (references.length > 0) {
    prompt += '\n\n---\n引用的内容：\n';
    
    for (const ref of references) {
      switch (ref.type) {
        case 'image':
          prompt += `\n[图片: ${ref.caption || '未命名'}]\n`;
          // 图片需要用多模态 API
          break;
        case 'table':
          prompt += `\n[表格]\n${ref.content}\n`;
          break;
        case 'equation':
          prompt += `\n[公式] $${ref.latex}$\n`;
          break;
        case 'text':
          prompt += `\n[文本] ${ref.content}\n`;
          break;
      }
    }
  }
  
  return prompt;
}
```

### 5.2 多模态支持

对于图片类型的引用，需要使用支持视觉的模型：

```typescript
// 如果引用中包含图片，使用多模态 API
async function sendToAI(message: string, references: PDFElement[]) {
  const hasImages = references.some(r => r.type === 'image');
  
  if (hasImages) {
    // 使用 GPT-4V / Claude Vision
    const imageRefs = references.filter(r => r.type === 'image');
    const images = await Promise.all(
      imageRefs.map(r => readImageAsBase64(r.imagePath))
    );
    
    return callMultimodalAPI(message, images);
  } else {
    // 使用普通文本 API
    return callTextAPI(buildPromptWithReferences(message, references));
  }
}
```

---

## 六、缓存策略

### 6.1 解析结果缓存

```
PDF 缓存目录结构：
~/.lumina-note/pdf-cache/
├── {pdf-hash}/
│   ├── structure.json     # 结构化数据
│   ├── images/            # 提取的图片
│   │   ├── page_0_img_0.png
│   │   ├── page_0_img_1.png
│   │   └── ...
│   └── metadata.json      # 缓存元数据（时间、版本等）
```

### 6.2 缓存策略

```rust
fn get_cached_structure(pdf_path: &str) -> Option<PDFStructure> {
    let pdf_hash = calculate_file_hash(pdf_path);
    let cache_dir = get_cache_dir(&pdf_hash);
    let structure_path = cache_dir.join("structure.json");
    
    if structure_path.exists() {
        // 检查 PDF 是否被修改
        let metadata = read_metadata(&cache_dir)?;
        let pdf_mtime = get_file_mtime(pdf_path)?;
        
        if metadata.pdf_mtime == pdf_mtime {
            // 缓存有效
            return Some(read_structure(&structure_path)?);
        }
    }
    
    None // 需要重新解析
}
```

---

## 七、开发计划

### Phase 1：基础 PDF 查看器（1-2 天）

- [ ] 集成 react-pdf
- [ ] 实现基础渲染
- [ ] 翻页/缩放控制
- [ ] 文本选择/搜索

### Phase 2：MinerU 集成（2-3 天）

- [ ] Rust 后端调用 MinerU
- [ ] 解析结果缓存
- [ ] 结构化数据接口

### Phase 3：交互层实现（2-3 天）

- [ ] 元素覆盖层渲染
- [ ] 悬停高亮效果
- [ ] 点击选择功能
- [ ] 元素类型图标

### Phase 4：引用侧边栏（1-2 天）

- [ ] 引用列表 UI
- [ ] 元素预览卡片
- [ ] 删除/清空引用

### Phase 5：AI 对话集成（1-2 天）

- [ ] 带引用的对话
- [ ] 多模态图片支持
- [ ] 上下文关联

### Phase 6：高级功能（可选）

- [ ] 手动框选区域
- [ ] PDF 注释/高亮
- [ ] 导出引用为笔记
- [ ] 批量处理多个 PDF

---

## 八、依赖清单

### 前端

```json
{
  "react-pdf": "^7.x",
  "pdfjs-dist": "^3.x"
}
```

### 后端/工具

- **MinerU**: `pip install magic-pdf[full]`
- 或 Docker: `opendatalab/mineru`

### 系统要求

- Python 3.8+（MinerU 运行环境）
- 约 2-4GB 磁盘空间（模型文件）

---

## 九、参考资料

- [MinerU GitHub](https://github.com/opendatalab/MinerU)
- [react-pdf 文档](https://github.com/wojtekmaj/react-pdf)
- [pdf.js 官方](https://mozilla.github.io/pdf.js/)

---

## 十、待讨论问题

1. **MinerU 部署方式**
   - 本地 Python 环境？
   - Docker 容器？
   - 云服务？

2. **首次解析体验**
   - MinerU 解析较慢（复杂 PDF 可能需要几十秒）
   - 是否显示进度条？
   - 是否支持取消？

3. **离线支持**
   - MinerU 需要模型文件
   - 是否打包到应用中？
   - 还是首次使用时下载？

4. **框选功能**
   - 是否同时支持手动框选？
   - 框选后如何处理（截图 vs OCR）？

5. **笔记集成**
   - 引用的元素如何嵌入到 Markdown 笔记中？
   - 使用什么格式保存？
