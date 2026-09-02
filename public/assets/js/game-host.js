(function () {
  'use strict';
  const registry = new Map();
  const loadedStyles = new Set();
  const loadedScripts = new Map();
  let mounted = null;

  function normalizePath(value) {
    const path = String(value || '').replace(/\\/g, '/').replace(/\/+/g, '/');
    if (!path || path.includes('..')) throw new Error('Некорректный путь игры.');
    return '/' + path.replace(/^\/+/, '').replace(/\/?$/, '/');
  }
  function loadStyle(path, version) {
    if (loadedStyles.has(path)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = path + 'style.css?v=' + encodeURIComponent(String(version || '1'));
    document.head.appendChild(link); loadedStyles.add(path);
  }
  async function loadEntry(path, version) {
    const url = path + 'index.js?v=' + encodeURIComponent(String(version || '1'));
    if (!loadedScripts.has(url)) {
      loadedScripts.set(url, import(url));
    }
    return loadedScripts.get(url);
  }

  window.NAVA_GAME = window.NAVA_GAME || {
    register(definition) {
      if (!definition || typeof definition !== 'object' || !definition.slug || typeof definition.mount !== 'function') {
        throw new Error('NAVA_GAME.register ожидает slug и mount(container, context).');
      }
      registry.set(String(definition.slug), definition);
    }
  };

  window.NAVA_GAME_HOST = {
    async mount(container, context) {
      if (!container) throw new Error('Контейнер игры не найден.');
      if (!context || !context.slug || !context.path) throw new Error('Контекст игры неполный.');
      await this.destroy();
      const path = normalizePath(context.path);
      loadStyle(path, context.version);
      if (!registry.has(String(context.slug)) && !(window.Game && typeof window.Game.init === 'function')) {
        try { await loadEntry(path, context.version); }
        catch (error) { throw new Error('Не удалось загрузить входной файл игры (' + path + 'index.js): ' + (error?.message || error)); }
      }
      const definition = registry.get(String(context.slug));
      if (definition) { mounted = await definition.mount(container, context); return mounted; }
      if (window.Game && typeof window.Game.init === 'function') {
        await window.Game.init(container, context.user || context);
        mounted = { destroy: () => window.Game?.destroy?.() };
        return mounted;
      }
      throw new Error('Игра не зарегистрировала контейнерный модуль.');
    },
    async destroy() { try { await mounted?.destroy?.(); } finally { mounted = null; } }
  };
})();
