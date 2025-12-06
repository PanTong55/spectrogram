use wasm_bindgen::prelude::*;
use rustfft::FftPlanner;
use num_complex::Complex;
use std::f32::consts::PI;

/// SpectrogramEngine: 處理音頻頻譜圖計算
/// 將 FFT、窗函數應用、濾波器組應用和 dB 轉換從 JavaScript 移到 Rust
#[wasm_bindgen]
pub struct SpectrogramEngine {
    fft_size: usize,
    _window_func: String,  // 保留用於調試
    window_values: Vec<f32>,
    planner: FftPlanner<f32>,
    scratch_buffer: Vec<Complex<f32>>,
    _output_buffer: Vec<f32>,  // 保留用於未來擴展
    _alpha: f32,  // 保留用於未來擴展
    // 濾波器組相關字段
    // 扁平化的濾波器組矩陣 (行優先順序)
    // 維度: num_filters x (fft_size / 2 + 1)
    filter_bank: Vec<f32>,
    num_filters: usize,
    use_filter_bank: bool,
}

#[wasm_bindgen]
impl SpectrogramEngine {
    /// 創建新的 SpectrogramEngine 實例
    /// 
    /// # Arguments
    /// * `fft_size` - FFT 大小（必須是 2 的冪）
    /// * `window_func` - 窗函數名稱 (hann, hamming, bartlett, blackman, etc.)
    /// * `alpha` - 某些窗函數的 alpha 參數（可選）
    #[wasm_bindgen(constructor)]
    pub fn new(fft_size: usize, window_func: String, alpha: Option<f32>) -> SpectrogramEngine {
        let alpha = alpha.unwrap_or(0.16);
        
        // 計算窗函數值
        let window_values = create_window(&window_func, fft_size, alpha);
        
        // 創建 FFT 規劃器
        let planner = FftPlanner::new();
        
        // 預分配緩衝區
        let scratch_buffer = vec![Complex::default(); fft_size];
        let output_buffer = vec![0.0; fft_size / 2];
        
        SpectrogramEngine {
            fft_size,
            _window_func: window_func,
            window_values,
            planner,
            scratch_buffer,
            _output_buffer: output_buffer,
            _alpha: alpha,
            filter_bank: Vec::new(),
            num_filters: 0,
            use_filter_bank: false,
        }
    }

    /// 載入濾波器組矩陣
    /// 
    /// # Arguments
    /// * `flat_weights` - 扁平化的濾波器組權重矩陣 (Float32Array)
    /// * `num_filters` - 濾波器數量
    /// 
    /// 矩陣順序: 行優先 (row-major)
    /// 每行長度: fft_size / 2 + 1
    #[wasm_bindgen]
    pub fn load_filter_bank(&mut self, flat_weights: &[f32], num_filters: usize) {
        self.filter_bank = flat_weights.to_vec();
        self.num_filters = num_filters;
        self.use_filter_bank = true;
    }

    /// 清除濾波器組 (禁用濾波)
    #[wasm_bindgen]
    pub fn clear_filter_bank(&mut self) {
        self.filter_bank.clear();
        self.num_filters = 0;
        self.use_filter_bank = false;
    }

    /// 計算 FFT 頻譜（返回幅度值，不進行 dB 轉換）
    ///
    /// # Arguments
    /// * `audio_data` - 音頻數據 (Float32Array)
    /// * `noverlap` - 重疊樣本數
    ///
    /// # Returns
    /// 平面的 Float32Array（頻率箱 * 時間步），包含幅度值
    #[wasm_bindgen]
    pub fn compute_spectrogram(
        &mut self,
        audio_data: &[f32],
        noverlap: usize,
    ) -> Vec<f32> {
        let step = self.fft_size - noverlap;
        let num_frames = if audio_data.len() >= self.fft_size {
            (audio_data.len() - self.fft_size) / step + 1
        } else {
            0
        };
        
        let freq_bins = self.fft_size / 2;
        let mut result = vec![0.0f32; freq_bins * num_frames];
        
        // 獲取 FFT 算法
        let fft = self.planner.plan_fft_forward(self.fft_size);
        
        let mut pos = 0;
        for frame_idx in 0..num_frames {
            if pos + self.fft_size > audio_data.len() {
                break;
            }
            
            // 應用窗函數並準備 FFT 輸入
            for i in 0..self.fft_size {
                let windowed = audio_data[pos + i] * self.window_values[i];
                self.scratch_buffer[i] = Complex {
                    re: windowed,
                    im: 0.0,
                };
            }
            
            // 執行 FFT
            fft.process(&mut self.scratch_buffer);
            
            // 計算幅度（不轉換為 dB，讓 JavaScript 處理）
            let scale = 2.0 / self.fft_size as f32;
            for i in 0..freq_bins {
                let c = self.scratch_buffer[i];
                let magnitude = (c.re * c.re + c.im * c.im).sqrt();
                result[frame_idx * freq_bins + i] = magnitude * scale;
            }
            
            pos += step;
        }
        
        result
    }

