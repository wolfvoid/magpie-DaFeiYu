const BUNDLED = new Set(['cursor', 'deepseek-color', 'codex-color', 'volcengine-color',
  'claude-color', 'gemini-color', 'qwen-color', 'openai', 'grok', 'zhipu-color']);

export function providerIconSource(icon) {
  return BUNDLED.has(icon)
    ? new URL(`../assets/provider-icons/${icon}.svg`, import.meta.url).href
    : null;
}

export function providerInitial(entry) {
  return String(entry?.name || entry?.provider || '?').trim().charAt(0).toUpperCase() || '?';
}
