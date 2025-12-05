/* tslint:disable */
/* eslint-disable */

/**
 * 計算音頻通道的峰值
 * 
 * # Arguments
 * * `channel_data` - 音頻通道數據 (Float32Array)
 * * `num_peaks` - 所需的峰值數量
 * * `precision` - 精度系數（用於縮放）
 *
 * # Returns
 * 包含峰值的 Float32Array
 */
export function compute_peaks(channel_data: Float32Array, num_peaks: number, precision: number): Float32Array;

/**
 * 計算多個通道的峰值（批量操作）
 *
 * # Arguments
 * * `channels` - 包含所有通道數據的向量（每個是 Float32Array）
 * * `num_peaks` - 所需的峰值數量
 * * `precision` - 精度系數
 *
 * # Returns
 * 嵌套的 Float32Array 向量（每個通道一個）
 */
export function compute_peaks_multichannel(channels: Array<any>, num_peaks: number, precision: number): Array<any>;

/**
 * 計算單個通道的優化峰值（使用步長來減少內存訪問）
 *
 * # Arguments
 * * `channel_data` - 音頻通道數據
 * * `num_peaks` - 所需的峰值數量
 * * `precision` - 精度系數
 *
 * # Returns
 * 包含峰值的 Float32Array
 */
export function compute_peaks_optimized(channel_data: Float32Array, num_peaks: number, precision: number): Float32Array;

/**
 * 歸一化音頻數據
 *
 * # Arguments
 * * `channel_data` - 音頻通道數據
 *
 * # Returns
 * 歸一化後的 Float32Array
 */
export function normalize_buffer(channel_data: Float32Array): Float32Array;

/**
 * 歸一化多個通道
 *
 * # Arguments
 * * `channels` - 包含所有通道數據的向量
 *
 * # Returns
 * 包含歸一化通道的向量
 */
export function normalize_buffer_multichannel(channels: Array<any>): Array<any>;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly compute_peaks: (a: any, b: number, c: number) => any;
  readonly compute_peaks_multichannel: (a: any, b: number, c: number) => any;
  readonly compute_peaks_optimized: (a: any, b: number, c: number) => any;
  readonly normalize_buffer: (a: any) => any;
  readonly normalize_buffer_multichannel: (a: any) => any;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
