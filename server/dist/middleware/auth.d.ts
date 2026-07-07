import type { IncomingMessage, ServerResponse } from "node:http";
import type { SessionUser } from "../models/types.js";
export interface AuthenticatedRequest extends IncomingMessage {
    currentUser?: SessionUser;
    body?: any;
}
export declare function authenticate(req: AuthenticatedRequest, res: ServerResponse): Promise<SessionUser | null>;
export declare function requireAdmin(req: AuthenticatedRequest, res: ServerResponse): boolean;
export declare function sendJson(res: ServerResponse, status: number, payload: unknown): void;
export declare function getRequestIp(req: IncomingMessage): string;
export declare function readJsonBody(req: IncomingMessage, maxBytes?: number): Promise<any>;
