# 视频字幕后端启动脚本
$port = 8765
$python = "D:\app\python\python.exe"
$script = "D:\同声传译\subtitle-app\backend\server.py"

# 检查并释放端口
$listener = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($listener) {
    Write-Host "端口 $port 被占用，终止进程..."
    Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

Write-Host "=========================================="
Write-Host " 视频字幕后端服务"
Write-Host " http://127.0.0.1:$port"
Write-Host " 关闭此窗口即停止服务"
Write-Host "=========================================="

# 启动服务
& $python -u $script

# 如果退出，暂停显示错误
Write-Host ""
Write-Host "服务已退出，按任意键关闭..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
