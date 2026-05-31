import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';

export const RestaurantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const restaurantId = request.user?.restaurantId;

    if (
      !restaurantId ||
      typeof restaurantId !== 'string' ||
      restaurantId.trim() === ''
    ) {
      throw new BadRequestException(
        'RestaurantId é obrigatório e não pode ser nulo',
      );
    }

    return restaurantId;
  },
);
