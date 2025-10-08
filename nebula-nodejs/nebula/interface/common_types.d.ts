export namespace NullType {
    const __NULL__: number;
    const NaN: number;
    const BAD_DATA: number;
    const BAD_TYPE: number;
    const ERR_OVERFLOW: number;
    const UNKNOWN_PROP: number;
    const DIV_BY_ZERO: number;
    const OUT_OF_RANGE: number;
}
export namespace PropertyType {
    const UNKNOWN: number;
    const BOOL: number;
    const INT64: number;
    const VID: number;
    const FLOAT: number;
    const DOUBLE: number;
    const STRING: number;
    const FIXED_STRING: number;
    const INT8: number;
    const INT16: number;
    const INT32: number;
    const TIMESTAMP: number;
    const DURATION: number;
    const DATE: number;
    const DATETIME: number;
    const TIME: number;
    const GEOGRAPHY: number;
}
export namespace ErrorCode {
    const SUCCEEDED: number;
    const E_DISCONNECTED: number;
    const E_FAIL_TO_CONNECT: number;
    const E_RPC_FAILURE: number;
    const E_LEADER_CHANGED: number;
    const E_SPACE_NOT_FOUND: number;
    const E_TAG_NOT_FOUND: number;
    const E_EDGE_NOT_FOUND: number;
    const E_INDEX_NOT_FOUND: number;
    const E_EDGE_PROP_NOT_FOUND: number;
    const E_TAG_PROP_NOT_FOUND: number;
    const E_ROLE_NOT_FOUND: number;
    const E_CONFIG_NOT_FOUND: number;
    const E_MACHINE_NOT_FOUND: number;
    const E_ZONE_NOT_FOUND: number;
    const E_LISTENER_NOT_FOUND: number;
    const E_PART_NOT_FOUND: number;
    const E_KEY_NOT_FOUND: number;
    const E_USER_NOT_FOUND: number;
    const E_STATS_NOT_FOUND: number;
    const E_SERVICE_NOT_FOUND: number;
    const E_BACKUP_FAILED: number;
    const E_BACKUP_EMPTY_TABLE: number;
    const E_BACKUP_TABLE_FAILED: number;
    const E_PARTIAL_RESULT: number;
    const E_REBUILD_INDEX_FAILED: number;
    const E_INVALID_PASSWORD: number;
    const E_FAILED_GET_ABS_PATH: number;
    const E_BAD_USERNAME_PASSWORD: number;
    const E_SESSION_INVALID: number;
    const E_SESSION_TIMEOUT: number;
    const E_SYNTAX_ERROR: number;
    const E_EXECUTION_ERROR: number;
    const E_STATEMENT_EMPTY: number;
    const E_BAD_PERMISSION: number;
    const E_SEMANTIC_ERROR: number;
    const E_TOO_MANY_CONNECTIONS: number;
    const E_PARTIAL_SUCCEEDED: number;
    const E_NO_HOSTS: number;
    const E_EXISTED: number;
    const E_INVALID_HOST: number;
    const E_UNSUPPORTED: number;
    const E_NOT_DROP: number;
    const E_BALANCER_RUNNING: number;
    const E_CONFIG_IMMUTABLE: number;
    const E_CONFLICT: number;
    const E_INVALID_PARM: number;
    const E_WRONGCLUSTER: number;
    const E_ZONE_NOT_ENOUGH: number;
    const E_ZONE_IS_EMPTY: number;
    const E_STORE_FAILURE: number;
    const E_STORE_SEGMENT_ILLEGAL: number;
    const E_BAD_BALANCE_PLAN: number;
    const E_BALANCED: number;
    const E_NO_RUNNING_BALANCE_PLAN: number;
    const E_NO_VALID_HOST: number;
    const E_CORRUPTED_BALANCE_PLAN: number;
    const E_NO_INVALID_BALANCE_PLAN: number;
    const E_IMPROPER_ROLE: number;
    const E_INVALID_PARTITION_NUM: number;
    const E_INVALID_REPLICA_FACTOR: number;
    const E_INVALID_CHARSET: number;
    const E_INVALID_COLLATE: number;
    const E_CHARSET_COLLATE_NOT_MATCH: number;
    const E_SNAPSHOT_FAILURE: number;
    const E_BLOCK_WRITE_FAILURE: number;
    const E_REBUILD_INDEX_FAILURE: number;
    const E_INDEX_WITH_TTL: number;
    const E_ADD_JOB_FAILURE: number;
    const E_STOP_JOB_FAILURE: number;
    const E_SAVE_JOB_FAILURE: number;
    const E_BALANCER_FAILURE: number;
    const E_JOB_NOT_FINISHED: number;
    const E_TASK_REPORT_OUT_DATE: number;
    const E_JOB_NOT_IN_SPACE: number;
    const E_JOB_NEED_RECOVER: number;
    const E_INVALID_JOB: number;
    const E_BACKUP_BUILDING_INDEX: number;
    const E_BACKUP_SPACE_NOT_FOUND: number;
    const E_RESTORE_FAILURE: number;
    const E_SESSION_NOT_FOUND: number;
    const E_LIST_CLUSTER_FAILURE: number;
    const E_LIST_CLUSTER_GET_ABS_PATH_FAILURE: number;
    const E_LIST_CLUSTER_NO_AGENT_FAILURE: number;
    const E_QUERY_NOT_FOUND: number;
    const E_AGENT_HB_FAILUE: number;
    const E_CONSENSUS_ERROR: number;
    const E_KEY_HAS_EXISTS: number;
    const E_DATA_TYPE_MISMATCH: number;
    const E_INVALID_FIELD_VALUE: number;
    const E_INVALID_OPERATION: number;
    const E_NOT_NULLABLE: number;
    const E_FIELD_UNSET: number;
    const E_OUT_OF_RANGE: number;
    const E_DATA_CONFLICT_ERROR: number;
    const E_WRITE_STALLED: number;
    const E_IMPROPER_DATA_TYPE: number;
    const E_INVALID_SPACEVIDLEN: number;
    const E_INVALID_FILTER: number;
    const E_INVALID_UPDATER: number;
    const E_INVALID_STORE: number;
    const E_INVALID_PEER: number;
    const E_RETRY_EXHAUSTED: number;
    const E_TRANSFER_LEADER_FAILED: number;
    const E_INVALID_STAT_TYPE: number;
    const E_INVALID_VID: number;
    const E_NO_TRANSFORMED: number;
    const E_LOAD_META_FAILED: number;
    const E_FAILED_TO_CHECKPOINT: number;
    const E_CHECKPOINT_BLOCKED: number;
    const E_FILTER_OUT: number;
    const E_INVALID_DATA: number;
    const E_MUTATE_EDGE_CONFLICT: number;
    const E_MUTATE_TAG_CONFLICT: number;
    const E_OUTDATED_LOCK: number;
    const E_INVALID_TASK_PARA: number;
    const E_USER_CANCEL: number;
    const E_TASK_EXECUTION_FAILED: number;
    const E_PLAN_IS_KILLED: number;
    const E_NO_TERM: number;
    const E_OUTDATED_TERM: number;
    const E_OUTDATED_EDGE: number;
    const E_WRITE_WRITE_CONFLICT: number;
    const E_CLIENT_SERVER_INCOMPATIBLE: number;
    const E_ID_FAILED: number;
    const E_RAFT_UNKNOWN_PART: number;
    const E_RAFT_LOG_GAP: number;
    const E_RAFT_LOG_STALE: number;
    const E_RAFT_TERM_OUT_OF_DATE: number;
    const E_RAFT_UNKNOWN_APPEND_LOG: number;
    const E_RAFT_WAITING_SNAPSHOT: number;
    const E_RAFT_SENDING_SNAPSHOT: number;
    const E_RAFT_INVALID_PEER: number;
    const E_RAFT_NOT_READY: number;
    const E_RAFT_STOPPED: number;
    const E_RAFT_BAD_ROLE: number;
    const E_RAFT_WAL_FAIL: number;
    const E_RAFT_HOST_STOPPED: number;
    const E_RAFT_TOO_MANY_REQUESTS: number;
    const E_RAFT_PERSIST_SNAPSHOT_FAILED: number;
    const E_RAFT_RPC_EXCEPTION: number;
    const E_RAFT_NO_WAL_FOUND: number;
    const E_RAFT_HOST_PAUSED: number;
    const E_RAFT_WRITE_BLOCKED: number;
    const E_RAFT_BUFFER_OVERFLOW: number;
    const E_RAFT_ATOMIC_OP_FAILED: number;
    const E_LEADER_LEASE_FAILED: number;
    const E_UNKNOWN: number;
}
export var version: string;
export function SchemaID(args: any): void;
export class SchemaID {
    constructor(args: any);
    tag_id: any;
    edge_type: any;
    read(input: any): void;
    write(output: any): void;
}
export function Date(args: any): void;
export class Date {
    constructor(args: any);
    year: any;
    month: any;
    day: any;
    read(input: any): void;
    write(output: any): void;
}
export function Time(args: any): void;
export class Time {
    constructor(args: any);
    hour: any;
    minute: any;
    sec: any;
    microsec: any;
    read(input: any): void;
    write(output: any): void;
}
export function DateTime(args: any): void;
export class DateTime {
    constructor(args: any);
    year: any;
    month: any;
    day: any;
    hour: any;
    minute: any;
    sec: any;
    microsec: any;
    read(input: any): void;
    write(output: any): void;
}
export function Value(args: any): void;
export class Value {
    constructor(args: any);
    nVal: any;
    bVal: any;
    iVal: any;
    fVal: any;
    sVal: any;
    dVal: Date;
    tVal: Time;
    dtVal: DateTime;
    vVal: Vertex;
    eVal: Edge;
    pVal: Path;
    lVal: NList;
    mVal: NMap;
    uVal: NSet;
    gVal: DataSet;
    ggVal: Geography;
    duVal: Duration;
    read(input: any): void;
    write(output: any): void;
}
export function NList(args: any): void;
export class NList {
    constructor(args: any);
    values: any;
    read(input: any): void;
    write(output: any): void;
}
export function NMap(args: any): void;
export class NMap {
    constructor(args: any);
    kvs: any;
    read(input: any): void;
    write(output: any): void;
}
export function NSet(args: any): void;
export class NSet {
    constructor(args: any);
    values: any;
    read(input: any): void;
    write(output: any): void;
}
export function Row(args: any): void;
export class Row {
    constructor(args: any);
    values: any;
    read(input: any): void;
    write(output: any): void;
}
export function DataSet(args: any): void;
export class DataSet {
    constructor(args: any);
    column_names: any;
    rows: any;
    read(input: any): void;
    write(output: any): void;
}
export function Coordinate(args: any): void;
export class Coordinate {
    constructor(args: any);
    x: any;
    y: any;
    read(input: any): void;
    write(output: any): void;
}
export function Point(args: any): void;
export class Point {
    constructor(args: any);
    coord: Coordinate;
    read(input: any): void;
    write(output: any): void;
}
export function LineString(args: any): void;
export class LineString {
    constructor(args: any);
    coordList: any;
    read(input: any): void;
    write(output: any): void;
}
export function Polygon(args: any): void;
export class Polygon {
    constructor(args: any);
    coordListList: any;
    read(input: any): void;
    write(output: any): void;
}
export function Geography(args: any): void;
export class Geography {
    constructor(args: any);
    ptVal: Point;
    lsVal: LineString;
    pgVal: Polygon;
    read(input: any): void;
    write(output: any): void;
}
export function Tag(args: any): void;
export class Tag {
    constructor(args: any);
    name: any;
    props: any;
    read(input: any): void;
    write(output: any): void;
}
export function Vertex(args: any): void;
export class Vertex {
    constructor(args: any);
    vid: Value;
    tags: any;
    read(input: any): void;
    write(output: any): void;
}
export function Edge(args: any): void;
export class Edge {
    constructor(args: any);
    src: Value;
    dst: Value;
    type: any;
    name: any;
    ranking: any;
    props: any;
    read(input: any): void;
    write(output: any): void;
}
export function Step(args: any): void;
export class Step {
    constructor(args: any);
    dst: Vertex;
    type: any;
    name: any;
    ranking: any;
    props: any;
    read(input: any): void;
    write(output: any): void;
}
export function Path(args: any): void;
export class Path {
    constructor(args: any);
    src: Vertex;
    steps: any;
    read(input: any): void;
    write(output: any): void;
}
export function HostAddr(args: any): void;
export class HostAddr {
    constructor(args: any);
    host: any;
    port: any;
    read(input: any): void;
    write(output: any): void;
}
export function KeyValue(args: any): void;
export class KeyValue {
    constructor(args: any);
    key: any;
    value: any;
    read(input: any): void;
    write(output: any): void;
}
export function Duration(args: any): void;
export class Duration {
    constructor(args: any);
    seconds: any;
    microseconds: any;
    months: any;
    read(input: any): void;
    write(output: any): void;
}
export function LogInfo(args: any): void;
export class LogInfo {
    constructor(args: any);
    log_id: any;
    term_id: any;
    read(input: any): void;
    write(output: any): void;
}
export function DirInfo(args: any): void;
export class DirInfo {
    constructor(args: any);
    root: any;
    data: any;
    read(input: any): void;
    write(output: any): void;
}
export function CheckpointInfo(args: any): void;
export class CheckpointInfo {
    constructor(args: any);
    space_id: any;
    parts: any;
    path: any;
    read(input: any): void;
    write(output: any): void;
}
export function LogEntry(args: any): void;
export class LogEntry {
    constructor(args: any);
    cluster: any;
    log_str: any;
    read(input: any): void;
    write(output: any): void;
}
