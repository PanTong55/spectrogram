/**
 * Professional-grade Bat Call Detection and Parameter Measurement Module
 */

import { getApplyWindowFunction, getGoertzelEnergyFunction } from './callAnalysisPopup.js';
export const DEFAULT_DETECTION_CONFIG = {
  // Energy threshold (dB below max) for call detection
  callThreshold_dB: -24,
  
  // High frequency threshold (dB below peak). Range: -24 to -70 dB
  highFreqThreshold_dB: -24,
  
  // Enable automatic optimization of high frequency threshold
  highFreqThreshold_dB_isAuto: true,
  
  // Low frequency threshold (dB below peak). Fixed at -27 dB for anti-rebounce
  lowFreqThreshold_dB: -27,
  
  // Enable automatic optimization of low frequency threshold
  lowFreqThreshold_dB_isAuto: true,
  
  // Characteristic frequency window: last N% of call duration
  characteristicFreq_percentEnd: 20,
  
  // Minimum call duration threshold (ms)
  minCallDuration_ms: 1,
  
  // Maximum gap between segments to bridge (ms)
  maxGapBridge_ms: 0,
  
  // Frequency resolution (Hz)
  freqResolution_Hz: 1,
  
  // Window function: 'hann', 'hamming', 'blackman', etc.
  windowType: 'hann',
  
  // FFT size for STFT analysis
  fftSize: 1024,
  
  // Hop size as percentage of FFT size. 3.125% = 96.875% overlap
  hopPercent: 3.125,
  
  // Call type: 'auto' (detect CF/FM), 'cf' (constant frequency), 'fm' (frequency modulated)
  callType: 'auto',
  
  // Minimum power in characteristic frequency region (dB)
  cfRegionThreshold_dB: -30,
  
  // ANTI-REBOUNCE PARAMETERS (2025)
  // Prevent false detections from echoes and reverberations in tunnels, forests, buildings
  
  // Enable backward scanning to detect true end frequency (prevents rebounce tail detection)
  enableBackwardEndFreqScan: true,
  
  // Maximum frequency drop threshold (kHz). Lock frequency after dropping below peak by this amount
  maxFrequencyDropThreshold_kHz: 10,
  
  // Protection window after peak energy (ms). Accept call content only within this window
  protectionWindowAfterPeak_ms: 10,
};

/**
 * Bat call type classifier
 */
export class CallTypeClassifier {
  /**
   * Classify call type based on bandwidth
   * CF: < 5 kHz | CF-FM: 5-20 kHz | FM: > 20 kHz
   */
  static classify(call) {
    if (!call.bandwidth_kHz || call.bandwidth_kHz < 5) {
      return 'CF';
    }
    if (call.bandwidth_kHz > 20) {
      return 'FM';
    }
    return 'CF-FM';
  }
  
  /**
   * Check if call matches CF bat characteristics
   * Bandwidth < 5 kHz and frequency > 10 kHz
   */
  static isCFBat(call) {
    return call.bandwidth_kHz < 5 && call.peakFreq_kHz > 10;
  }
  
  /**
   * Check if call matches FM bat characteristics
   * Bandwidth > 10 kHz with downward frequency sweep
   */
  static isFMBat(call) {
    return call.bandwidth_kHz > 10 && call.highFreq_kHz > call.lowFreq_kHz;
  }
}

/**
 * Represents a single detected bat call with all measured parameters
 */
export class BatCall {
  constructor() {
    this.startTime_s = null;        // Call start time (seconds)
    this.endTime_s = null;          // Call end time (seconds)
    this.duration_ms = null;        // Total duration (milliseconds)
    
    // FREQUENCY PARAMETERS: 7 key measurements with time values
    
    this.peakFreq_kHz = null;       // Peak frequency (kHz) - absolute maximum power
    this.peakFreqTime_ms = null;    // Peak frequency time (ms) in selection area
    
    this.highFreq_kHz = null;       // High frequency (kHz) - highest frequency across all frames
    this.highFreqTime_ms = null;    // High frequency time (ms) in selection area
    this.highFreqFrameIdx = null;   // High frequency frame index
    
    this.startFreq_kHz = null;      // Start frequency (kHz) - from first frame
    this.startFreq_ms = null;       // Start frequency time (ms) - always 0
    this.startFreqFrameIdx = null;  // Start frequency frame index - always 0
    this.startFreqTime_s = null;    // [DEPRECATED] Use startFreq_ms instead
    
    this.endFreq_kHz = null;        // End frequency (kHz) - from last frame
    this.endFreq_ms = null;         // End frequency time (ms) in selection area
    this.endFreqTime_s = null;      // [DEPRECATED] Use endFreq_ms instead
    
    this.lowFreq_kHz = null;        // Low frequency (kHz) - lowest frequency in call
    this.lowFreq_ms = null;         // Low frequency time (ms) in selection area
    
    this.characteristicFreq_kHz = null;  // Characteristic frequency (lowest in last 20%)
    this.characteristicFreq_ms = null;   // Characteristic frequency time (ms)
    
    this.kneeFreq_kHz = null;       // Knee frequency (kHz) - CF-FM transition point
    this.kneeFreq_ms = null;        // Knee frequency time (ms)
    this.kneeTime_ms = null;        // [DEPRECATED] Use kneeFreq_ms instead
    
    this.bandwidth_kHz = null;      // Bandwidth (highFreq - lowFreq)
    
    // Frequency boundaries
    this.Flow = null;               // Low frequency boundary (Hz)
    this.Fhigh = null;              // High frequency boundary (kHz)
    
    // Power measurements
    this.peakPower_dB = null;       // Peak power (dB)
    this.startPower_dB = null;      // Power at start frequency (dB)
    this.endPower_dB = null;        // Power at end frequency (dB)
    
    // Quality metrics
    this.noiseFloor_dB = null;      // Noise floor (25th percentile)
    this.snr_dB = null;             // Signal-to-noise ratio (dB)
    this.quality = null;            // Quality rating: Very Poor/Poor/Normal/Good/Excellent
    
    this.highFreqDetectionWarning = false;  // Flag: reached -70dB limit
    
    // Threshold values used for this call (2025)
    this.highFreqThreshold_dB_used = null;  // Actual high frequency threshold used
    this.lowFreqThreshold_dB_used = null;   // Actual low frequency threshold used
    
    // Call classification
    this.callType = 'FM';           // 'CF', 'FM', or 'CF-FM'
    
    // Spectrogram data for visualization
    this.spectrogram = null;        // 2D array [timeFrames][frequencyBins]
    this.timeFrames = null;         // Time points for each frame
    this.freqBins = null;           // Frequency bins (Hz)
  }
  
  /**
   * Calculate call duration in milliseconds
   * Prefers frequency-based timing over time-based
   */
  calculateDuration() {
    if (this.startFreqTime_s !== null && this.endFreqTime_s !== null) {
      this.duration_ms = (this.endFreqTime_s - this.startFreqTime_s) * 1000;
    } else if (this.startTime_s !== null && this.endTime_s !== null) {
      this.duration_ms = (this.endTime_s - this.startTime_s) * 1000;
    }
  }
  
