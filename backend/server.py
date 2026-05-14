"""
Video subtitle generator - Backend service
FastAPI + OpenAI Whisper
"""

import asyncio
import os
import re
import subprocess
import tempfile
import traceback
from pathlib import Path
from typing import Any, Dict, List

import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

app = FastAPI(title="Video Subtitle Backend", version="1.0.0")

# CORS support (frontend Vite dev server on port 8080)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model cache
_whisper_model = None
_current_model_size = "large-v3"

# Whisper decoding parameters for accuracy
_TRANSCRIBE_OPTIONS = {
    "language": "zh",
    "beam_size": 5,
    "temperature": 0.0,
    "best_of": 5,
    "word_timestamps": True,
}


def get_model(model_size: str = "large-v3"):
    """Load Whisper model (lazy load, globally reused)"""
    global _whisper_model, _current_model_size

    if _whisper_model is not None and _current_model_size == model_size:
        return _whisper_model

    import whisper

    print(f"[Whisper] Loading {model_size} model...")
    _whisper_model = whisper.load_model(model_size)
    _current_model_size = model_size
    print(f"[Whisper] {model_size} model loaded")
    return _whisper_model


@app.get("/api/health")
async def health_check():
    """Health check with ffmpeg availability check"""
    return {"status": "ok", "gpu_available": _check_gpu(), "ffmpeg_ok": _check_ffmpeg()}


def _check_gpu():
    try:
        import torch
        return torch.cuda.is_available()
    except ImportError:
        return False


def _check_ffmpeg():
    """Check if ffmpeg is available in PATH"""
    try:
        result = subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True, timeout=5
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def extract_audio(video_path: str) -> str:
    """
    Extract audio from video file using ffmpeg.
    Returns path to extracted WAV audio file.
    Raises RuntimeError if extraction fails.
    """
    # Check ffmpeg availability
    if not _check_ffmpeg():
        raise RuntimeError(
            "ffmpeg 未安装或不在 PATH 中。请安装 ffmpeg 并添加到系统 PATH 环境变量。"
            "\nWindows: choco install ffmpeg 或从 https://ffmpeg.org/download.html 下载"
        )

    # Output: WAV format (16kHz mono, best for Whisper)
    audio_path = video_path.rsplit(".", 1)[0] + "_extracted.wav"

    print(f"[Audio] Extracting audio from: {video_path}")
    print(f"[Audio] Output to: {audio_path}")

    # ffmpeg command: extract audio as 16kHz mono PCM WAV (Whisper optimal input)
    cmd = [
        "ffmpeg",
        "-i", video_path,
        "-vn",                    # no video
        "-acodec", "pcm_s16le",   # PCM 16-bit little-endian
        "-ar", "16000",           # 16kHz sample rate (Whisper native)
        "-ac", "1",               # mono channel
        "-y",                     # overwrite output
        audio_path,
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,          # 5 minute timeout for long videos
        )

        if result.returncode != 0:
            raise RuntimeError(
                f"ffmpeg 提取音频失败 (exit code {result.returncode})\n"
                f"stderr: {result.stderr[-500:] if result.stderr else 'empty'}"
            )

        # Verify the extracted audio file exists and has content
        if not os.path.exists(audio_path):
            raise RuntimeError("音频文件提取失败：输出文件不存在")

        audio_size = os.path.getsize(audio_path)
        if audio_size < 1000:      # less than 1KB means essentially empty
            os.unlink(audio_path)
            raise RuntimeError(
                f"提取的音频文件过小（{audio_size} bytes），视频可能没有音频轨道或音频为空"
            )

        print(f"[Audio] Extraction complete: {audio_size / 1024:.1f} KB")
        return audio_path

    except subprocess.TimeoutExpired:
        raise RuntimeError("ffmpeg 提取超时（超过5分钟），视频可能损坏或过长")


@app.post("/api/recognize")
async def recognize_video(
    file: UploadFile = File(...),
    model_size: str = "large-v3",
    language: str = "zh",
):
    """
    Upload video file -> extract audio -> Whisper recognition -> return subtitle data
    """
    suffix = Path(file.filename or "video.mp4").suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        video_path = tmp.name

    try:
        result = await run_recognition(video_path, model_size, language)
        return JSONResponse(content=result)

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        try:
            os.unlink(video_path)
        except OSError:
            pass
        # Clean up extracted audio if it exists
        audio_path = video_path.rsplit(".", 1)[0] + "_extracted.wav"
        if os.path.exists(audio_path):
            try:
                os.unlink(audio_path)
            except OSError:
                pass


