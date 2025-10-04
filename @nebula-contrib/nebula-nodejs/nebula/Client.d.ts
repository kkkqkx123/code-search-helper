/**
 * Created by Wu Jian Ping on - 2021/06/11.
 */
/// <reference types="node" />
import { ClientOption } from './types';
import { EventEmitter } from 'events';
export default class Client extends EventEmitter {
    private clientOption;
    private connections;
    private taskQueue;
    private connectionGuarders;
    constructor(option: ClientOption);
    /**
     * Execute command
     *
     * @param command Command
     * @param returnOriginalData Return nebula orginal response?
     * @returns
     */
    execute(command: string, returnOriginalData?: boolean): Promise<any>;
    close(): Promise<any>;
}
