# 视频字幕生成与校对工具

基于 Electron + Vue 3 的桌面应用，集成 OpenAI Whisper 大模型实现视频语音自动识别，支持字幕编辑、实时预览与 SRT 导出。

## 功能特性

- **视频导入** — 支持拖拽和文件对话框，兼容 MP4/AVI/MOV/MKV/FLV/WMV/WebM 等主流格式
- **语音识别** — 集成 OpenAI Whisper large-v3 模型，支持中文及多语言识别
- **字幕编辑** — 增删改字幕条目，时间轴精准调整
- **实时预览** — 字幕叠加显示在视频画面上，同步播放
- **视频播放控制** — 播放/暂停、进度拖拽、倍速切换
- **SRT 导出** — 一键导出标准 SRT 字幕文件
- **多语言识别** — 支持中文、英文、日文等多语言切换

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 33 |
| 前端框架 | Vue 3 (Composition API + `<script setup>`) |
| 构建工具 | Vite 5 + electron-vite |
| 后端服务 | FastAPI + Uvicorn |
| AI 模型 | OpenAI Whisper (large-v3) |
| 音频处理 | FFmpeg (16kHz 单声道 WAV 提取) |
| 语言 | JavaScript / Python 3.12 |

## 项目结构

```
subtitle-app/
├── backend/                  # Python 后端服务
│   ├── server.py             # FastAPI 服务 + Whisper 识别逻辑
│   └── requirements.txt      # Python 依赖
├── electron/                 # Electron 主进程
│   ├── main.js               # 主进程入口
│   └── preload.js            # 预加载脚本（IPC 通信）
├── src/renderer/             # 前端渲染进程
│   └── src/
│       ├── App.vue           # 主组件（状态管理 + 业务逻辑）
│       ├── main.js           # 渲染进程入口
│       ├── components/
│       │   ├── VideoPlayer.vue    # 视频播放器 + 字幕叠加
│       │   ├── SubtitleEditor.vue # 字幕编辑面板
│       │   ├── BottomBar.vue      # 底部操作栏（导入/识别/导出）
│       │   ├── TitleBar.vue       # 自定义标题栏
│       │   └── Notification.vue   # 通知提示
│       └── styles/
│           └── global.css    # 全局样式
├── package.json
├── vite.config.js
└── electron.vite.config.js
```

## 环境要求

- **Node.js** >= 18
- **Python** >= 3.10
- **FFmpeg** — 需添加到系统 PATH（[下载地址](https://ffmpeg.org/download.html)）
- **GPU（可选）** — CUDA 可用时可加速 Whisper 推理

## 快速开始

### 1. 安装前端依赖

```bash
cd subtitle-app
npm install
```

### 2. 安装后端依赖

```bash
cd subtitle-app/backend
pip install -r requirements.txt
```

> 注意：如遇 `whisper` 包冲突，使用清华镜像安装：
> ```bash
> pip install openai-whisper -i https://pypi.tuna.tsinghua.edu.cn/simple
> ```

### 3. 启动后端服务

```bash
cd subtitle-app/backend
python server.py
```

后端启动后会在 `http://127.0.0.1:8765` 提供服务，首次启动需加载 large-v3 模型（约 2.94GB），后续启动使用缓存。

### 4. 启动前端开发服务器

```bash
cd subtitle-app
npm run dev
```

前端运行在 `http://localhost:8080`，浏览器打开即可使用。

### 5. Electron 桌面模式（可选）

```bash
cd subtitle-app
npm run electron:dev
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查（含 GPU/ffmpeg 状态） |
| POST | `/api/recognize` | 上传视频文件进行识别 |
| POST | `/api/recognize/path` | Electron 模式：通过本地文件路径识别 |

### 请求示例

```bash
# 上传视频识别
curl -X POST http://127.0.0.1:8765/api/recognize \
  -F "file=@video.mp4" \
  -F "model_size=large-v3" \
  -F "language=zh"

# 通过本地路径识别（Electron 模式）
curl -X POST http://127.0.0.1:8765/api/recognize/path \
  -H "Content-Type: application/json" \
  -d '{"path": "D:/videos/test.mp4", "model_size": "large-v3", "language": "zh"}'
```

### 响应格式

```json
{
  "success": true,
  "count": 42,
  "language": "zh",
  "subtitles": [
    {
      "id": 1,
      "start": 0.52,
      "end": 3.18,
      "text": "识别到的字幕文本",
      "confidence": -0.234,
      "low_confidence": false
    }
  ]
}
```

## 识别流程

```
视频文件
  │
  ▼
FFmpeg 音频提取 (16kHz 单声道 WAV)
  │
  ▼
Whisper large-v3 语音识别
  │
  ▼
后处理（过滤静音段、标记低置信度）
  │
  ▼
字幕数据返回前端 → 编辑 → 导出 SRT
```

## 注意事项

- 首次运行会自动下载 Whisper large-v3 模型（约 2.94GB），请确保网络通畅
- CPU 模式下长视频识别可能需要数分钟，建议视频时长控制在 30 分钟以内
- FFmpeg 必须在系统 PATH 中可用，否则音频提取会失败
