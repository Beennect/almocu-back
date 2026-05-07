import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const redirectUri = request.query.redirect_uri;
    
    // Passamos o redirect_uri via 'state' para o Google,
    // que o devolverá exatamente igual no callback.
    return {
      state: redirectUri,
    };
  }
}
