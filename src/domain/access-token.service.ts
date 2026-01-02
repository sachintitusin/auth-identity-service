import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_TTL_SECONDS = 60 * 15; // 15 minutes

type AccessTokenClaims = {
  sub: string;        // identity subject
  sid: string;        // session identifier
};

export function issueAccessToken(params: {
  subject: string;
  sessionId: string;
}) {
  const claims: AccessTokenClaims = {
    sub: params.subject,
    sid: params.sessionId,
  };

  const token = jwt.sign(
    claims,
    process.env.ACCESS_TOKEN_SECRET!,
    {
      algorithm: 'HS256',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      audience: 'user',
      issuer: 'auth-service',
    }
  );

  return {
    accessToken: token,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };
}
