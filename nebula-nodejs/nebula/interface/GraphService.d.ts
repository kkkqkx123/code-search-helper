declare function GraphServiceClient(output: any, pClass: any): void;
declare class GraphServiceClient {
    constructor(output: any, pClass: any);
    output: any;
    pClass: any;
    _seqid: number;
    _reqs: {};
    seqid(): number;
    new_seqid(): number;
    authenticate(username: any, password: any, callback: any): any;
    send_authenticate(username: any, password: any): any;
    recv_authenticate(input: any, mtype: any, rseqid: any): any;
    signout(sessionId: any, callback: any): any;
    send_signout(sessionId: any): void;
    execute(sessionId: any, stmt: any, callback: any): any;
    send_execute(sessionId: any, stmt: any): any;
    recv_execute(input: any, mtype: any, rseqid: any): any;
    executeWithParameter(sessionId: any, stmt: any, parameterMap: any, callback: any): any;
    send_executeWithParameter(sessionId: any, stmt: any, parameterMap: any): any;
    recv_executeWithParameter(input: any, mtype: any, rseqid: any): any;
    executeJson(sessionId: any, stmt: any, callback: any): any;
    send_executeJson(sessionId: any, stmt: any): any;
    recv_executeJson(input: any, mtype: any, rseqid: any): any;
    executeJsonWithParameter(sessionId: any, stmt: any, parameterMap: any, callback: any): any;
    send_executeJsonWithParameter(sessionId: any, stmt: any, parameterMap: any): any;
    recv_executeJsonWithParameter(input: any, mtype: any, rseqid: any): any;
    verifyClientVersion(req: any, callback: any): any;
    send_verifyClientVersion(req: any): any;
    recv_verifyClientVersion(input: any, mtype: any, rseqid: any): any;
}
declare function GraphServiceProcessor(handler: any): void;
declare class GraphServiceProcessor {
    constructor(handler: any);
    _handler: any;
    process(input: any, output: any): any;
    process_authenticate(seqid: any, input: any, output: any): void;
    process_signout(seqid: any, input: any, output: any): void;
    process_execute(seqid: any, input: any, output: any): void;
    process_executeWithParameter(seqid: any, input: any, output: any): void;
    process_executeJson(seqid: any, input: any, output: any): void;
    process_executeJsonWithParameter(seqid: any, input: any, output: any): void;
    process_verifyClientVersion(seqid: any, input: any, output: any): void;
}
export { GraphServiceClient as Client, GraphServiceProcessor as Processor };
