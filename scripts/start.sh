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
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
COMPOSE_FILE="${DOCKER_DIR}/docker-compose.yaml"

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

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log_error "缺少依赖命令：$1"
    exit 1
  fi
}

container_health() {
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$1" 2>/dev/null || true
}

bootstrap_database() {
  local db_exists
  local table_exists

  db_exists="$(docker exec scene-script-mysql-prod mysql -uroot -proot -Nse "SHOW DATABASES LIKE 'scene_script_db';" 2>/dev/null || true)"
  if [ "${db_exists}" != "scene_script_db" ]; then
    log_warn "未检测到 scene_script_db，正在自动初始化数据库..."
    docker exec -i scene-script-mysql-prod mysql -uroot -proot < "${SCRIPT_DIR}/db/init.sql"
    log_success "数据库初始化完成"
    return 0
  fi

  table_exists="$(docker exec scene-script-mysql-prod mysql -uroot -proot -Nse "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='scene_script_db' AND table_name='ss_user';" 2>/dev/null || true)"
  if [ "${table_exists}" != "1" ]; then
    log_warn "数据库存在但核心表缺失，正在补齐初始化脚本..."
    docker exec -i scene-script-mysql-prod mysql -uroot -proot < "${SCRIPT_DIR}/db/init.sql"
    log_success "数据库表结构初始化完成"
  else
    log_success "数据库已存在，跳过初始化"
  fi
}

wait_for_container() {
  local container="$1"
  local timeout_seconds="$2"
  local waited=0
  while [ "$waited" -lt "$timeout_seconds" ]; do
    local status
    status="$(container_health "$container")"
    case "$status" in
      healthy|running)
        log_success "容器已就绪：${container} (${status})"
        return 0
        ;;
      exited|dead)
        log_error "容器启动失败：${container} (${status})"
        docker logs "$container" || true
        return 1
        ;;
    esac
    sleep 2
    waited=$((waited + 2))
  done

  log_error "等待容器超时：${container}"
  docker logs "$container" || true
  return 1
}

log_info "Scene Script 生产环境启动中..."
echo "Project root: ${PROJECT_ROOT}"
echo "Docker config: ${DOCKER_DIR}"

require_command docker
require_command node
require_command npm

if ! docker info >/dev/null 2>&1; then
  log_error "Docker daemon 未启动，请先打开 Docker Desktop 或启动 Docker 服务。"
  exit 1
fi

for file in \
  "${COMPOSE_FILE}" \
  "${DOCKER_DIR}/Dockerfile" \
  "${DOCKER_DIR}/config.yaml" \
  "${DOCKER_DIR}/nginx/default.conf" \
  "${SCRIPT_DIR}/db/init.sql" \
  "${FRONTEND_DIR}/package.json"; do
  if [ ! -f "$file" ]; then
    log_error "缺少必要文件：$file"
    exit 1
  fi
done

log_info "准备运行目录..."
mkdir -p "${DOCKER_DIR}/volumes/mysql" "${DOCKER_DIR}/volumes/redis" "${DOCKER_DIR}/volumes/logs"
log_success "运行目录已准备完成"

log_info "构建前端生产静态资源..."
cd "${FRONTEND_DIR}"
if [ ! -d node_modules ]; then
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
fi
npm run build -- --mode production

if [ ! -f "${FRONTEND_DIR}/dist/index.html" ]; then
  log_error "前端构建失败，未生成 dist/index.html"
  exit 1
fi
log_success "前端构建完成"

log_info "校验 Docker Compose 配置..."
run_compose config >/dev/null
log_success "Docker Compose 配置校验通过"

log_info "停止旧容器..."
run_compose down --remove-orphans >/dev/null 2>&1 || true

log_info "构建后端镜像..."
run_compose build backend
log_success "后端镜像构建完成"

log_info "启动基础依赖服务..."
run_compose up -d mysql redis

log_info "等待服务健康检查..."
wait_for_container "scene-script-mysql-prod" 120
wait_for_container "scene-script-redis-prod" 120

bootstrap_database

log_info "启动应用服务..."
run_compose up -d backend nginx

wait_for_container "scene-script-backend-prod" 180
wait_for_container "scene-script-nginx-prod" 120

log_info "当前服务状态："
run_compose ps

log_success "Scene Script 生产环境启动成功"
echo ""
echo "启动成功，请访问 Nginx 地址：http://localhost:8080"
echo ""
echo "常用命令："
echo "  - 查看日志:   cd ${DOCKER_DIR} && ${COMPOSE_CMD[*]} -f docker-compose.yaml logs -f"
 "  - 停止环境:   cd ${SCRIPT_DIR} && ./stop.sh"
echo "  - 重启服务:   cd ${DOCKER_DIR} && ${COMPOSE_CMD[*]} -f docker-compose.yaml restart"
echo "  - 后端容器:   docker exec -it scene-script-backend-prod sh"
echo "  - MySQL 客户端: docker exec -it scene-script-mysql-prod mysql -uroot -proot scene_script_db"
echo "  - Redis 客户端: docker exec -it scene-script-redis-prod redis-cli"
echo ""
echo "终端已释放，可继续输入其他命令。"
