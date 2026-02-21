import type { Context, Config } from "@netlify/functions";
import { createPrivateKey, createSign } from "crypto";

export default async (req: Request, context: Context) => {
  try {
    const teamId = Netlify.env.get("APPLE_TEAM_ID");
    const keyId = Netlify.env.get("APPLE_KEY_ID");
    const rawKey = Netlify.env.get("APPLE_PRIVATE_KEY");

    if (!teamId || !keyId || !rawKey) {
      return new Response(
        JSON.stringify({ error: "Missing Apple Music credentials", teamId: !!teamId, keyId: !!keyId, hasKey: !!rawKey }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const stripped = rawKey
      .replace(/-----BEGIN PRIVATE KEY-----/g, "")
      .replace(/-----END PRIVATE KEY-----/g, "")
      .replace(/-----BEGIN EC PRIVATE KEY-----/g, "")
      .replace(/-----END EC PRIVATE KEY-----/g, "")
      .replace(/\r/g, "")
      .replace(/\n/g, "")
      .replace(/\\n/g, "")
      .replace(/\s/g, "")
      .trim();

    const lines = stripped.match(/.{1,64}/g) || [];
    const pem = `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----\n`;

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
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ 
        error: err.message || "Token generation failed",
        code: err.code,
        stack: err.stack?.split("\n").slice(0, 3)
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config: Config = {
  path: "/api/apple-music-token",
};
