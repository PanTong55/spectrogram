// modules/autoid_HK.js

export function autoIdHK({ callType, cfStart, duration, lowFreq }) {
  let result = '-';
  if (callType === 'CF-FM') {
    if (cfStart >= 120 && cfStart <= 130 && duration >= 5 && duration <= 10) {
      result = 'Hipposideros gentilis';
    } else if (cfStart >= 60 && cfStart <= 70 && duration >= 10 && duration <= 18) {
      result = 'Hipposideros armiger';
    } else {
      result = 'Hipposideros sp.';
    }
  } else if (callType === 'FM-CF-FM') {
    if (cfStart >= 100 && cfStart <= 110 && duration >= 30 && duration <= 70) {
      result = 'Rhinolophus pusillus';
    } else if (cfStart >= 75 && cfStart <= 87 && duration >= 30 && duration <= 70) {
      result = 'Rhinolophus sinicus';
    } else if (cfStart >= 68 && cfStart <= 75 && duration >= 30 && duration <= 80) {
      result = 'Rhinolophus affinis';
    } else {
      result = 'Rhinolophus sp.';
    }
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
