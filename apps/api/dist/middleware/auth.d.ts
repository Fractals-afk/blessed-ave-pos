import { Request, Response, NextFunction } from "express";
import { UserRole } from "@blessed-ave/types";
export interface AuthPayload {
    userId: string;
    role: UserRole;
}
declare global {
    namespace Express {
        interface Request {
            user?: AuthPayload;
        }
    }
}
export declare function requireAuth(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function requireRole(...roles: UserRole[]): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=auth.d.ts.map