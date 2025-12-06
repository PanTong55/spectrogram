#!/usr/bin/env node

/**
 * 簡單的單元測試，驗證 WASM 峰值檢測實現
 */

import init, { SpectrogramEngine } from './modules/spectrogram_wasm.js';

async function testPeakDetection() {
    console.log('🧪 開始測試 WASM 峰值檢測...\n');
    
    try {
        // 初始化 WASM
        await init();
        console.log('✅ WASM 初始化成功\n');
        
        // 創建 SpectrogramEngine 實例
        const fftSize = 2048;
        const engine = new SpectrogramEngine(fftSize, 'hann', null);
        console.log(`✅ 創建 SpectrogramEngine (FFT 大小: ${fftSize})\n`);
        
        // 生成測試音頻數據（包含兩個簡單的正弦波）
        const sampleRate = 44100;
        const duration = 0.5; // 500ms
        const samples = sampleRate * duration;
        const audioData = new Float32Array(samples);
        
        // 第一部分 (0-250ms): 1000 Hz
        // 第二部分 (250-500ms): 5000 Hz
        for (let i = 0; i < samples; i++) {
            const t = i / sampleRate;
            if (t < 0.25) {
                // 1000 Hz
                audioData[i] = 0.5 * Math.sin(2 * Math.PI * 1000 * t);
            } else {
                // 5000 Hz
                audioData[i] = 0.5 * Math.sin(2 * Math.PI * 5000 * t);
            }
        }
        
        console.log(`✅ 生成測試音頻 (${samples} 樣本, ${duration}s)`);
        console.log(`   - 0-250ms: 1000 Hz\n   - 250-500ms: 5000 Hz\n`);
        
        // 調用 compute_spectrogram_u8
        const noverlap = 512;
        const gainDb = 0;
        const rangeDb = 100;
        
        console.log('📊 計算頻譜...');
        const spectrum = engine.compute_spectrogram_u8(audioData, noverlap, gainDb, rangeDb);
        console.log(`✅ 頻譜計算完成 (${spectrum.length} bytes)\n`);
        
        // 獲取峰值
        const thresholdRatio = 0.4;
        const peaks = engine.get_peaks(thresholdRatio);
        console.log(`📍 峰值檢測 (閾值比率: ${thresholdRatio})`);
        console.log(`✅ 峰值數量: ${peaks.length} 幀`);
        
        // 獲取全局最大值
        const globalMax = engine.get_global_max();
        console.log(`✅ 全局最大幅度: ${globalMax.toFixed(6)}\n`);
        
        // 分析峰值
        const freq_bins = fftSize / 2;
        const validPeaks = [];
        const invalidPeaks = [];
        
        peaks.forEach((peak, idx) => {
            if (peak === 0xFFFF) {
                invalidPeaks.push(idx);
            } else {
                validPeaks.push({ frame: idx, bin: peak });
            }
        });
        
        console.log(`📈 峰值統計:`);
        console.log(`   - 有效峰值: ${validPeaks.length}`);
        console.log(`   - 無效峰值: ${invalidPeaks.length}`);
        console.log(`   - 總幀數: ${peaks.length}\n`);
        
        if (validPeaks.length > 0) {
            console.log('📌 前 5 個有效峰值:');
            validPeaks.slice(0, 5).forEach(({ frame, bin }) => {
                const freq = (bin / fftSize) * sampleRate;
                console.log(`   - 幀 ${frame}: bin=${bin}, 頻率≈${freq.toFixed(0)}Hz`);
            });
            console.log();
        }
        
        // 驗證結果
        console.log('✔️  測試完成!\n');
        return true;
        
    } catch (error) {
        console.error('❌ 測試失敗:', error);
        console.error(error.stack);
        return false;
    }
}

testPeakDetection().then(success => {
    process.exit(success ? 0 : 1);
});
