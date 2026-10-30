<div align="center">

# 🐋 magpie-DaFeiYu

### 让 AI 的忙碌，变成桌边的一条鱼。

**Mac 专用 · 接入 Magpie · 看请求、看额度、会放烟花**

![macOS Apple Silicon](https://img.shields.io/badge/macOS-Apple%20Silicon-426B9A)
![Magpie](https://img.shields.io/badge/Magpie-local%20integration-C7475C)
![Version](https://img.shields.io/badge/version-0.1.1-4C78A8)
![Code MIT](https://img.shields.io/badge/code-MIT-538476)
![Artwork noncommercial](https://img.shields.io/badge/artwork-noncommercial-D19A35)

<img src="docs/images/desktop.png" alt="magpie-DaFeiYu：蓝色大肥鱼、请求灯泡与多账号额度" width="520">

*演示图为合成账号与额度。角色动画来自 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)。*

[下载 App](https://github.com/wolfvoid/magpie-DaFeiYu/releases/latest) · [功能](#为什么是它) · [安装](#安装) · [致谢](#致谢与许可)

</div>

一只住在 Mac 桌边的蓝色大肥鱼。请求进来时亮起小灯泡，额度快用完时直接摆在眼前，空闲时吃饭、施法、放烟花——**让 Magpie 的状态不用再开面板确认。**

不需要 DSH，也不绑定 Codex。只要请求经过本机 Magpie，桌宠就能跟着忙起来。

## 为什么是它

| 抓点 | 实际体验 |
| --- | --- |
| 💡 **几个请求，就亮几盏** | 进行中和排队的请求各有灯泡；没有请求时自动熄灭，断连变淡，不冒充“任务完成”。 |
| 💰 **两种额度，两套读法** | 订阅账号显示剩余百分比；DeepSeek 等 API 钱包直接显示剩余金额，不再假装有百分比。 |
| 👥 **多账号一眼扫完** | 账号横向排列，正在处理请求的账号标珊瑚红；账号多时可滚动，不挤占桌宠主体。 |
| 🎬 **106 段动作，不只会待机** | 吃饭、玩耍、魔术、施法、烟花都有；避开最近 15 个动作，降低重复感。 |
| 🖐 **真的能放在桌边** | 可拖动、甩动弹跳、贴边摆放；允许动作越出屏幕，不再被透明窗口卡在中间。 |
| 🔒 **只看本机，不碰聊天** | 只读 Magpie 的本地状态；不调用模型、不读 Codex 数据库、不保存账号邮箱或提示词。 |

底栏只有三件事：**换动作、暂停/继续、更多**。默认不开机启动，也不需要登录任何第三方账号。

## 安装

### 直接用 App（推荐）

1. 打开 [Releases](https://github.com/wolfvoid/magpie-DaFeiYu/releases/latest)，下载最新的 `magpie-DaFeiYu-*-macOS-arm64.zip`。
2. 解压后把「蓝色大肥鱼.app」拖进「应用程序」，再从菜单栏打开。
3. 启动本机 [Magpie](https://github.com/yetone/magpie)，请求灯泡和额度会自动接入。

**要求：Apple Silicon Mac（M 系列），macOS 12+。** 不支持 Intel Mac、Windows 或 Linux。

App 使用本地 ad-hoc 签名，没有 Apple Developer ID 签名或公证。若 macOS 拦截，请先核对下载来源，再到「系统设置 → 隐私与安全性」选择「仍要打开」；不要关闭 Gatekeeper。

### Magpie 页面

仓库带有 `magpie-plugin` Topic，并提供 Magpie 可识别的页面插件：

```bash
magpie plugin add github:wolfvoid/magpie-DaFeiYu
```

安装后，Magpie 侧边栏会出现「蓝色大肥鱼」使用页。**页面不会自动安装或启动桌面 App**，桌面悬浮窗仍需下载 ZIP。

### 从源码

需要 Node.js 24+、npm、Python 3 和 Git：

```bash
git clone https://github.com/wolfvoid/magpie-DaFeiYu.git
cd magpie-DaFeiYu
npm ci --ignore-scripts
node node_modules/electron/install.js
python3 scripts/download_assets.py
node scripts/prepare.mjs
npm run build
npm test
npm start
```

动画从上游固定提交下载并逐文件校验，不重复塞进 Git 仓库。首次运行需要联网下载依赖和约 52 MB 素材。

## 它能知道什么

**它显示 Magpie 能看见的请求，不是完整任务追踪器。**

- 能看见：请求数、排队状态、当前实际使用的账号、Magpie 已缓存的额度。
- 看不见：改了哪个文件、执行了哪条命令、是否等你审批，以及整个任务何时完成。
- 不经过本机 Magpie 的请求不会出现；模型响应结束也不会被误判为任务完成。
- 未知或过期额度显示 `—%` 或「余额待刷新」，不会凭空推算。

本地接口只连接 `127.0.0.1:3425`（支持自定义端口）：并发状态每 2 秒读取，额度和今日统计每 30 秒刷新。账号归属只在内存中换算为每次启动重新生成的代号。

## 致谢与许可

| 来源 | 贡献 |
| --- | --- |
| [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) | 大肥鱼形象、106 段动画、动作配置与初始选择器；本项目最重要的视觉来源。 |
| [yetone/magpie](https://github.com/yetone/magpie) | 本地模型网关，以及请求、额度、路由接口与集成文档。 |
| [yifanlu0227/DaFeiYu-codex-pet](https://github.com/yifanlu0227/DaFeiYu-codex-pet) | 大肥鱼桌宠与安装思路的最初参考；本项目没有使用其 spritesheet。 |
| [bianbian-666/Codex-dafeiyu](https://github.com/bianbian-666/Codex-dafeiyu) | 早期 Codex 状态联动方案参考；当前版本已改为 Magpie。 |

本仓库新增代码采用 [MIT](LICENSE)；上游选择器保留其 [MIT 许可](licenses/dsh-pet-MIT.txt)。

**角色动画、提示词、源视频等素材不属于 MIT，禁止商用。** 二创展示、介绍和分发必须保留 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 来源；完整说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

这是一个独立社区项目，与 DeepSeek、OpenAI、Magpie 无官方隶属关系。

---

**magpie-DaFeiYu** is a macOS desktop pet for Magpie: 106 animations, live request lights, subscription quotas, API wallet balances, and a local-only privacy model. Apple Silicon, macOS 12+.
