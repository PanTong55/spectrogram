use wasm_bindgen::prelude::*;
use js_sys::Float32Array;

/// 計算音頻通道的峰值
/// 
/// # Arguments
/// * `channel_data` - 音頻通道數據 (Float32Array)
/// * `num_peaks` - 所需的峰值數量
/// * `precision` - 精度系數（用於縮放）
///
/// # Returns
/// 包含峰值的 Float32Array
#[wasm_bindgen]
pub fn compute_peaks(
    channel_data: &Float32Array,
    num_peaks: usize,
    precision: f32,
) -> Float32Array {
    let data_len = channel_data.length() as usize;
    
    if num_peaks == 0 || data_len == 0 {
        return Float32Array::new_with_length(0);
    }
    
    // 創建峰值數組
    let mut peaks = vec![0.0f32; num_peaks];
    
    // 計算塊大小和相關常數
    let block_size_reciprocal = num_peaks as f32 / data_len as f32;
    let precision_reciprocal = 1.0 / precision;
    
    // 獲取 JavaScript 中的數據（通過共享內存）
    let data = channel_data.to_vec();
    
    // 對每個峰值進行計算
    for p in 0..num_peaks {
        let start = ((p as f32) / block_size_reciprocal).floor() as usize;
        let end = (((p as f32 + 1.0) / block_size_reciprocal).ceil() as usize).min(data_len);
        
        let mut max_val = 0.0f32;
        
        // 在該塊中找最大絕對值
        for idx in start..end {
            let sample = data[idx];
            let abs_val = sample.abs();
            if abs_val > max_val {
                max_val = abs_val;
            }
        }
        
        // 存儲縮放後的峰值
        peaks[p] = (max_val * precision).round() * precision_reciprocal;
    }
    
    // 轉換為 Float32Array 返回
    Float32Array::from(&peaks[..])
}

/// 計算多個通道的峰值（批量操作）
///
/// # Arguments
/// * `channels` - 包含所有通道數據的向量（每個是 Float32Array）
/// * `num_peaks` - 所需的峰值數量
/// * `precision` - 精度系數
///
/// # Returns
/// 嵌套的 Float32Array 向量（每個通道一個）
#[wasm_bindgen]
pub fn compute_peaks_multichannel(
    channels: &js_sys::Array,
    num_peaks: usize,
    precision: f32,
) -> js_sys::Array {
    let result = js_sys::Array::new();
    
    for i in 0..channels.length() {
        if let Ok(channel) = channels.get(i).dyn_into::<Float32Array>() {
            let peaks = compute_peaks(&channel, num_peaks, precision);
            result.push(&peaks);
        }
    }
    
    result
}

/// 歸一化音頻數據
///
/// # Arguments
/// * `channel_data` - 音頻通道數據
///
/// # Returns
/// 歸一化後的 Float32Array
#[wasm_bindgen]
pub fn normalize_buffer(channel_data: &Float32Array) -> Float32Array {
    let mut data = channel_data.to_vec();
    
    if data.is_empty() {
        return Float32Array::from(&data[..]);
    }
    
    // 找最大絕對值
    let mut max_val = 0.0f32;
    for sample in &data {
        let abs_val = sample.abs();
        if abs_val > max_val {
            max_val = abs_val;
        }
    }
    
    // 如果最大值大於 0，進行歸一化
    if max_val > 0.0 {
        for sample in &mut data {
            *sample /= max_val;
        }
    }
    
    Float32Array::from(&data[..])
}

/// 歸一化多個通道
///
/// # Arguments
/// * `channels` - 包含所有通道數據的向量
///
/// # Returns
/// 包含歸一化通道的向量
#[wasm_bindgen]
pub fn normalize_buffer_multichannel(channels: &js_sys::Array) -> js_sys::Array {
    let result = js_sys::Array::new();
    
    // 先找全局最大值
    let mut global_max = 0.0f32;
    
    for i in 0..channels.length() {
        if let Ok(channel) = channels.get(i).dyn_into::<Float32Array>() {
            let data = channel.to_vec();
            for sample in &data {
                let abs_val = sample.abs();
                if abs_val > global_max {
                    global_max = abs_val;
                }
            }
        }
    }
    
    // 如果全局最大值為 0，直接返回所有通道
    if global_max == 0.0 {
        for i in 0..channels.length() {
            if let Ok(channel) = channels.get(i).dyn_into::<Float32Array>() {
                result.push(&channel);
            }
        }
        return result;
    }
    
    // 使用全局最大值歸一化所有通道
    for i in 0..channels.length() {
        if let Ok(channel) = channels.get(i).dyn_into::<Float32Array>() {
            let mut data = channel.to_vec();
            for sample in &mut data {
                *sample /= global_max;
            }
            result.push(&Float32Array::from(&data[..]));
        }
    }
    
    result
}

/// 計算單個通道的優化峰值（使用步長來減少內存訪問）
///
/// # Arguments
/// * `channel_data` - 音頻通道數據
/// * `num_peaks` - 所需的峰值數量
/// * `precision` - 精度系數
///
/// # Returns
/// 包含峰值的 Float32Array
#[wasm_bindgen]
pub fn compute_peaks_optimized(
    channel_data: &Float32Array,
    num_peaks: usize,
    precision: f32,
) -> Float32Array {
    let data_len = channel_data.length() as usize;
    
    if num_peaks == 0 || data_len == 0 {
        return Float32Array::new_with_length(0);
    }
    
    let mut peaks = vec![0.0f32; num_peaks];
    let data = channel_data.to_vec();
    
    // 計算步長
    let block_size = (data_len as f32 / num_peaks as f32).ceil() as usize;
    let precision_reciprocal = 1.0 / precision;
    
    // 優化：使用塊迭代而不是計算索引
    let mut chunk_iter = data.chunks(block_size);
    
    for (p, chunk) in chunk_iter.enumerate() {
        if p >= num_peaks {
            break;
        }
        
        let mut max_val = 0.0f32;
        for sample in chunk {
            let abs_val = sample.abs();
            if abs_val > max_val {
                max_val = abs_val;
            }
        }
        
        peaks[p] = (max_val * precision).round() * precision_reciprocal;
    }
    
    Float32Array::from(&peaks[..])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_peaks_basic() {
        // 測試基本功能（在 Rust 環境中）
        let data = vec![0.1, 0.5, -0.3, 0.8, -0.2];
        // 期望峰值：[0.5, 0.8]（每個塊的最大絕對值）
    }
}
