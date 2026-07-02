import crypto from "crypto";

// Shared Google Cloud OAuth2 access token helper (service account, JWT
// bearer flow) used by server-side routes that call Google Cloud REST APIs
// (Speech-to-Text, Text-to-Speech, ...). Uses only Node's built-in `crypto`
// and `fetch` so no extra dependency (e.g. googleapis/google-auth-library)
// is required.

interface ServiceAccount {
  client_email?: string;
  private_key?: string;
  token_uri?: string;
}

let cachedToken: { token: string; expiresAt: number; scope: string } | null = null;

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function hasGoogleServiceAccount() {
  return Boolean(process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON);
}

export async function getGoogleAccessToken(scope = "https://www.googleapis.com/auth/cloud-platform") {
  if (cachedToken && cachedToken.scope === scope && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const raw = process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON");

  const account = JSON.parse(raw) as ServiceAccount;
  if (!account.client_email || !account.private_key) {
    throw new Error("Invalid GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: account.client_email,
    scope,
    aud: account.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  const privateKey = account.private_key.replace(/\\n/g, "\n");
  const signature = base64Url(signer.sign(privateKey));
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch(payload.aud, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok || !data.access_token) {
    throw new Error(`Google auth failed (${response.status}): ${data.error_description || "missing access token"}`);
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(300, data.expires_in || 3600) * 1000,
    scope,
  };
  return cachedToken.token;
}
