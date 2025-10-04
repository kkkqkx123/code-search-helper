/**
 * Created by Wu Jian Ping on - 2021/06/10.
 */
declare class NebulaError extends Error {
    code: string;
    errno: number;
    constructor(errno: number, message: string);
}
export default NebulaError;
