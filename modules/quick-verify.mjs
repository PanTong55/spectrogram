// 快速驗證 WASM 導入
try {
    const module = await import('./spectrogram_wasm.js');
    
    console.log('✓ WASM 模塊加載成功');
    console.log('✓ 導出的項目:');
    console.log('  - init:', typeof module.default === 'function' ? '函數' : '其他');
    console.log('  - SpectrogramEngine:', typeof module.SpectrogramEngine === 'function' ? '類' : '其他');
    
    console.log('\n✓ 導入方式正確！');
} catch (err) {
    console.error('✗ 錯誤:', err.message);
}
