import { prismaUser } from '@collm/database';
import { User } from '../types/domain';
import { hash, compare } from 'bcryptjs';

export interface IUserService {
  createUser(email: string, password: string, name?: string): Promise<User>;
  getUser(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  validateUser(email: string, password: string): Promise<User | null>;
}

export class UserService implements IUserService {
  async createUser(email: string, password: string, name?: string): Promise<User> {
    const hashedPassword = await hash(password, 10);
    const user = await prismaUser.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getUser(id: string): Promise<User | null> {
    const user = await prismaUser.user.findUnique({
      where: { id },
    });
    
    if (!user) return null;
    
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = await prismaUser.user.findUnique({
      where: { email },
    });
    
    if (!user) return null;

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await prismaUser.user.findUnique({
      where: { email },
    });

    if (!user) return null;

    const isValid = await compare(password, user.password);
    if (!isValid) return null;

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}

export const userService = new UserService();
