import type { Context, Config } from "@netlify/functions";
import { createSign } from "crypto";

export default async (req: Request, context: Context) => {
  try {
    const teamId = Netlify.env.get("APPLE_TEAM_ID");
    const keyId = Netlify.env.get("APPLE_KEY_ID");
    const privateKey = Netlify.env.get("APPLE_PRIVATE_KEY");

    if (!teamId || !keyId || !privateKey) {
      return new Response(
        JSON.stringify({ error: "Missing Apple Music credentials" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const header = { alg: "ES256", kid: keyId };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: teamId,
      iat: now,
      exp: now + 15777000,
    };

    const encode = (obj: object) =>
      Buffer.from(JSON.stringify(obj))
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

    const headerEncoded = encode(header);
    const payloadEncoded = encode(payload);
    const signingInput = `${headerEncoded}.${payloadEncoded}`;

    const sign = createSign("SHA256");
    sign.update(signingInput);
    sign.end();

    const normalizedKey = privateKey.replace(/\\n/g, "\n");

    const signature = sign
      .sign({ key: normalizedKey, dsaEncoding: "ieee-p1363" })
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
      JSON.stringify({ error: err.message || "Token generation failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config: Config = {
  path: "/api/apple-music-token",
};
