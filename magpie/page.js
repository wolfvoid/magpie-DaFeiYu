(() => {
  const zh = {
    title: '蓝色大肥鱼桌宠',
    tagline: '把 Magpie 的实时状态，变成桌边的陪伴。',
    noticeTitle: '本页只是使用指南',
    notice: '桌宠是需要另外下载的独立 App。安装这个插件不会安装、下载或启动它。',
    featuresTitle: 'App 能显示什么',
    feature1: '几个进行中的请求，就亮几盏灯。',
    feature2: '订阅显示额度百分比，API 钱包显示余额，每一项都能单独开关。',
    feature3: '106 段透明动画，可拖到屏幕边缘。',
    installTitle: '安装桌面 App',
    step1: '在浏览器中打开发布页，下载与系统匹配的压缩包：Windows 10+ x64，或 macOS 12+ 的 Apple Silicon Mac。',
    step2: 'macOS：解压后把 App 拖入「应用程序」。Windows：解压后运行 BlueDaFeiYu.exe，或用 install.ps1 安装到当前用户。',
    step3: '在本机 Magpie 运行时启动 App。',
    downloadLabel: '发布页地址（选中后复制）',
    signing: 'macOS 版仅 ad-hoc 签名，未公证；Windows 版未签名。首次打开前请先核对来源。',
    privacyTitle: '它如何读取 Magpie',
    privacy: 'App 只读取本机 Magpie（127.0.0.1）：请求状态每 2 秒一次，额度卡片每 30 秒一次。请求时带上 magpie-dafeiyu，若设置了 MAGPIE_API_KEY 则带上它。本页不读取任何数据。',
    credits: '角色与动画：PC2005-cloud/dsh-pet，仅限非商用。网关：yetone/magpie。',
    unofficial: '独立社区项目，非 Magpie 官方插件。',
  };
  const english = {};
  for (const node of document.querySelectorAll('[data-i18n]')) english[node.dataset.i18n] = node.textContent;
  function apply(lang) {
    const chinese = /^zh/i.test(lang || '');
    document.documentElement.lang = chinese ? 'zh-CN' : 'en';
    for (const node of document.querySelectorAll('[data-i18n]')) {
      node.textContent = (chinese ? zh : english)[node.dataset.i18n] || english[node.dataset.i18n];
    }
  }
  const bridge = globalThis.magpie;
  apply(bridge?.theme?.lang || navigator.language);
  if (!bridge) return;
  Promise.resolve(bridge.ready).then(() => apply(bridge.theme?.lang)).catch(() => {});
  bridge.onTheme?.(theme => apply(theme?.lang));
})();
