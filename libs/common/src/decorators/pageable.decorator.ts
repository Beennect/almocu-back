import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Pageable } from '../interfaces/pageable.interface';

export const PageableParams = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Pageable => {
    const request = ctx.switchToHttp().getRequest();
    const page = Math.max(1, parseInt(request.query.page) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(request.query.limit) || 10),
    );
    return { page, limit, skip: (page - 1) * limit };
  },
);
