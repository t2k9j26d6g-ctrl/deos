(function initDeosRemoteConfig(global) {
  const defaults = {
    enabled: false,
    provider: "supabase",
    supabaseUrl: "",
    supabasePublishableKey: "",
    environment: "test",
    authRedirectUrl: "",
    debug: false
  };

  const existing = global.DEOS_REMOTE_CONFIG && typeof global.DEOS_REMOTE_CONFIG === "object"
    ? global.DEOS_REMOTE_CONFIG
    : {};

  global.DEOS_REMOTE_CONFIG = Object.freeze({
    ...defaults,
    ...existing
  });
})(window);