import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { SessionService } from '../../session/session.service';
import { SessionStatus } from '../types/session.types';

@Injectable()
export class RequirementsCompleteGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ params: Record<string, string> }>();
    const id = request.params['id'];
    const session = this.sessionService.findById(id);
    if (session.status !== SessionStatus.ARCHITECTURE_APPROVED) {
      throw new ForbiddenException(
        'Architecture must be approved before generating CDK',
      );
    }
    return true;
  }
}
