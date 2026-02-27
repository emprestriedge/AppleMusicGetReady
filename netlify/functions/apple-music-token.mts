import type { Context, Config } from "@netlify/functions";
import { createPrivateKey, createSign } from "crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const teamId = Netlify.env.get("APPLE_TEAM_ID");
    const keyId = Netlify.env.get("APPLE_KEY_ID");
    const rawKey = Netlify.env.get("APPLE_PRIVATE_KEY");

    if (!teamId || !keyId || !rawKey) {
      return new Response(
        JSON.stringify({ error: "Missing Apple Music credentials", teamId: !!teamId, keyId: !!keyId, hasKey: !!rawKey }),
        { status: 500, headers: corsHeaders }
      );
    }

    const beginKey = "-----BEGIN " + "PRIVATE KEY-----";
    const endKey = "-----END " + "PRIVATE KEY-----";
    const beginEcKey = "-----BEGIN EC " + "PRIVATE KEY-----";
    const endEcKey = "-----END EC " + "PRIVATE KEY-----";

    const stripped = rawKey
      .replace(new RegExp(beginKey, 'g'), "")
      .replace(new RegExp(endKey, 'g'), "")
      .replace(new RegExp(beginEcKey, 'g'), "")
      .replace(new RegExp(endEcKey, 'g'), "")
      .replace(/\r/g, "")
      .replace(/\n/g, "")
      .replace(/\\n/g, "")
      .replace(/\s/g, "")
      .trim();

    const lines = stripped.match(/.{1,64}/g) || [];
    const pem = `${beginKey}\n${lines.join("\n")}\n${endKey}\n`;

    const privateKeyObj = createPrivateKey({ key: pem, format: "pem" });

    const header = { alg: "ES256", kid: keyId };
    const now = Math.floor(Date.now() / 1000);
    const payload = { iss: teamId, iat: now, exp: now + 15777000 };

    const encode = (obj: object) =>
      Buffer.from(JSON.stringify(obj))
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

    const signingInput = `${encode(header)}.${encode(payload)}`;

    const sign = createSign("SHA256");
    sign.update(signingInput);
    sign.end();

    const signature = sign
      .sign({ key: privateKeyObj, dsaEncoding: "ieee-p1363" })
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const token = `${signingInput}.${signature}`;

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ 
        error: err.message || "Token generation failed",
        code: err.code,
        stack: err.stack?.split("\n").slice(0, 3)
      }),
      { status: 500, headers: corsHeaders }
    );
  }
};

export const config: Config = {
  path: "/api/apple-music-token",
};
