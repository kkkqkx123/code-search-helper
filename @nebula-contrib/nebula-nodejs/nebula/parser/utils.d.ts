/**
 * Created by Wu Jian Ping on - 2021/06/10.
 */
import { NebulaValue } from '../types';
declare const _default: {
    isNebulaValueTypeName: (propName: string) => boolean;
    isNebulaNListTypeName: (propName: string) => boolean;
    isNebulaVertexTypeName: (propName: string) => boolean;
    isNebulaEdgeTypeName: (propName: string) => boolean;
    isNebulaPathTypeName: (propName: string) => boolean;
    isNebulaValue: (obj: any) => boolean;
    isNebulaNMapTypeName: (propName: string) => boolean;
    isNebulaNSetTypeName: (propName: string) => boolean;
    isNebulaNDataSetTypeName: (propName: string) => boolean;
    getNebulaValueTypeName: (obj: NebulaValue) => string;
};
export default _default;
