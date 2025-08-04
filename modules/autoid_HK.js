// modules/autoid_HK.js

const speciesRules = [
  {
    name: 'Hipposideros gentilis',
    rules: [
      {
        callType: 'CF-FM',
        cfStart: [120, 130],
        duration: [5, 10],
        harmonic: [0, 1, 2, 3]
      }
    ]
  },
  {
    name: 'Hipposideros armiger',
    rules: [
      {
        callType: 'CF-FM',
        cfStart: [65, 72],
        duration: [10, 18],
        harmonic: [0, 1, 2, 3]
      }
    ]
  },
  {
    name: 'Rhinolophus pusillus',
    rules: [
      {
        callType: 'FM-CF-FM',
        cfStart: [100, 110],
        duration: [30, 70],
        harmonic: [0, 1, 2, 3]
      }
    ]
  },
  {
    name: 'Rhinolophus sinicus',
    rules: [
      {
        callType: 'FM-CF-FM',
        cfStart: [75, 87],
        duration: [30, 70],
        harmonic: [0, 1, 2, 3]
      }
    ]
  },
  {
    name: 'Rhinolophus affinis',
    rules: [
      {
        callType: 'FM-CF-FM',
        cfStart: [68, 75],
        duration: [30, 80],
        harmonic: [0, 1, 2, 3]
      }
    ]
  },
  {
    name: 'Pipistrellus tenuis',
    rules: [
      {
        callType: 'QCF',
        lowestFreq: [39, 42],
        bandwidth: [1, 5],
        duration: [5, 10],
        harmonic: [0, 1, 2, 3]
      }
    ]
  },
  {
    name: 'Pipistrellus abramus',
    rules: [
      {
        callType: 'QCF',
        lowestFreq: [44, 46],
        harmonic: [0, 1, 2, 3]
      },
      {
        callType: 'FM-QCF',
        lowestFreq: [46, 50],
        highestFreq: [60, 100],
        kneeFreq: [46, 53],
        kneeLowBandwidth: [0, 5],
        duration: [3, 6],
        harmonic: [0, 1, 2]
      }
    ]
  },
  {
    name: 'Hypsugo pulveratus',
    rules: [
      {
        callType: 'QCF',
        lowestFreq: [32, 36],
        harmonic: [0, 1, 2, 3]
      }
    ]
  },
  {
    name: 'Pipistrellus ceylonicus',
    rules: [
      {
        callType: 'QCF',
        lowestFreq: [30, 32],
        harmonic: [0, 1, 2, 3]
      }
    ]
  },
  {
    name: 'Nyctalus plancyi',
    rules: [
      {
        callType: 'QCF',
        lowestFreq: [17.5, 21],
        harmonic: [0, 1, 2, 3]
      }
    ]
  },
  {
    name: 'Mops plicatus',
    rules: [
      {
        callType: 'QCF',
        lowestFreq: [17.5, 21],
        harmonic: [0, 1, 2, 3]
      },
      {
        callType: 'QCF',
        lowestFreq: [13, 16.5],
        harmonic: [0, 1, 2, 3]
      }
    ]
  },
  {
    name: 'Taphozous melanopogon',
    rules: [
      {
        callType: 'QCF',
        lowestFreq: [24.5, 26],
        harmonic: [0, 1, 2, 3]
      }
    ]
  }
];

function inRange(val, range) {
  if (val == null || isNaN(val)) return false;
  if (Array.isArray(range[0])) return range.some(r => inRange(val, r));
  const [min, max] = range;
  return val >= min && val <= max;
}

export function autoIdHK(data = {}) {
  const fields = [
    'highestFreq', 'lowestFreq', 'kneeFreq', 'heelFreq',
    'startFreq', 'endFreq', 'cfStart', 'cfEnd', 'duration',
    'bandwidth', 'kneeLowTime', 'kneeLowBandwidth',
    'heelLowBandwidth', 'kneeHeelBandwidth'
  ];

  const matches = speciesRules.filter(species =>
    species.rules.some(rule => {
      if (rule.callType && rule.callType !== data.callType) return false;
      if (rule.harmonic && !rule.harmonic.includes(data.harmonic)) return false;
      return fields.every(f => !rule[f] || inRange(data[f], rule[f]));
    })
  ).map(s => s.name);

  return matches.length ? matches.join(' / ') : 'No species matched';
}
