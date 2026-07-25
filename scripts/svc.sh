#!/bin/bash
# eonova.me 服务管理脚本
# 用法: pnpm svc {start|stop|restart|status|logs}

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_DIR="$PROJECT_DIR/.pids"
LOG_DIR="$PROJECT_DIR/.logs"

PORT_PROXY=8079
PORT_APP=13000

PID_REDIS="$PID_DIR/redis-proxy.pid"
PID_NEXT="$PID_DIR/next.pid"
LOG_REDIS="$LOG_DIR/redis-proxy.log"
LOG_NEXT="$LOG_DIR/next.log"

mkdir -p "$PID_DIR" "$LOG_DIR"

# ─── 工具函数 ───

is_running() {
  local pid_file="$1"
  if [ -f "$pid_file" ]; then
    local pid
    pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    rm -f "$pid_file"
  fi
  return 1
}

check_port() {
  lsof -ti:"$1" >/dev/null 2>&1
}

# ─── 启动 ───

start_redis_proxy() {
  if is_running "$PID_REDIS"; then
    echo "✅ Redis 代理已在运行 (PID $(cat $PID_REDIS))"
    return
  fi
  if check_port $PORT_PROXY; then
    echo "⚠️  端口 $PORT_PROXY 已被占用，跳过 Redis 代理启动"
    return
  fi
  echo "🚀 启动 Redis 代理..."
  nohup node "$PROJECT_DIR/scripts/redis-http-proxy.mjs" > "$LOG_REDIS" 2>&1 &
  echo $! > "$PID_REDIS"
  sleep 1
  if is_running "$PID_REDIS"; then
    echo "✅ Redis 代理启动成功 (PID $(cat $PID_REDIS))"
  else
    echo "❌ Redis 代理启动失败，查看日志: $LOG_REDIS"
    return 1
  fi
}

start_next() {
  if is_running "$PID_NEXT"; then
    echo "✅ Next.js 已在运行 (PID $(cat $PID_NEXT))"
    return
  fi
  if check_port $PORT_APP; then
    echo "⚠️  端口 $PORT_APP 已被占用，跳过 Next.js 启动"
    return
  fi
  echo "🚀 启动 Next.js 生产服务器..."
  cd "$PROJECT_DIR"
  nohup pnpm start > "$LOG_NEXT" 2>&1 &
  echo $! > "$PID_NEXT"
  sleep 2
  if is_running "$PID_NEXT"; then
    echo "✅ Next.js 启动成功 (PID $(cat $PID_NEXT))"
  else
    echo "❌ Next.js 启动失败，查看日志: $LOG_NEXT"
    return 1
  fi
}

cmd_start() {
  echo "🔍 检查前置服务..."
  if ! systemctl is-active --quiet postgresql 2>/dev/null; then
    echo "❌ PostgreSQL 未运行，请先启动: sudo systemctl start postgresql"
    exit 1
  fi
  echo "✅ PostgreSQL 已运行"
  if ! systemctl is-active --quiet redis 2>/dev/null; then
    echo "❌ Redis 未运行，请先启动: sudo systemctl start redis"
    exit 1
  fi
  echo "✅ Redis 已运行"
  echo ""

  start_redis_proxy
  start_next

  echo ""
  echo "🎉 所有服务已启动！"
  echo "   📡 Redis 代理: http://localhost:$PORT_PROXY"
  echo "   🌐 网站:       http://localhost:$PORT_APP"
  echo "   🌐 局域网:     http://$(hostname -I | awk '{print $1}'):$PORT_APP"
}

# ─── 停止 ───

stop_process() {
  local name="$1"
  local pid_file="$2"
  if is_running "$pid_file"; then
    local pid
    pid=$(cat "$pid_file")
    echo "🛑 停止 $name (PID $pid)..."
    kill "$pid" 2>/dev/null
    # 等待最多 5 秒
    for i in $(seq 1 10); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.5
    done
    # 还没停就强制杀
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
    rm -f "$pid_file"
    echo "   ✅ 已停止"
  else
    # 尝试按端口杀
    local port
    case "$name" in
      "Next.js") port=$PORT_APP ;;
      "Redis 代理") port=$PORT_PROXY ;;
    esac
    if check_port "$port"; then
      echo "🛑 停止占用端口 $port 的 $name..."
      kill $(lsof -ti:"$port") 2>/dev/null
      sleep 1
      echo "   ✅ 已停止"
    else
      echo "⚪ $name 未在运行"
    fi
  fi
}

cmd_stop() {
  echo "🛑 正在停止所有服务..."
  stop_process "Next.js" "$PID_NEXT"
  stop_process "Redis 代理" "$PID_REDIS"
  echo ""
  echo "👋 所有服务已停止"
}

# ─── 重启 ───

cmd_restart() {
  cmd_stop
  echo ""
  cmd_start
}

# ─── 状态 ───

cmd_status() {
  echo "📋 服务状态:"
  echo ""

  # PostgreSQL
  if systemctl is-active --quiet postgresql 2>/dev/null; then
    echo "  ✅ PostgreSQL       运行中"
  else
    echo "  ❌ PostgreSQL       未运行"
  fi

  # Redis
  if systemctl is-active --quiet redis 2>/dev/null; then
    echo "  ✅ Redis            运行中"
  else
    echo "  ❌ Redis            未运行"
  fi

  # Redis 代理
  if is_running "$PID_REDIS" || check_port $PORT_PROXY; then
    local pid
    pid=$(cat "$PID_REDIS" 2>/dev/null || lsof -ti:$PORT_PROXY 2>/dev/null | head -1)
    echo "  ✅ Redis 代理       运行中 (PID $pid, 端口 $PORT_PROXY)"
  else
    echo "  ❌ Redis 代理       未运行"
  fi

  # Next.js
  if is_running "$PID_NEXT" || check_port $PORT_APP; then
    local pid
    pid=$(cat "$PID_NEXT" 2>/dev/null || lsof -ti:$PORT_APP 2>/dev/null | head -1)
    echo "  ✅ Next.js          运行中 (PID $pid, 端口 $PORT_APP)"
  else
    echo "  ❌ Next.js          未运行"
  fi

  echo ""
}

# ─── 日志 ───

cmd_logs() {
  local service="${2:-all}"
  case "$service" in
    redis|proxy)
      echo "📄 Redis 代理日志 (最近 30 行):"
      tail -30 "$LOG_REDIS" 2>/dev/null || echo "  无日志"
      ;;
    next|app)
      echo "📄 Next.js 日志 (最近 30 行):"
      tail -30 "$LOG_NEXT" 2>/dev/null || echo "  无日志"
      ;;
    all|*)
      echo "📄 Redis 代理日志 (最近 15 行):"
      tail -15 "$LOG_REDIS" 2>/dev/null || echo "  无日志"
      echo ""
      echo "📄 Next.js 日志 (最近 15 行):"
      tail -15 "$LOG_NEXT" 2>/dev/null || echo "  无日志"
      ;;
  esac
}

# ─── 主入口 ───

case "${1:-help}" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_restart ;;
  status)  cmd_status ;;
  logs)    cmd_logs "$@" ;;
  *)
    echo "用法: pnpm svc <command>"
    echo ""
    echo "命令:"
    echo "  start    启动所有服务"
    echo "  stop     停止所有服务"
    echo "  restart  重启所有服务"
    echo "  status   查看服务状态"
    echo "  logs     查看日志 (可选: logs redis / logs next)"
    echo ""
    echo "示例:"
    echo "  pnpm svc start"
    echo "  pnpm svc status"
    echo "  pnpm svc logs redis"
    ;;
esac
