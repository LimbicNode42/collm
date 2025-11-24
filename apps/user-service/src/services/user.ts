import { prismaUser } from '@collm/database';
import { User } from '@collm/types';

export interface IUserService {
  createUser(email: string, name?: string): Promise<User>;
  getUser(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
}

export class UserService implements IUserService {
  async createUser(email: string, name?: string): Promise<User> {
    const user = await prismaUser.user.create({
      data: {
        email,
        name,
      },
    });
    return user;
  }

  async getUser(id: string): Promise<User | null> {
    const user = await prismaUser.user.findUnique({
      where: { id },
    });
    return user;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = await prismaUser.user.findUnique({
      where: { email },
    });
    return user;
  }
}

export const userService = new UserService();
