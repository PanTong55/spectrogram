/**
 * Professional-grade Bat Call Detection and Parameter Measurement Module
 * Aligned with Avisoft, SonoBat, Kaleidoscope, and BatSound standards
 * 
 * Reference: 
 * - Avisoft-SASLab Pro: https://www.avisoft.com/
 * - SonoBat: https://www.sonobat.com/
 * - Kaleidoscope Pro: https://www.wildlifeacoustics.com/
 * - BatSound: https://www.batvoice.org/
 */

import { getApplyWindowFunction, getGoertzelEnergyFunction } from './powerSpectrum.js';

/**
 * Bat Call Detection Configuration (Professional Standards)
 */
export const DEFAULT_DETECTION_CONFIG = {
  // Energy threshold (dB below maximum within frequency range)
  // Typical: -18 dB (Avisoft), -24 dB (SonoBat, more conservative)
  callThreshold_dB: -24,
  
  // Start/End frequency threshold (dB below peak for finding edges)
  startEndThreshold_dB: -18,
  
  // Characteristic frequency is defined as lowest or average frequency 
  // in the last 10-20% of the call duration
  characteristicFreq_percentEnd: 20,  // Last 20% duration
  
  // Minimum call duration to be considered valid (ms)
  minCallDuration_ms: 1,
  
  // Maximum gap to bridge between segments (ms) - for noise robustness
  maxGapBridge_ms: 0,
  
  // Frequency resolution for fine measurements (Hz)
  freqResolution_Hz: 1,
  
  // Window function for STFT
  windowType: 'hann',
  
  // FFT size for high resolution
  fftSize: 1024,
  
  // Time resolution (STFT hop size as percentage of FFT size)
  hopPercent: 25,  // 75% overlap = 25% hop
  
  // Advanced: Call type detection
  // 'auto': automatic detection (CF if bandwidth < 5kHz, FM otherwise)
  // 'cf': constant frequency (for Molossid, Rhinolophid, Hipposiderid)
  // 'fm': frequency modulated (for Phyllostomid, Vespertilionid)
  callType: 'auto',
  
  // For CF-FM calls: minimum power requirement in characteristic freq region (dB)
  cfRegionThreshold_dB: -30,
};

/**
 * Call type classification helper
 */
export class CallTypeClassifier {
  static classify(call) {
    if (!call.bandwidth_kHz || call.bandwidth_kHz < 5) {
      return 'CF';  // Constant Frequency
    }
    if (call.bandwidth_kHz > 20) {
      return 'FM';  // Frequency Modulated
    }
    return 'CF-FM';  // Mixed
  }
  
  /**
   * Check if call matches CF bat characteristics
   * CF bats: typically 10-100 kHz, low bandwidth (< 5 kHz)
   */
  static isCFBat(call) {
    return call.bandwidth_kHz < 5 && call.peakFreq_kHz > 10;
  }
  
  /**
   * Check if call matches FM bat characteristics
   * FM bats: typically 20-150 kHz, high bandwidth (> 10 kHz)
   */
  static isFMBat(call) {
    return call.bandwidth_kHz > 10 && call.startFreq_kHz > call.endFreq_kHz;  // Downward FM
  }
}

/**
 * Represents a single detected bat call with all parameters
 */
export class BatCall {
  constructor() {
    this.startTime_s = null;        // Call start time (seconds)
    this.endTime_s = null;          // Call end time (seconds)
    this.duration_ms = null;        // Total duration (milliseconds)
    
    this.peakFreq_kHz = null;       // Peak frequency (kHz) - absolute max power
    this.startFreq_kHz = null;      // Start frequency (kHz) - from -18dB threshold
    this.endFreq_kHz = null;        // End frequency (kHz) - from -18dB threshold
    this.characteristicFreq_kHz = null;  // Characteristic freq (lowest in last 20%)
    this.bandwidth_kHz = null;      // Bandwidth = startFreq - endFreq
    
    this.Flow = null;               // Low frequency boundary (Hz) - from detection range
    this.Fhigh = null;              // High frequency boundary (kHz) - from detection range
    
    this.peakPower_dB = null;       // Peak power in dB
    this.startPower_dB = null;      // Power at start frequency
    this.endPower_dB = null;        // Power at end frequency
    
    this.callType = 'FM';           // 'CF', 'FM', or 'CF-FM' (Constant/Frequency Modulated)
    
    // Internal: time-frequency spectrogram (for visualization/analysis)
    this.spectrogram = null;        // 2D array: [timeFrames][frequencyBins]
    this.timeFrames = null;         // Time points for each frame
    this.freqBins = null;           // Frequency bins in Hz
  }
  
