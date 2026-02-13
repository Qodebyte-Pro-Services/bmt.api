async function fetchHelper(...args) {
  if (!globalThis._fetchModule) {
    const fetchModule = await import('node-fetch');
    globalThis._fetchModule = fetchModule.default;
  }
  return globalThis._fetchModule(...args);
}

module.exports = fetchHelper;