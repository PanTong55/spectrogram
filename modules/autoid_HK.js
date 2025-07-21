// modules/autoid_HK.js

export function autoIdHK({ callType, highFreq, lowFreq }) {
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
  } else if (callType === 'QCF') {
    if (lowFreq >= 39 && lowFreq <= 42) result = '<i>Pipistrellus tenuis</i>';
    else if (lowFreq >= 44 && lowFreq <= 46) result = '<i>Pipistrellus abramus</i>';
    else if (lowFreq >= 32 && lowFreq <= 36) result = '<i>Hypsugo pulveratus</i>';
    else if (lowFreq >= 30 && lowFreq < 32) result = '<i>Pipistrellus ceylonicus</i>';
    else if (lowFreq >= 17.5 && lowFreq <= 21) result = '<i>Nyctalus plancyi</i> / <i>Mops plicatus</i>';
    else if (lowFreq >= 24.5 && lowFreq <= 26) result = '<i>Taphozous melanopogon</i>';
    else if (lowFreq >= 13 && lowFreq <= 16.5) result = '<i>Mops plicatus</i>';
  } else if (callType === 'FM' || callType === 'FM-QCF') {
    result = 'TBC';
  }
  return result;
}
