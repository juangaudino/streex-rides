globalThis.__phaseBBlockedNetworkRequests = [];
globalThis.fetch = async (input) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  globalThis.__phaseBBlockedNetworkRequests.push(url);
  throw new Error(`Network is disabled in local Phase B validation: ${url}`);
};
