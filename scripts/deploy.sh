#!/bin/bash
# 一键部署：拉取代码 → 构建 → 重启服务
# 用法: bash scripts/deploy.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "📥 拉取最新代码..."
git pull origin mmblog

echo ""
echo "🔨 构建项目..."
pnpm build

echo ""
echo "🔄 重启服务..."
bash scripts/svc.sh restart

echo ""
echo "✅ 部署完成！"
echo "🌐 网站: http://localhost:13000"
echo "🌐 局域网: http://$(hostname -I | awk '{print $1}'):13000"
