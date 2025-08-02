// modules/autoid_HK.js

const speciesRules = [
  {
    name: 'Hipposideros gentilis',
    callType: 'CF-FM',
    cfStart: [120, 130],
    duration: [5, 10]
  },
  {
    name: 'Hipposideros armiger',
    callType: 'CF-FM',
    cfStart: [60, 70],
    duration: [10, 18]
  },
  {
    name: 'Rhinolophus pusillus',
    callType: 'FM-CF-FM',
    cfStart: [100, 110],
    duration: [30, 70]
  },
  {
    name: 'Rhinolophus sinicus',
    callType: 'FM-CF-FM',
    cfStart: [75, 87],
    duration: [30, 70]
  },
  {
    name: 'Rhinolophus affinis',
    callType: 'FM-CF-FM',
    cfStart: [68, 75],
    duration: [30, 80]
  },
  {
    name: 'Pipistrellus tenuis',
    callType: 'QCF',
    lowestFreq: [39, 42],
    bandwidth: [1, 5],
    duration: [5, 10]
  },
  {
    name: 'Pipistrellus abramus',
    callType: 'QCF',
    lowestFreq: [44, 46]
  },
  {
    name: 'Hypsugo pulveratus',
    callType: 'QCF',
    lowestFreq: [32, 36]
  },
  {
    name: 'Pipistrellus ceylonicus',
    callType: 'QCF',
    lowestFreq: [30, 32]
  },
  {
    name: 'Nyctalus plancyi',
    callType: 'QCF',
    lowestFreq: [17.5, 21]
  },
  {
    name: 'Mops plicatus',
    callType: 'QCF',
    lowestFreq: [[17.5, 21], [13, 16.5]]
  },
  {
    name: 'Taphozous melanopogon',
    callType: 'QCF',
    lowestFreq: [24.5, 26]
  }
];

function inRange(val, range) {
  if (val == null || isNaN(val)) return false;
  if (Array.isArray(range[0])) return range.some(r => inRange(val, r));
  const [min, max] = range;
  return val >= min && val <= max;
}

export function autoIdHK(data = {}) {
  if (data.callType === 'FM' || data.callType === 'FM-QCF') return 'TBC';
  const matches = speciesRules.filter(rule => {
    if (rule.callType && rule.callType !== data.callType) return false;
    const fields = [
      'highestFreq', 'lowestFreq', 'kneeFreq', 'heelFreq',
      'startFreq', 'endFreq', 'cfStart', 'cfEnd', 'duration',
      'bandwidth', 'kneeLowTime', 'kneeLowBandwidth',
      'heelLowBandwidth', 'kneeHeelBandwidth'
    ];
    return fields.every(f => !rule[f] || inRange(data[f], rule[f]));
  }).map(r => r.name);
  if (matches.length) return matches.join(' / ');
  const fallback = { 'CF-FM': 'Hipposideros sp.', 'FM-CF-FM': 'Rhinolophus sp.' };
  return fallback[data.callType] || '-';
}
