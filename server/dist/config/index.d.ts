export declare const APP_CONFIG: {
    name: string;
    fullName: string;
    version: string;
    description: string;
};
export declare const SERVER_CONFIG: {
    port: number;
    host: string;
    requestTimeoutMs: number;
    maxFileSizeMb: number;
};
export declare const JWT_CONFIG: {
    secret: string;
    expiresIn: string;
};
export declare const ORACLE_CONFIG: {
    user: string;
    password: string;
    host: string;
    port: number;
    service: string;
    readonly connectString: string;
    pool: {
        min: number;
        max: number;
        increment: number;
        timeout: number;
    };
};
