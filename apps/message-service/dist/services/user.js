"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = exports.UserService = void 0;
const database_1 = require("@collm/database");
class UserService {
    async createUser(email, name) {
        const user = await database_1.prisma.user.create({
            data: {
                email,
                name,
            },
        });
        return user;
    }
    async getUser(id) {
        const user = await database_1.prisma.user.findUnique({
            where: { id },
        });
        return user;
    }
    async getUserByEmail(email) {
        const user = await database_1.prisma.user.findUnique({
            where: { email },
        });
        return user;
    }
}
exports.UserService = UserService;
exports.userService = new UserService();
//# sourceMappingURL=user.js.map