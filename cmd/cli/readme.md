# Scene Script CLI - 代码生成工具

> 一站式代码生成工具：从 DDL 生成完整的 CRUD 代码和 API 文件

## 📖 简介

Scene Script CLI 是为 Scene Script Go 脚手架项目设计的代码生成器，帮助你快速生成标准化的业务代码。它支持：

- ✅ **从 DDL 生成全套代码**：自动生成 Types、Handler、Logic、Model 及路由配置
- ✅ **反向生成 API 文件**：从现有代码生成 `.api` 文件，方便文档管理
- ✅ **严格遵循架构规范**：生成的代码完全符合 Scene Script 项目的三层架构标准
- ✅ **智能表名处理**：自动识别并去除表名前缀（如 `sys_`, `t_`, `tb_`）

---

## 🚀 快速开始

### 安装

```bash
# 在项目根目录编译 CLI 工具
go build -o bin/scene-script ./cmd/cli

# 或者直接运行
go run ./cmd/cli/main.go
```

### 基本用法

```bash
# 查看帮助
./bin/scene-script --help

# 查看版本
./bin/scene-script --version

# 查看子命令帮助
./bin/scene-script gen --help
```

---

## 📚 命令详解

### 1. `scene-script gen all` - 从 DDL 生成全套代码

**功能**：解析 SQL DDL 文件，自动生成完整的 CRUD 代码（Types、Handler、Logic、Model）并更新路由和 ServiceContext。

#### 使用方式

```bash
./bin/scene-script gen all --src <DDL文件路径> [选项]
```

#### 参数说明

| 参数 | 简写 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `--src` | - | ✅ | - | DDL SQL 文件路径 |
| `--output` | `-o` | ❌ | `.` | 代码输出目录 |
| `--prefix` | - | ❌ | 自动识别 | 表名前缀（如 `sys_`, `t_`） |

#### 示例 1：基本使用

```bash
# 从 DDL 文件生成代码到当前目录
./bin/scene-script gen all --src ./scripts/db/sys_role.sql
```

**输入文件** (`scripts/db/sys_role.sql`):
```sql
CREATE TABLE `sys_role` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL COMMENT '角色名称',
  `code` varchar(50) NOT NULL COMMENT '角色编码',
  `status` tinyint DEFAULT '1' COMMENT '状态：1-启用，0-禁用',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统角色表';
```

**生成的代码结构**:
```
.
├── internal/
│   ├── types/
│   │   └── role.go                    # 请求/响应类型定义
│   ├── handler/
│   │   └── role/
│   │       ├── create_role_handler.go # 创建角色
│   │       ├── delete_role_handler.go # 删除角色
│   │       ├── get_role_handler.go    # 获取角色详情
│   │       ├── list_role_handler.go   # 角色列表
│   │       └── update_role_handler.go # 更新角色
│   ├── logic/
│   │   └── role/
│   │       ├── create_role_logic.go
│   │       ├── delete_role_logic.go
│   │       ├── get_role_logic.go
│   │       ├── list_role_logic.go
│   │       └── update_role_logic.go
│   ├── svc/svc.go                     # 自动注册 RoleModel
│   └── router/api/v1.go               # 自动注册 role 路由
├── internal/model/
│   └── role.go                        # 数据模型和 DAO
└── api/desc/
    └── role.api                       # 自动生成 API 文档
```

#### 示例 2：指定输出目录

```bash
# 生成代码到指定目录
./bin/scene-script gen all --src ./scripts/db/sys_user.sql --output ./output
```

#### 示例 3：指定表名前缀

```bash
# 指定表名前缀（表名为 t_product，模块名为 product）
./bin/scene-script gen all --src ./scripts/db/t_product.sql --prefix "t_"
```

#### 自动完成的任务

✅ **生成 5 个标准 CRUD Handler**
  - `CreateXxxHandler` - 创建资源
  - `DeleteXxxHandler` - 删除资源
  - `GetXxxHandler` - 获取单个资源详情
  - `ListXxxHandler` - 分页查询资源列表
  - `UpdateXxxHandler` - 更新资源

✅ **生成对应的 Logic 层**
  - 包含完整业务逻辑
  - 自动注入日志、错误处理
  - 遵循 Scene Script 架构规范

✅ **生成 Model 层**
  - 数据结构定义
  - CRUD 操作接口
  - 使用 sqlx 进行数据库操作

✅ **自动更新 ServiceContext**
  - 在 `internal/svc/svc.go` 中注册 Model
  - 添加依赖注入

✅ **自动更新路由**
  - 在 `internal/router/api/v1.go` 中注册路由
  - RESTful 风格路由规则

✅ **生成 API 文档**
  - 自动生成 `.api` 文件
  - 符合 goctl 规范

---

### 2. `scene-script gen api` - 反向生成 API 文件

**功能**：从现有的 Handler、Types、Router 代码反向生成 `.api` 文件，方便维护 API 文档。

#### 使用方式

```bash
./bin/scene-script gen api [选项]
```

#### 参数说明

