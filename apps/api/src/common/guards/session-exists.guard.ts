import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { SessionService } from '../../session/session.service';

@Injectable()
export class SessionExistsGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ params: Record<string, string> }>();
    const id = request.params['id'];
    this.sessionService.findById(id); //throws NotFoundException (→ 404) if the session doesn't exist
    return true;
  }
}
