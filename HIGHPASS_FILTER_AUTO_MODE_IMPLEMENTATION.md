# Highpass Filter Auto Mode Implementation (2025)

## Summary
Successfully implemented Auto/Manual mode for the Highpass Filter Frequency (`highpassFilterFreq_kHz`) control, mirroring the existing Auto Mode functionality for High/Low frequency thresholds.

## Features Implemented

### 1. **Auto Mode Calculation Logic**
- Function: `calculateAutoHighpassFilterFreq(peakFreq_kHz)`
- Based on peak frequency thresholds:
  - ≥ 40 kHz → 40 kHz
  - ≥ 35 kHz → 35 kHz
  - ≥ 25 kHz → 25 kHz
  - ≥ 20 kHz → 20 kHz
  - ≥ 15 kHz → 15 kHz
  - < 15 kHz → 15 kHz (default minimum)

### 2. **UI/UX Design**
- **Auto Mode Display:**
  - Empty input field (value = "")
  - Placeholder shows "Auto (calculated_value)" (e.g., "Auto (40)")
  - Text color: Gray (#999)
  
- **Manual Mode Display:**
  - Input field shows numeric value (e.g., "40")
  - Placeholder shows "Auto" (default)
  - Text color: Black (#000)

- **Mode Switching:**
  - Empty input value → Auto Mode
  - Numeric input value → Manual Mode
  - Invalid input → Falls back to Auto Mode

### 3. **Configuration Structure**
New flag added to `batCallConfig`:
```javascript
highpassFilterFreq_kHz_isAuto: boolean  // true = Auto, false = Manual
```

### 4. **Memory Persistence**
Added to `window.__batCallControlsMemory`:
```javascript
highpassFilterFreq_kHz_isAuto: true  // Default Auto mode (persistent across sessions)
```

## Code Changes

### File: `/workspaces/spectrogram/modules/callAnalysisPopup.js`

#### 1. Global Memory Initialization (Line 23-40)
- Added `highpassFilterFreq_kHz_isAuto: true` to default memory structure

#### 2. batCallConfig Initialization (Line 96)
- Added flag: `highpassFilterFreq_kHz_isAuto: memory.highpassFilterFreq_kHz_isAuto !== false`

#### 3. Auto Calculation Function (Line 263-272)
- `calculateAutoHighpassFilterFreq()` - Threshold-based calculation from peak frequency

#### 4. Auto Mode Calculation in updateBatCallConfig (Line 632-635)
- **CRITICAL: Calculation moved from updateBatCallAnalysis start to updateBatCallConfig**
- Executed BEFORE detector.config update (ensures fresh config values)
- Uses `lastPeakFreq` from original spectrum (same as SNR calculation):
```javascript
// 2025: Auto Mode 時，根據原始 spectrum 的 peakFreq 計算自動高通濾波器頻率
// 這與 SNR 計算邏輯一致，都使用原始（未濾波）音頻的峰值頻率
if (batCallConfig.highpassFilterFreq_kHz_isAuto === true && lastPeakFreq) {
  batCallConfig.highpassFilterFreq_kHz = calculateAutoHighpassFilterFreq(lastPeakFreq);
}
```

#### 5. UI Updates in updateBatCallAnalysis (Line 373-390)
- Query highpassFilterFreqInput
- Update based on isAuto flag:
  - Auto Mode: Clear value, set gray color, update placeholder
  - Manual Mode: Show value, set black color, update placeholder

#### 6. updateBatCallConfig Function (Line 572-593)
- Parse input value to determine Auto/Manual mode
- Store mode flag in batCallConfig
- Handle invalid input (fallback to Auto)
- **Order: Parse → Set isAuto → Calculate Auto value → Update detector.config → Call updateBatCallAnalysis**

#### 7. Memory Persistence (Line 617)
- Added to memory save structure: `highpassFilterFreq_kHz_isAuto`

#### 8. UI Element Creation (Line 1265-1295)
- Initialize based on memory flag
- Set appropriate value, placeholder, and color

#### 9. Event Listeners (Already Exists)
- Input and change events trigger updateBatCallConfig
- Mode detection and UI update happens automatically

## Behavior Flow

1. **User leaves input empty** → Auto Mode activated
   - `updateBatCallConfig` detects empty value
   - Sets `isAuto = true`
   - Calls `updateBatCallAnalysis(peakFreq)`
   
2. **updateBatCallAnalysis runs**
   - Calculates filter frequency from peakFreq
   - Updates UI: empty field + gray text + "Auto (value)" placeholder
   
3. **User enters numeric value** → Manual Mode activated
   - `updateBatCallConfig` detects numeric input
   - Sets `isAuto = false` + stores numeric value
   - Calls `updateBatCallAnalysis(peakFreq)`
   
4. **updateBatCallAnalysis runs**
   - Ignores auto calculation
   - Shows user's numeric value in field
   - Updates UI: filled field + black text + "Auto" placeholder

## Testing Checklist

- ✓ Syntax check passed
- ✓ All code locations verified
- ✓ Event listeners confirmed operational
- ✓ Memory persistence structure complete
- ✓ UI initialization logic in place

## Default Behavior

- **Initial State:** Auto Mode (default true)
- **Display:** Empty field with "Auto (40)" placeholder, gray text
- **Calculation:** Based on detected peak frequency in spectrum
- **User Override:** Type any number (1-100) to switch to Manual Mode

## Notes

- Peak frequency detection happens in `findPeakFrequencyFromSpectrum()`
- Auto values are recalculated whenever spectrum is redrawn
- Manual values persist until user clears the input field
- Memory is saved across sessions via `window.__batCallControlsMemory`
- Fully compatible with existing highpass filter application logic

## Related Files

- `modules/callAnalysisPopup.js` - Main implementation
- `modules/batCallDetector.js` - Uses config values
- `modules/powerSpectrum.js` - Provides peak frequency calculation

---

## Bug Fix: Auto Mode Calculation (2025-12-01)

### Problem Identified
1. Auto Mode calculation was happening in `updateBatCallAnalysis()` start
2. Peak frequency used was from function parameter (could be old/stale)
3. `detector.config` was already updated before Auto calculation, causing sync issues

### Root Cause
```javascript
// WRONG: In updateBatCallAnalysis (calculated too late)
if (batCallConfig.highpassFilterFreq_kHz_isAuto === true && peakFreq) {
  batCallConfig.highpassFilterFreq_kHz = calculateAutoHighpassFilterFreq(peakFreq);
}
// Problem: detector.config already has old highpassFilterFreq_kHz value
```

### Solution Applied
Moved Auto Mode calculation to `updateBatCallConfig()` **BEFORE** detector.config update:

```javascript
// CORRECT: In updateBatCallConfig (before detector.config sync)
if (batCallConfig.highpassFilterFreq_kHz_isAuto === true && lastPeakFreq) {
  batCallConfig.highpassFilterFreq_kHz = calculateAutoHighpassFilterFreq(lastPeakFreq);
}

// Now detector.config gets updated with fresh calculated value
detector.config = { ...batCallConfig };
```

### Key Changes
1. **Peak Frequency Source**: Changed from function parameter to `lastPeakFreq`
   - `lastPeakFreq` is set in `redrawSpectrum()` from original spectrum
   - Consistent with SNR calculation (both use unfiltered audio peak)

2. **Calculation Timing**: Moved before `detector.config` sync
   - Ensures detector gets fresh Auto-calculated value
   - No stale values in detector.config

3. **Result**: Auto Mode now correctly reflects peak frequency in UI

### Verification
- Peak frequency for Auto calculation: From original spectrum (unfiltered)
- Same source as SNR calculation: ✓ Consistent
- Value updates in detector.config: ✓ Fresh
- UI reflects calculated value: ✓ Correct