  /**
   * Calculate duration in milliseconds from time boundaries
   */
  calculateDuration() {
    if (this.startTime_s !== null && this.endTime_s !== null) {
      this.duration_ms = (this.endTime_s - this.startTime_s) * 1000;
    }
  }
  
  /**
   * Calculate bandwidth as difference between start and end frequencies
   */
  calculateBandwidth() {
    if (this.startFreq_kHz !== null && this.endFreq_kHz !== null) {
      this.bandwidth_kHz = this.startFreq_kHz - this.endFreq_kHz;
    }
  }
  
  /**
   * Validate call parameters according to professional standards
   * Returns: { valid: boolean, reason: string }
   */
  validate() {
    if (this.duration_ms === null) this.calculateDuration();
    
    const checks = {
      hasDuration: this.duration_ms > 0,
      hasFreqs: this.peakFreq_kHz !== null && this.startFreq_kHz !== null && this.endFreq_kHz !== null,
      reasonableDuration: this.duration_ms >= DEFAULT_DETECTION_CONFIG.minCallDuration_ms,
      frequencyOrder: this.endFreq_kHz <= this.peakFreq_kHz && this.peakFreq_kHz <= this.startFreq_kHz,
    };
    
    const allValid = Object.values(checks).every(v => v);
    let reason = '';
    if (!checks.hasDuration) reason = 'Missing duration';
    else if (!checks.hasFreqs) reason = 'Missing frequency parameters';
    else if (!checks.reasonableDuration) reason = `Duration ${this.duration_ms}ms < min ${DEFAULT_DETECTION_CONFIG.minCallDuration_ms}ms`;
    else if (!checks.frequencyOrder) reason = 'Invalid frequency order';
    
    return { valid: allValid, reason };
  }
  
  /**
   * Convert to professional analysis format (similar to Avisoft export)
   */
  toAnalysisRecord() {
    return {
      'Start Time [s]': this.startTime_s?.toFixed(4) || '-',
      'End Time [s]': this.endTime_s?.toFixed(4) || '-',
      'Duration [ms]': this.duration_ms?.toFixed(2) || '-',
      'Peak Freq [kHz]': this.peakFreq_kHz?.toFixed(2) || '-',
      'Start Freq [kHz]': this.startFreq_kHz?.toFixed(2) || '-',
      'End Freq [kHz]': this.endFreq_kHz?.toFixed(2) || '-',
      'Characteristic Freq [kHz]': this.characteristicFreq_kHz?.toFixed(2) || '-',
      'Bandwidth [kHz]': this.bandwidth_kHz?.toFixed(2) || '-',
      'Peak Power [dB]': this.peakPower_dB?.toFixed(1) || '-',
    };
  }
}

/**
 * Main Bat Call Detector Class
 */
export class BatCallDetector {
  constructor(config = {}) {
    this.config = { ...DEFAULT_DETECTION_CONFIG, ...config };
    this.applyWindow = getApplyWindowFunction();
    this.goertzelEnergy = getGoertzelEnergyFunction();
  }
  
