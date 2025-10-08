export function ProfilingStats(args: any): void;
export class ProfilingStats {
    constructor(args: any);
    rows: any;
    exec_duration_in_us: any;
    total_duration_in_us: any;
    other_stats: any;
    read(input: any): void;
    write(output: any): void;
}
export function PlanNodeBranchInfo(args: any): void;
export class PlanNodeBranchInfo {
    constructor(args: any);
    is_do_branch: any;
    condition_node_id: any;
    read(input: any): void;
    write(output: any): void;
}
export function Pair(args: any): void;
export class Pair {
    constructor(args: any);
    key: any;
    value: any;
    read(input: any): void;
    write(output: any): void;
}
export function PlanNodeDescription(args: any): void;
export class PlanNodeDescription {
    constructor(args: any);
    name: any;
    id: any;
    output_var: any;
    description: any;
    profiles: any;
    branch_info: PlanNodeBranchInfo;
    dependencies: any;
    read(input: any): void;
    write(output: any): void;
}
export function PlanDescription(args: any): void;
export class PlanDescription {
    constructor(args: any);
    plan_node_descs: any;
    node_index_map: any;
    format: any;
    optimize_time_in_us: any;
    read(input: any): void;
    write(output: any): void;
}
export function ExecutionResponse(args: any): void;
export class ExecutionResponse {
    constructor(args: any);
    error_code: any;
    latency_in_us: any;
    data: common_ttypes.DataSet;
    space_name: any;
    error_msg: any;
    plan_desc: PlanDescription;
    comment: any;
    read(input: any): void;
    write(output: any): void;
}
export function AuthResponse(args: any): void;
export class AuthResponse {
    constructor(args: any);
    error_code: any;
    error_msg: any;
    session_id: any;
    time_zone_offset_seconds: any;
    time_zone_name: any;
    read(input: any): void;
    write(output: any): void;
}
export function VerifyClientVersionResp(args: any): void;
export class VerifyClientVersionResp {
    constructor(args: any);
    error_code: any;
    error_msg: any;
    read(input: any): void;
    write(output: any): void;
}
export function VerifyClientVersionReq(args: any): void;
export class VerifyClientVersionReq {
    constructor(args: any);
    version: any;
    read(input: any): void;
    write(output: any): void;
}
import common_ttypes = require("./common_types");
