type DbMode = "oracle" | "sqlite";
type OracleRuntimeConfig = {
    user: string;
    password: string;
    host: string;
    port: string | number;
    service: string;
};
export declare function connectOracleRuntime(config?: Partial<OracleRuntimeConfig>): Promise<{
    ok: boolean;
    config: {
        user: string;
        password: string;
        host: string;
        port: string;
        service: string;
    };
}>;
export declare function initDatabase(): Promise<{
    mode: "sqlite";
    ok: boolean;
} | {
    mode: "oracle";
    ok: boolean;
}>;
export declare function getDbMode(): DbMode;
export declare function query<T = any>(sql: string, params?: Record<string, any>): Promise<T[]>;
export declare function execute(sql: string, params?: Record<string, any>): Promise<number>;
export declare function transaction<T>(fn: (conn: any) => Promise<T>): Promise<T>;
export declare function pingDb(): Promise<{
    ok: boolean;
    msg: any;
    ms: number;
}>;
export declare function closeDb(): Promise<void>;
export {};