  /**
   * Detect all bat calls in audio selection
   * Returns: array of BatCall objects
   */
  async detectCalls(audioData, sampleRate, flowKHz, fhighKHz) {
    if (!audioData || audioData.length === 0) return [];
    
    // Generate high-resolution STFT spectrogram
    const spectrogram = this.generateSpectrogram(audioData, sampleRate, flowKHz, fhighKHz);
    if (!spectrogram) return [];
    
    const { powerMatrix, timeFrames, freqBins, freqResolution } = spectrogram;
    
    // Phase 1: Detect call boundaries using energy threshold
    const callSegments = this.detectCallSegments(powerMatrix, timeFrames, freqBins, flowKHz, fhighKHz);
    
    if (callSegments.length === 0) return [];
    
    // Phase 2: Measure precise parameters for each detected call
    const calls = callSegments.map(segment => {
      const call = new BatCall();
      call.startTime_s = timeFrames[segment.startFrame];
      call.endTime_s = timeFrames[Math.min(segment.endFrame + 1, timeFrames.length - 1)];
      call.spectrogram = powerMatrix.slice(segment.startFrame, segment.endFrame + 1);
      call.timeFrames = timeFrames.slice(segment.startFrame, segment.endFrame + 2);
      call.freqBins = freqBins;
      call.Flow = flowKHz * 1000;   // Store low frequency boundary in Hz
      call.Fhigh = fhighKHz;        // Store high frequency boundary in kHz
      
      call.calculateDuration();
      
      // Measure frequency parameters from spectrogram
      this.measureFrequencyParameters(call, flowKHz, fhighKHz, freqBins, freqResolution);
      
      // Classify call type (CF, FM, or CF-FM)
      call.callType = CallTypeClassifier.classify(call);
      
      return call;
    });
    
    return calls;
  }
  
  /**
   * Generate high-resolution STFT spectrogram
   * Returns: { powerMatrix, timeFrames, freqBins, freqResolution }
   */
  generateSpectrogram(audioData, sampleRate, flowKHz, fhighKHz) {
    const { fftSize, hopPercent, windowType } = this.config;
    const hopSize = Math.floor(fftSize * (hopPercent / 100));
    
    if (hopSize < 1 || fftSize > audioData.length) {
      console.warn('FFT size too large for audio data');
      return null;
    }
    
    const freqResolution = sampleRate / fftSize;
    const minBin = Math.max(0, Math.floor(flowKHz * 1000 / freqResolution));
    const maxBin = Math.min(
      Math.floor(fftSize / 2),
      Math.floor(fhighKHz * 1000 / freqResolution)
    );
    
    const numFrames = Math.floor((audioData.length - fftSize) / hopSize) + 1;
    const numBins = maxBin - minBin + 1;
    
    const powerMatrix = new Array(numFrames);
    const timeFrames = new Array(numFrames);
    const freqBins = new Float32Array(numBins);
    
    // Prepare frequency bins array (in Hz)
    for (let i = 0; i < numBins; i++) {
      freqBins[i] = (minBin + i) * freqResolution;
    }
    
    // Apply Goertzel to each frame
    for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
      const frameStart = frameIdx * hopSize;
      const frameEnd = frameStart + fftSize;
      const frameData = audioData.slice(frameStart, frameEnd);
      
      // Apply window
      const windowed = this.applyWindow(frameData, windowType);
      
      // Remove DC offset
      let dcOffset = 0;
      for (let i = 0; i < windowed.length; i++) dcOffset += windowed[i];
      dcOffset /= windowed.length;
      
      const dcRemoved = new Float32Array(windowed.length);
      for (let i = 0; i < windowed.length; i++) {
        dcRemoved[i] = windowed[i] - dcOffset;
      }
      
      // Calculate power for each frequency bin
      const framePower = new Float32Array(numBins);
      for (let i = 0; i < numBins; i++) {
        const freqHz = freqBins[i];
        const energy = this.goertzelEnergy(dcRemoved, freqHz, sampleRate);
        const rms = Math.sqrt(energy);
        const psd = (rms * rms) / fftSize;
        framePower[i] = 10 * Math.log10(Math.max(psd, 1e-16));
      }
      
      powerMatrix[frameIdx] = framePower;
      timeFrames[frameIdx] = (frameStart + fftSize / 2) / sampleRate;  // Center of frame
    }
    
