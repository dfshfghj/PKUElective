# PKUElective

PKUElective 是面向北京大学选课网的跨平台客户端，使用 Tauri 构建。包含课程查询、选课计划、预选、补退选、选课结果等功能。

> 本项目与北京大学及其选课系统无官方关联。请遵守选课系统的使用规则，合理设置刷新频率，并自行确认每次选课操作的结果。

# 注意
在Mac上安装可能出现“文件已损坏”而无法安装，这是因为缺少证书，
图形界面方式：

把 App 拖到 Applications
在 Finder 里对 App 右键
选择 打开
弹窗里再点一次 打开
如果还是被拦，走系统设置：

打开 系统设置
进入 隐私与安全性
在底部找到关于 App 被拦截的提示
点 仍要打开
也可以用命令行去掉隔离标记：

xattr -dr com.apple.quarantine path-to-app

## 项目结构

```text
PKUElective/
├─ crates/elective-core/
├─ src-tauri/
├─ web/
└─ tools/             # 验证码训练
```

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

## 测试

```bash
cd web
npm run build
cd ..
cargo check --manifest-path src-tauri/Cargo.toml
cargo test -p elective-core
```

## License

本项目基于 [GPL-3.0](./LICENSE.md) 许可证发布。
