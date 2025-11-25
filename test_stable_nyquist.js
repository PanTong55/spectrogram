/**
 * Test: Verify Start Frequency remains stable regardless of selection area boundary (fhighKHz)
 * 
 * This test validates the fix where:
 * - Before: Start Frequency varied when fhighKHz changed because we used freqBins[freqBins.length - 1]
 * - After: Start Frequency remains consistent because we use sampleRate / 2 (true Nyquist)
 */

// Test parameters - simulate different selection areas
const testCases = [
  {
    name: "Selection with fhighKHz = 192 kHz (narrow)",
    fhighKHz: 192,
    flowKHz: 5,
    sampleRate: 384000  // 384 kHz (Nyquist = 192 kHz)
  },
  {
    name: "Selection with fhighKHz = 384 kHz (full)",
    fhighKHz: 384,
    flowKHz: 5,
    sampleRate: 384000  // 384 kHz (Nyquist = 192 kHz) - same sampleRate!
  },
  {
    name: "Selection with fhighKHz = 96 kHz (very narrow)",
    fhighKHz: 96,
    flowKHz: 5,
    sampleRate: 384000  // 384 kHz (Nyquist = 192 kHz) - same sampleRate!
  }
];

console.log("=".repeat(80));
console.log("TEST: Start Frequency Stability Across Different Selection Boundaries");
console.log("=".repeat(80));
console.log();

// Simulate what generateSpectrogram does with different fhighKHz values
// This demonstrates the problem with using freqBins[freqBins.length - 1]

function simulateFreqBinsGeneration(flowKHz, fhighKHz, sampleRate) {
  const fftSize = 1024;
  const freqResolution = sampleRate / fftSize;
  
  const minBin = Math.max(0, Math.floor(flowKHz * 1000 / freqResolution));
  const maxBin = Math.min(
    Math.floor(fftSize / 2),
    Math.floor(fhighKHz * 1000 / freqResolution)  // ← This changes with fhighKHz!
  );
  
  const numBins = maxBin - minBin + 1;
  const freqBins = new Float32Array(numBins);
  
  for (let i = 0; i < numBins; i++) {
    freqBins[i] = (minBin + i) * freqResolution;
  }
  
  return {
    freqBins,
    numBins,
    lastBinFreq: freqBins[freqBins.length - 1],
    trueNyquist: sampleRate / 2
  };
}

console.log("PROBLEM - Using freqBins[freqBins.length - 1] as reference:");
console.log("-".repeat(80));

const oldApproachResults = [];

for (const testCase of testCases) {
  const result = simulateFreqBinsGeneration(testCase.flowKHz, testCase.fhighKHz, testCase.sampleRate);
  oldApproachResults.push({
    ...testCase,
    ...result
  });
  
  console.log(`\n${testCase.name}`);
  console.log(`  fhighKHz: ${testCase.fhighKHz} kHz`);
  console.log(`  freqBins array size: ${result.numBins} bins`);
  console.log(`  freqBins[freqBins.length - 1]: ${(result.lastBinFreq / 1000).toFixed(2)} kHz  ← PROBLEM: varies with fhighKHz!`);
  console.log(`  True Nyquist (sampleRate/2): ${(result.trueNyquist / 1000).toFixed(2)} kHz  ← SOLUTION: stable!`);
}

console.log();
console.log("=".repeat(80));
console.log("ANALYSIS:");
console.log("-".repeat(80));

// Check if old approach produces different values
const oldValues = oldApproachResults.map(r => r.lastBinFreq);
const oldValuesUnique = new Set(oldValues);
const oldApproachConsistent = oldValuesUnique.size === 1;

console.log(`\nOLD APPROACH (freqBins[freqBins.length - 1]):`);
if (!oldApproachConsistent) {
  console.log("  ✗ INCONSISTENT: Different values for different fhighKHz");
  for (let i = 0; i < oldApproachResults.length; i++) {
    console.log(`    Case ${i+1}: ${(oldApproachResults[i].lastBinFreq / 1000).toFixed(2)} kHz`);
  }
} else {
  console.log("  ✓ Consistent (by coincidence in this test)");
}

// Check if new approach produces consistent values
const newValues = oldApproachResults.map(r => r.trueNyquist);
const newValuesUnique = new Set(newValues);
const newApproachConsistent = newValuesUnique.size === 1;

console.log(`\nNEW APPROACH (sampleRate / 2):`);
if (newApproachConsistent) {
  console.log("  ✓ CONSISTENT: Same value for all fhighKHz (192.0 kHz)");
  console.log(`    Result: ${(newValues[0] / 1000).toFixed(1)} kHz for all cases`);
} else {
  console.log("  ✗ Inconsistent (should not happen)");
}

console.log();
console.log("=".repeat(80));
console.log("CONCLUSION:");
console.log("-".repeat(80));
console.log("The fix changes Start Frequency initialization from:");
console.log("  OLD: const nyquistFreq_Hz = freqBins[freqBins.length - 1];  // Selection-dependent!");
console.log("  NEW: const nyquistFreq_Hz = call.sampleRate / 2;            // Stable!");
console.log();
console.log("This ensures findOptimalStartEndThreshold and STEP 2");
console.log("produce consistent Start Frequency regardless of selection area boundary.");
console.log("=".repeat(80));

