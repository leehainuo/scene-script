#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
BOLD='\033[1m'
RESET='\033[0m'

log_info() {
  echo -e "${BOLD}$1${RESET}"
}

log_warn() {
  echo -e "${YELLOW}$1${RESET}"
}

log_error() {
  echo -e "${RED}$1${RESET}"
}

log_success() {
  echo -e "${GREEN}$1${RESET}"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DOCKER_DIR="${SCRIPT_DIR}/docker"
COMPOSE_FILE="${DOCKER_DIR}/docker-compose.yaml"
MODE="remove"

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  log_error "未找到 docker compose，请先安装 Docker Compose。"
  exit 1
fi

run_compose() {
  "${COMPOSE_CMD[@]}" -f "${COMPOSE_FILE}" "$@"
}

for arg in "$@"; do
  case "$arg" in
    --keep)
      MODE="keep"
      ;;
    --volumes)
      MODE="volumes"
      ;;
    *)
      log_error "未知参数：$arg"
      echo "可用参数：--keep | --volumes"
      exit 1
      ;;
  esac
done

log_info "停止 Scene Script 生产环境..."
echo "Project root: ${PROJECT_ROOT}"
echo "Docker config: ${DOCKER_DIR}"

if [ ! -f "${COMPOSE_FILE}" ]; then
  log_error "缺少 Docker Compose 文件：${COMPOSE_FILE}"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  log_error "Docker daemon 未启动，请先打开 Docker Desktop 或启动 Docker 服务。"
  exit 1
fi

log_info "当前服务状态："
run_compose ps || true

case "${MODE}" in
  keep)
    log_info "停止服务并保留容器..."
    run_compose stop
    ;;
  remove)
    log_info "停止服务并删除容器..."
    run_compose down --remove-orphans
    ;;
  volumes)
    log_warn "停止服务并删除容器及 volumes，这会清空本地 MySQL/Redis 数据。"
    run_compose down --remove-orphans --volumes
    ;;
esac

echo ""
log_success "Scene Script 生产环境已停止"
echo "常用命令："
echo "  - 重新启动:  cd ${SCRIPT_DIR} && ./start.sh"
echo "  - 仅停止服务并保留容器: cd ${SCRIPT_DIR} && ./stop.sh --keep"
echo "  - 删除容器和数据卷: cd ${SCRIPT_DIR} && ./stop.sh --volumes"
