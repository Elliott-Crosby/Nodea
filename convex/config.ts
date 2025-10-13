const normalize = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const stripTrailingSlash = (value: string): string => {
  return value.endsWith("/") ? value.replace(/\/+$/, "") : value;
};

const DEFAULT_SITE_URL = "http://localhost:5173";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com";

const rawSiteUrl =
  normalize(process.env.CONVEX_SITE_URL) ??
  normalize(process.env.SITE_URL) ??
  DEFAULT_SITE_URL;

const siteUrl = stripTrailingSlash(rawSiteUrl);

const allowedOrigins =
  normalize(process.env.ALLOWED_ORIGINS) ??
  siteUrl ??
  DEFAULT_SITE_URL;

const rawOpenAiBase =
  normalize(process.env.CONVEX_OPENAI_BASE_URL) ??
  normalize(process.env.OPENAI_BASE_URL) ??
  DEFAULT_OPENAI_BASE_URL;

const openAiBaseUrl = stripTrailingSlash(rawOpenAiBase);
const openAiChatCompletionsUrl = `${openAiBaseUrl}/v1/chat/completions`;

export const serverEnv = {
  siteUrl,
  allowedOrigins,
  openAiBaseUrl,
  openAiChatCompletionsUrl,
};

export const buildShareUrl = (token: string) => `${serverEnv.siteUrl}/share/${token}`;
