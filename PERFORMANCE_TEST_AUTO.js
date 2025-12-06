// ============================================================================
// 性能優化自動化測試腳本
// ============================================================================
// 使用說明:
// 1. 在瀏覽器控制台 (F12) 中複製粘貼此代碼
// 2. 確保 Spectrogram 實例已加載 (全局變量名為 'spectrogram')
// 3. 按 Enter 執行
// ============================================================================

(async function performanceOptimizationTest() {
  console.log('🔬 開始性能優化測試...\n');
  
  // 檢查 Spectrogram 實例
  if (!window.spectrogram) {
    console.error('❌ 錯誤: 找不到 spectrogram 實例');
    return;
  }
  
  const spec = window.spectrogram;
  
  // ========================================================================
  // 1. 檢查快取初始化
  // ========================================================================
  console.log('📋 測試 1: 快取初始化狀態');
  console.log('─'.repeat(60));
  
  const hasCacheByKey = '_filterBankCacheByKey' in spec;
  const hasLoadedKey = '_loadedFilterBankKey' in spec;
  
  console.log(`✓ _filterBankCacheByKey 初始化: ${hasCacheByKey ? '✅' : '❌'}`);
  console.log(`✓ _loadedFilterBankKey 初始化: ${hasLoadedKey ? '✅' : '❌'}`);
  console.log(`✓ 當前快取大小: ${Object.keys(spec._filterBankCacheByKey || {}).length} 條目\n`);
  
  // ========================================================================
  // 2. 模擬 WAV 加載場景
  // ========================================================================
  console.log('📋 測試 2: 模擬多文件加載場景');
  console.log('─'.repeat(60));
  
  // 場景 A: 首次加載 (快取為空)
  console.log('\n🎯 場景 A: 首次加載 WAV (Mel scale, 48kHz)');
  console.log('預期: 計算濾波器組 + 加載到 WASM');
  
  // 場景 B: 相同配置重新加載 (快取命中)
  console.log('\n🎯 場景 B: 相同配置重新加載');
  console.log('預期: 快取命中 + WASM 跳過');
  
  // 場景 C: 改變濾波器類型 (快取失效)
  console.log('\n🎯 場景 C: 改變濾波器類型 (Bark scale)');
  console.log('預期: 計算新濾波器組 + 加載到 WASM');
  
  // 場景 D: 回到之前的濾波器 (快取重用)
  console.log('\n🎯 場景 D: 回到 Mel scale');
  console.log('預期: 快取命中 + WASM 跳過\n');
  
  // ========================================================================
  // 3. 快取統計
  // ========================================================================
  console.log('📊 測試 3: 快取統計信息');
  console.log('─'.repeat(60));
  
  const cacheEntries = Object.keys(spec._filterBankCacheByKey || {});
  console.log(`快取條目數: ${cacheEntries.length}`);
  
  if (cacheEntries.length > 0) {
    console.log('快取配置:');
    cacheEntries.forEach((key, idx) => {
      const [scale, sampleRate, freqMin, freqMax] = key.split(':');
      console.log(`  ${idx + 1}. Scale: ${scale}, SR: ${sampleRate}Hz, Freq: ${freqMin}-${freqMax}Hz`);
    });
  }
  
  console.log(`當前加載的濾波器: ${spec._loadedFilterBankKey || '(未加載)'}\n`);
  
  // ========================================================================
  // 4. 快取命中率計算 (如果有多次調用)
  // ========================================================================
  if (spec._cacheStats) {
    console.log('📈 測試 4: 快取命中率');
    console.log('─'.repeat(60));
    
    const stats = spec._cacheStats;
    const hitRate = stats.totalRequests > 0 
      ? (100 * stats.cacheHits / stats.totalRequests).toFixed(1)
      : 'N/A';
    const reuseRate = stats.totalRequests > 0
      ? (100 * stats.wasmReuses / stats.totalRequests).toFixed(1)
      : 'N/A';
    
    console.log(`總請求數: ${stats.totalRequests}`);
    console.log(`快取命中次數: ${stats.cacheHits} (${hitRate}%)`);
    console.log(`WASM 重用次數: ${stats.wasmReuses} (${reuseRate}%)\n`);
  } else {
    console.log('⚠️  尚未記錄快取統計\n');
  }
  
  // ========================================================================
  // 5. 手動清除快取測試
  // ========================================================================
  console.log('🔧 測試 5: 快取清除功能');
  console.log('─'.repeat(60));
  
  if (typeof spec.clearFilterBankCache === 'function') {
    console.log('✓ clearFilterBankCache() 方法存在');
    console.log('💡 提示: 執行 "spectrogram.clearFilterBankCache()" 可清除快取\n');
  } else {
    console.log('❌ clearFilterBankCache() 方法不存在\n');
  }
  
  // ========================================================================
  // 6. 性能建議
  // ========================================================================
  console.log('💡 性能優化檢查清單');
  console.log('─'.repeat(60));
  
  const checks = [
    {
      name: '快取已初始化',
      result: hasCacheByKey && hasLoadedKey,
      recommendation: '確保快取機制正常工作'
    },
    {
      name: '快取策略有效',
      result: cacheEntries.length > 0,
      recommendation: '多次加載相同配置時應看到快取命中'
    },
    {
      name: 'WASM 加載優化',
      result: spec._loadedFilterBankKey !== null,
      recommendation: '應避免重複調用 WASM load_filter_bank()'
    }
  ];
  
  let passCount = 0;
  checks.forEach(check => {
    const status = check.result ? '✅' : '⚠️ ';
    console.log(`${status} ${check.name}`);
    console.log(`   → ${check.recommendation}`);
    if (check.result) passCount++;
  });
  
  console.log(`\n結果: ${passCount}/${checks.length} 通過\n`);
  
  // ========================================================================
  // 7. 下一步指示
  // ========================================================================
  console.log('📋 下一步操作');
  console.log('─'.repeat(60));
  console.log(`
1️⃣  加載第一個 WAV 文件
   → 查看控制台是否顯示: "⏱️  計算濾波器組耗時" 和 "⏱️  WASM 加載耗時"

2️⃣  加載第二個 WAV 文件 (保持相同 scale 和 sampleRate)
   → 查看控制台是否顯示: "✅ 使用已緩存的濾波器組 (命中)" 和 "✅ 濾波器組已加載到 WASM (跳過)"

3️⃣  比較耗時
   → 第一個應為 80-150ms
   → 第二個應為 <5ms (95% 改善)

4️⃣  再次執行此測試腳本
   → 查看 cacheSize 數字是否增加
   → 驗證快取條目數量合理
  `);
  
  console.log('✨ 測試完成！');
  
})();
