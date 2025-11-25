# Fix: Start Frequency Stability (Selection-Independent Calculation)

## Problem Identified

**Symptom:** Start Frequency calculation produced different values when changing the selection area's upper boundary (`fhighKHz`), even with the same threshold value.

**Root Cause:** 
- In `generateSpectrogram()`, the `freqBins` array is constructed with size that depends on `fhighKHz` parameter
- When `fhighKHz` changes, the number of frequency bins changes
- Therefore `freqBins[freqBins.length - 1]` (the last element) represents different frequencies for different selections
- This was used as the default Start Frequency in both:
  1. `findOptimalStartEndThreshold()` function
  2. STEP 2 "Find start frequency" calculation

### Example: How freqBins Changes

**Case 1:** Selection with `fhighKHz = 96 kHz`
```
generateSpectrogram parameters:
  - sampleRate: 384000 Hz
  - fftSize: 1024
  - flowKHz: 5 kHz
  - fhighKHz: 96 kHz
  
Calculation:
  - freqResolution = 384000 / 1024 = 375 Hz
  - minBin = floor(5000 / 375) = 13
  - maxBin = floor(96000 / 375) = 256  ← Limited by fhighKHz
  - numBins = 256 - 13 + 1 = 244 bins
  - freqBins[243] (last element) = 256 * 375 = 96000 Hz
```

**Case 2:** Selection with `fhighKHz = 192 kHz`
```
generateSpectrogram parameters:
  - sampleRate: 384000 Hz (SAME)
  - fftSize: 1024 (SAME)
  - flowKHz: 5 kHz (SAME)
  - fhighKHz: 192 kHz  ← Different!
  
Calculation:
  - freqResolution = 375 Hz (same)
  - minBin = 13 (same)
  - maxBin = floor(192000 / 375) = 512  ← NOT limited by fhighKHz
  - numBins = 512 - 13 + 1 = 500 bins
  - freqBins[499] (last element) = 512 * 375 = 192000 Hz  ← DIFFERENT!
```

**Problem:** When using `freqBins[freqBins.length - 1]`:
- Case 1 gets 96 kHz as default Start Frequency
- Case 2 gets 192 kHz as default Start Frequency
- Same threshold produces different Start Frequencies! ❌

## Solution Implemented

**Key Change:** Use true Nyquist frequency based on **sample rate**, not selection-dependent `freqBins` array.

```javascript
// OLD (WRONG):
const nyquistFreq_Hz = freqBins[freqBins.length - 1];  // Selection-dependent!

// NEW (CORRECT):
const nyquistFreq_Hz = call.sampleRate / 2;  // True Nyquist frequency
```

### Why This Works

The Nyquist frequency is defined as:
$$f_{Nyquist} = \frac{f_{sampleRate}}{2}$$

This is a **property of the audio signal**, not the spectrogram display:
- Regardless of how we slice the spectrogram (by changing `fhighKHz`)
- The true Nyquist frequency remains the same
- It only depends on the audio sample rate

**Example with same audio:**
- Sample rate: 384 kHz
- True Nyquist: 384000 / 2 = **192 kHz** (fixed!)
- This is **identical** for Case 1, Case 2, and any other selection area

## Code Changes

### 1. Function Signature Update
**File:** `batCallDetector.js`, Line ~555

**Before:**
```javascript
findOptimalStartEndThreshold(spectrogram, freqBins, flowKHz, fhighKHz, callPeakPower_dB) {
```

**After:**
```javascript
findOptimalStartEndThreshold(spectrogram, freqBins, flowKHz, fhighKHz, callPeakPower_dB, sampleRate) {
```

### 2. Nyquist Calculation Fix (findOptimalStartEndThreshold)
**File:** `batCallDetector.js`, Line ~567-569

**Before:**
```javascript
const nyquistFreq_Hz = freqBins[freqBins.length - 1];
```

**After:**
```javascript
// CRITICAL FIX (2025): Use actual Nyquist frequency based on sample rate
// NOT freqBins[freqBins.length - 1] which changes with selection area fhighKHz
// freqBins array size depends on fhighKHz parameter in generateSpectrogram
// So using "last element" creates inconsistent reference points
// True Nyquist = sampleRate / 2 (stable, independent of selection area)
const nyquistFreq_Hz = sampleRate / 2;
```

### 3. Function Call Update
**File:** `batCallDetector.js`, Line ~828-835

**Before:**
```javascript
startEndThreshold_dB = this.findOptimalStartEndThreshold(
  spectrogram,
  freqBins,
  flowKHz,
  fhighKHz,
  peakPower_dB
);
```

**After:**
```javascript
startEndThreshold_dB = this.findOptimalStartEndThreshold(
  spectrogram,
  freqBins,
  flowKHz,
  fhighKHz,
  peakPower_dB,
  call.sampleRate  // Pass sample rate for stable Nyquist calculation
);
```

### 4. STEP 2 Fix (Start Frequency Calculation)
**File:** `batCallDetector.js`, Line ~1029-1032

**Before:**
```javascript
const nyquistFreq_Hz = freqBins[freqBins.length - 1];
let startFreq_Hz = nyquistFreq_Hz;  // Default to highest frequency bin (not fhighKHz * 1000)
```

**After:**
```javascript
// CRITICAL FIX (2025): Use actual Nyquist frequency based on sample rate
// NOT freqBins[freqBins.length - 1] which changes with selection area fhighKHz
// True Nyquist = sampleRate / 2 (stable, independent of selection area)
const nyquistFreq_Hz = call.sampleRate / 2;
let startFreq_Hz = nyquistFreq_Hz;  // Default to true Nyquist frequency (not selection-dependent)
```

## Validation

**Test Results:**

```
PROBLEM - Using freqBins[freqBins.length - 1] as reference:
----
Case 1: fhighKHz = 96 kHz
  Last bin frequency: 96.00 kHz  ← INCONSISTENT!
  
Case 2: fhighKHz = 192 kHz
  Last bin frequency: 192.00 kHz  ← INCONSISTENT!
  
Case 3: fhighKHz = 384 kHz
  Last bin frequency: 192.00 kHz  ← INCONSISTENT!

NEW APPROACH (sampleRate / 2):
----
All cases: 192.0 kHz  ← CONSISTENT! ✓
```

## Impact

✓ **Fixed:** Start Frequency now remains stable regardless of selection area boundary  
✓ **Consequence:** Different selection areas produce identical results with same threshold  
✓ **Professional Standard:** Aligns with audio signal theory (Nyquist-Shannon sampling theorem)  
✓ **No Breaking Changes:** All existing code paths preserved  

## Related Issues Solved in This Session

1. ✅ QCF call duration miscalculation (2-3ms → ~8ms) - Fixed with forward scanning
2. ✅ Knee position incorrect - Fixed with curvature-based detection
3. ✅ Weak calls filtered in small selections - Fixed with percentile-based SNR
4. ✅ Start Frequency inconsistent across selection boundaries - **Fixed in this change**

## Code Quality Notes

- The `call.sampleRate` is already available and stable (set during audio loading)
- This change maintains backward compatibility with existing spectrogram structures
- No changes needed to `generateSpectrogram()` - that function's behavior is correct
- The fix only affects the default Start Frequency reference point, not the actual scanning logic