async def run_recognition(video_path: str, model_size: str, language: str) -> dict:
    """
    Execute full recognition pipeline:
    1. Extract audio from video using ffmpeg
    2. Run Whisper on extracted audio
    3. Filter results and return subtitles
    """

    def _recognize():
        import whisper

        # Step 1: Extract audio from video FIRST
        print(f"[Recognize] Input file: {video_path}")
        print(f"[Recognize] File size: {os.path.getsize(video_path)} bytes")

        audio_path = extract_audio(video_path)
        print(f"[Recognize] Audio extracted successfully")

        # Step 2: Load model
        model = get_model(model_size)

        # Step 3: Build transcription options
        options = dict(_TRANSCRIBE_OPTIONS)
        if language:
            options["language"] = language

        # 宽松参数：宁可多出也不要漏掉
        # no_speech_threshold 不设置，让 Whisper 用默认值（不过滤无语音段）
        # 我们在后处理中标记低置信度段，而不是丢弃
        options.pop("no_speech_threshold", None)
        options.pop("logprob_threshold", None)
        options["condition_on_previous_text"] = False  # 避免前文上下文影响后续段识别

        print(
            f"[Recognize] Transcribing... "
            f"(model={model_size}, lang={options.get('language', 'auto')}, "
            f"audio={os.path.getsize(audio_path) / 1024:.1f}KB)"
        )

        # Monkey-patch Whisper timing hook bug (PyTorch 2.11+ compatibility)
        # whisper/timing.py:189 — outs[-1] can be None → TypeError
        import whisper.timing as _wt
        _orig_register = getattr(_wt, "register_timings_hooks", None)
        if _orig_register:
            def _patched_register(model):
                """Skip timing hooks to avoid PyTorch 2.11+ compatibility crash"""
                return  # no-op: skip timing registration entirely
            _wt.register_timings_hooks = _patched_register

        result = model.transcribe(audio_path, **options)

        # Restore original if needed (not strictly necessary for single-threaded use)
        if _orig_register:
            _wt.register_timings_hooks = _orig_register

        print(f"[Recognize] Done, {len(result['segments'])} segments")
        print(f"[Recognize] Detected language: {result.get('language', '?')}")

        # Step 4: Process segments — 保留所有 Whisper 输出，只标记可疑段
        subtitles = []
        total_segments = len(result["segments"])
        for seg in result["segments"]:
            text = seg["text"].strip()
            if not text:
                continue

            no_speech_prob = seg.get("no_speech_prob", 0)
            logprob = seg.get("avg_logprob", -1)

            # 仅在极低置信度 + 极高无语音概率时才跳过（基本是纯静音/噪声段）
            if no_speech_prob > 0.95 and logprob < -2.0:
                continue

            subtitles.append({
                "id": len(subtitles) + 1,
                "start": round(seg["start"], 2),
                "end": round(seg["end"], 2),
                "text": text,
                "language": result.get("language", ""),
                "confidence": round(logprob, 3),
                "low_confidence": no_speech_prob > 0.6 or logprob < -0.8,
            })

        low_conf_count = sum(1 for s in subtitles if s.get("low_confidence"))
        print(f"[Recognize] {len(subtitles)} segments (kept from {total_segments}, {low_conf_count} low-confidence)")

        return {
            "success": True,
            "count": len(subtitles),
            "language": result.get("language", ""),
            "subtitles": subtitles,
        }

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _recognize)
    return result


class RecognizePathRequest(BaseModel):
    path: str
    model_size: str = "large-v3"
    language: str = "zh"


class AudioExtractRequest(BaseModel):
    path: str


@app.post("/api/recognize/path")
async def recognize_by_path(req: RecognizePathRequest):
    """
    Electron only: pass local file path directly (no upload needed)
    """
    if not os.path.isfile(req.path):
        raise HTTPException(status_code=400, detail=f"File not found: {req.path}")

    try:
        result = await run_recognition(req.path, req.model_size, req.language)
        return JSONResponse(content=result)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/audio/extract")