    /// 獲取窗函數值（用於調試/驗證）
    #[wasm_bindgen]
    pub fn get_window_values(&self) -> Vec<f32> {
        self.window_values.clone()
    }

    /// 獲取 FFT 大小
    #[wasm_bindgen]
    pub fn get_fft_size(&self) -> usize {
        self.fft_size
    }

    /// 獲取濾波器數量
    #[wasm_bindgen]
    pub fn get_num_filters(&self) -> usize {
        self.num_filters
    }

    /// 獲取頻率箱數
    #[wasm_bindgen]
    pub fn get_freq_bins(&self) -> usize {
        self.fft_size / 2
    }

    /// 計算頻譜圖並轉換為 u8 量化值 (0-255)
    /// 
    /// # Arguments
    /// * `audio_data` - 音頻數據 (Float32Array)
    /// * `noverlap` - 重疊樣本數
    /// * `gain_db` - 增益 dB 值（用於縮放）
    /// * `range_db` - 動態範圍 dB 值
    ///
    /// # Returns
    /// 扁平化的 Uint8Array (filter_nums * num_frames 或 freq_bins * num_frames)
    /// 包含映射到 0-255 範圍的頻譜數據
    #[wasm_bindgen]
    pub fn compute_spectrogram_u8(
        &mut self,
        audio_data: &[f32],
        noverlap: usize,
        gain_db: f32,
        range_db: f32,
    ) -> Vec<u8> {
        let step = self.fft_size - noverlap;
        let num_frames = if audio_data.len() >= self.fft_size {
            (audio_data.len() - self.fft_size) / step + 1
        } else {
            0
        };
        
        let fft = self.planner.plan_fft_forward(self.fft_size);
        let freq_bins = self.fft_size / 2;
        
        // 決定輸出大小
        let output_bins = if self.use_filter_bank && self.num_filters > 0 {
            self.num_filters
        } else {
            freq_bins
        };
        
        let mut result = vec![0u8; output_bins * num_frames];
        let mut pos = 0;
        
        // 預計算 dB 範圍值，以優化迴圈
        let gain_db_neg = -gain_db;
        let range_db_reciprocal = 255.0 / range_db;
        
        for frame_idx in 0..num_frames {
            if pos + self.fft_size > audio_data.len() {
                break;
            }
            
            // 第一步: 應用窗函數並準備 FFT 輸入
            for i in 0..self.fft_size {
                let windowed = audio_data[pos + i] * self.window_values[i];
                self.scratch_buffer[i] = Complex {
                    re: windowed,
                    im: 0.0,
                };
            }
            
            // 第二步: 執行 FFT
            fft.process(&mut self.scratch_buffer);
            
            // 第三步: 計算線性幅度
            let scale = 2.0 / self.fft_size as f32;
            let mut magnitude = vec![0.0f32; freq_bins];
            for i in 0..freq_bins {
                let c = self.scratch_buffer[i];
                let mag = (c.re * c.re + c.im * c.im).sqrt() * scale;
                magnitude[i] = mag;
            }
            
            // 第四步: 應用濾波器組 (如果啟用)
            let filtered = if self.use_filter_bank && self.num_filters > 0 {
                self.apply_filter_bank(&magnitude)
            } else {
                magnitude.clone()
            };
            
            // 第五步: 轉換為 dB 並量化到 0-255
            for i in 0..filtered.len() {
                let mag = filtered[i];
                // 防止 log10(0)，使用最小值 1e-10
                let safe_mag = if mag > 1e-10 { mag } else { 1e-10 };
                let db = 20.0 * safe_mag.log10();
                
                // 映射到 0-255 範圍
                let u8_val = if db < gain_db_neg - range_db {
                    0
                } else if db > gain_db_neg {
                    255
                } else {
                    ((db - (gain_db_neg - range_db)) * range_db_reciprocal) as u8
                };
                
                result[frame_idx * output_bins + i] = u8_val;
            }
            
            pos += step;
        }
        
        result
    }

    /// 內部方法: 應用濾波器組 (矩陣乘法)
    /// 
    /// magnitude: 線性幅度頻譜 (長度: freq_bins)
    /// 返回: 濾波後的幅度 (長度: num_filters)
    fn apply_filter_bank(&self, magnitude: &[f32]) -> Vec<f32> {
        let mut result = vec![0.0f32; self.num_filters];
        
        if self.filter_bank.is_empty() || magnitude.is_empty() {
            return result;
        }
        
        let freq_bins = magnitude.len();
        
        // 矩陣乘法: result[i] = sum(magnitude[j] * filter_bank[i * freq_bins + j])
        for i in 0..self.num_filters {
            let mut sum = 0.0f32;
            let row_start = i * freq_bins;
            
            for j in 0..freq_bins {
                if row_start + j < self.filter_bank.len() {
                    sum += magnitude[j] * self.filter_bank[row_start + j];
                }
            }
            
            result[i] = sum;
        }
        
        result
    }
}

