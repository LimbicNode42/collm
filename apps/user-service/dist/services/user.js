"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = exports.UserService = void 0;
const database_1 = require("@collm/database");
const bcryptjs_1 = require("bcryptjs");
class UserService {
    async createUser(email, password, name) {
        const hashedPassword = await (0, bcryptjs_1.hash)(password, 10);
        const user = await database_1.prismaUser.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
            },
        });
        const { password: _ } = user, userWithoutPassword = __rest(user, ["password"]);
        return userWithoutPassword;
    }
    async getUser(id) {
        const user = await database_1.prismaUser.user.findUnique({
            where: { id },
        });
        if (!user)
            return null;
        const { password: _ } = user, userWithoutPassword = __rest(user, ["password"]);
        return userWithoutPassword;
    }
    async getUserByEmail(email) {
        const user = await database_1.prismaUser.user.findUnique({
            where: { email },
        });
        if (!user)
            return null;
        const { password: _ } = user, userWithoutPassword = __rest(user, ["password"]);
        return userWithoutPassword;
    }
    async validateUser(email, password) {
        const user = await database_1.prismaUser.user.findUnique({
            where: { email },
        });
        if (!user)
            return null;
        const isValid = await (0, bcryptjs_1.compare)(password, user.password);
        if (!isValid)
            return null;
        const { password: _ } = user, userWithoutPassword = __rest(user, ["password"]);
        return userWithoutPassword;
    }
}
exports.UserService = UserService;
exports.userService = new UserService();
//# sourceMappingURL=user.js.map