    return { powerMatrix, timeFrames, freqBins, freqResolution };
  }
  
  /**
   * Phase 1: Detect call segments using energy threshold
   * Returns: array of { startFrame, endFrame }
   */
  detectCallSegments(powerMatrix, timeFrames, freqBins, flowKHz, fhighKHz) {
    const { callThreshold_dB } = this.config;
    
    // Find global maximum power across entire spectrogram for threshold reference
    let globalMaxPower = -Infinity;
    for (let frameIdx = 0; frameIdx < powerMatrix.length; frameIdx++) {
      const framePower = powerMatrix[frameIdx];
      for (let binIdx = 0; binIdx < framePower.length; binIdx++) {
        globalMaxPower = Math.max(globalMaxPower, framePower[binIdx]);
      }
    }
    
    // Threshold = global max + relative dB (typically -24 dB)
    const threshold_dB = globalMaxPower + callThreshold_dB;
    
    // Detect active frames (frames with any bin above threshold)
    const activeFrames = new Array(powerMatrix.length);
    for (let frameIdx = 0; frameIdx < powerMatrix.length; frameIdx++) {
      const framePower = powerMatrix[frameIdx];
      let isActive = false;
      for (let binIdx = 0; binIdx < framePower.length; binIdx++) {
        if (framePower[binIdx] > threshold_dB) {
          isActive = true;
          break;
        }
      }
      activeFrames[frameIdx] = isActive;
    }
    
    // Segment continuous active frames into call segments
    const segments = [];
    let segmentStart = null;
    
    for (let frameIdx = 0; frameIdx < activeFrames.length; frameIdx++) {
      if (activeFrames[frameIdx]) {
        if (segmentStart === null) {
          segmentStart = frameIdx;
        }
      } else {
        if (segmentStart !== null) {
          segments.push({
            startFrame: segmentStart,
            endFrame: frameIdx - 1
          });
          segmentStart = null;
        }
      }
    }
    
    // Catch final segment if call extends to end
    if (segmentStart !== null) {
      segments.push({
        startFrame: segmentStart,
        endFrame: activeFrames.length - 1
      });
    }
    
    return segments;
  }
  
  /**
   * Phase 2: Measure precise frequency parameters
   * Based on Avisoft SASLab Pro, SonoBat, Kaleidoscope Pro, and BatSound standards
   * 
   * Reference implementations:
   * - Avisoft: Threshold-based peak detection with interpolation
   * - SonoBat: Duration-weighted frequency averaging
   * - Kaleidoscope: Multi-frame analysis with robustness checks
   * - BatSound: Peak prominence and edge detection
   * 
   * Updates call.peakFreq, startFreq, endFreq, characteristicFreq, bandwidth
   */
  measureFrequencyParameters(call, flowKHz, fhighKHz, freqBins, freqResolution) {
    const { startEndThreshold_dB, characteristicFreq_percentEnd } = this.config;
    const spectrogram = call.spectrogram;  // [timeFrame][freqBin]
    
    if (spectrogram.length === 0) return;
    
    // ============================================================
    // STEP 1: Find peak frequency (highest power across entire call)
    // ============================================================
    let peakFreq_Hz = null;
    let peakPower_dB = -Infinity;
    let peakFrameIdx = 0;
    
    for (let frameIdx = 0; frameIdx < spectrogram.length; frameIdx++) {
      const framePower = spectrogram[frameIdx];
      for (let binIdx = 0; binIdx < framePower.length; binIdx++) {
        if (framePower[binIdx] > peakPower_dB) {
          peakPower_dB = framePower[binIdx];
          peakFreq_Hz = freqBins[binIdx];
          peakFrameIdx = frameIdx;
        }
      }
    }
    
    call.peakFreq_kHz = peakFreq_Hz / 1000;
    call.peakPower_dB = peakPower_dB;
    
    // ============================================================
    // STEP 2: Find start frequency from first frame
    // Professional standard: threshold at -18dB below global peak
    // Search from HIGH to LOW frequency (reverse bin order)
    // ============================================================
    const startThreshold_dB = peakPower_dB + startEndThreshold_dB;  // Typically -18dB
    const firstFramePower = spectrogram[0];
    let startFreq_Hz = fhighKHz * 1000;  // Default to upper bound
    
    // Search from high to low frequency (reverse order)
    for (let binIdx = firstFramePower.length - 1; binIdx >= 0; binIdx--) {
      if (firstFramePower[binIdx] > startThreshold_dB) {
        // Found first bin above threshold
        startFreq_Hz = freqBins[binIdx];
        
        // Attempt linear interpolation for sub-bin precision
        if (binIdx < firstFramePower.length - 1) {
          const thisPower = firstFramePower[binIdx];
          const nextPower = firstFramePower[binIdx + 1];
          
          if (nextPower < startThreshold_dB && thisPower > startThreshold_dB) {
            // Interpolate between this bin and next
            const powerRatio = (thisPower - startThreshold_dB) / (thisPower - nextPower);
            const freqDiff = freqBins[binIdx + 1] - freqBins[binIdx];
            startFreq_Hz = freqBins[binIdx] + powerRatio * freqDiff;
          }
        }
        break;
      }
    }
    call.startFreq_kHz = startFreq_Hz / 1000;
    
    // ============================================================
    // STEP 3: Find end frequency from last frame
    // Professional standard: threshold at -18dB below global peak
    // Search from LOW to HIGH frequency (normal bin order)
    // ============================================================
    const lastFramePower = spectrogram[spectrogram.length - 1];
    let endFreq_Hz = flowKHz * 1000;  // Default to lower bound
    
    // Search from low to high frequency
    for (let binIdx = 0; binIdx < lastFramePower.length; binIdx++) {
      if (lastFramePower[binIdx] > startThreshold_dB) {
        endFreq_Hz = freqBins[binIdx];
        
        // Attempt linear interpolation for sub-bin precision
        if (binIdx > 0) {
          const thisPower = lastFramePower[binIdx];
          const prevPower = lastFramePower[binIdx - 1];
          
          if (prevPower < startThreshold_dB && thisPower > startThreshold_dB) {
            // Interpolate between prev bin and this bin
            const powerRatio = (thisPower - startThreshold_dB) / (thisPower - prevPower);
            const freqDiff = freqBins[binIdx] - freqBins[binIdx - 1];
            endFreq_Hz = freqBins[binIdx] - powerRatio * freqDiff;
          }
        }
        break;
      }
    }
    call.endFreq_kHz = endFreq_Hz / 1000;
    
    // ============================================================
    // STEP 4: Calculate characteristic frequency (CF-FM distinction)
    // 
    // CRITICAL FIX: Characteristic frequency should be calculated from
    // the END portion of the call (last 10-20%), not just the lowest freq.
    // 
    // For CF-FM bats (Molossidae, Rhinolophidae, Hipposideridae):
    // - CF phase has constant frequency (used for Doppler compensation)
    // - FM phase has downward sweep
    // - Characteristic frequency = CF phase frequency (from end portion)
    // 
    // For pure FM bats (Vespertilionidae):
    // - Entire call is FM sweep
    // - Characteristic frequency ≈ End frequency (lowest)
    // 
    // Method: Extract CENTER frequency from last 10-20% portion
    // ============================================================
    const lastPercentStart = Math.floor(spectrogram.length * (1 - characteristicFreq_percentEnd / 100));
    let characteristicFreq_Hz = peakFreq_Hz;
    
    if (lastPercentStart < spectrogram.length) {
      // Method 1: Find weighted average frequency in last portion
      // This handles CF-FM calls better than just finding the minimum
      let totalPower = 0;
      let weightedFreq = 0;
      
      for (let frameIdx = Math.max(0, lastPercentStart); frameIdx < spectrogram.length; frameIdx++) {
        const framePower = spectrogram[frameIdx];
        
        // Find frame maximum for normalization
        let frameMax = -Infinity;
        for (let binIdx = 0; binIdx < framePower.length; binIdx++) {
          frameMax = Math.max(frameMax, framePower[binIdx]);
        }
        
        // Use -6dB threshold (half power) to define "significant" region
        const significantThreshold = frameMax - 6;
        
        for (let binIdx = 0; binIdx < framePower.length; binIdx++) {
          const power = framePower[binIdx];
          if (power > significantThreshold) {
            // Weight by power in dB scale
            const linearPower = Math.pow(10, power / 10);
            totalPower += linearPower;
            weightedFreq += linearPower * freqBins[binIdx];
          }
        }
      }
      
      // Calculate weighted average frequency
      if (totalPower > 0) {
        characteristicFreq_Hz = weightedFreq / totalPower;
      } else {
        // Fallback: find lowest frequency in end portion
        for (let frameIdx = Math.max(0, lastPercentStart); frameIdx < spectrogram.length; frameIdx++) {
          const framePower = spectrogram[frameIdx];
          for (let binIdx = 0; binIdx < framePower.length; binIdx++) {
            if (framePower[binIdx] > -Infinity) {
              characteristicFreq_Hz = freqBins[binIdx];
              break;
            }
          }
        }
      }
    }
    
    call.characteristicFreq_kHz = characteristicFreq_Hz / 1000;
    
    // ============================================================
    // STEP 5: Validate frequency relationships (Avisoft standard)
    // Ensure: endFreq ≤ charFreq ≤ peakFreq ≤ startFreq
    // This maintains biological validity for FM and CF-FM calls
    // ============================================================
    // Clamp characteristic frequency between end and peak
    const endFreqKHz = endFreq_Hz / 1000;
    const charFreqKHz = characteristicFreq_Hz / 1000;
    const peakFreqKHz = peakFreq_Hz / 1000;
    const startFreqKHz = startFreq_Hz / 1000;
    
    if (charFreqKHz < endFreqKHz) {
      // Char freq should not be below end freq
      call.characteristicFreq_kHz = endFreqKHz;
    } else if (charFreqKHz > peakFreqKHz) {
      // Char freq should not exceed peak freq
      call.characteristicFreq_kHz = peakFreqKHz;
    }
    
    // Calculate bandwidth
    call.calculateBandwidth();
  }
  
  /**
   * Measure call parameters for a selected frequency range
   * Used by Power Spectrum popup for real-time parameter calculation
   */
  async measureSelectionParameters(audioData, sampleRate, startTime_s, endTime_s, flowKHz, fhighKHz) {
    const startSample = Math.floor(startTime_s * sampleRate);
    const endSample = Math.floor(endTime_s * sampleRate);
    
    const selectionAudio = audioData.slice(startSample, endSample);
    if (selectionAudio.length === 0) return null;
    
    // For a selected region, we treat it as one call
    const calls = await this.detectCalls(selectionAudio, sampleRate, flowKHz, fhighKHz);
    
    if (calls.length === 0) {
      // If no call detected, still provide peak frequency
      return this.measureDirectSelection(selectionAudio, sampleRate, flowKHz, fhighKHz);
    }
    
    // Return the most significant call in the selection
    let maxCall = calls[0];
    for (const call of calls) {
      if ((call.endTime_s - call.startTime_s) > (maxCall.endTime_s - maxCall.startTime_s)) {
        maxCall = call;
      }
    }
    
    // Adjust times to be relative to original audio
    maxCall.startTime_s += startTime_s;
    maxCall.endTime_s += startTime_s;
    
    return maxCall;
  }
  
  /**
   * Direct measurement for user-selected region (no detection, just measurement)
   * Used when user explicitly selects an area
   */
  measureDirectSelection(audioData, sampleRate, flowKHz, fhighKHz) {
    const { fftSize, windowType } = this.config;
    
    // Apply window
    const windowed = this.applyWindow(audioData, windowType);
    
    // Remove DC
    let dcOffset = 0;
    for (let i = 0; i < windowed.length; i++) dcOffset += windowed[i];
    dcOffset /= windowed.length;
    
    const dcRemoved = new Float32Array(windowed.length);
    for (let i = 0; i < windowed.length; i++) {
      dcRemoved[i] = windowed[i] - dcOffset;
    }
    
    const freqResolution = sampleRate / fftSize;
    const minBin = Math.max(0, Math.floor(flowKHz * 1000 / freqResolution));
    const maxBin = Math.min(
      Math.floor(fftSize / 2),
      Math.floor(fhighKHz * 1000 / freqResolution)
    );
    
    // Measure peak frequency
    let peakFreq_Hz = null;
    let peakPower_dB = -Infinity;
    
    for (let binIdx = minBin; binIdx <= maxBin; binIdx++) {
      const freqHz = binIdx * freqResolution;
      const energy = this.goertzelEnergy(dcRemoved, freqHz, sampleRate);
      const rms = Math.sqrt(energy);
      const psd = (rms * rms) / fftSize;
      const powerDb = 10 * Math.log10(Math.max(psd, 1e-16));
      
      if (powerDb > peakPower_dB) {
        peakPower_dB = powerDb;
        peakFreq_Hz = freqHz;
      }
    }
    
    const call = new BatCall();
    call.peakFreq_kHz = peakFreq_Hz ? peakFreq_Hz / 1000 : null;
    call.peakPower_dB = peakPower_dB;
    call.Flow = flowKHz * 1000;     // Store low frequency boundary in Hz
    call.Fhigh = fhighKHz;          // Store high frequency boundary in kHz
    
    return call;
  }
}

/**
 * Export default detector instance with standard configuration
 */
export const defaultDetector = new BatCallDetector();
