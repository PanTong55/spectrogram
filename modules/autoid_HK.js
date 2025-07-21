// modules/autoid_HK.js

export function autoIdHK({ callType, highFreq }) {
  let result = '-';
  if (callType === 'CF-FM') {
    if (highFreq >= 120 && highFreq <= 130) result = 'Hipposideros gentilis';
    else if (highFreq >= 60 && highFreq <= 70) result = 'Hipposideros armiger';
    else result = 'Hipposideros sp.';
  } else if (callType === 'FM-CF-FM') {
    if (highFreq >= 100 && highFreq <= 110) result = 'Rhinolophus pusillus';
    else if (highFreq >= 75 && highFreq <= 85) result = 'Rhinolophus sinicus';
    else if (highFreq >= 65 && highFreq <= 75) result = 'Rhinolophus affinis';
    else result = 'Rhinolophus sp.';
  } else if (callType === 'FM' || callType === 'FM-QCF' || callType === 'QCF') {
    result = 'TBC';
  }
  return result;
}