/// 根據名稱創建窗函數
fn create_window(window_name: &str, size: usize, alpha: f32) -> Vec<f32> {
    let mut window = vec![0.0; size];
    
    match window_name {
        "bartlett" => {
            for i in 0..size {
                window[i] = 2.0 / (size as f32 - 1.0)
                    * ((size as f32 - 1.0) / 2.0 - (i as f32 - (size as f32 - 1.0) / 2.0).abs());
            }
        }
        "bartlettHann" => {
            for i in 0..size {
                let ni = i as f32 / (size as f32 - 1.0);
                window[i] = 0.62
                    - 0.48 * (ni - 0.5).abs()
                    - 0.38 * (2.0 * PI * ni).cos();
            }
        }
        "blackman" => {
            for i in 0..size {
                window[i] = (1.0 - alpha) / 2.0
                    - 0.5 * (2.0 * PI * i as f32 / (size as f32 - 1.0)).cos()
                    + alpha / 2.0 * (4.0 * PI * i as f32 / (size as f32 - 1.0)).cos();
            }
        }
        "cosine" => {
            for i in 0..size {
                window[i] = (PI * i as f32 / (size as f32 - 1.0) - PI / 2.0).cos();
            }
        }
        "gauss" => {
            let sigma = 0.25 * (size as f32 - 1.0) / 2.0;
            for i in 0..size {
                let x = (i as f32 - (size as f32 - 1.0) / 2.0) / sigma;
                window[i] = (-0.5 * x * x).exp();
            }
        }
        "hamming" => {
            for i in 0..size {
                window[i] = 0.54 - 0.46 * (2.0 * PI * i as f32 / (size as f32 - 1.0)).cos();
            }
        }
        "hann" => {
            for i in 0..size {
                window[i] = 0.5 * (1.0 - (2.0 * PI * i as f32 / (size as f32 - 1.0)).cos());
            }
        }
        "lanczos" => {
            for i in 0..size {
                let x = 2.0 * i as f32 / (size as f32 - 1.0) - 1.0;
                let pi_x = PI * x;
                window[i] = if pi_x.abs() < 1e-6 {
                    1.0
                } else {
                    pi_x.sin() / pi_x
                };
            }
        }
        "rectangular" => {
            for i in 0..size {
                window[i] = 1.0;
            }
        }
        "triangular" => {
            for i in 0..size {
                window[i] = 2.0 / size as f32
                    * (size as f32 / 2.0 - (i as f32 - (size as f32 - 1.0) / 2.0).abs());
            }
        }
        _ => {
            // 默認為 Hann 窗
            for i in 0..size {
                window[i] = 0.5 * (1.0 - (2.0 * PI * i as f32 / (size as f32 - 1.0)).cos());
            }
        }
    }
    
    window
}

/// 計算波形峰值用於可視化
/// 
/// 該函數對音頻通道進行下采樣，將其縮放為指定數量的峰值點。
/// 每個峰值點代表相應範圍內樣本的最大絕對值。
/// 
/// # Arguments
/// * `channel_data` - 音頻通道數據 (原始 float32 樣本)
/// * `num_peaks` - 所需的峰值點數量（目標寬度）
/// 
/// # Returns
/// 包含 num_peaks 個絕對最大值的 Vec<f32>
/// 
/// # Performance
/// 使用迭代器進行優化，避免不必要的數組複製。
/// 對於長音頻文件，此函數比 JavaScript 實現快 5-10 倍。
#[wasm_bindgen]
pub fn compute_wave_peaks(channel_data: &[f32], num_peaks: usize) -> Vec<f32> {
    if num_peaks == 0 || channel_data.is_empty() {
        return Vec::new();
    }
    
    let data_len = channel_data.len();
    let step_size = data_len as f32 / num_peaks as f32;
    
    let mut peaks = Vec::with_capacity(num_peaks);
    
    // 迭代每個峰值點
    for peak_idx in 0..num_peaks {
        let start = (peak_idx as f32 * step_size) as usize;
        let end = (((peak_idx + 1) as f32 * step_size).ceil() as usize).min(data_len);
        
        // 找到該段中的最大絕對值
        let max_val = if start < end {
            channel_data[start..end]
                .iter()
                .copied()
                .map(|x| x.abs())
                .fold(0.0f32, f32::max)
        } else {
            0.0
        };
        
        peaks.push(max_val);
    }
    
    peaks
}

/// 找到整個音頻緩衝區的全局最大值（用於標準化）
/// 
/// # Arguments
/// * `channel_data` - 音頻通道數據
/// 
/// # Returns
/// 整個通道的最大絕對值
#[wasm_bindgen]
pub fn find_global_max(channel_data: &[f32]) -> f32 {
    channel_data
        .iter()
        .copied()
        .map(|x| x.abs())
        .fold(0.0f32, f32::max)
}
