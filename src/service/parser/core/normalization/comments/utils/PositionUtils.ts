import { Position } from '../types';

/**
 * 位置工具函数
 */
export class PositionUtils {
  /**
   * 计算两个位置之间的距离
   */
  static distance(pos1: Position, pos2: Position): number {
    const rowDiff = Math.abs(pos1.row - pos2.row);
    const colDiff = Math.abs(pos1.column - pos2.column);
    return Math.sqrt(rowDiff * rowDiff + colDiff * colDiff);
 }

  /**
   * 检查位置是否在范围内
   */
  static isInRange(position: Position, start: Position, end: Position): boolean {
    return (
      position.row >= start.row &&
      position.row <= end.row &&
      position.column >= start.column &&
      position.column <= end.column
    );
  }

 /**
   * 比较位置
   */
  static compare(pos1: Position, pos2: Position): number {
    if (pos1.row !== pos2.row) {
      return pos1.row - pos2.row;
    }
    return pos1.column - pos2.column;
  }
}