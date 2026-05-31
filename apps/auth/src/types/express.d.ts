declare namespace Express {
  interface User {
    id: string;
    _id: string;
    username: string;
    globalRoles: string[];
    restaurantId?: string;
    role?: string;
  }
}
