import type { ServerResponse } from "node:http";
import type { AuthenticatedRequest } from "../middleware/auth.js";
export declare function handleGetInvoices(req: AuthenticatedRequest, res: ServerResponse, url: URL): Promise<void>;
export declare function handleGetInvoice(req: AuthenticatedRequest, res: ServerResponse, invId: string): Promise<void>;
export declare function handleCreateInvoice(req: AuthenticatedRequest, res: ServerResponse): Promise<void>;
export declare function handleUpdateInvoice(req: AuthenticatedRequest, res: ServerResponse, invId: string): Promise<void>;
export declare function handleDeleteInvoice(req: AuthenticatedRequest, res: ServerResponse, invId: string): Promise<void>;
export declare function handleInvoiceStats(req: AuthenticatedRequest, res: ServerResponse): Promise<void>;
