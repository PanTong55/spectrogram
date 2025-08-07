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
    name: 'Tylonycteris fulvida',
    rules: [
      {
        callType: 'QCF',
        lowestFreq: [49, 51],
        bandwidth: [3.5, 5],
        duration: [7, 8.5],
        harmonic: [0, 1, 2]
      },      
      {
        callType: 'FM, FM-QCF',
        lowestFreq: [49.5, 55],
        highestFreq: [54.6, 65],
        bandwidth: [5.1, 15],
        duration: [7, 11],
        harmonic: [0, 1, 2]
      },
      {
        callType: 'FM, FM-QCF',
        lowestFreq: [49.5, 55],
        highestFreq: [65.1, 92],
        bandwidth: [15.1, 45],
        duration: [6, 11],
        harmonic: [0, 1, 2]
      },      
      {
        callType: 'FM',
        lowestFreq: [55.1, 60],
        highestFreq: [70, 115],
        bandwidth: [15.1, 60],
        duration: [5, 7],
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
  // 新增: 支援 [=>field]、[>field]、[<field]、[=<field] 格式
  if (typeof range[0] === 'string' && range.length === 1) {
    const match = range[0].match(/^(=|=>|>=|<|<=|>)\s*(\w+)$/);
    if (match) {
      const op = match[1];
      const refField = match[2];
      // 這裡 val 是 data[f]，refVal 需外部傳入
      // 但 inRange 目前無法取得 data，只能在 autoIdHK 處理
      return { op, refField };
    }
  }
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
      // callType 支援逗號分隔 OR
      if (rule.callType) {
        const callTypes = rule.callType.split(',').map(s => s.trim());
        if (!callTypes.includes(data.callType)) return false;
      }
      // harmonic 支援陣列 includes
      if (rule.harmonic && !rule.harmonic.includes(data.harmonic)) return false;
      return fields.every(f => {
        if (!rule[f]) return true;
        // 檢查是否為特殊比較格式
        if (typeof rule[f][0] === 'string' && rule[f].length === 1) {
          const match = rule[f][0].match(/^(=|=>|>=|<|<=|>)\s*(\w+)$/);
          if (match) {
            const op = match[1];
            const refField = match[2];
            const val = data[f];
            const refVal = data[refField];
            if (val == null || refVal == null || isNaN(val) || isNaN(refVal)) return false;
            switch (op) {
              case '=':
                return val === refVal;
              case '>':
                return val > refVal;
              case '<':
                return val < refVal;
              case '>=':
              case '=>':
                return val >= refVal;
              case '<=':
              case '=<':
                return val <= refVal;
              default:
                return false;
            }
          }
        }
        // 一般範圍判斷
        return inRange(data[f], rule[f]);
      });
    })
  ).map(s => s.name);

  return matches.length ? matches.join(' / ') : 'No species matched';
}
