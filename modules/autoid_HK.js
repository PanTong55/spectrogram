// modules/autoid_HK.js

const speciesRules = [
  {
    name: 'Hipposideros gentilis',
    callType: 'CF-FM',
    cfStart: [120, 130],
    duration: [5, 10],
    harmonic: [0, 1, 2, 3]
  },
  {
    name: 'Hipposideros armiger',
    callType: 'CF-FM',
    cfStart: [60, 70],
    duration: [10, 18],
    harmonic: [0, 1, 2, 3]
  },
  {
    name: 'Rhinolophus pusillus',
    callType: 'FM-CF-FM',
    cfStart: [100, 110],
    duration: [30, 70],
    harmonic: [0, 1, 2, 3]
  },
  {
    name: 'Rhinolophus sinicus',
    callType: 'FM-CF-FM',
    cfStart: [75, 87],
    duration: [30, 70],
    harmonic: [0, 1, 2, 3]
  },
  {
    name: 'Rhinolophus affinis',
    callType: 'FM-CF-FM',
    cfStart: [68, 75],
    duration: [30, 80],
    harmonic: [0, 1, 2, 3]
  },
  {
    name: 'Pipistrellus tenuis',
    callType: 'QCF',
    lowestFreq: [39, 42],
    bandwidth: [1, 5],
    duration: [5, 10],
    harmonic: [0, 1, 2, 3]
  },
  {
    name: 'Pipistrellus abramus',
    callType: 'QCF',
    lowestFreq: [44, 46],
    harmonic: [0, 1, 2, 3]
  },
  {
    name: 'Hypsugo pulveratus',
    callType: 'QCF',
    lowestFreq: [32, 36],
    harmonic: [0, 1, 2, 3]
  },
  {
    name: 'Pipistrellus ceylonicus',
    callType: 'QCF',
    lowestFreq: [30, 32],
    harmonic: [0, 1, 2, 3]
  },
  {
    name: 'Nyctalus plancyi',
    callType: 'QCF',
    lowestFreq: [17.5, 21],
    harmonic: [0, 1, 2, 3]
  },
  {
    name: 'Mops plicatus',
    callType: 'QCF',
    lowestFreq: [[17.5, 21], [13, 16.5]],
    harmonic: [0, 1, 2, 3]
  },
  {
    name: 'Taphozous melanopogon',
    callType: 'QCF',
    lowestFreq: [24.5, 26],
    harmonic: [0, 1, 2, 3]
  }
];

function inRange(val, range) {
  if (val == null || isNaN(val)) return false;
  if (Array.isArray(range[0])) return range.some(r => inRange(val, r));
  const [min, max] = range;
  return val >= min && val <= max;
}

export function autoIdHK(data = {}) {
  const matches = speciesRules.filter(rule => {
    if (rule.callType && rule.callType !== data.callType) return false;
    if (rule.harmonic && !rule.harmonic.includes(data.harmonic)) return false;
    const fields = [
      'highestFreq', 'lowestFreq', 'kneeFreq', 'heelFreq',
      'startFreq', 'endFreq', 'cfStart', 'cfEnd', 'duration',
      'bandwidth', 'kneeLowTime', 'kneeLowBandwidth',
      'heelLowBandwidth', 'kneeHeelBandwidth'
    ];
    return fields.every(f => !rule[f] || inRange(data[f], rule[f]));
  }).map(r => r.name);
  return matches.length ? matches.join(' / ') : 'No species matched';
}
