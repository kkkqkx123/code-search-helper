/**
 * Created by Wu Jian Ping on - 2021/06/09.
 */
/// <reference types="node" />
import { EventEmitter } from 'events';
import { ConnectionOption, ConnectionInfo, Task } from './types';
export default class Connection extends EventEmitter {
    private connectionOption;
    private connection;
    private client;
    private sessionId;
    connectionId: string;
    isReady: boolean;
    isBusy: boolean;
    constructor(connectionOption: ConnectionOption);
    prepare(): void;
    close(): Promise<any>;
    ping(timeout: number): Promise<boolean>;
    run(task: Task): void;
    getConnectionInfo(): ConnectionInfo;
}
