import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    const issuer = configService.get<string>('ZITADEL_ISSUER') || 'http://localhost:8080';
    const jwksUri = configService.get<string>('ZITADEL_JWKS_URI') || `${issuer}/oauth/v2/keys`;
    const audience = configService.get<string>('ZITADEL_CLIENT_ID');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      audience: audience,
      issuer: issuer,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: jwksUri,
      }),
    });
  }

  async validate(payload: any) {
    return { 
      userId: payload.sub, 
      username: payload.preferred_username, 
      email: payload.email,
      roles: payload['urn:zitadel:iam:org:project:roles'] || []
    };
  }
}