  /**
   * Calculate bandwidth (high frequency - low frequency)
   */
  calculateBandwidth() {
    if (this.highFreq_kHz !== null && this.lowFreq_kHz !== null) {
      this.bandwidth_kHz = this.highFreq_kHz - this.lowFreq_kHz;
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
      hasFreqs: this.peakFreq_kHz !== null && this.highFreq_kHz !== null && this.lowFreq_kHz !== null,
      reasonableDuration: this.duration_ms >= DEFAULT_DETECTION_CONFIG.minCallDuration_ms,
      frequencyOrder: this.lowFreq_kHz <= this.peakFreq_kHz && this.peakFreq_kHz <= this.highFreq_kHz,
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
   * Convert to professional analysis record format (similar to Avisoft)
   */
  toAnalysisRecord() {
    return {
      'Start Time [s]': this.startTime_s?.toFixed(4) || '-',
      'End Time [s]': this.endTime_s?.toFixed(4) || '-',
      'Duration [ms]': this.duration_ms?.toFixed(2) || '-',
      'Peak Freq [kHz]': this.peakFreq_kHz?.toFixed(2) || '-',
      'High Freq [kHz]': this.highFreq_kHz?.toFixed(2) || '-',
      'Start Freq [kHz]': this.startFreq_kHz?.toFixed(2) || '-',
      'End Freq [kHz]': this.endFreq_kHz?.toFixed(2) || '-',
      'Low Freq [kHz]': this.lowFreq_kHz?.toFixed(2) || '-',
      'Knee Freq [kHz]': this.kneeFreq_kHz?.toFixed(2) || '-',
      'Characteristic Freq [kHz]': this.characteristicFreq_kHz?.toFixed(2) || '-',
      'Bandwidth [kHz]': this.bandwidth_kHz?.toFixed(2) || '-',
      'Peak Power [dB]': this.peakPower_dB?.toFixed(1) || '-',
      'Knee Time [ms]': this.kneeTime_ms?.toFixed(2) || '-',
      'SNR [dB]': this.snr_dB !== null ? (this.snr_dB > 0 ? `+${this.snr_dB.toFixed(1)}` : this.snr_dB.toFixed(1)) : '-',
      'Quality': this.quality || '-',
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
   * Calculate quality rating based on SNR (Signal-to-Noise Ratio)
   * SNR ranges:
   * - < 10 dB: Very Poor
   * - 10-20 dB: Poor
   * - 20-40 dB: Normal
   * - 40-60 dB: Good
   * - >= 60 dB: Excellent
   */
  getQualityRating(snr_dB) {
    if (snr_dB < 10) {
      return 'Very Poor';
    } else if (snr_dB < 20) {
      return 'Poor';
    } else if (snr_dB < 40) {
      return 'Normal';
    } else if (snr_dB < 60) {
      return 'Good';
    } else {
      return 'Excellent';
    }
  }
  
  /**
   * Main detection pipeline for bat calls in audio selection
   * Returns: array of BatCall objects
   * 
   * Algorithm:
   * 1. Generate high-resolution STFT spectrogram
   * 2. Detect call segments using energy threshold
   * 3. Measure frequency parameters for each segment
   * 4. Calculate SNR and quality rating
   * 5. Filter out low-SNR detections (noise)
   */
  async detectCalls(audioData, sampleRate, flowKHz, fhighKHz) {
    if (!audioData || audioData.length === 0) return [];
    
    // Generate STFT spectrogram with high time-frequency resolution
    const spectrogram = this.generateSpectrogram(audioData, sampleRate, flowKHz, fhighKHz);
    if (!spectrogram) return [];
    
    const { powerMatrix, timeFrames, freqBins, freqResolution } = spectrogram;
    
    // Detect call segments using energy threshold
    const callSegments = this.detectCallSegments(powerMatrix, timeFrames, freqBins, flowKHz, fhighKHz);
    
    if (callSegments.length === 0) return [];
    
    // Measure frequency parameters for each detected segment
    const calls = callSegments.map(segment => {
      const call = new BatCall();
      call.startTime_s = timeFrames[segment.startFrame];
      call.endTime_s = timeFrames[Math.min(segment.endFrame + 1, timeFrames.length - 1)];
      call.spectrogram = powerMatrix.slice(segment.startFrame, segment.endFrame + 1);
      call.timeFrames = timeFrames.slice(segment.startFrame, segment.endFrame + 2);
      call.freqBins = freqBins;
      
      call.calculateDuration();
      
      // Filter: discard calls shorter than minimum duration
      if (call.duration_ms < this.config.minCallDuration_ms) {
        return null;
      }
      
      // Measure frequency parameters
      this.measureFrequencyParameters(call, flowKHz, fhighKHz, freqBins, freqResolution);
      
      // Set frequency boundaries (commercial standard)
      call.Flow = call.lowFreq_kHz * 1000;   // Hz
      call.Fhigh = call.highFreq_kHz;        // kHz
      
      // Classify call type
      call.callType = CallTypeClassifier.classify(call);
      
      return call;
    }).filter(call => call !== null);
    
    // Calculate noise floor and SNR for quality assessment
    const allPowerValues = [];
    
    for (let frameIdx = 0; frameIdx < powerMatrix.length; frameIdx++) {
      const framePower = powerMatrix[frameIdx];
      for (let binIdx = 0; binIdx < framePower.length; binIdx++) {
        allPowerValues.push(framePower[binIdx]);
      }
    }
    
    // Sort to calculate percentiles
    allPowerValues.sort((a, b) => a - b);
    
    // Noise floor = 25th percentile (robust estimate)
    // This represents the typical background noise level
    const percentile25Index = Math.floor(allPowerValues.length * 0.25);
    const noiseFloor_dB = allPowerValues[Math.max(0, percentile25Index)];
    
    // Use minimum baseline to ensure reasonable noise floor estimate
    const minNoiseFloor_dB = -80;
    const robustNoiseFloor_dB = Math.max(noiseFloor_dB, minNoiseFloor_dB);
    
    // Filter calls by SNR: only keep calls with significant signal above noise
    const snrThreshold_dB = 20;  // Minimum SNR requirement
    const filteredCalls = calls.filter(call => {
      if (call.peakPower_dB === null || call.peakPower_dB === undefined) {
        return false;
      }
      
      // Calculate SNR using robust noise baseline
      const snr_dB = call.peakPower_dB - robustNoiseFloor_dB;
      
      // Store SNR and noise floor for reporting
      call.noiseFloor_dB = robustNoiseFloor_dB;
      call.snr_dB = snr_dB;
      call.quality = this.getQualityRating(snr_dB);
      
      // Discard low-SNR detections (likely noise)
      return snr_dB >= snrThreshold_dB;
    });
    
    return filteredCalls;
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
    
    // Prepare frequency bins array (Hz)
    for (let i = 0; i < numBins; i++) {
      freqBins[i] = (minBin + i) * freqResolution;
    }
    
    // Compute power for each frame using Goertzel algorithm
    for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
      const frameStart = frameIdx * hopSize;
      const frameEnd = frameStart + fftSize;
      const frameData = audioData.slice(frameStart, frameEnd);
      
      // Apply window function
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
      timeFrames[frameIdx] = (frameStart + fftSize / 2) / sampleRate;  // Frame center time
    }
    
    return { powerMatrix, timeFrames, freqBins, freqResolution };
  }
  
  /**
   * Phase 1: Detect call segments using energy threshold
   * Returns: array of { startFrame, endFrame }
   */
  detectCallSegments(powerMatrix, timeFrames, freqBins, flowKHz, fhighKHz) {
    const { callThreshold_dB } = this.config;
    
    // Find global maximum power for threshold reference
    let globalMaxPower = -Infinity;
    for (let frameIdx = 0; frameIdx < powerMatrix.length; frameIdx++) {
      const framePower = powerMatrix[frameIdx];
      for (let binIdx = 0; binIdx < framePower.length; binIdx++) {
        globalMaxPower = Math.max(globalMaxPower, framePower[binIdx]);
      }
    }
    
    // Apply threshold: global max + relative dB
    const threshold_dB = globalMaxPower + callThreshold_dB;
    
    // Detect active frames (containing energy above threshold)
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
    
    // Segment continuous active frames into call boundaries
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
    
    // Capture final segment if extending to end
    if (segmentStart !== null) {
      segments.push({
        startFrame: segmentStart,
        endFrame: activeFrames.length - 1
      });
    }
    
    return segments;
  }
  
  /**
   * Savitzky-Golay smoothing filter for frequency contour smoothing
   * 
   * Used for stable 2nd derivative calculation before knee detection
   * Parameters: window=5, polynomial order=2
   * (Standard used by Avisoft for knee detection)
   * 
   * Advantages over moving average:
   * - Preserves peaks and edges better
   * - Reduces noise while maintaining signal features
   */
  savitzkyGolay(data, windowSize = 5, polyOrder = 2) {
    if (data.length < windowSize) return data;
    
    const halfWindow = Math.floor(windowSize / 2);
    const smoothed = new Array(data.length);
    
    // Pre-calculated SG coefficients for window=5, polyorder=2
    const sgCoeffs = [-3, 12, 17, 12, -3];
    const sgSum = 35;
    
    // Apply filter with boundary handling
    for (let i = 0; i < data.length; i++) {
      let sum = 0;
      
      for (let j = -halfWindow; j <= halfWindow; j++) {
        const idx = i + j;
        if (idx >= 0 && idx < data.length) {
          const coeffIdx = j + halfWindow;
          sum += data[idx] * sgCoeffs[coeffIdx];
        }
      }
      
      smoothed[i] = sum / sgSum;
    }
    
    return smoothed;
  }

  /**
   * Validate Low Frequency measurement against anti-rebounce protection rules
   * 
   * Ensures Low Frequency is consistent with anti-rebounce detection
   * and meets professional measurement standards.
   * 
   * Returns: { valid, reason, confidence (0-1), details }
   */
  validateLowFrequencyMeasurement(
    lowFreq_Hz, lowFreq_kHz, peakFreq_Hz, peakPower_dB,
    thisPower, prevPower, endThreshold_dB, freqBinWidth_Hz,
    rebounceDetected = false
  ) {
    const result = {
      valid: true,
      reason: '',
      confidence: 1.0,
      details: {
        frequencySpread: Math.abs((peakFreq_Hz / 1000) - lowFreq_kHz),
        powerRatio_dB: thisPower - prevPower,
        interpolationRatio: (thisPower - endThreshold_dB) / Math.max(thisPower - prevPower, 0.001),
        rebounceCompat: !rebounceDetected ? 'N/A' : 'verified'
      }
    };
    
    // Check 1: Frequency relationship (Low < Peak)
    const peakFreq_kHz = peakFreq_Hz / 1000;
    if (lowFreq_kHz > peakFreq_kHz) {
      result.valid = false;
      result.reason = `Low Freq (${lowFreq_kHz.toFixed(2)} kHz) exceeds Peak (${peakFreq_kHz.toFixed(2)} kHz)`;
      result.confidence = 0.0;
      return result;
    }
    
    // Check frequency spread
    const freqSpread = peakFreq_kHz - lowFreq_kHz;
    if (freqSpread < 0.5) {
      result.confidence *= 0.8;
      result.details.frequencySpreadWarning = 'Very narrow bandwidth (< 0.5 kHz)';
    }
    
    // Check 2: Power ratio at threshold crossing
    const powerRatio = Math.abs(thisPower - prevPower);
    if (powerRatio < 2.0) {
      result.confidence *= 0.7;
      result.details.powerRatioWarning = 'Weak power gradient (< 2 dB)';
    } else if (powerRatio > 20) {
      result.confidence *= 1.0;
    } else {
      result.confidence *= 0.95;
    }
    
    // Check 3: Interpolation sanity
    const interpolationRatio = result.details.interpolationRatio;
    if (interpolationRatio < 0 || interpolationRatio > 1) {
      result.valid = false;
      result.reason = `Invalid interpolation ratio: ${interpolationRatio.toFixed(3)}`;
      result.confidence = 0.3;
      return result;
    }
    
    // Check 4: Anti-rebounce compatibility
    if (rebounceDetected) {
      if (thisPower < (endThreshold_dB + 3)) {
        result.confidence *= 0.6;
        result.details.rebounceWarning = 'Low frequency power barely above threshold';
      }
      result.details.rebounceCompat = 'verified';
    }
    
    // Final assessment
    if (result.confidence < 0.6) {
      result.valid = false;
      if (!result.reason) {
        result.reason = `Low confidence (${(result.confidence * 100).toFixed(1)}%)`;
      }
    }
    
    return result;
  }

  /**
   * Find optimal high frequency threshold by testing range and detecting anomalies
   * 
   * Algorithm:
   * 1. Test each threshold on first frame (-24 to -70 dB)
   * 2. For each threshold: calculate high frequency (high→low scan) and start frequency (low→high scan)
   * 3. Detect anomalies: frequency jumps > 2.5 kHz indicate threshold instability
   * 4. Select threshold just before first major anomaly, or use last stable threshold if anomaly is followed by 3+ normal values
   * 5. Apply safety mechanism: cap at -30 dB if needed (prevents extreme extrapolation)
   * 
   * Returns: { threshold, highFreq_Hz, highFreq_kHz, startFreq_Hz, startFreq_kHz, warning }
   */
  findOptimalHighFrequencyThreshold(spectrogram, freqBins, flowKHz, fhighKHz, callPeakPower_dB, peakFrameIdx = 0) {
    if (spectrogram.length === 0) return {
      threshold: -24,
      highFreq_Hz: null,
      highFreq_kHz: null,
      startFreq_Hz: null,
      startFreq_kHz: null,
      warning: false
    };

    const firstFramePower = spectrogram[0];
    
    const stablePeakPower_dB = callPeakPower_dB;
    
    // Test threshold range: -24 to -70 dB with 0.5 dB steps
    const thresholdRange = [];
    for (let threshold = -24; threshold >= -70; threshold -= 0.5) {
      thresholdRange.push(threshold);
    }
    
    // Measure high and start frequencies for each threshold
    const measurements = [];
    
    for (const testThreshold_dB of thresholdRange) {
      let highFreq_Hz = null;
      let highFreqBinIdx = 0;
      let startFreq_Hz = null;
      let foundBin = false;
      
      const highFreqThreshold_dB = stablePeakPower_dB + testThreshold_dB;
      
      // HIGH FREQUENCY: scan high to low, find first bin above threshold
      for (let binIdx = firstFramePower.length - 1; binIdx >= 0; binIdx--) {
        if (firstFramePower[binIdx] > highFreqThreshold_dB) {
          highFreq_Hz = freqBins[binIdx];
          highFreqBinIdx = binIdx;
          foundBin = true;
          
          // Apply linear interpolation for sub-bin precision
          if (binIdx < firstFramePower.length - 1) {
            const thisPower = firstFramePower[binIdx];
            const nextPower = firstFramePower[binIdx + 1];
            
            if (nextPower < highFreqThreshold_dB && thisPower > highFreqThreshold_dB) {
              const powerRatio = (thisPower - highFreqThreshold_dB) / (thisPower - nextPower);
              const freqDiff = freqBins[binIdx + 1] - freqBins[binIdx];
              highFreq_Hz = freqBins[binIdx] + powerRatio * freqDiff;
            }
          }
          break;
        }
      }
      
      // START FREQUENCY: scan low to high, find first bin above threshold (independent calculation)
      if (foundBin) {
        for (let binIdx = 0; binIdx < firstFramePower.length; binIdx++) {
          if (firstFramePower[binIdx] > highFreqThreshold_dB) {
            startFreq_Hz = freqBins[binIdx];
            
            // Apply linear interpolation
            if (binIdx > 0) {
              const thisPower = firstFramePower[binIdx];
              const prevPower = firstFramePower[binIdx - 1];
              
              if (prevPower < highFreqThreshold_dB && thisPower > highFreqThreshold_dB) {
                const powerRatio = (thisPower - highFreqThreshold_dB) / (thisPower - prevPower);
                const freqDiff = freqBins[binIdx] - freqBins[binIdx - 1];
                startFreq_Hz = freqBins[binIdx] - powerRatio * freqDiff;
              }
            }
            break;
          }
        }
      }
      
      // Unable to measure at this threshold if no bin found
      if (!foundBin) {
        highFreq_Hz = null;
        startFreq_Hz = null;
      }
      
      measurements.push({
        threshold: testThreshold_dB,
        highFreqThreshold_dB: highFreqThreshold_dB,
        highFreq_Hz: highFreq_Hz,
        highFreq_kHz: highFreq_Hz !== null ? highFreq_Hz / 1000 : null,
        highFreqBinIdx: highFreqBinIdx,
        startFreq_Hz: startFreq_Hz,
        startFreq_kHz: startFreq_Hz !== null ? startFreq_Hz / 1000 : null,
        foundBin: foundBin
      });
    }
    
    // Collect only measurements with successful bin detection
    const validMeasurements = measurements.filter(m => m.foundBin);
    
    if (validMeasurements.length === 0) {
      return {
        threshold: -24,
        highFreq_Hz: null,
        highFreq_kHz: null,
        startFreq_Hz: null,
        startFreq_kHz: null,
        warning: false
      };
    }
    
    // Determine optimal threshold by detecting anomalies
    // Look for first anomaly (frequency jump > 2.5 kHz) or use last stable threshold
    let optimalThreshold = -24;
    let optimalMeasurement = validMeasurements[0];
    
    // Track anomaly detection state
    let lastValidThreshold = validMeasurements[0].threshold;
    let lastValidMeasurement = validMeasurements[0];
    let recordedEarlyAnomaly = null;
    let firstAnomalyIndex = -1;
    
    // Compare each measurement with previous for anomalies
    for (let i = 1; i < validMeasurements.length; i++) {
      const prevFreq_kHz = validMeasurements[i - 1].highFreq_kHz;
      const currFreq_kHz = validMeasurements[i].highFreq_kHz;
      const freqDifference = Math.abs(currFreq_kHz - prevFreq_kHz);
      
      // Major jump protection: frequency drop > 4 kHz triggers immediate stop
      if (freqDifference > 4.0) {
        optimalThreshold = validMeasurements[i - 1].threshold;
        optimalMeasurement = validMeasurements[i - 1];
        break;
      }
      
      const isAnomaly = freqDifference > 2.5;
      
      if (isAnomaly) {
        // Detected anomaly (> 2.5 kHz jump)
        // Record early anomaly if not already recorded
        if (recordedEarlyAnomaly === null && firstAnomalyIndex === -1) {
          firstAnomalyIndex = i;
          recordedEarlyAnomaly = validMeasurements[i - 1].threshold;
          lastValidThreshold = validMeasurements[i - 1].threshold;
          lastValidMeasurement = validMeasurements[i - 1];
        }
      } else {
        // Normal value: no major jump detected
        
        // If early anomaly recorded, check if followed by 3+ normal values
        if (recordedEarlyAnomaly !== null && firstAnomalyIndex !== -1) {
          const afterAnomalyStart = firstAnomalyIndex + 1;
          const afterAnomalyEnd = Math.min(firstAnomalyIndex + 3, validMeasurements.length - 1);
          
          // Check if 3 values after anomaly are all normal
          let hasThreeNormalAfterAnomaly = true;
          
          for (let checkIdx = afterAnomalyStart; checkIdx <= afterAnomalyEnd; checkIdx++) {
            if (checkIdx >= validMeasurements.length) {
              hasThreeNormalAfterAnomaly = false;
              break;
            }
            
            const checkPrevFreq_kHz = validMeasurements[checkIdx - 1].highFreq_kHz;
            const checkCurrFreq_kHz = validMeasurements[checkIdx].highFreq_kHz;
            const checkFreqDiff = Math.abs(checkCurrFreq_kHz - checkPrevFreq_kHz);
            
            if (checkFreqDiff > 2.5) {
              hasThreeNormalAfterAnomaly = false;
              break;
            }
          }
          
          // Ignore early anomaly if followed by 3+ normal values
          if (hasThreeNormalAfterAnomaly && (afterAnomalyEnd - afterAnomalyStart + 1) >= 3) {
            recordedEarlyAnomaly = null;
            firstAnomalyIndex = -1;
          }
        }
        
        // Update last valid measurement
        lastValidThreshold = validMeasurements[i].threshold;
        lastValidMeasurement = validMeasurements[i];
      }
    }
    
    // Select optimal threshold
    if (recordedEarlyAnomaly !== null) {
      // Use threshold before unignored anomaly
      optimalThreshold = recordedEarlyAnomaly;
      optimalMeasurement = lastValidMeasurement;
    } else {
      // Use last valid threshold (no anomaly or anomaly ignored)
      optimalThreshold = lastValidThreshold;
      optimalMeasurement = lastValidMeasurement;
    }
    
    // Ensure threshold in valid range
    const finalThreshold = Math.max(Math.min(optimalThreshold, -24), -70);
    
    // Safety mechanism: cap at -30 dB if calculation reaches -70 dB limit
    const safeThreshold = (finalThreshold <= -70) ? -30 : finalThreshold;
    const hasWarning = finalThreshold <= -70;
    
    // If safety mechanism activated, recalculate high frequency using -30 dB
    let returnHighFreq_Hz = optimalMeasurement.highFreq_Hz;
    let returnHighFreq_kHz = optimalMeasurement.highFreq_kHz;
    let returnHighFreqBinIdx = optimalMeasurement.highFreqBinIdx;
    let returnStartFreq_Hz = optimalMeasurement.startFreq_Hz;
    let returnStartFreq_kHz = optimalMeasurement.startFreq_kHz;
    
    if (safeThreshold !== finalThreshold) {
      // Recalculate using safe threshold
      const firstFramePower = spectrogram[0];
      const peakPower_dB = callPeakPower_dB;
      const highFreqThreshold_dB_safe = peakPower_dB + safeThreshold;
      
      let highFreq_Hz_safe = null;
      let highFreqBinIdx_safe = 0;
      let startFreq_Hz_safe = null;
      
      // Calculate high frequency using safe threshold
      for (let binIdx = firstFramePower.length - 1; binIdx >= 0; binIdx--) {
        if (firstFramePower[binIdx] > highFreqThreshold_dB_safe) {
          highFreq_Hz_safe = freqBins[binIdx];
          highFreqBinIdx_safe = binIdx;
          
          // Apply linear interpolation
          if (binIdx < firstFramePower.length - 1) {
            const thisPower = firstFramePower[binIdx];
            const nextPower = firstFramePower[binIdx + 1];
            
            if (nextPower < highFreqThreshold_dB_safe && thisPower > highFreqThreshold_dB_safe) {
              const powerRatio = (thisPower - highFreqThreshold_dB_safe) / (thisPower - nextPower);
              const freqDiff = freqBins[binIdx + 1] - freqBins[binIdx];
              highFreq_Hz_safe = freqBins[binIdx] + powerRatio * freqDiff;
            }
          }
          break;
        }
      }
      
      // Calculate start frequency
      if (highFreq_Hz_safe !== null) {
        for (let binIdx = 0; binIdx < firstFramePower.length; binIdx++) {
          if (firstFramePower[binIdx] > highFreqThreshold_dB_safe) {
            startFreq_Hz_safe = freqBins[binIdx];
            
            // Apply linear interpolation
            if (binIdx > 0) {
              const thisPower = firstFramePower[binIdx];
              const prevPower = firstFramePower[binIdx - 1];
              
              if (prevPower < highFreqThreshold_dB_safe && thisPower > highFreqThreshold_dB_safe) {
                const powerRatio = (thisPower - highFreqThreshold_dB_safe) / (thisPower - prevPower);
                const freqDiff = freqBins[binIdx] - freqBins[binIdx - 1];
                startFreq_Hz_safe = freqBins[binIdx] - powerRatio * freqDiff;
              }
            }
            break;
          }
        }
      }
      
      if (highFreq_Hz_safe !== null) {
        returnHighFreq_Hz = highFreq_Hz_safe;
        returnHighFreq_kHz = highFreq_Hz_safe / 1000;
        returnHighFreqBinIdx = highFreqBinIdx_safe;
        returnStartFreq_Hz = startFreq_Hz_safe;
        returnStartFreq_kHz = startFreq_Hz_safe / 1000;
      }
    }
    
    // Return optimized high and start frequencies
    return {
      threshold: safeThreshold,
      highFreq_Hz: returnHighFreq_Hz,
      highFreq_kHz: returnHighFreq_kHz,
      highFreqBinIdx: returnHighFreqBinIdx,
      startFreq_Hz: returnStartFreq_Hz,
      startFreq_kHz: returnStartFreq_kHz,
      warning: hasWarning
    };
  }

  /**
   * Find optimal low frequency threshold by testing range and detecting anomalies
   * 
   * Algorithm:
   * 1. Test each threshold on last frame (-24 to -70 dB)
   * 2. For each threshold: calculate low and end frequencies (low→high scan, last frame)
   * 3. Detect anomalies: frequency jumps > 1.5 kHz indicate threshold instability
   * 4. Select threshold just before first major anomaly
   * 5. Apply safety mechanism: cap at -30 dB if needed
   * 
   * Returns: { threshold, lowFreq_Hz, lowFreq_kHz, endFreq_Hz, endFreq_kHz, warning }
   *
   * Anti-rebounce compatibility:
   * - Uses last frame power spectrum (like low frequency measurement)
   * - Works with backward endFreqScan detection
   * - Maintains frequency boundary integrity
   * 
   * @param {Array} spectrogram - STFT spectrogram (time x frequency bins)
   * @param {Array} freqBins - Frequency bin values (Hz)
   * @param {number} flowKHz - Low frequency boundary (kHz)
   * @param {number} fhighKHz - High frequency boundary (kHz)
   * @param {number} callPeakPower_dB - Call peak power in dB (stable value)
   * @returns {Object} {threshold, lowFreq_Hz, lowFreq_kHz, endFreq_Hz, endFreq_kHz, warning}
   */
  findOptimalLowFrequencyThreshold(spectrogram, freqBins, flowKHz, fhighKHz, callPeakPower_dB) {
    if (spectrogram.length === 0) return {
      threshold: -24,
      lowFreq_Hz: null,
      lowFreq_kHz: null,
      endFreq_Hz: null,
      endFreq_kHz: null,
      warning: false
    };

    const lastFramePower = spectrogram[spectrogram.length - 1];
    
    // CRITICAL FIX (2025): Use stable call.peakPower_dB instead of computing global peak
    const stablePeakPower_dB = callPeakPower_dB;
    
    // Test threshold range: -24 to -70 dB
    const thresholdRange = [];
    for (let threshold = -24; threshold >= -70; threshold-= 0.5) {
      thresholdRange.push(threshold);
    }
    
    // Measure low and end frequencies for each threshold
    // CRITICAL: Use exactly same Calculate method as measureFrequencyParameters
    const measurements = [];
    
    for (const testThreshold_dB of thresholdRange) {
      let lowFreq_Hz = null;
      let endFreq_Hz = null;
      let foundBin = false;
      
      // Use stable call peak power (unaffected by selection size)
      const lowFreqThreshold_dB = stablePeakPower_dB + testThreshold_dB;
      
      // ============================================================
      // Calculate LOW FREQUENCY（scan low to high，find lowest frequency）
      // Use last frame power spectrum (represents signal end)
      // ============================================================
      for (let binIdx = 0; binIdx < lastFramePower.length; binIdx++) {
        if (lastFramePower[binIdx] > lowFreqThreshold_dB) {
          lowFreq_Hz = freqBins[binIdx];
          foundBin = true;
          
            // Apply linear interpolation
          if (binIdx > 0) {
            const thisPower = lastFramePower[binIdx];
            const prevPower = lastFramePower[binIdx - 1];
            
            if (prevPower < lowFreqThreshold_dB && thisPower > lowFreqThreshold_dB) {
              const powerRatio = (thisPower - lowFreqThreshold_dB) / (thisPower - prevPower);
              const freqDiff = freqBins[binIdx] - freqBins[binIdx - 1];
              lowFreq_Hz = freqBins[binIdx] - powerRatio * freqDiff;
            }
          }
          break;
        }
      }
      
      // END FREQUENCY: same as low frequency (lowest frequency from last frame)
      if (foundBin) {
        endFreq_Hz = lowFreq_Hz;
      }
      
      // Unable to measure at this threshold if no bin found
      if (!foundBin) {
        lowFreq_Hz = null;
        endFreq_Hz = null;
      }
      
      measurements.push({
        threshold: testThreshold_dB,
        lowFreqThreshold_dB: lowFreqThreshold_dB,
        lowFreq_Hz: lowFreq_Hz,
        lowFreq_kHz: lowFreq_Hz !== null ? lowFreq_Hz / 1000 : null,
        endFreq_Hz: endFreq_Hz,
        endFreq_kHz: endFreq_Hz !== null ? endFreq_Hz / 1000 : null,
        foundBin: foundBin
      });
    }
    
    // Collect only measurements with successful bin detection
    const validMeasurements = measurements.filter(m => m.foundBin);
    
    if (validMeasurements.length === 0) {
      return {
        threshold: -24,
        lowFreq_Hz: null,
        lowFreq_kHz: null,
        endFreq_Hz: null,
        endFreq_kHz: null,
        warning: false
      };
    }
    
    // Determine optimal threshold by detecting anomalies
    // Select threshold before first major anomaly (> 1.5 kHz jump)
    let optimalThreshold = -24;
    let optimalMeasurement = validMeasurements[0];
    
    // Track anomaly detection state
    let lastValidThreshold = validMeasurements[0].threshold;  // Last valid measurement (no anomalies)
    let lastValidMeasurement = validMeasurements[0];
    let recordedEarlyAnomaly = null;  // Early anomaly threshold (may be ignored)
    let firstAnomalyIndex = -1;       // Index of first anomaly
    let majorJumpIndex = -1;          // Index position where major jump occurs
    let majorJumpThreshold = null;    // Threshold before major jump
    
    // Starting from second valid measurement, compare with previous measurement
    for (let i = 1; i < validMeasurements.length; i++) {
      const prevFreq_kHz = validMeasurements[i - 1].lowFreq_kHz;
      const currFreq_kHz = validMeasurements[i].lowFreq_kHz;
      const freqDifference = Math.abs(currFreq_kHz - prevFreq_kHz);
      
      // ============================================================
      // Optimization 2025: Large frequency jump (>2 kHz)
      // ============================================================
      if (freqDifference > 2.0) {
        // Large anomaly >2.0 kHz, stop test immediately
        // 選擇這個超大幅異常前的閾值
        optimalThreshold = validMeasurements[i - 1].threshold;
        optimalMeasurement = validMeasurements[i - 1];
        break;
      }
      
      const isAnomaly = freqDifference > 1.5;
      
      if (isAnomaly) {
        // 發現大幅異常 (>1.5 kHz)
        
        // 如果還沒有記錄早期異常，現在記錄
        if (recordedEarlyAnomaly === null && firstAnomalyIndex === -1) {
          firstAnomalyIndex = i;  // Record anomaly index
          recordedEarlyAnomaly = validMeasurements[i - 1].threshold;  // 異常前的閾值
          lastValidThreshold = validMeasurements[i - 1].threshold;
          lastValidMeasurement = validMeasurements[i - 1];
        }
      } else {
        // 正常值：沒有大幅跳變
        
        // 如果有記錄的早期異常，Check if followed by 3 normal values
        if (recordedEarlyAnomaly !== null && firstAnomalyIndex !== -1) {
          // Calculate從異常發生後緊接著的 3 個索引
          const afterAnomalyStart = firstAnomalyIndex + 1;
          const afterAnomalyEnd = Math.min(firstAnomalyIndex + 3, validMeasurements.length - 1);
          
          // 檢查異常後的 3 個值是否都無異常
          let hasThreeNormalAfterAnomaly = true;
          
          for (let checkIdx = afterAnomalyStart; checkIdx <= afterAnomalyEnd; checkIdx++) {
            if (checkIdx >= validMeasurements.length) {
              hasThreeNormalAfterAnomaly = false;
              break;
            }
            
            // 檢查當前值與前一個值是否有異常
            const checkPrevFreq_kHz = validMeasurements[checkIdx - 1].lowFreq_kHz;
            const checkCurrFreq_kHz = validMeasurements[checkIdx].lowFreq_kHz;
            const checkFreqDiff = Math.abs(checkCurrFreq_kHz - checkPrevFreq_kHz);
            
            if (checkFreqDiff > 1.5) {
              // Found anomaly，說明異常後面不是連續 3 個正常值
              hasThreeNormalAfterAnomaly = false;
              break;
            }
          }
          
          // 如果異常後有連續 3 個正常值，Ignore early anomaly
          if (hasThreeNormalAfterAnomaly && (afterAnomalyEnd - afterAnomalyStart + 1) >= 3) {
            recordedEarlyAnomaly = null;  // Ignore early anomaly
            firstAnomalyIndex = -1;       // Reset
          }
        }
        
        // Update last valid measurement
        lastValidThreshold = validMeasurements[i].threshold;
        lastValidMeasurement = validMeasurements[i];
      }
    }
    
    // ============================================================
    // 最終決定：選擇最優閾值
    // ============================================================
    if (recordedEarlyAnomaly !== null) {
      // 有未被忽略的早期異常：使用異常前的閾值
      optimalThreshold = recordedEarlyAnomaly;
      optimalMeasurement = lastValidMeasurement;
    } else {
      // 沒有異常或異常被忽略：使用最後一個有效測量
      optimalThreshold = lastValidThreshold;
      optimalMeasurement = lastValidMeasurement;
    }
    
    // 確保返回值在有效範圍內
    const finalThreshold = Math.max(Math.min(optimalThreshold, -24), -70);
    
    // 2025 SAFETY MECHANISM: 如果使用了極限閾值 -70dB，改用固定的安全值 -30dB
    // 這表示 Low Frequency Calculate達到極限，使用保守的固定值而不是極限值
    const safeThreshold = (finalThreshold <= -70) ? -30 : finalThreshold;
    
    // 檢測是否使用了 -70dB 的極限閾值（但實際使用 -30dB）
    const hasWarning = finalThreshold <= -70;
    
    // 當應用安全機制時（改為 -30dB），需要使用 -30dB 重新Calculate lowFreq_Hz
    let returnLowFreq_Hz = optimalMeasurement.lowFreq_Hz;
    let returnLowFreq_kHz = optimalMeasurement.lowFreq_kHz;
    let returnEndFreq_Hz = optimalMeasurement.endFreq_Hz;
    let returnEndFreq_kHz = optimalMeasurement.endFreq_kHz;
    
    if (safeThreshold !== finalThreshold) {
      // Safety mechanism changed threshold，使用 -30dB 重新Calculate lowFreq_Hz
      const lastFramePower = spectrogram[spectrogram.length - 1];
      const peakPower_dB = callPeakPower_dB;
      const lowFreqThreshold_dB_safe = peakPower_dB + safeThreshold;
      
      let lowFreq_Hz_safe = null;
      let endFreq_Hz_safe = null;
      
      // Calculate low frequency using safe threshold
      for (let binIdx = 0; binIdx < lastFramePower.length; binIdx++) {
        if (lastFramePower[binIdx] > lowFreqThreshold_dB_safe) {
          lowFreq_Hz_safe = freqBins[binIdx];
          
            // Apply linear interpolation
          if (binIdx > 0) {
            const thisPower = lastFramePower[binIdx];
            const prevPower = lastFramePower[binIdx - 1];
            
            if (prevPower < lowFreqThreshold_dB_safe && thisPower > lowFreqThreshold_dB_safe) {
              const powerRatio = (thisPower - lowFreqThreshold_dB_safe) / (thisPower - prevPower);
              const freqDiff = freqBins[binIdx] - freqBins[binIdx - 1];
              lowFreq_Hz_safe = freqBins[binIdx] - powerRatio * freqDiff;
            }
          }
          break;
        }
      }
      
      if (lowFreq_Hz_safe !== null) {
        endFreq_Hz_safe = lowFreq_Hz_safe;  // End frequency = low frequency
        returnLowFreq_Hz = lowFreq_Hz_safe;
        returnLowFreq_kHz = lowFreq_Hz_safe / 1000;
        returnEndFreq_Hz = endFreq_Hz_safe;
        returnEndFreq_kHz = endFreq_Hz_safe / 1000;
      }
    }
    
    // 返回優化的 Low Frequency 和 End Frequency
    return {
      threshold: safeThreshold,
      lowFreq_Hz: returnLowFreq_Hz,
      lowFreq_kHz: returnLowFreq_kHz,
      endFreq_Hz: returnEndFreq_Hz,
      endFreq_kHz: returnEndFreq_kHz,
      warning: hasWarning
    };
  }

  /**
   * Phase 2: Measure precise
   * Based on Avisoft SASLab Pro, SonoBat, Kaleidoscope Pro, and BatSound standards
   * 
   * Reference implementations:
   * - Avisoft: Threshold-based peak detection with interpolation
   * - SonoBat: Duration-weighted frequency averaging
   * - Kaleidoscope: Multi-frame analysis with robustness checks
   * - BatSound: Peak prominence and edge detection
   * 
   * Updates call.peakFreq, startFreq, endFreq, characteristicFreq, bandwidth, duration
   */
  measureFrequencyParameters(call, flowKHz, fhighKHz, freqBins, freqResolution) {
    let { highFreqThreshold_dB, characteristicFreq_percentEnd } = this.config;
    const spectrogram = call.spectrogram;  // [timeFrame][freqBin]
    const timeFrames = call.timeFrames;    // Time points for each frame
    
    if (spectrogram.length === 0) return;
    
    // ============================================================
    // STEP 0: Find peak frequency FIRST (before auto-threshold calculation)
    // 
    // CRITICAL (2025 FIX): Must find actual call peak BEFORE auto-threshold mode
    // so that findOptimalHighFrequencyThreshold can use stable call.peakPower_dB
    // instead of spectrogram's global max (which varies with selection size)
    // 
    // Professional Standard: Use FFT + Parabolic Interpolation
    // (aligned with Avisoft, SonoBat, Kaleidoscope, BatSound)
    // 
    // Method:
    // 1. Find peak bin in spectrogram
    // 2. If peak is not at edge, apply parabolic interpolation
    // 3. This provides sub-bin precision (~0.1 Hz accuracy)
    // ============================================================
    let peakFreq_Hz = null;
    let peakPower_dB = -Infinity;
    let peakFrameIdx = 0;
    let peakBinIdx = 0;
    
    // Phase 1: Find global peak bin
    for (let frameIdx = 0; frameIdx < spectrogram.length; frameIdx++) {
      const framePower = spectrogram[frameIdx];
      for (let binIdx = 0; binIdx < framePower.length; binIdx++) {
        if (framePower[binIdx] > peakPower_dB) {
          peakPower_dB = framePower[binIdx];
          peakBinIdx = binIdx;
          peakFrameIdx = frameIdx;
        }
      }
    }
    
    // Phase 2: Apply parabolic interpolation for sub-bin precision
    // If peak is not at edges, interpolate between neighboring bins
    peakFreq_Hz = freqBins[peakBinIdx];
    
    if (peakBinIdx > 0 && peakBinIdx < spectrogram[peakFrameIdx].length - 1) {
      const framePower = spectrogram[peakFrameIdx];
      const db0 = framePower[peakBinIdx - 1];
      const db1 = framePower[peakBinIdx];
      const db2 = framePower[peakBinIdx + 1];
      
      // Parabolic vertex formula: y = a*x^2 + b*x + c
      // Peak position correction using 2nd derivative
      const a = (db2 - 2 * db1 + db0) / 2;
      if (Math.abs(a) > 1e-10) {
        // bin correction = (f(x-1) - f(x+1)) / (4*a)
        const binCorrection = (db0 - db2) / (4 * a);
        const refinedBin = peakBinIdx + binCorrection;
        const binWidth = freqBins[1] - freqBins[0]; // Frequency distance between bins
        peakFreq_Hz = freqBins[peakBinIdx] + binCorrection * binWidth;
      }
    }
    
    // Store peak values for use in auto-threshold calculation
    // IMPORTANT: These values are NOW STABLE and don't depend on selection area size
    call.peakFreq_kHz = peakFreq_Hz / 1000;
    call.peakPower_dB = peakPower_dB;
    
    // ============================================================
    // NEW (2025): Calculate peak frequency time in milliseconds
    // peakFreqTime_ms = absolute time of peak frequency frame within selection area
    // Unit: ms (milliseconds), relative to selection area start
    // ============================================================
    if (peakFrameIdx < timeFrames.length) {
      // Convert from seconds to milliseconds, using first frame as reference point (0 ms)
      const peakTimeInSeconds = timeFrames[peakFrameIdx];
      const firstFrameTimeInSeconds = timeFrames[0];
      const relativeTime_ms = (peakTimeInSeconds - firstFrameTimeInSeconds) * 1000;
      call.peakFreqTime_ms = relativeTime_ms;  // Time relative to selection area start
    }
    
    // ============================================================
    // AUTO MODE: If highFreqThreshold_dB_isAuto is enabled,
    // automatically find optimal threshold using STABLE call.peakPower_dB
    // (NOT the floating globalPeakPower_dB from entire spectrogram)
    // ============================================================
    // 2025: Declare these variables in outer scope so they can be used in STEP 2
    let safeHighFreq_kHz = null;
    let safeHighFreq_Hz = null;
    let safeHighFreqBinIdx = undefined;
    
    if (this.config.highFreqThreshold_dB_isAuto === true) {
      const result = this.findOptimalHighFrequencyThreshold(
        spectrogram,
        freqBins,
        flowKHz,
        fhighKHz,
        peakPower_dB,  // Pass stable call peak value instead of computing global peak again
        peakFrameIdx   // Pass peak frame index to only check frames before peak
      );
      
      // ============================================================
      // 新規則 2025：High Frequency 防呆機制
      // 找出第一個 >= Peak Frequency 的有效 High Frequency
      // ============================================================
      // 如果返回的 High Frequency < Peak Frequency，視為異常
      // 需要向上遍歷 thresholdRange 找到第一個 >= Peak Frequency 的值
      safeHighFreq_kHz = result.highFreq_kHz;
      safeHighFreq_Hz = result.highFreq_Hz;
      safeHighFreqBinIdx = result.highFreqBinIdx;  // 2025: Initialize from findOptimalHighFrequencyThreshold
      let usedThreshold = result.threshold;
      
      // 如果最優閾值的 High Frequency 低於 Peak Frequency，執行防呆檢查
      if (result.highFreq_kHz !== null && result.highFreq_kHz < (peakFreq_Hz / 1000)) {
        // 需要找到第一個 >= Peak Frequency 的 High Frequency
        // 重新測試閾值範圍，從 -24 到 -70
        const peakFreq_kHz = peakFreq_Hz / 1000;
        let foundValidHighFreq = false;
        
        for (let testThreshold_dB = -24; testThreshold_dB >= -70; testThreshold_dB--) {
          const highFreqThreshold_dB = peakPower_dB + testThreshold_dB;
          const firstFramePower = spectrogram[0];
          
          // Calculate此閾值的 High Frequency
          let testHighFreq_Hz = null;
          let testHighFreqBinIdx = 0;  // 2025: Track the bin index found
          
          // High Frequency Calculate（從高到低）
          for (let binIdx = firstFramePower.length - 1; binIdx >= 0; binIdx--) {
            if (firstFramePower[binIdx] > highFreqThreshold_dB) {
              testHighFreq_Hz = freqBins[binIdx];
              testHighFreqBinIdx = binIdx;  // 2025: Save the found bin index
              
              // 線性插值
              if (binIdx < firstFramePower.length - 1) {
                const thisPower = firstFramePower[binIdx];
                const nextPower = firstFramePower[binIdx + 1];
                if (nextPower < highFreqThreshold_dB && thisPower > highFreqThreshold_dB) {
                  const powerRatio = (thisPower - highFreqThreshold_dB) / (thisPower - nextPower);
                  const freqDiff = freqBins[binIdx + 1] - freqBins[binIdx];
                  testHighFreq_Hz = freqBins[binIdx] + powerRatio * freqDiff;
                }
              }
              break;
            }
          }
          
          // 如果找到有效的 High Frequency，檢查是否 >= Peak Frequency
          if (testHighFreq_Hz !== null && (testHighFreq_Hz / 1000) >= peakFreq_kHz) {
            // IMPORTANT 2025: 
            // Start Frequency 必須使用固定的 -24dB 閾值，不能用調整後的 highFreqThreshold_dB
            // Start Frequency 的規則 (a)/(b) 邏輯在 STEP 2.5 中執行，不在此處
            // Auto Mode 防呆檢查只調整 High Frequency threshold，不涉及 Start Frequency
            
            safeHighFreq_Hz = testHighFreq_Hz;
            safeHighFreq_kHz = testHighFreq_Hz / 1000;
            safeHighFreqBinIdx = testHighFreqBinIdx;  // 2025: Save the bin index for later use
            usedThreshold = testThreshold_dB;
            foundValidHighFreq = true;
            break;
          }
        }
      }
      
      // Update the config with the calculated optimal threshold
      this.config.highFreqThreshold_dB = usedThreshold;
      // 2025: 在 auto mode 下保存實際使用的 high frequency threshold
      // Auto mode: 保存經過防呆檢查後的最終 threshold 值
      call.highFreqThreshold_dB_used = usedThreshold;
      // 
      // 2025 CRITICAL FIX: 已應用安全機制
      // 當 threshold 達到 -70dB 極限時，自動改用 -30dB
      // 不再需要顯示 warning，因此 highFreqDetectionWarning 已棄用
      
      // ============================================================
      // 重要修正 (2025)：
      // Start Frequency 必須基於 -24dB 閾值Calculate，與 High Frequency 無關
      // 規則 (a)/(b) 應用在 STEP 2.5 中，不在此處提前Calculate
      // Auto Mode 中只使用優化的 High Frequency，Start Frequency 留到 STEP 2.5 Calculate
      // 不再存儲臨時的 _startFreq_kHz_fromAuto 和 _startFreq_Hz_fromAuto
      // ============================================================
    }
    
    // ============================================================
    // STEP 1.5: 重新Calculate時間邊界 (基於新的 highFreqThreshold_dB)
    // 
    // 2025 ANTI-REBOUNCE UPGRADE:
    // - Backward scanning for clean end frequency detection
    // - Maximum frequency drop rule to lock end frame
    // - 10ms protection window after peak energy
    // ============================================================
    const { 
      enableBackwardEndFreqScan,
      maxFrequencyDropThreshold_kHz,
      protectionWindowAfterPeak_ms
    } = this.config;
    
    const highThreshold_dB = peakPower_dB + this.config.highFreqThreshold_dB;  // High Frequency threshold (可調整)
    
    // ============================================================
    // End & Low Frequency Threshold
    // Manual Mode: 使用用戶輸入的 lowFreqThreshold_dB 值
    // Auto Mode: 使用固定的 -27dB（會在後續 findOptimalLowFrequencyThreshold 中被覆蓋）
    // ============================================================
    let endThreshold_dB;
    if (this.config.lowFreqThreshold_dB_isAuto === false) {
      // Manual Mode: 使用用戶手動輸入的值
      endThreshold_dB = peakPower_dB + this.config.lowFreqThreshold_dB;
    } else {
      // Auto Mode: 初始使用預設值 -27dB（會在 findOptimalLowFrequencyThreshold 中被重新Calculate）
      endThreshold_dB = peakPower_dB - 27;
    }
    
    // 找到第一個幀，其中有信號超過閾值
    let newStartFrameIdx = 0;
    for (let frameIdx = 0; frameIdx < spectrogram.length; frameIdx++) {
      const framePower = spectrogram[frameIdx];
      let frameHasSignal = false;
      for (let binIdx = 0; binIdx < framePower.length; binIdx++) {
        if (framePower[binIdx] > highThreshold_dB) {
          frameHasSignal = true;
          break;
        }
      }
      if (frameHasSignal) {
        newStartFrameIdx = frameIdx;
        break;
      }
    }
    
    // TRICK 1 & 3: Find end frame with anti-rebounce protection
    // 
    // Standard method: Backward scan from end to find -27dB cutoff
    // + Maximum frequency drop detection (Trick 2)
    // + Protection window limit (Trick 3) - but only if frequency drop is detected
    // ============================================================
    let newEndFrameIdx = spectrogram.length - 1;
    
    // Calculate frame limit for Trick 3 (10ms protection window)
    const protectionFrameLimit = Math.round(
      (protectionWindowAfterPeak_ms / 1000) / (timeFrames[1] - timeFrames[0])
    );
    const maxFrameIdxAllowed = Math.min(
      peakFrameIdx + protectionFrameLimit,
      spectrogram.length - 1
    );
    
    // ANTI-REBOUNCE: Forward scan from peak to find natural end
    // Professional approach: Use energy trend analysis + monotonic decay detection
    // - FM/Sweep: Stop when frequency drops significantly (TRICK 2)
    // - CF/QCF: Energy monotonically decreases until call ends
    //   Special rule: If energy rises after falling = rebounce signal detected → STOP immediately
    if (enableBackwardEndFreqScan) {
      let lastValidEndFrame = peakFrameIdx;
      let freqDropDetected = false;
      
      // Professional criterion (Avisoft/SonoBat style): Find last frame where energy > peakPower_dB - 18dB
      // This softer threshold (-18dB vs -27dB) better handles natural decay in CF/QCF calls
      const sustainedEnergyThreshold = peakPower_dB - 18; // 18dB drop from peak
      let lastFrameAboveSustainedThreshold = peakFrameIdx;
      
      // Track energy for monotonic decay detection
      let lastFrameMaxPower = peakPower_dB;
      let hasStartedDecaying = false;
      let lastValidEndBeforeRebounce = peakFrameIdx;
      
      // Scan FORWARD from peak to END to find natural decay point
      for (let frameIdx = peakFrameIdx; frameIdx < spectrogram.length; frameIdx++) {
        const framePower = spectrogram[frameIdx];
        let frameMaxPower = -Infinity;
        let framePeakFreq = 0;
        
        for (let binIdx = 0; binIdx < framePower.length; binIdx++) {
          if (framePower[binIdx] > frameMaxPower) {
            frameMaxPower = framePower[binIdx];
            framePeakFreq = freqBins[binIdx] / 1000;
          }
        }
        
        // Check for FM frequency drop (primary indicator for FM calls)
        if (frameIdx > peakFrameIdx && !freqDropDetected && frameMaxPower > endThreshold_dB) {
          const prevFramePower = spectrogram[frameIdx - 1];
          let prevFramePeakFreq = 0;
          let prevFrameMaxPower = -Infinity;
          for (let binIdx = 0; binIdx < prevFramePower.length; binIdx++) {
            if (prevFramePower[binIdx] > prevFrameMaxPower) {
              prevFrameMaxPower = prevFramePower[binIdx];
              prevFramePeakFreq = freqBins[binIdx] / 1000;
            }
          }
          
          const frequencyDrop = prevFramePeakFreq - framePeakFreq;
          if (frequencyDrop > maxFrequencyDropThreshold_kHz) {
            // FM call: frequency drop detected, stop here
            freqDropDetected = true;
            lastValidEndFrame = frameIdx - 1;
            break;
          }
        }
        
        // CF/QCF monotonic decay detection
        if (!freqDropDetected) {
          // Track if energy has started declining from peak
          if (frameMaxPower < lastFrameMaxPower) {
            hasStartedDecaying = true;
            lastValidEndBeforeRebounce = frameIdx;
          }
          
          // CRITICAL: Detect rebounce (energy rises after falling)
          // But with threshold to avoid QCF natural energy fluctuations
          // QCF signals naturally have ±2-3dB fluctuations, so require >5dB rise to detect rebounce
          const rebounceThreshold_dB = 0.5; // Minimum dB rise to be considered a rebounce (not QCF fluctuation)
          if (hasStartedDecaying && frameMaxPower > lastFrameMaxPower && frameIdx > peakFrameIdx + 1) {
            const energyRise = frameMaxPower - lastFrameMaxPower;
            if (energyRise > rebounceThreshold_dB) {
              // Significant energy rise detected = true rebounce!
              // Use the frame where energy was lowest before rising
              newEndFrameIdx = lastValidEndBeforeRebounce;
              break;
            }
            // else: Just minor fluctuation in QCF signal, continue scanning
          }
          
          // Track sustained energy above -18dB threshold
          if (frameMaxPower > sustainedEnergyThreshold) {
            lastFrameAboveSustainedThreshold = frameIdx;
            lastValidEndFrame = frameIdx;
          }
          // If signal drops permanently below -18dB, stop
          else if (frameMaxPower <= sustainedEnergyThreshold && frameIdx > peakFrameIdx) {
            // No rebounce detected, just natural decay below threshold
            newEndFrameIdx = lastFrameAboveSustainedThreshold;
            break;
          }
          
          lastFrameMaxPower = frameMaxPower;
        }
      }
      
      // Determine final end frame if loop completed without special conditions
      if (newEndFrameIdx === spectrogram.length - 1 || newEndFrameIdx === 0) {
        if (!freqDropDetected) {
          // CF/QCF call: use last frame with sustained energy
          newEndFrameIdx = lastFrameAboveSustainedThreshold;
        } else {
          // FM call: already set by frequency drop detection
          newEndFrameIdx = lastValidEndFrame;
        }
      }
    } else {
      // Original forward scanning method (without anti-rebounce)
      for (let frameIdx = spectrogram.length - 1; frameIdx >= 0; frameIdx--) {
        const framePower = spectrogram[frameIdx];
        let frameHasSignal = false;
        for (let binIdx = 0; binIdx < framePower.length; binIdx++) {
          if (framePower[binIdx] > endThreshold_dB) {
            frameHasSignal = true;
            break;
          }
        }
        if (frameHasSignal) {
          newEndFrameIdx = frameIdx;
          break;
        }
      }
    }
    
    // 注意：For CF/QCF calls, newEndFrameIdx 可能超過 maxFrameIdxAllowed
    // 這是正常的，因為 CF 信號可能延續超過 10ms 的保護窗
    // Protection window 限制只應用於檢測到頻率下降（FM 類型）的情況
    // 不應在此進行全局限制
    
    // 更新時間邊界
    if (newStartFrameIdx < timeFrames.length) {
      call.startTime_s = timeFrames[newStartFrameIdx];
    }
    if (newEndFrameIdx < timeFrames.length - 1) {
      call.endTime_s = timeFrames[Math.min(newEndFrameIdx + 1, timeFrames.length - 1)];
    }
    
    // 注意：Duration 將在Calculate完 endFreqTime_s 後根據 endFreq 的 frameIdx Calculate
    // (見 STEP 3 的結尾)
    
    // ============================================================
    // STEP 2: Calculate HIGH FREQUENCY from entire spectrogram
    // 
    // 2025 修正：High Frequency 應該掃描整個 spectrogram 以找到最高頻率
    // 不只限於第一幀，因為最高頻率可能出現在任何幀中
    // 
    // Professional standard: threshold at adjustable dB below peak
    // This is the HIGHEST frequency in the entire call (not just first frame)
    // Search from HIGH to LOW frequency (reverse bin order)
    // Track both frequency value AND the frame it appears in
    // ============================================================
    let highFreq_Hz = fhighKHz * 1000;  // Default to upper bound
    let highFreqBinIdx = 0;  // 2025: Track bin index for High Frequency
    let highFreqFrameIdx = 0;  // 2025: Track frame index where high frequency occurs
    
    // 2025 修正：無論是 Auto Mode 還是 Manual Mode，都掃描整個 spectrogram
    // Auto Mode 和 Manual Mode 的差異只在使用的 threshold 値不同
    // 但都應該在整個 spectrogram 中find highest frequency
    // Scan entire spectrogram to find highest frequency across ALL frames
    for (let frameIdx = 0; frameIdx < spectrogram.length; frameIdx++) {
      const framePower = spectrogram[frameIdx];
      // Search from high to low frequency (reverse order)
      for (let binIdx = framePower.length - 1; binIdx >= 0; binIdx--) {
        if (framePower[binIdx] > highThreshold_dB) {
          // Found first bin above threshold in this frame
          const testHighFreq_Hz = freqBins[binIdx];
          
          // Only update if this frequency is higher than previously found
          if (testHighFreq_Hz > highFreq_Hz || highFreqFrameIdx === 0) {
            highFreq_Hz = testHighFreq_Hz;
            highFreqBinIdx = binIdx;
            highFreqFrameIdx = frameIdx;  // 2025: Store the frame index
            
            // Attempt linear interpolation for sub-bin precision
            if (binIdx < framePower.length - 1) {
              const thisPower = framePower[binIdx];
              const nextPower = framePower[binIdx + 1];
              
              if (nextPower < highThreshold_dB && thisPower > highThreshold_dB) {
                // Interpolate between this bin and next
                const powerRatio = (thisPower - highThreshold_dB) / (thisPower - nextPower);
                const freqDiff = freqBins[binIdx + 1] - freqBins[binIdx];
                highFreq_Hz = freqBins[binIdx] + powerRatio * freqDiff;
              }
            }
          }
          break;  // Move to next frame after finding first bin in this frame
        }
      }
    }
    
    call.highFreq_kHz = highFreq_Hz / 1000;
    call.highFreqFrameIdx = highFreqFrameIdx;  // 2025: Store the frame index for High Frequency
    
    // ============================================================
    // NEW (2025): Calculate high frequency time in milliseconds
    // highFreqTime_ms = absolute time of high frequency bin within selection area
    // Unit: ms (milliseconds), relative to selection area start (timeFrames[0])
    // 
    // 修正：High Frequency 的時間應該基於它所在的幀Calculate，而不是固定為 0
    // ============================================================
    const firstFrameTimeInSeconds = timeFrames[0];
    let highFreqTime_ms = 0;
    if (highFreqFrameIdx < timeFrames.length) {
      const highFreqTimeInSeconds = timeFrames[highFreqFrameIdx];
      highFreqTime_ms = (highFreqTimeInSeconds - firstFrameTimeInSeconds) * 1000;
    }
    call.highFreqTime_ms = highFreqTime_ms;  // High frequency time relative to selection area start
    
    // 2025: 在 manual mode 下保存實際使用的 high frequency threshold
    // Manual mode: highThreshold_dB = peakPower_dB + highFreqThreshold_dB
    // Calculate相對於 peakPower_dB 的偏移值
    const highFreqThreshold_dB_used_manual = highThreshold_dB - peakPower_dB;
    call.highFreqThreshold_dB_used = highFreqThreshold_dB_used_manual;
    
    // ============================================================
    // STEP 2.5: Calculate START FREQUENCY (獨立於 High Frequency)
    // 
    // 2025 關鍵修正：
    // Start Frequency 是真正的 "First frame of call signal (frame 0)"
    // 總是從第一幀掃描得出，但其值由規則 (a)/(b) 決定
    // 
    // 方法：
      // Calculate start frequency
    // (a) 若 -24dB 閾值的頻率 < Peak Frequency：使用該值為 Start Frequency
    // (b) 若 -24dB 閾值的頻率 >= Peak Frequency：Start Frequency = High Frequency
    // 
    // 時間點說明：
    // Start Frequency 總是在第一幀（frame 0），時間 = 0 ms
    // 但 Start Frequency 的值可能等於 High Frequency（規則 b）
    // 
    // 2025 低頻 Noise 保護機制：
    // 若 Peak Frequency ≥ 60 kHz，則 Start Frequency 不能 ≤ 40 kHz
    // 在掃描時忽略 40 kHz 或以下的 bin，防止誤判低頻 noise 為 Start Frequency
    // ============================================================
    const firstFramePower = spectrogram[0];
    let startFreq_Hz = null;
    let startFreq_kHz = null;
    let startFreqBinIdx = 0;  // 2025: Track independent bin index for Start Frequency
    let startFreqFrameIdx = 0;  // 2025: Start Frequency is always in frame 0
    
      // Calculate start frequency
    const threshold_24dB = peakPower_dB - 24;
    
    // 2025: 低頻 Noise 保護閾值
    const LOW_FREQ_NOISE_THRESHOLD_kHz = 40;  // kHz - 低於此頻率的 bin 在某些情況下應被忽略
    const HIGH_PEAK_THRESHOLD_kHz = 60;       // kHz - Peak >= 此值時啟動低頻保護
    const peakFreqInKHz = peakFreq_Hz / 1000; // 將 Peak 頻率轉換為 kHz
    const shouldIgnoreLowFreqNoise = peakFreqInKHz >= HIGH_PEAK_THRESHOLD_kHz;
    
    // scan low to high，find lowest frequency（規則 a）
    for (let binIdx = 0; binIdx < firstFramePower.length; binIdx++) {
      if (firstFramePower[binIdx] > threshold_24dB) {
        const testStartFreq_Hz = freqBins[binIdx];
        const testStartFreq_kHz = testStartFreq_Hz / 1000;
        
        // 2025: 應用低頻 Noise 保護機制
        // 若 Peak ≥ 60 kHz，忽略 40 kHz 或以下的候選值
        if (shouldIgnoreLowFreqNoise && testStartFreq_kHz <= LOW_FREQ_NOISE_THRESHOLD_kHz) {
          // 此 bin 被視為低頻 noise，跳過
          continue;
        }
        
        // 檢查是否低於 Peak Frequency（規則 a）
        if (testStartFreq_kHz < peakFreqInKHz) {
          // 滿足規則 (a)：使用此值為 Start Frequency
          startFreq_Hz = testStartFreq_Hz;
          startFreq_kHz = testStartFreq_kHz;
          startFreqBinIdx = binIdx;  // 2025: Store independent bin index for Start Frequency
          
            // Apply linear interpolation
          if (binIdx > 0) {
            const thisPower = firstFramePower[binIdx];
            const prevPower = firstFramePower[binIdx - 1];
            
            if (prevPower < threshold_24dB && thisPower > threshold_24dB) {
              const powerRatio = (thisPower - threshold_24dB) / (thisPower - prevPower);
              const freqDiff = freqBins[binIdx] - freqBins[binIdx - 1];
              startFreq_Hz = freqBins[binIdx] - powerRatio * freqDiff;
              startFreq_kHz = startFreq_Hz / 1000;
            }
          }
          break;
        }
      }
    }
    
    // 如果規則 (a) 不滿足（-24dB 頻率 >= Peak Frequency），使用規則 (b)
    if (startFreq_Hz === null) {
      // Start Frequency = High Frequency（規則 b）
      // Note: 此時 Start Frequency 的值等於 High Frequency 的值
      // 但 Start Frequency 的幀索引固定為 0（frame 0）
      startFreq_Hz = highFreq_Hz;
      startFreq_kHz = highFreq_Hz / 1000;
      startFreqBinIdx = highFreqBinIdx;  // 2025: Use High Frequency's bin index
      // 但時間點仍然是 0 ms（第一幀）
    }
    
    // 存儲 Start Frequency 及其信息
    call.startFreq_kHz = startFreq_kHz;
    call.startFreqTime_s = timeFrames[0];  // Time of first frame (frame 0)
    call.startFreqBinIdx = startFreqBinIdx;  // 2025: Store independent bin index
    call.startFreqFrameIdx = startFreqFrameIdx;  // 2025: Always frame 0
    
    // ============================================================
    // NEW (2025): Calculate start frequency time in milliseconds
    // startFreq_ms = absolute time of start frequency (always at first frame = 0 ms)
    // Unit: ms (milliseconds), relative to selection area start
    // 
    // NOTE: Start Frequency is ALWAYS at frame 0 by definition
    // (Start Frequency is the "First frame of call signal")
    // ============================================================
    const firstFrameTime_ms = 0;  // First frame is at time 0 relative to selection area start
    call.startFreq_ms = firstFrameTime_ms;  // Start frequency time is always at frame 0
    
    // ============================================================
    // STEP 3: Calculate LOW FREQUENCY from last frame
    // 2025 ENHANCED PRECISION: Linear interpolation with anti-rebounce support
    // 
    // Professional standard: Fixed threshold at -27dB below global peak
    // This is the lowest frequency in the call (from last frame)
    // Search from LOW to HIGH frequency (normal bin order)
    // 
    // LINEAR INTERPOLATION METHOD (aligned with START FREQUENCY precision):
    // When a bin crosses the -27dB threshold, interpolate between:
    // - Previous bin (below threshold): lowPower < endThreshold_dB
    // - Current bin (above threshold): thisPower > endThreshold_dB
    // 
    // Position ratio = (thisPower - threshold) / (thisPower - prevPower)
    // Interpolated frequency = currentFreq - ratio * freqBinWidth
    // This provides ~0.1 Hz sub-bin accuracy (typical bin width 3-5 Hz)
    // 
    // Compatibility with Anti-Rebounce:
    // - Works with backward endFreqScan: Uses last frame's true Low Freq
    // - Detects rebounce transitions: Maintains accurate frequency boundaries
    // - Protects against echo tails: Precise threshold crossing detection
    // ============================================================
    // 2025: Limit Low Frequency calculation to newEndFrameIdx (call end point)
    const endFrameIdx_forLowFreq = Math.min(newEndFrameIdx, spectrogram.length - 1);
    const lastFramePower = spectrogram[endFrameIdx_forLowFreq];
    const lastFrameTime_s = timeFrames[endFrameIdx_forLowFreq];  // Time of call end frame
    let lowFreq_Hz = flowKHz * 1000;  // Default to lower bound
    
    // Search from low to high frequency using fixed -27dB threshold
    // Enhanced with interpolation for higher precision
    for (let binIdx = 0; binIdx < lastFramePower.length; binIdx++) {
      if (lastFramePower[binIdx] > endThreshold_dB) {
        // Found first bin above threshold
        const thisPower = lastFramePower[binIdx];
        lowFreq_Hz = freqBins[binIdx];
        
        // ============================================================
        // LINEAR INTERPOLATION FOR SUB-BIN PRECISION
        // Conditions:
        // 1. Previous bin exists (binIdx > 0)
        // 2. Previous bin is BELOW threshold
        // 3. Current bin is ABOVE threshold
        // This ensures we have a proper threshold crossing to interpolate
        // ============================================================
        if (binIdx > 0) {
          const prevPower = lastFramePower[binIdx - 1];
          
          // Check for threshold crossing: prev below, curr above
          if (prevPower < endThreshold_dB && thisPower > endThreshold_dB) {
            // Calculate interpolation ratio
            // ratio = 0.0 means frequency = prevFreq (at threshold)
            // ratio = 1.0 means frequency = currFreq (at currPower)
            const powerRatio = (thisPower - endThreshold_dB) / (thisPower - prevPower);
            
            // Calculate frequency bin width (typically 3-5 Hz)
            const freqDiff = freqBins[binIdx] - freqBins[binIdx - 1];
            
            // Interpolated frequency
            // Start from current bin and move backward by interpolated distance
            lowFreq_Hz = freqBins[binIdx] - powerRatio * freqDiff;
            
            // Sanity check: interpolated frequency should be within bin range
            // If not, fall back to bin center
            if (lowFreq_Hz < freqBins[binIdx - 1] || lowFreq_Hz > freqBins[binIdx]) {
              lowFreq_Hz = freqBins[binIdx];
            }
          }
        }
        
        break;  // Stop after first threshold crossing (lowest frequency)
      }
    }
    
    // ============================================================
    // END FREQUENCY CALCULATION: Use low frequency bin result
    // End Frequency = frequency from last frame using -27dB threshold
    // (before comparison with Start Frequency)
    // End Frequency Time = time of last frame
    // 預設將 low frequency bin 的 frequency 及 Time 值用作 End Frequency
    // ============================================================
    let endFreq_kHz = lowFreq_Hz / 1000;
    call.endFreq_kHz = endFreq_kHz;
    call.endFreqTime_s = lastFrameTime_s;
    
    // ============================================================
    // 2025 OPTIMIZATION: Calculate duration based on endFreq frameIdx (endFreqTime_s)
    // Duration is now calculated ONLY ONCE here, based on endFreq time point
    // This avoids repeated calculations and ensures consistency
    // Duration = endFreq time - startFreq time (from first frame, which is always timeFrames[0])
    // ============================================================
    if (call.startFreqTime_s !== null && call.endFreqTime_s !== null) {
      call.duration_ms = (call.endFreqTime_s - call.startFreqTime_s) * 1000;
    }
    
    // ============================================================
    // NEW (2025): Calculate low and end frequency times in milliseconds
    const firstFrameTimeInSeconds_low = timeFrames[0];
    const lastFrameTime_ms = (lastFrameTime_s - firstFrameTimeInSeconds_low) * 1000;  // Time relative to selection area start
    call.lowFreq_ms = lastFrameTime_ms;  // Low frequency is from end frame (limited by newEndFrameIdx)
    call.endFreq_ms = lastFrameTime_ms;  // End frequency = Low frequency (same time)
    
    // 2025: 在 manual mode 下保存實際使用的 low frequency threshold
    // Manual mode: endThreshold_dB = peakPower_dB + lowFreqThreshold_dB
    // Calculate相對於 peakPower_dB 的偏移值
    const lowFreqThreshold_dB_used_manual = endThreshold_dB - peakPower_dB;
    call.lowFreqThreshold_dB_used = lowFreqThreshold_dB_used_manual;
    
    // Now calculate lowFreq_kHz with potential Start Frequency optimization
    let lowFreq_kHz = lowFreq_Hz / 1000;
    
    // ============================================================
    // AUTO MODE: If lowFreqThreshold_dB_isAuto is enabled,
    // automatically find optimal threshold using STABLE call.peakPower_dB
    // (similar to high frequency optimization)
    // ============================================================
    if (this.config.lowFreqThreshold_dB_isAuto === true) {
      const result = this.findOptimalLowFrequencyThreshold(
        spectrogram,
        freqBins,
        flowKHz,
        fhighKHz,
        peakPower_dB  // Pass stable call peak value instead of using endThreshold_dB
      );
      
      // ============================================================
      // 新規則 2025：Low Frequency 防呆機制
      // 找出第一個 <= Peak Frequency 的有效 Low Frequency
      // 低頻應該低於或等於峰值頻率，這是 FM 掃頻信號的特性
      // ============================================================
      let safeLowFreq_kHz = result.lowFreq_kHz;
      let safeLowFreq_Hz = result.lowFreq_Hz;
      let safeEndFreq_kHz = result.endFreq_kHz;
      let safeEndFreq_Hz = result.endFreq_Hz;
      let usedThreshold = result.threshold;
      
      // 如果最優閾值的 Low Frequency 高於 Peak Frequency，執行防呆檢查
      if (result.lowFreq_kHz !== null && result.lowFreq_kHz > (peakFreq_Hz / 1000)) {
        // 需要找到第一個 <= Peak Frequency 的 Low Frequency
        // 重新測試閾值範圍，從 -24 到 -70
        const peakFreq_kHz = peakFreq_Hz / 1000;
        let foundValidLowFreq = false;
        
        for (let testThreshold_dB = -24; testThreshold_dB >= -70; testThreshold_dB--) {
          const lowFreqThreshold_dB = peakPower_dB + testThreshold_dB;
          const lastFramePowerForTest = spectrogram[spectrogram.length - 1];
          
          // Calculate此閾值的 Low Frequency
          let testLowFreq_Hz = null;
          let testEndFreq_Hz = null;
          
          // Low Frequency Calculate（從低到高）
          for (let binIdx = 0; binIdx < lastFramePowerForTest.length; binIdx++) {
            if (lastFramePowerForTest[binIdx] > lowFreqThreshold_dB) {
              testLowFreq_Hz = freqBins[binIdx];
              
              // 線性插值
              if (binIdx > 0) {
                const thisPower = lastFramePowerForTest[binIdx];
                const prevPower = lastFramePowerForTest[binIdx - 1];
                if (prevPower < lowFreqThreshold_dB && thisPower > lowFreqThreshold_dB) {
                  const powerRatio = (thisPower - lowFreqThreshold_dB) / (thisPower - prevPower);
                  const freqDiff = freqBins[binIdx] - freqBins[binIdx - 1];
                  testLowFreq_Hz = freqBins[binIdx] - powerRatio * freqDiff;
                }
              }
              break;
            }
          }
          
          // 如果找到有效的 Low Frequency，檢查是否 <= Peak Frequency
          if (testLowFreq_Hz !== null && (testLowFreq_Hz / 1000) <= peakFreq_kHz) {
            testEndFreq_Hz = testLowFreq_Hz;  // End frequency = low frequency
            
            safeLowFreq_Hz = testLowFreq_Hz;
            safeLowFreq_kHz = testLowFreq_Hz / 1000;
            safeEndFreq_Hz = testEndFreq_Hz;
            safeEndFreq_kHz = testEndFreq_Hz !== null ? testEndFreq_Hz / 1000 : null;
            usedThreshold = testThreshold_dB;
            foundValidLowFreq = true;
            break;
          }
        }
      }
      
      // Update the config with the calculated optimal threshold
      // 2025 SAFETY MECHANISM: 應用安全機制 - 如果 usedThreshold 達到 -70，改用 -30
      const finalSafeThreshold = (usedThreshold <= -70) ? -30 : usedThreshold;
      this.config.lowFreqThreshold_dB = finalSafeThreshold;
      // 2025: 在 auto mode 下保存實際使用的 low frequency threshold
      // Auto mode: 保存經過防呆檢查和安全機制後的最終 threshold 值
      call.lowFreqThreshold_dB_used = finalSafeThreshold;
      
      // 如果Safety mechanism changed threshold，使用新閾值重新Calculate lowFreq_Hz
      if (finalSafeThreshold !== usedThreshold) {
        const lastFramePowerForSafe = spectrogram[spectrogram.length - 1];
        const lowFreqThreshold_dB_safe = peakPower_dB + finalSafeThreshold;
        
        let testLowFreq_Hz_safe = null;
        let testEndFreq_Hz_safe = null;
        
      // Calculate low frequency using safe threshold
        for (let binIdx = 0; binIdx < lastFramePowerForSafe.length; binIdx++) {
          if (lastFramePowerForSafe[binIdx] > lowFreqThreshold_dB_safe) {
            testLowFreq_Hz_safe = freqBins[binIdx];
            
            // 線性插值
            if (binIdx > 0) {
              const thisPower = lastFramePowerForSafe[binIdx];
              const prevPower = lastFramePowerForSafe[binIdx - 1];
              if (prevPower < lowFreqThreshold_dB_safe && thisPower > lowFreqThreshold_dB_safe) {
                const powerRatio = (thisPower - lowFreqThreshold_dB_safe) / (thisPower - prevPower);
                const freqDiff = freqBins[binIdx] - freqBins[binIdx - 1];
                testLowFreq_Hz_safe = freqBins[binIdx] - powerRatio * freqDiff;
              }
            }
            break;
          }
        }
        
        if (testLowFreq_Hz_safe !== null) {
          testEndFreq_Hz_safe = testLowFreq_Hz_safe;
          safeLowFreq_Hz = testLowFreq_Hz_safe;
          safeLowFreq_kHz = testLowFreq_Hz_safe / 1000;
          safeEndFreq_Hz = testEndFreq_Hz_safe;
          safeEndFreq_kHz = testEndFreq_Hz_safe / 1000;
        }
      }
      
      // 2025 SAFETY MECHANISM: 禁用 Low Frequency Warning
      // 由於 findOptimalLowFrequencyThreshold 已實施安全機制（-70時改用-30）
      
      // Use the optimized low frequency values
      lowFreq_Hz = safeLowFreq_Hz;
      lowFreq_kHz = safeLowFreq_kHz;
      endFreq_kHz = safeEndFreq_kHz;
      
      // 重要：更新 call.endFreq_kHz 為 auto mode Calculate的值
      // Auto mode: End Frequency = Auto-calculated Low Frequency
      call.endFreq_kHz = endFreq_kHz;
    }
    
    // ============================================================
    // 2025 ENHANCEMENT: Validate Low Frequency measurement quality
    // This ensures compatibility with anti-rebounce protection
    // ============================================================
    let validationResult = null;
    
    // Retrieve power values for validation
    const lastFramePowerAtLowFreq = lastFramePower[Math.max(0, Math.floor(lowFreq_Hz / (freqBins[1] - freqBins[0])))];
    const prevBinIdx = Math.max(0, Math.floor(lowFreq_Hz / (freqBins[1] - freqBins[0])) - 1);
    const prevFramePowerAtLowFreq = lastFramePower[prevBinIdx];
    const freqBinWidth = freqBins.length > 1 ? freqBins[1] - freqBins[0] : 1;
    
    // Run validation if we have valid power values
    if (lastFramePowerAtLowFreq !== undefined && prevFramePowerAtLowFreq !== undefined) {
      validationResult = this.validateLowFrequencyMeasurement(
        lowFreq_Hz,
        lowFreq_kHz,
        peakFreq_Hz,
        peakPower_dB,
        lastFramePowerAtLowFreq,
        prevFramePowerAtLowFreq,
        endThreshold_dB,
        freqBinWidth,
        this.config.enableBackwardEndFreqScan  // rebounce detection status
      );
      
      // Store validation metadata on call object (for debugging/analysis)
      call._lowFreqValidation = {
        valid: validationResult.valid,
        confidence: validationResult.confidence,
        interpolationRatio: validationResult.details.interpolationRatio,
        powerRatio_dB: validationResult.details.powerRatio_dB,
        frequencySpread_kHz: validationResult.details.frequencySpread,
        rebounceCompat: validationResult.details.rebounceCompat,
        warnings: []
      };
      
      // Collect warnings
      if (validationResult.details.frequencySpreadWarning) {
        call._lowFreqValidation.warnings.push(validationResult.details.frequencySpreadWarning);
      }
      if (validationResult.details.powerRatioWarning) {
        call._lowFreqValidation.warnings.push(validationResult.details.powerRatioWarning);
      }
      if (validationResult.details.rebounceWarning) {
        call._lowFreqValidation.warnings.push(validationResult.details.rebounceWarning);
      }
    }
    
    // ============================================================
    // LOW FREQUENCY OPTIMIZATION: Compare with Start Frequency
    // If Start Frequency is lower, use it as Low Frequency
    // 優化邏輯：如果 Start Frequency 比Calculate的 Low Frequency 更低
    // 則使用 Start Frequency 作為 Low Frequency
    // 
    // IMPORTANT: This optimization respects anti-rebounce mechanism
    // Start Frequency is from FIRST frame (after anti-rebounce boundary)
    // Low Frequency is from LAST frame (also respects anti-rebounce)
    // Both are measured within the same protected boundaries
    // ============================================================
    if (startFreq_kHz !== null && startFreq_kHz < lowFreq_kHz) {
      lowFreq_kHz = startFreq_kHz;
      
      // Update validation metadata to reflect use of Start Frequency
      if (call._lowFreqValidation) {
        call._lowFreqValidation.usedStartFreq = true;
        call._lowFreqValidation.note = 'Low Frequency replaced by Start Frequency (lower value)';
      }
    }
    
    call.lowFreq_kHz = lowFreq_kHz;
    
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
    // 2025: Limit search range to endFrameIdx_forLowFreq (call end, limited by newEndFrameIdx)
    // ============================================================
    // Use endFrameIdx_forLowFreq instead of spectrogram.length - 1 to respect call boundaries
    const charFreqSearchEnd = endFrameIdx_forLowFreq;  // Limited by newEndFrameIdx
    const lastPercentStart = Math.floor(newStartFrameIdx + (charFreqSearchEnd - newStartFrameIdx) * (1 - characteristicFreq_percentEnd / 100));
    let characteristicFreq_Hz = peakFreq_Hz;
    let characteristicFreq_FrameIdx = 0;  // Track frame index for time calculation
    
    if (lastPercentStart < charFreqSearchEnd) {
      // Method 1: Find weighted average frequency in last portion
      // This handles CF-FM calls better than just finding the minimum
      let totalPower = 0;
      let weightedFreq = 0;
      let weightedFrameIdx = 0;  // Weighted frame index for time calculation
      let totalFrameWeight = 0;
      
      // Search only up to charFreqSearchEnd (limited by newEndFrameIdx)
      for (let frameIdx = Math.max(0, lastPercentStart); frameIdx <= charFreqSearchEnd; frameIdx++) {
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
            // Accumulate weighted frame index
            weightedFrameIdx += linearPower * frameIdx;
            totalFrameWeight += linearPower;
          }
        }
      }
      
      // Calculate weighted average frequency
      if (totalPower > 0) {
        characteristicFreq_Hz = weightedFreq / totalPower;
        characteristicFreq_FrameIdx = Math.round(weightedFrameIdx / totalFrameWeight);
      } else {
        // Fallback: find lowest frequency in end portion (limited by charFreqSearchEnd)
        for (let frameIdx = Math.max(0, lastPercentStart); frameIdx <= charFreqSearchEnd; frameIdx++) {
          const framePower = spectrogram[frameIdx];
          for (let binIdx = 0; binIdx < framePower.length; binIdx++) {
            if (framePower[binIdx] > -Infinity) {
              characteristicFreq_Hz = freqBins[binIdx];
              characteristicFreq_FrameIdx = frameIdx;
              break;
            }
          }
        }
      }
    }
    
    call.characteristicFreq_kHz = characteristicFreq_Hz / 1000;
    
    // ============================================================
    // NEW (2025): Calculate characteristic frequency time in milliseconds
    // characteristicFreq_ms = absolute time of characteristic frequency point within selection area
    // Unit: ms (milliseconds), relative to selection area start
    // ============================================================
    if (characteristicFreq_FrameIdx < timeFrames.length) {
      const charFreqTime_s = timeFrames[characteristicFreq_FrameIdx];
      const firstFrameTimeInSeconds_char = timeFrames[0];
      call.characteristicFreq_ms = (charFreqTime_s - firstFrameTimeInSeconds_char) * 1000;  // Time relative to selection area start
    }
    
    // ============================================================
    // STEP 5: Validate frequency relationships (Avisoft standard)
    // Ensure: lowFreq ≤ charFreq ≤ peakFreq ≤ highFreq
    // This maintains biological validity for FM and CF-FM calls
    // ============================================================
    // Clamp characteristic frequency between low and peak
    const lowFreqKHz = lowFreq_Hz / 1000;
    const charFreqKHz = characteristicFreq_Hz / 1000;
    const peakFreqKHz = peakFreq_Hz / 1000;
    const highFreqKHz = highFreq_Hz / 1000;
    
    if (charFreqKHz < lowFreqKHz) {
      // Char freq should not be below low freq
      call.characteristicFreq_kHz = lowFreqKHz;
    } else if (charFreqKHz > peakFreqKHz) {
      // Char freq should not exceed peak freq
      call.characteristicFreq_kHz = peakFreqKHz;
    }
    
    // Calculate bandwidth
    call.calculateBandwidth();
    
    // ============================================================
    // ============================================================
    // STEP 6: Calculate Knee Frequency and Knee Time
    // 
    // 2025 PROFESSIONAL STANDARD: Maximum 2nd Derivative + -15 dB Fallback
    // Used by: Avisoft official manual, SonoBat whitepaper, Kaleidoscope tech docs
    // 
    // Algorithm:
    // 1. Extract frequency contour (peak frequency trajectory)
    // 2. Smooth with Savitzky-Golay filter (window=5)
    // 3. Calculate 2nd derivative (acceleration of frequency change)
    // 4. Find minimum 2nd derivative point (CF→FM transition)
    // 5. If noise too high: fallback to -15 dB below peak method
    // ============================================================
    
    // STEP 6.1: Extract peak frequency trajectory for each frame
    // (More stable than weighted average for noisy signals)
    const frameFrequencies = [];
    
    for (let frameIdx = 0; frameIdx < spectrogram.length; frameIdx++) {
      const framePower = spectrogram[frameIdx];
      
      // Find peak frequency (highest power bin) in this frame
      let peakIdx = 0;
      let maxPower = -Infinity;
      
      for (let binIdx = 0; binIdx < framePower.length; binIdx++) {
        if (framePower[binIdx] > maxPower) {
          maxPower = framePower[binIdx];
          peakIdx = binIdx;
        }
      }
      
      // Store peak frequency in Hz
      frameFrequencies.push(freqBins[peakIdx]);
    }
    
    // STEP 6.2: Apply Savitzky-Goyal smoothing filter (window=5, polynomial=2)
    // This is what Avisoft uses for stable knee detection
    const smoothedFrequencies = this.savitzkyGolay(frameFrequencies, 5, 2);
    
    // STEP 6.3: Calculate 1st derivative (frequency change rate)
    // Note: firstDerivatives[i] represents derivative at frame i+1 position
    const firstDerivatives = [];
    const firstDerivIndices = [];  // Track corresponding frame indices
    
    for (let i = 0; i < smoothedFrequencies.length - 1; i++) {
      const freqChange = smoothedFrequencies[i + 1] - smoothedFrequencies[i];
      const timeDelta = (i + 1 < timeFrames.length) ? 
        (timeFrames[i + 1] - timeFrames[i]) : 0.001; // Prevent division by zero
      
      firstDerivatives.push(freqChange / timeDelta);
      firstDerivIndices.push(i + 1);  // This derivative is at frame i+1
    }
    
    // STEP 6.4: Calculate 2nd derivative (acceleration of frequency change)
    // Note: secondDerivatives[i] represents 2nd derivative at frame i+2 position
    const secondDerivatives = [];
    const secondDerivIndices = [];  // Track corresponding frame indices
    
    for (let i = 0; i < firstDerivatives.length - 1; i++) {
      const derivChange = firstDerivatives[i + 1] - firstDerivatives[i];
      const timeDelta = (i + 2 < timeFrames.length) ? 
        (timeFrames[i + 2] - timeFrames[i + 1]) : 0.001;
      
      secondDerivatives.push(derivChange / timeDelta);
      secondDerivIndices.push(i + 2);  // This 2nd derivative is at frame i+2
    }
    
    // STEP 6.5: Find knee point - Use frequency acceleration (curvature) method
    // Professional method: Find maximum |curvature| = |d²f/dt²| / (1 + (df/dt)²)^(3/2)
    // This identifies the sharpest turning point in frequency trajectory
    // For FM-QCF: Knee is at the point where FM transitions to QCF
    
    // 2025: Helper function to validate knee point using slope protection mechanism
    // Verifies that the knee represents a transition from steep negative slope to flattening
    const isValidKneeBySlope = (candidateFrameIdx) => {
      // Find the index in firstDerivIndices that corresponds to this frame
      const derivIdx = firstDerivIndices.indexOf(candidateFrameIdx);
      
      if (derivIdx < 0 || derivIdx >= firstDerivatives.length) {
        // Frame index not found in derivatives array
        return false;
      }
      
      // Get slopes before and after the candidate knee point
      const incomingSlope = derivIdx > 0 ? firstDerivatives[derivIdx - 1] : null;
      const outgoingSlope = derivIdx < firstDerivatives.length - 1 ? firstDerivatives[derivIdx] : null;
      
      // Both slopes must exist
      if (incomingSlope === null || outgoingSlope === null) {
        return false;
      }
      
      const STEEP_NEGATIVE_THRESHOLD = -50; // Hz/s - minimum slope to be considered "steep negative"
      const SLOPE_RATIO_THRESHOLD = 0.7;     // Outgoing must be flatter (smaller absolute value)
      
      // 2025: Slope protection mechanism validation
      // 1. Incoming slope (before knee) MUST be a significant negative value (steep frequency decrease)
      if (incomingSlope >= STEEP_NEGATIVE_THRESHOLD) {
        // Incoming slope is not steep enough (not sufficiently negative)
        // This indicates the call is not in a clear FM phase before the knee
        return false;
      }
      
      // 2. Outgoing slope (after knee) MUST be flatter (smaller absolute value) than incoming
      // This validates the transition from steep FM to flat/quasi-constant frequency
      const incomingAbsSlope = Math.abs(incomingSlope);
      const outgoingAbsSlope = Math.abs(outgoingSlope);
      
      if (outgoingAbsSlope >= incomingAbsSlope * SLOPE_RATIO_THRESHOLD) {
        // Outgoing slope is NOT significantly flatter than incoming
        // This is an invalid knee (possibly a "plateau" to "steep" transition instead of "steep" to "plateau")
        return false;
      }
      
      // 3. Additional check: Incoming and Outgoing should have opposite trends or outgoing should be near-flat
      // If both are negative but outgoing is becoming more negative, it's not a valid knee
      if (outgoingSlope < incomingSlope) {
        // Outgoing slope is MORE negative than incoming (frequency dropping faster)
        // This is the opposite of what we expect at a knee point
        return false;
      }
      
      // All checks passed - this is a valid knee point
      return true;
    };
    
    let kneeIdx = -1;
    let maxCurvature = 0;
    
    // Calculate curvature for each point using proper formula
    for (let i = 1; i < firstDerivatives.length - 1; i++) {
      const frameIdx = firstDerivIndices[i]; // Get actual frame index
      
      if (frameIdx >= secondDerivIndices.length) continue;
      
      const df_dt = firstDerivatives[i];
      const d2f_dt2 = secondDerivatives[i];
      
      // Curvature = |d²f/dt²| / (1 + (df/dt)²)^(3/2)
      // Higher curvature = sharper turn in frequency trajectory
      const denominator = Math.pow(1 + df_dt * df_dt, 1.5);
      const curvature = Math.abs(d2f_dt2) / (denominator + 1e-10); // Avoid division by zero
      
      // For FM-QCF transition: we look for maximum curvature, not minimum 2nd derivative
      // This identifies the sharpest change in frequency pattern
      // 2025: Apply slope protection mechanism to validate knee point
      if (curvature > maxCurvature && isValidKneeBySlope(frameIdx)) {
        maxCurvature = curvature;
        kneeIdx = frameIdx;
      }
    }
    
    // STEP 6.6: Quality check - verify knee detection is reliable
    // Only use knee point if curvature is significant relative to signal noise
    const derivMean = secondDerivatives.reduce((a, b) => a + b, 0) / Math.max(secondDerivatives.length, 1);
    const derivStdDev = Math.sqrt(
      secondDerivatives.reduce((sum, val) => sum + Math.pow(val - derivMean, 2), 0) / Math.max(secondDerivatives.length, 1)
    );
    
    // Curvature-based SNR: if max curvature is weak, use fallback
    const isWeakCurvature = maxCurvature < derivStdDev * 0.3;
    
    // STEP 6.7: If curvature method fails, use professional fallback
    // Avisoft uses: Find point where frequency change rate has maximum transition
    if (kneeIdx < 0 || isWeakCurvature) {
      // FALLBACK: Find maximum of |1st derivative| 
      // For FM-QCF: This is typically where FM segment ends (frequency change slows down)
      let maxFirstDeriv = 0;
      let maxDerivIdx = -1;
      
      // Search only in the latter half of the call (where QCF typically occurs)
      const searchStart = Math.floor(spectrogram.length * 0.3);
      const searchEnd = Math.floor(spectrogram.length * 0.9);
      
      for (let i = 0; i < firstDerivatives.length; i++) {
        const frameIdx = firstDerivIndices[i];
        if (frameIdx >= searchStart && frameIdx <= searchEnd) {
          const absDeriv = Math.abs(firstDerivatives[i]);
          // 2025: Apply slope protection mechanism to fallback method as well
          // Only consider candidates that pass slope validation
          if (absDeriv > maxFirstDeriv && isValidKneeBySlope(frameIdx)) {
            maxFirstDeriv = absDeriv;
            maxDerivIdx = frameIdx;
          }
        }
      }
      
      if (maxDerivIdx >= 0) {
        kneeIdx = maxDerivIdx;
      }
      // No ultimate fallback: if knee not detected, leave as -1
    }
    
    // STEP 6.8: Set knee frequency and knee time from detected knee point
    // 
    // CRITICAL: Knee time MUST be between 0 and duration_ms
    // Knee must occur AFTER call start and BEFORE call end
    // kneeTime_ms = (timeFrames[kneeIdx] - call.startTime_s) * 1000
    
    let finalKneeIdx = -1;
    
    // Determine which knee point to use (prioritize validity)
    if (kneeIdx >= 0 && kneeIdx >= newStartFrameIdx && kneeIdx <= newEndFrameIdx) {
      // Curvature-detected knee is valid (within call boundaries)
      finalKneeIdx = kneeIdx;
    } else if (peakFrameIdx >= newStartFrameIdx && peakFrameIdx <= newEndFrameIdx) {
      // Fall back to peak if detected knee is invalid
      finalKneeIdx = peakFrameIdx;
    }
    
    if (finalKneeIdx >= 0 && finalKneeIdx < frameFrequencies.length && finalKneeIdx < timeFrames.length) {
      // Use original (non-smoothed) frequency at knee point
      call.kneeFreq_kHz = frameFrequencies[finalKneeIdx] / 1000;
      
      // ============================================================
      // NEW (2025): Calculate knee frequency time in milliseconds
      // kneeFreq_ms = absolute time of knee frequency point within selection area
      // Unit: ms (milliseconds), relative to selection area start
      // ============================================================
      const kneeFreqTime_s = timeFrames[finalKneeIdx];
      const firstFrameTimeInSeconds_knee = timeFrames[0];
      call.kneeFreq_ms = (kneeFreqTime_s - firstFrameTimeInSeconds_knee) * 1000;  // Time relative to selection area start
      
      // Calculate knee time from call start
      if (call.startTime_s !== null) {
        const rawKneeTime_ms = (timeFrames[finalKneeIdx] - call.startTime_s) * 1000;
        
        // SAFETY CHECK: Ensure knee time is valid
        // Must be positive and less than duration
        if (rawKneeTime_ms >= 0 && rawKneeTime_ms <= call.duration_ms) {
          call.kneeTime_ms = rawKneeTime_ms;
        } else {
          // Invalid knee time, reset to null (no valid knee)
          call.kneeTime_ms = null;
          call.kneeFreq_kHz = null;
        }
      } else {
        call.kneeTime_ms = null;
        call.kneeFreq_kHz = null;
      }
    } else {
      // No valid knee point found
      call.kneeTime_ms = null;
      call.kneeFreq_kHz = null;
    }
    
    // ============================================================
    // AUTO-DETECT CF-FM TYPE AND DISABLE ANTI-REBOUNCE IF NEEDED
    // 
    // If High-Freq and Peak Freq differ by < 1 kHz, 
    // it's likely a CF-FM call that exceeds the 10ms protection window.
    // Automatically disable anti-rebounce to avoid truncating long CF phases.
    // ============================================================
    
    // Compare peak frequency with high frequency (calculated from first frame)
    const peakFreq_kHz = peakFreq_Hz / 1000;
    const highFreq_kHz = call.highFreq_kHz;  // Already calculated in STEP 2
    
    // Calculate difference between peak and high frequency
    const freqDifference = Math.abs(peakFreq_kHz - highFreq_kHz);
    
    // ============================================================
    // IMPORTANT: Save actual used threshold value (after Auto mode calculation)
    // This allows UI to reflect the real value being used
    // Must be done BEFORE any further modifications to config
    // ============================================================
    if (this.config.highFreqThreshold_dB_isAuto === true) {
      // Auto mode: threshold already updated in detectCalls
      // No need to do anything here - config is already current
    }
    
    // ============================================================
    // CF-FM AUTO-DETECTION
    // ============================================================
    if (freqDifference < 1.0) {
      // CF-FM type call detected: peak and start frequencies very close
      // This means the call has a significant CF phase followed by FM sweep
      // The call duration likely exceeds the 10ms protection window
      // Auto-disable anti-rebounce to prevent false truncation
      this.config.enableBackwardEndFreqScan = false;
    } else {
      // Pure FM call: restore the anti-rebounce setting from original config
      // Re-read from parent config to get user's intended setting
      this.config.enableBackwardEndFreqScan = this.config.enableBackwardEndFreqScan !== false;
    }
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
   * 
   * Commercial standard (Avisoft, SonoBat, Kaleidoscope, BatSound):
   * Flow = lowest detectable frequency in selection (Hz)
   * Fhigh = highest detectable frequency in selection (kHz)
   */
  measureDirectSelection(audioData, sampleRate, flowKHz, fhighKHz) {
    const { fftSize, windowType, highFreqThreshold_dB } = this.config;
    
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
    
    // Measure peak frequency and find frequency range
    let peakFreq_Hz = null;
    let peakPower_dB = -Infinity;
    let lowestFreq_Hz = null;
    let highestFreq_Hz = null;
    
    // First pass: find peak
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
    
    // Second pass: find frequency range based on -27dB threshold from peak
    // (Commercial standard from Avisoft, SonoBat)
    if (peakPower_dB > -Infinity) {
      const threshold_dB = peakPower_dB + highFreqThreshold_dB; // Typically -24dB
      
      // Find lowest frequency above threshold
      for (let binIdx = minBin; binIdx <= maxBin; binIdx++) {
        const freqHz = binIdx * freqResolution;
        const energy = this.goertzelEnergy(dcRemoved, freqHz, sampleRate);
        const rms = Math.sqrt(energy);
        const psd = (rms * rms) / fftSize;
        const powerDb = 10 * Math.log10(Math.max(psd, 1e-16));
        
        if (powerDb > threshold_dB) {
          lowestFreq_Hz = freqHz;
          break;
        }
      }
      
      // Find highest frequency above threshold
      for (let binIdx = maxBin; binIdx >= minBin; binIdx--) {
        const freqHz = binIdx * freqResolution;
        const energy = this.goertzelEnergy(dcRemoved, freqHz, sampleRate);
        const rms = Math.sqrt(energy);
        const psd = (rms * rms) / fftSize;
        const powerDb = 10 * Math.log10(Math.max(psd, 1e-16));
        
        if (powerDb > threshold_dB) {
          highestFreq_Hz = freqHz;
          break;
        }
      }
    }
    
    const call = new BatCall();
    call.peakFreq_kHz = peakFreq_Hz ? peakFreq_Hz / 1000 : null;
    call.peakPower_dB = peakPower_dB;
    
    // Set Flow and Fhigh based on detected frequency range
    // (Commercial standard from Avisoft, SonoBat, Kaleidoscope, BatSound)
    // Flow = Lowest frequency in the selection (Hz)
    // Fhigh = Highest frequency in the selection (kHz)
    // Note: For direct user selection, may not have complete frequency sweep
    call.Flow = lowestFreq_Hz ? lowestFreq_Hz : (flowKHz * 1000);     // Hz
    call.Fhigh = highestFreq_Hz ? (highestFreq_Hz / 1000) : fhighKHz; // kHz
    
    return call;
  }
}

/**
 * Export default detector instance with standard configuration
 */
export const defaultDetector = new BatCallDetector();
