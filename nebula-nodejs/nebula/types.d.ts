/**
 * Created by Wu Jian Ping on - 2021/06/09.
 */
/// <reference types="node" />
import { AsyncResource } from 'async_hooks';
interface ConnectionOption {
    host: string;
    port: number;
    userName: string;
    password: string;
    space: string;
}
interface Endpoint {
    host: string;
    port: number;
}
interface ClientOption {
    servers: string[] | Endpoint[];
    userName: string;
    password: string;
    space: string;
    poolSize?: number;
    bufferSize?: number;
    executeTimeout?: number;
    pingInterval?: number;
}
interface ConnectionInfo {
    connectionId: string;
    host: string;
    port: number;
    space: string;
    isReady: boolean;
}
interface NebulaValue {
    nVal: any;
    bVal: any;
    iVal: any;
    fVal: any;
    sVal: any;
    dVal: any;
    tVal: any;
    dtVal: any;
    vVal: any;
    eVal: any;
    pVal: any;
    lVal: {
        values: any[];
    };
    mVal: any;
    uVal: any;
    gVal: any;
}
interface Metrics {
    execute: number;
    traverse: number;
}
interface Task {
    command: string;
    returnOriginalData: boolean;
    resolve: (value: any) => void;
    reject: (err: any) => void;
    asyncResource?: AsyncResource;
    executingTimer?: NodeJS.Timeout;
}
export { Endpoint, ClientOption, ConnectionOption, NebulaValue, Metrics, Task, ConnectionInfo };