async def audio_extract(req: AudioExtractRequest):
    """从视频文件中提取音频，返回 PCM 数据"""
    import wave

    if not os.path.isfile(req.path):
        raise HTTPException(status_code=400, detail=f"File not found: {req.path}")

    try:
        output_path = str(Path(tempfile.gettempdir()) / f"audio_extract_{os.getpid()}.wav")

        # 使用 ffmpeg 提取音频
        cmd = [
            "ffmpeg", "-y", "-i", req.path,
            "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            output_path,
        ]
        subprocess.run(cmd, capture_output=True, check=True)

        # 读取 wav 文件并返回
        with open(output_path, "rb") as f:
            data = f.read()

        # 清理临时文件
        try:
            os.remove(output_path)
        except OSError:
            pass

        return Response(content=data, media_type="audio/wav")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# v3.0  AI 智能功能接口
# ============================================================


class SubtitleItem(BaseModel):
    id: int
    start: float
    end: float
    text: str


class SegmentRequest(BaseModel):
    subtitles: List[Dict[str, Any]]
    config: Dict[str, Any] = {}


class PunctuationRequest(BaseModel):
    subtitles: List[Dict[str, Any]]
    enabled_types: Dict[str, bool] = {}
    mode: str = "all"


class CorrectionRequest(BaseModel):
    subtitles: List[Dict[str, Any]]


