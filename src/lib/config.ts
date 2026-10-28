export const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  // Strong model for conversation and evaluation, fast model for simple tasks.
  models: {
    smart: process.env.MIRRAH_MODEL_SMART ?? "claude-sonnet-5-5",
    fast: process.env.MIRRAH_MODEL_FAST ?? "claude-haiku-5-5",
  },
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  opsPassword: process.env.OPS_PASSWORD ?? "",
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  maxRounds: 3,
  replyWaitHours: 48,
};

export const aiMode = () => (config.anthropicApiKey ? "live" : "mock");
export const dbMode = () =>
  config.supabaseUrl && config.supabaseServiceKey ? "supabase" : "demo";
