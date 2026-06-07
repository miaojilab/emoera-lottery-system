# Emoera Lottery System

Emoera Lottery System（E时代抽奖）是一个基于 Next.js 的多人抽奖系统，适合年会、活动报名、现场互动和小型运营活动。管理员可以创建抽奖房间、生成报名二维码、查看参与者列表并执行抽奖；参与者可以通过链接或二维码进入报名页。

目标开源仓库：[github.com/miaojilab/emoera-lottery-system](https://github.com/miaojilab/emoera-lottery-system)

## 功能特性

- 房间制抽奖：每个房间拥有独立参与者、中奖记录和历史数据。
- 二维码报名：自动生成参与链接和二维码，方便现场扫码报名。
- 手动录入：支持管理员单个添加用户，也支持批量生成序号用户。
- 防重复中奖：可选择是否排除已经中奖的参与者。
- 抽奖历史：记录房间创建、抽奖轮次、奖项名称和中奖者信息。
- 移动端适配：报名页针对手机端做了导航和表单体验优化。

## 技术栈

- [Next.js](https://nextjs.org/) 15
- [React](https://react.dev/) 18
- [Ant Design](https://ant.design/) 5
- [MySQL](https://www.mysql.com/)
- [mysql2](https://github.com/sidorares/node-mysql2)
- [qrcode](https://github.com/soldair/node-qrcode)

## 本地开发

### 环境要求

- Node.js 18.18 或更高版本
- npm
- MySQL 8.x 或兼容版本

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制示例文件并按实际情况修改：

```bash
cp .env.example .env.local
```

必填变量：

- `MYSQL_HOST`：MySQL 主机地址
- `MYSQL_PORT`：MySQL 端口，默认 `3306`
- `MYSQL_USER`：MySQL 用户名
- `MYSQL_PASSWORD`：MySQL 密码
- `MYSQL_DATABASE`：MySQL 数据库名
- `MYSQL_SSL`：是否启用 SSL，取值 `true` 或 `false`
- `MYSQL_SSL_REJECT_UNAUTHORIZED`：启用 SSL 时是否校验证书

> 不要提交 `.env.local`、`.env` 或任何包含真实密码的环境文件。

### 准备数据库

先创建一个空数据库，例如：

```sql
CREATE DATABASE lottery CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

应用启动后会自动创建以下数据表：

- `rooms`：抽奖房间
- `users`：房间参与者
- `lottery_winners`：中奖记录

### 启动开发服务

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 常用脚本

```bash
npm run dev      # 启动本地开发服务
npm run build    # 构建生产版本
npm run start    # 启动生产服务
npm run lint     # 运行 lint
```

## 项目结构

```text
src/
  app/
    api/          # API 路由
    history/      # 历史记录页
    register/     # 参与者报名页
    room/         # 抽奖房间页
  components/     # 复用组件
  lib/            # 数据库连接与初始化
  types/          # 类型声明
```

## 部署

项目支持标准 Next.js 部署流程。部署前请在目标环境中配置所有 `MYSQL_*` 环境变量，并确认应用服务器可以访问 MySQL。

如果使用 Docker、Vercel、服务器 PM2 或其他平台部署，请确保：

- 生产环境不要使用开发数据库账号。
- 数据库账号只授予当前应用需要的库级权限。
- 不要把真实环境变量写入镜像、代码或构建日志。
- 对公网部署建议增加访问控制、限流和备份策略。

## 安全说明

开源发布前请完成以下检查：

- 轮换曾经出现在代码或 Git 历史中的数据库密码、账号和访问地址。
- 确认 Git 历史不包含 `.env`、证书、私钥、Token、云服务密钥等敏感信息。
- 如需保留第三方统计脚本，请确认统计 ID 可以公开；否则建议改为环境变量或移除。
- 为生产环境添加认证、授权和操作审计，尤其是删除用户、重置数据库、执行抽奖等管理操作。

## License

本项目基于 [Apache License 2.0](./LICENSE) 开源。
