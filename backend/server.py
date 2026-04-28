"""
Video subtitle generator - Backend service
FastAPI + OpenAI Whisper
"""

import asyncio
import os
import subprocess
import tempfile
import traceback
from pathlib import Path

import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="Video Subtitle Backend", version="1.0.0")

# CORS support (frontend Vite dev server on port 8080)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
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
        result = model.transcribe(audio_path, **options)
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


@app.post("/api/recognize/path")
async def recognize_by_path(
    path: str,
    model_size: str = "large-v3",
    language: str = "zh",
):
    """
    Electron only: pass local file path directly (no upload needed)
    """
    if not os.path.isfile(path):
        raise HTTPException(status_code=400, detail=f"File not found: {path}")

    try:
        result = await run_recognition(path, model_size, language)
        return JSONResponse(content=result)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    print("=" * 50)
    print("  Video Subtitle Backend v2")
    print("  http://127.0.0.1:8765")
    print("  GPU:", "CUDA available" if _check_gpu() else "CPU only (slower)")
    print("  ffmpeg:", "OK" if _check_ffmpeg() else "NOT FOUND - audio extraction will fail!")
    print("=" * 50)
    # Preload large-v3 model on startup
    get_model("large-v3")
    uvicorn.run(app, host="127.0.0.1", port=8765)
