# Contributing

欢迎改进 magpie-DaFeiYu。请保持 Magpie 接入只读、可断连降级，不发送模型请求。

本项目是单一共享代码库，同时服务 Windows 10+ x64 与 Apple Silicon Mac（macOS 12+）。主界面、动画、请求灯泡、额度面板与 Magpie 本地读取共用同一份代码；平台差异只允许出现在很窄的范围（安装脚本、数据目录、托盘/菜单外观、打包与签名）。不要创建平台分支或分叉，也不要在共享逻辑里散落平台判断。

## 提交问题

请提供操作系统与版本（Windows 10+ x64，或 macOS 版本与芯片架构）、Magpie 版本、复现步骤和预期效果。截图请遮盖账号信息；不要上传设置文件、密钥、聊天内容、原始路由响应或整个 `qa/` 目录。

## 本地开发

Windows、macOS 或 Linux 命令行都可以开发。Node.js 24+ 与全部 npm 命令两个平台一致；只有 Python 命令按平台区分：

- Windows：`python scripts/download_assets.py`
- macOS / Linux：`python3 scripts/download_assets.py`

其余步骤两边完全相同：

```bash
npm ci --ignore-scripts
node node_modules/electron/install.js
npm run build
npm test
npm start
```

## 提交代码

1. Fork 仓库，创建功能分支。
2. 按 README 下载依赖与素材。
3. 修改共享代码；为账号匹配、调度、边界等行为提供有意义的测试。
4. 运行 `npm test` 与 `npm run check`；界面或安装脚本的改动，在你手头的操作系统上实际验证，并在 PR 里注明验证过的系统。
5. CI 在 Windows、macOS、Linux 上运行单元测试，并在 macOS 打包 Apple Silicon、Windows 打包 x64；打包产物以 CI 为准。不要声称在没实际运行过的系统上做过界面验证。
6. PR 写明问题、改动与验证结果；不要提交 `node_modules/`、下载的视频、构建产物或私人运行报告。

安装脚本约定：Windows 产物为 `BlueDaFeiYu.exe` + `install.ps1`，按用户安装到 `%LocalAppData%\Programs\magpie-DaFeiYu`，只创建开始菜单快捷方式，不需要管理员权限、不设开机启动；macOS 产物为 Apple Silicon arm64 的「蓝色大肥鱼.app」，仅 ad-hoc 签名。

发布仍限定在 `0.1.x`。更新 `package.json` 和 `package-lock.json` 版本、添加对应的 `docs/releases/v0.1.x.md` 后推送到 `main`，发布流程会检查版本尚未发布，在两种系统完成构建后创建标签和 Release。也支持推送匹配版本的标签或手动运行工作流；已有标签或版本不会被覆盖。

桌面冒烟测试用 `npm start -- --smoke-test` 触发；截图与 `smoke.json` 写入 `DAFEIYU_QA_DIR` 指定的目录，未设置时写入应用 userData 的 `qa/`，不写入应用安装目录，也不要提交进仓库。

素材来自 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)，禁止商用。若修改或添加视觉素材，请说明来源与授权，并保留作者致谢。
