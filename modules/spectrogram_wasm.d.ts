/* tslint:disable */
/* eslint-disable */

export class SpectrogramEngine {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * 獲取 FFT 大小
   */
  get_fft_size(): number;
  /**
   * 獲取頻率箱數
   */
  get_freq_bins(): number;
  /**
   * 獲取窗函數值（用於調試/驗證）
   */
  get_window_values(): Float32Array;
  /**
   * 計算頻譜圖
   *
   * # Arguments
   * * `audio_data` - 音頻數據 (Float32Array)
   * * `noverlap` - 重疊樣本數
   * * `gain_db` - 增益 (dB)
   * * `range_db` - 範圍 (dB)
   *
   * # Returns
   * 平面的 Uint8Array（頻率箱 * 時間步）
   */
  compute_spectrogram(audio_data: Float32Array, noverlap: number, gain_db: number, range_db: number): Uint8Array;
  /**
   * 創建新的 SpectrogramEngine 實例
   * 
   * # Arguments
   * * `fft_size` - FFT 大小（必須是 2 的冪）
   * * `window_func` - 窗函數名稱 (hann, hamming, bartlett, blackman, etc.)
   * * `alpha` - 某些窗函數的 alpha 參數（可選）
   */
  constructor(fft_size: number, window_func: string, alpha?: number | null);
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_spectrogramengine_free: (a: number, b: number) => void;
  readonly spectrogramengine_compute_spectrogram: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
  readonly spectrogramengine_get_fft_size: (a: number) => number;
  readonly spectrogramengine_get_freq_bins: (a: number) => number;
  readonly spectrogramengine_get_window_values: (a: number) => [number, number];
  readonly spectrogramengine_new: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
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
