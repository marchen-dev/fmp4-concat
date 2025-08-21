import { MP4Parser } from '../core/MP4Parser'

export interface BoxInfo {
  size: number // box 的总大小（包含头部）
  type: string // box 类型（4字符）
  offset: number // box 在数据中的偏移量
  headerSize: number // box 头部大小（8字节或16字节）
}

/**
 * MOOF 片段信息接口
 */
export interface MoofInfo {
  moofOffset: number // moof box 在文件中的偏移量
  trafOffset: number // traf box 在 moof 内的偏移量
  tfdtOffset: number // tfdt box 在 traf 内的偏移量
  tfdtGlobalOffset: number // tfdt box 在整个文件中的绝对偏移量
  trackId: number // 轨道 ID（从 tfhd 中获取）
  baseTime: number // 原始基础时间
  tfdtBox: MP4Parser // tfdt box 对象引用
}

export interface TracKInfo {
  trackId: number
  originalBaseTime: number
  adjustedBaseTime: number
  tfdtCount: number
}