# ---- 智能分段 ----
@app.post("/api/ai/segment")
async def ai_segment(req: SegmentRequest):
    """
    规则引擎版本智能分段：
    - 合并 < min_duration 的短句到相邻句
    - 拆分 > max_duration 或超字数的长句
    """
    subs = [dict(s) for s in req.subtitles]
    cfg = req.config
    min_dur = float(cfg.get("minDuration", 1.0))
    max_dur = float(cfg.get("maxDuration", 8.0))
    max_chars = int(cfg.get("maxChars", 20))

    before_preview = []
    after_preview = []
    changes = 0

    # 第一步：合并过短的字幕
    merged = []
    i = 0
    while i < len(subs):
        s = subs[i]
        dur = s["end"] - s["start"]
        if dur < min_dur and len(s["text"].strip()) < 4 and merged:
            # 合并到前一条
            prev = merged[-1]
            prev["text"] = prev["text"].rstrip("。，！？、") + s["text"]
            prev["end"] = s["end"]
            before_preview.append({"text": s["text"], "start": s["start"], "end": s["end"], "changed": True})
            changes += 1
        else:
            merged.append(dict(s))
        i += 1

    # 第二步：拆分过长的字幕
    result = []
    for s in merged:
        dur = s["end"] - s["start"]
        text = s["text"].strip()
        if dur > max_dur or len(text) > max_chars:
            # 尝试在逗号、句号、顿号处拆分
            split_points = [m.start() + 1 for m in re.finditer(r'[，。、；]', text)]
            if split_points:
                mid = split_points[len(split_points) // 2]
                t1, t2 = text[:mid], text[mid:]
                mid_time = s["start"] + (s["end"] - s["start"]) * mid / len(text)
                before_preview.append({"text": text, "start": s["start"], "end": s["end"], "changed": True})
                after_preview.append({"text": t1, "start": s["start"], "end": mid_time, "changed": True})
                after_preview.append({"text": t2, "start": mid_time, "end": s["end"], "changed": True})
                result.append({"id": s["id"], "start": s["start"], "end": mid_time, "text": t1})
                result.append({"id": s["id"] + 0.5, "start": mid_time, "end": s["end"], "text": t2})
                changes += 1
            else:
                result.append(s)
        else:
            result.append(s)

    # 重新分配 id
    for idx, s in enumerate(result):
        s["id"] = idx + 1

    # 补全预览（未变化条目）
    for s in subs[:5]:
        if not any(p["text"] == s["text"] for p in before_preview):
            before_preview.insert(0, {"text": s["text"], "start": s["start"], "end": s["end"], "changed": False})

    return {
        "subtitles": result,
        "changes_count": changes,
        "before_preview": before_preview[:8],
        "after_preview": after_preview[:8] or [{"text": s["text"], "start": s["start"], "end": s["end"], "changed": False} for s in result[:5]],
    }


# ---- 智能标点 ----
@app.post("/api/ai/punctuation")
async def ai_punctuation(req: PunctuationRequest):
    """
    规则引擎版本智能标点：
    - 句尾无标点时，根据关键词添加 ？！，。
    """
    subs = [dict(s) for s in req.subtitles]
    enabled = req.enabled_types
    changes = []

    question_words = ["吗", "呢", "吧", "么", "是否", "怎么", "为什么", "哪", "谁", "几", "多少"]
    exclaim_words = ["太", "真棒", "好棒", "厉害", "不得了", "太好了", "哇", "真的假的"]
    end_punct = set("。！？…")

    for i, s in enumerate(subs):
        text = s["text"].strip()
        if not text:
            continue
        last = text[-1]
        if last in end_punct or last in "，、；：":
            continue  # 已有标点，跳过

        new_text = text
        reason = None

        if enabled.get("question", True) and any(w in text for w in question_words):
            new_text = text + "？"
            reason = "疑问语气"
        elif enabled.get("exclamation", True) and any(w in text for w in exclaim_words):
            new_text = text + "！"
            reason = "感叹语气"
        elif enabled.get("period", True):
            new_text = text + "。"
            reason = "句末添加句号"

        if new_text != text and reason:
            changes.append({"index": i, "before": text, "after": new_text, "reason": reason})
            subs[i]["text"] = new_text

    return {
        "subtitles": subs,
        "changes": changes,
        "changes_count": len(changes),
    }


# ---- 上下文纠错 ----
# 常见同音/近音错误词典（MVP 规则库）
_CORRECTION_DICT = {
    "阿狸爸爸": "阿里巴巴",
    "腾训": "腾讯",
    "腾训视频": "腾讯视频",
    "新lang": "新浪",
    "百渡": "百度",
    "威信": "微信",
    "爱奇一": "爱奇艺",
    "优土": "优酷",
    "深度学系": "深度学习",
    "机器学系": "机器学习",
    "人工制能": "人工智能",
    "神经网洛": "神经网络",
    "算法模形": "算法模型",
    "数据分析是": "数据分析师",
}

_HIGH_CONF_DICT = {
    "公式公司": "公司",
    "在在": "在",
    "的的": "的",
    "了了": "了",
    "是是": "是",
}


@app.post("/api/ai/correction")
async def ai_correction(req: CorrectionRequest):
    """
    规则引擎版本上下文纠错：
    - 高置信度词（>= 90%）自动修正
    - 中等置信度词（75-89%）提交用户确认
    """
    subs = [dict(s) for s in req.subtitles]
    auto_fixed = []
    pending = []

    for i, s in enumerate(subs):
        text = s["text"]
        modified = text

        # 高置信度 - 自动修正
        for wrong, right in _HIGH_CONF_DICT.items():
            if wrong in modified:
                modified = modified.replace(wrong, right)
                auto_fixed.append({
                    "subtitleIndex": i,
                    "original": wrong,
                    "suggestion": right,
                    "confidence": 95,
                    "reason": "重复词汇自动合并",
                })

        # 中等置信度 - 待确认
        for wrong, right in _CORRECTION_DICT.items():
            if wrong in modified:
                pending.append({
                    "subtitleIndex": i,
                    "original": wrong,
                    "suggestion": right,
                    "confidence": 88,
                })
                # 自动替换（待用户撤销）
                modified = modified.replace(wrong, right)
                auto_fixed.append({
                    "subtitleIndex": i,
                    "original": wrong,
                    "suggestion": right,
                    "confidence": 88,
                    "reason": "专有名词纠错",
                })

        subs[i]["text"] = modified

    return {
        "subtitles": subs,
        "auto_fixed": auto_fixed,
        "pending": pending,
        "changes_count": len(auto_fixed),
    }


# ---- 情感识别（预留接口） ----
@app.post("/api/ai/emotion")
async def ai_emotion(req: dict):
    """情感识别接口（预留，模型待集成）"""
    return {"subtitles": req.get("subtitles", []), "changes_count": 0, "message": "情感识别模型未加载"}


if __name__ == "__main__":
    print("=" * 50)
    print("  Video Subtitle Backend v3")
    print("  http://127.0.0.1:8081")
    print("  GPU:", "CUDA available" if _check_gpu() else "CPU only (slower)")
    print("  ffmpeg:", "OK" if _check_ffmpeg() else "NOT FOUND - audio extraction will fail!")
    print("  模型加载方式: 懒加载（首次识别时加载）")
    print("=" * 50)
    # 不再预加载模型，改为懒加载（首次识别时加载）
    try:
        uvicorn.run(app, host="127.0.0.1", port=8081, log_level="info")
    except Exception as e:
        print(f"[ERROR] 服务器启动失败: {e}")
        import traceback
        traceback.print_exc()
        input("按回车键退出...")
