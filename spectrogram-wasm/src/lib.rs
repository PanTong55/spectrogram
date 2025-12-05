use wasm_bindgen::prelude::*;
use rustfft::FftPlanner;
use num_complex::Complex;
use std::f32::consts::PI;

/// SpectrogramEngine: 處理音頻頻譜圖計算
/// 將 FFT、窗函數應用和 dB 轉換從 JavaScript 移到 Rust
#[wasm_bindgen]
pub struct SpectrogramEngine {
    fft_size: usize,
    window_func: String,
    window_values: Vec<f32>,
    planner: FftPlanner<f32>,
    scratch_buffer: Vec<Complex<f32>>,
    output_buffer: Vec<f32>,
    alpha: f32,
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
            window_func,
            window_values,
            planner,
            scratch_buffer,
            output_buffer,
            alpha,
        }
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

    /// 獲取頻率箱數
    #[wasm_bindgen]
    pub fn get_freq_bins(&self) -> usize {
        self.fft_size / 2
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
