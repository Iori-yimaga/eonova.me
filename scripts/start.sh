#!/bin/bash
# 一键启动所有服务：Redis HTTP 代理 + Next.js 生产服务器

set -e

PORT_PROXY=8079
PORT_APP=13000

echo "🔍 检查服务状态..."

# 检查 PostgreSQL
if systemctl is-active --quiet postgresql; then
  echo "✅ PostgreSQL 已运行"
else
  echo "⚠️  PostgreSQL 未运行，请手动启动: sudo systemctl start postgresql"
  exit 1
fi

# 检查 Redis
if systemctl is-active --quiet redis; then
  echo "✅ Redis 已运行"
else
  echo "⚠️  Redis 未运行，请手动启动: sudo systemctl start redis"
  exit 1
fi

# 清理旧进程
cleanup() {
  echo ""
  echo "🛑 正在停止服务..."
  [ -n "$REDIS_PID" ] && kill "$REDIS_PID" 2>/dev/null && echo "  停止 Redis 代理"
  [ -n "$NEXT_PID" ] && kill "$NEXT_PID" 2>/dev/null && echo "  停止 Next.js"
  # 清理占用端口的进程
  kill $(lsof -ti:$PORT_PROXY) 2>/dev/null
  kill $(lsof -ti:$PORT_APP) 2>/dev/null
  echo "👋 已停止所有服务"
}
trap cleanup EXIT INT TERM

# 启动 Redis HTTP 代理（如果端口未被占用）
if lsof -ti:$PORT_PROXY >/dev/null 2>&1; then
  echo "✅ Redis 代理已在运行 (端口 $PORT_PROXY)"
else
  echo "🚀 启动 Redis HTTP 代理..."
  node scripts/redis-http-proxy.mjs &
  REDIS_PID=$!
  sleep 1
  if lsof -ti:$PORT_PROXY >/dev/null 2>&1; then
    echo "✅ Redis 代理启动成功"
  else
    echo "❌ Redis 代理启动失败"
    exit 1
  fi
fi

# 启动 Next.js 生产服务器（如果端口未被占用）
if lsof -ti:$PORT_APP >/dev/null 2>&1; then
  echo "✅ Next.js 已在运行 (端口 $PORT_APP)"
else
  echo "🚀 启动 Next.js 生产服务器..."
  pnpm start &
  NEXT_PID=$!
  sleep 2
  if lsof -ti:$PORT_APP >/dev/null 2>&1; then
    echo "✅ Next.js 启动成功"
  else
    echo "❌ Next.js 启动失败"
    exit 1
  fi
fi

echo ""
echo "🎉 所有服务已启动！"
echo "   📡 Redis 代理: http://localhost:$PORT_PROXY"
echo "   🌐 网站:       http://localhost:$PORT_APP"
echo "   🌐 局域网:     http://$(hostname -I | awk '{print $1}'):$PORT_APP"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待子进程
wait
