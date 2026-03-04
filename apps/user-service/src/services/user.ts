import { prismaUser } from '@collm/database';
import { User } from '../types/domain';
import { hash, compare } from 'bcryptjs';

export interface IUserService {
  createUser(email: string, password: string, name?: string): Promise<User>;
  getUser(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByName(name: string): Promise<User | null>;
  validateUser(email: string, password: string): Promise<User | null>;
  updateUser(id: string, updates: { name?: string }): Promise<User | null>;
  getAllUsers(): Promise<User[]>;
}

export class UserService implements IUserService {
  async createUser(email: string, password: string, name?: string): Promise<User> {
    const hashedPassword = await hash(password, 10);
    const user = await prismaUser.user.create({
      data: { email, password: hashedPassword, name },
    });
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  async getUser(id: string): Promise<User | null> {
    const user = await prismaUser.user.findUnique({ where: { id } });
    if (!user) return null;
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = await prismaUser.user.findUnique({ where: { email } });
    if (!user) return null;
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  async getUserByName(name: string): Promise<User | null> {
    if (!name || !name.trim()) return null;
    const user = await prismaUser.user.findFirst({ where: { name } });
    if (!user) return null;
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await prismaUser.user.findUnique({ where: { email } });
    if (!user) return null;
    const isValid = await compare(password, user.password);
    if (!isValid) return null;
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  async updateUser(id: string, updates: { name?: string }): Promise<User | null> {
    try {
      const user = await prismaUser.user.update({
        where: { id },
        data: { ...(updates.name !== undefined && { name: updates.name }) },
      });
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    } catch {
      return null;
    }
  }

  async getAllUsers(): Promise<User[]> {
    const users = await prismaUser.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true }
    });
    return users as User[];
  }
}

export const userService = new UserService();
