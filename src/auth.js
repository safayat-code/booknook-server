import { createRemoteJWKSet, jwtVerify } from "jose";

const authUrl = (process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
const jwks = createRemoteJWKSet(
  new URL(process.env.JWKS_URL || `${authUrl}/api/auth/jwks`)
);

// Verifies the JWT issued by Better Auth (jwt plugin) in the Next.js app.
export async function verifyJWT(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: "Please log in to continue." });
  }
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: authUrl,
      audience: authUrl,
    });
    if (!payload.email) throw new Error("Token has no email");
    req.user = {
      id: payload.id || payload.sub,
      email: payload.email,
      name: payload.name || "Reader",
    };
    next();
  } catch (err) {
    console.error("JWT check failed:", err.message);
    res
      .status(401)
      .json({ message: "Your session is invalid or has expired. Please log in again." });
  }
}
