# PKUElective

PKUElective 是面向北京大学选课网的跨平台客户端，使用 Rust、Tauri 2、React 和 TypeScript 构建。它将课程查询、选课计划、预选、补退选、选课结果和自动抢课集中在一个界面中。

> 本项目与北京大学及其选课系统无官方关联。请遵守选课系统的使用规则，合理设置刷新频率，并自行确认每次选课操作的结果。

## 功能

- 登录选课网，并在受支持的平台上安全保存凭据、自动恢复登录状态
- 按课程分类、课程号、课程名、开课单位、星期和节次查询课程
- 查看课程详情及课程测评
- 将课程加入选课计划，或从计划中移除
- 查看可预选课程、设置意愿值、提交或取消预选
- 在补退选阶段选课、退课，并处理验证码流程
- 查看选课结果和学期课程表
- 创建独立会话的抢课 Bot，选择目标课程并自动刷新
- 管理刷新间隔、请求超时、验证码识别和通知等选项
- 检查应用更新，查看、导出或清理本地日志

## 项目结构

```text
PKUElective/
├─ crates/elective-core/  # 选课网会话、页面解析、课程操作与自动化核心
├─ src-tauri/         # Tauri 应用入口、命令层、状态与本地持久化
├─ web/               # React + TypeScript 前端
└─ tools/             # 辅助开发工具
```

核心层负责与选课网通信并解析页面；Tauri 层管理应用状态、凭据和系统能力；前端通过 Tauri 命令读取快照并发起操作。

## 开发

### 环境要求

- Rust stable
- Node.js 20+
- npm
- 当前平台所需的 [Tauri 2 系统依赖](https://v2.tauri.app/start/prerequisites/)

### 安装依赖

```bash
cd web
npm install
```

### 启动应用

在仓库根目录运行：

```bash
npx --prefix web tauri dev
```

### 构建

构建前端：

```bash
cd web
npm run build
```

构建可分发的应用安装包：

```bash
npx --prefix web tauri build
```

构建产物位于 `target/release/bundle/`。应用内更新元数据和安装包由项目的 GitHub Releases 提供。

## 验证

```bash
cd web
npm run build
cd ..
cargo check --manifest-path src-tauri/Cargo.toml
cargo test -p elective-core
```

## 使用

1. 使用学号、密码和对应身份渠道登录选课网。
2. 在“课程查询”中查找课程，并将目标课程加入“选课计划”。
3. 在“预选”中刷新列表、填写意愿值并提交；已提交的预选也可在此取消。
4. 补退选阶段可在“补选退选”中完成选课或退课，并在“选课结果”中核对最终状态与课表。
5. 如需自动抢课，在“自动化”中添加 Bot、选择目标课程，并根据需要调整刷新和验证码设置。

自动化功能会向选课系统持续发送请求。请使用合理的刷新间隔，并始终以选课网显示的最终结果为准。

## License

本项目基于 [GPL-3.0](./LICENSE.md) 许可证发布。