| 参数 | 简写 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `--handler` | - | ❌ | `./internal/handler` | Handler 目录 |
| `--types` | - | ❌ | `./internal/types` | Types 目录 |
| `--router` | - | ❌ | `./internal/router` | Router 目录 |
| `--output` | `-o` | ❌ | `./api/desc` | 输出目录 |

#### 示例 1：使用默认路径

```bash
# 从默认路径生成 .api 文件
./bin/scene-script gen api
```

#### 示例 2：自定义路径

```bash
# 指定自定义路径
./bin/scene-script gen api \
  --handler ./internal/handler \
  --types ./internal/types \
  --router ./internal/router \
  --output ./api/desc
```

#### 使用场景

- ✅ 代码已存在，需要补充 API 文档
- ✅ 手动修改了代码，需要同步更新 API 文件
- ✅ 团队协作时，统一维护 API 规范

---

## 🎯 典型工作流

### 场景 1：新建功能模块

```bash
# 1. 编写 DDL 文件
vim ./scripts/db/sys_permission.sql

# 2. 生成全套代码
./bin/scene-script gen all --src ./scripts/db/sys_permission.sql

# 3. 启动项目验证
go run cmd/main.go

# 4. 访问生成的 API
curl http://localhost:8888/api/v1/permissions
```

### 场景 2：更新现有模块

```bash
# 1. 修改 Handler 或 Logic 代码
vim ./internal/handler/role/get_role_handler.go

# 2. 重新生成 API 文档
./bin/scene-script gen api

# 3. 提交代码
git add .
git commit -m "feat: update role module"
```

### 场景 3：批量生成多个模块

```bash
# 创建多个 DDL 文件
# scripts/db/sys_user.sql
# scripts/db/sys_role.sql
# scripts/db/sys_permission.sql

# 批量生成
for file in ./scripts/db/*.sql; do
  ./bin/scene-script gen all --src "$file"
done
```

---

## 📝 命名规范

CLI 工具生成的代码严格遵循 Scene Script 项目的命名规范：

### 表名到模块名转换

| 表名 | 模块名 | 说明 |
|------|--------|------|
| `sys_role` | `role` | 去除 `sys_` 前缀 |
| `t_product` | `product` | 去除 `t_` 前缀 |
| `tb_orders` | `order` | 去除 `tb_` 前缀和复数 `s` |
| `users` | `user` | 去除复数 `s` |

### 文件命名规范

- **Handler**: `{action}_{module}_handler.go` (例如: `create_role_handler.go`)
- **Logic**: `{action}_{module}_logic.go` (例如: `create_role_logic.go`)
- **Types**: `{module}.go` (例如: `role.go`)
- **Model**: `{module}.go` (例如: `role.go`)

### 函数命名规范

- **Handler**: `{Action}{Module}Handler()` (例如: `CreateRoleHandler()`)
- **Logic**: `New{Action}{Module}Logic()` (例如: `NewCreateRoleLogic()`)

---

## 🔧 配置与扩展

### 表前缀自动识别

CLI 默认识别以下表名前缀：
- `sys_` - 系统表
- `t_` - 通用表前缀
- `tb_` - table 缩写
- `tbl_` - table 缩写

如需自定义前缀，使用 `--prefix` 参数。

### 输出目录结构

生成的代码遵循 Scene Script 项目标准结构：

```
output/
├── internal/
│   ├── types/      # 请求/响应类型
│   ├── handler/    # HTTP 处理层
│   ├── logic/      # 业务逻辑层
│   ├── model/      # 数据模型层
│   ├── svc/        # 依赖注入
│   └── router/     # 路由配置
└── api/desc/       # API 文档
```

---

## ⚠️ 注意事项

### 1. DDL 文件格式

确保 DDL 文件符合 MySQL 语法，包含：
- 表名和字段定义
- 数据类型和长度
- 注释（`COMMENT`）用于生成文档
- 主键定义

### 2. 代码覆盖

- CLI 使用 **追加模式**，不会覆盖已存在的文件
- 手动修改的代码不会被覆盖
- `svc.go` 和 `v1.go` 会智能追加，避免重复

### 3. 依赖管理

生成代码后，确保项目依赖已安装：

```bash
go mod tidy
```

### 4. 代码格式化

生成代码后建议运行格式化：

```bash
go fmt ./...
goimports -w .
```

---

## 🛠️ 故障排查

### 问题 1：找不到 `scene-script` 命令

**解决方案**：
```bash
# 确保已编译 CLI
go build -o bin/scene-script ./cmd/cli

# 或使用绝对路径
./bin/scene-script gen all --src ./scripts/db/test.sql
```

### 问题 2：生成的代码有语法错误

**解决方案**：
```bash
# 检查 DDL 文件格式
cat ./scripts/db/test.sql

# 运行 go fmt 修复格式
go fmt ./internal/...

# 检查依赖
go mod tidy
```

### 问题 3：路由没有自动注册

**解决方案**：
- 确保 `internal/router/api/v1.go` 文件存在
- 检查文件是否有写权限
- 查看 CLI 输出的警告信息

---

## 📚 参考资料

- [Scene Script 项目架构文档](../README.md)
- [API 规范](../api/desc/)
- [数据库脚本](../scripts/db/)

---

## 📄 许可证

本工具遵循 Scene Script 项目的开源许可证。
