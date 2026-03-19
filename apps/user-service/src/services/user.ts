import { prismaUser } from '@collm/database';
import { User } from '../types/domain';
import { hash, compare } from 'bcryptjs';

export interface IUserService {
  createUser(email: string, password: string, name?: string, role?: string): Promise<User>;
  getUser(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByName(name: string): Promise<User | null>;
  validateUser(email: string, password: string): Promise<User | null>;
  updateUser(id: string, updates: { name?: string }): Promise<User | null>;
  updateUserRole(id: string, role: string): Promise<User | null>;
  resetPassword(id: string, newPassword: string): Promise<User | null>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
}

export class UserService implements IUserService {
  async createUser(email: string, password: string, name?: string, role?: string): Promise<User> {
    const VALID_ROLES = ['ADMIN', 'CONTRIBUTOR', 'VIEWER'];
    const hashedPassword = await hash(password, 10);
    const user = await prismaUser.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        ...(role && VALID_ROLES.includes(role) ? { role } : {}),
      },
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

  async updateUserRole(id: string, role: string): Promise<User | null> {
    const VALID_ROLES = ['ADMIN', 'CONTRIBUTOR', 'VIEWER'];
    if (!VALID_ROLES.includes(role)) return null;
    try {
      const user = await prismaUser.user.update({
        where: { id },
        data: { role },
      });
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    } catch {
      return null;
    }
  }

  async resetPassword(id: string, newPassword: string): Promise<User | null> {
    if (!newPassword || newPassword.length < 8) return null;
    try {
      const hashedPassword = await hash(newPassword, 10);
      const user = await prismaUser.user.update({
        where: { id },
        data: { password: hashedPassword },
      });
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    } catch {
      return null;
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      await prismaUser.user.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async getAllUsers(): Promise<User[]> {
    const users = await prismaUser.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true }
    });
    return users as User[];
  }
}

export const userService = new UserService();
