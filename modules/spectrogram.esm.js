function t(t, e, s, r) {
  return new (s || (s = Promise))(function (i, a) {
    function n(t) {
      try {
        o(r.next(t));
      } catch (t) {
        a(t);
      }
    }
    function h(t) {
      try {
        o(r.throw(t));
      } catch (t) {
        a(t);
      }
    }
    function o(t) {
      var e;
      t.done
        ? i(t.value)
        : ((e = t.value),
          e instanceof s
            ? e
            : new s(function (t) {
                t(e);
              })).then(n, h);
    }
    o((r = r.apply(t, e || [])).next());
  });
}
"function" == typeof SuppressedError && SuppressedError;
class e {
  constructor() {
    this.listeners = {};
  }
  on(t, e, s) {
    if (
      (this.listeners[t] || (this.listeners[t] = new Set()),
      this.listeners[t].add(e),
      null == s ? void 0 : s.once)
    ) {
      const s = () => {
        (this.un(t, s), this.un(t, e));
      };
      return (this.on(t, s), s);
    }
    return () => this.un(t, e);
  }
  un(t, e) {
    var s;
    null === (s = this.listeners[t]) || void 0 === s || s.delete(e);
  }
  once(t, e) {
    return this.on(t, e, { once: !0 });
  }
  unAll() {
    this.listeners = {};
  }
  emit(t, ...e) {
    this.listeners[t] && this.listeners[t].forEach((t) => t(...e));
  }
}
class s extends e {
  constructor(t) {
    (super(), (this.subscriptions = []), (this.options = t));
  }
  onInit() {}
  _init(t) {
    ((this.wavesurfer = t), this.onInit());
  }
  destroy() {
    (this.emit("destroy"), this.subscriptions.forEach((t) => t()));
  }
}
function r(t, e) {
  const s = e.xmlns
    ? document.createElementNS(e.xmlns, t)
    : document.createElement(t);
  for (const [t, i] of Object.entries(e))
    if ("children" === t)
      for (const [t, i] of Object.entries(e))
        "string" == typeof i
          ? s.appendChild(document.createTextNode(i))
          : s.appendChild(r(t, i));
    else
      "style" === t
        ? Object.assign(s.style, i)
        : "textContent" === t
          ? (s.textContent = i)
          : s.setAttribute(t, i.toString());
  return s;
}
function i(t, e, s) {
  const i = r(t, e || {});
  return (null == s || s.appendChild(i), i);
}
function a(t, e, s, r) {
  switch (
    ((this.bufferSize = t),
    (this.sampleRate = e),
    (this.bandwidth = (2 / t) * (e / 2)),
    (this.sinTable = new Float32Array(t)),
    (this.cosTable = new Float32Array(t)),
    (this.windowValues = new Float32Array(t)),
    (this.reverseTable = new Uint32Array(t)),
    (this.peakBand = 0),
    (this.peak = 0),
    s)
  ) {
    case "bartlett":
      for (i = 0; i < t; i++)
        this.windowValues[i] =
          (2 / (t - 1)) * ((t - 1) / 2 - Math.abs(i - (t - 1) / 2));
      break;
    case "bartlettHann":
      for (i = 0; i < t; i++)
        this.windowValues[i] =
          0.62 -
          0.48 * Math.abs(i / (t - 1) - 0.5) -
          0.38 * Math.cos((2 * Math.PI * i) / (t - 1));
      break;
    case "blackman":
      for (r = r || 0.16, i = 0; i < t; i++)
        this.windowValues[i] =
          (1 - r) / 2 -
          0.5 * Math.cos((2 * Math.PI * i) / (t - 1)) +
          (r / 2) * Math.cos((4 * Math.PI * i) / (t - 1));
      break;
    case "blackmanHarris7":
      for (i = 0; i < t; i++)
        this.windowValues[i] =
          0.2712203606 -
          0.4334446123 * Math.cos((2 * Math.PI * i) / (t - 1)) +
          0.21800412 * Math.cos((4 * Math.PI * i) / (t - 1)) -
          0.0657853433 * Math.cos((6 * Math.PI * i) / (t - 1)) +
          0.0107618673 * Math.cos((8 * Math.PI * i) / (t - 1)) -
          0.0007700128 * Math.cos((10 * Math.PI * i) / (t - 1)) +
          0.0000136802 * Math.cos((12 * Math.PI * i) / (t - 1));
      break;
    case "flattop":
      for (i = 0; i < t; i++)
        this.windowValues[i] =
          1 -
          1.93 * Math.cos((2 * Math.PI * i) / (t - 1)) +
          1.29 * Math.cos((4 * Math.PI * i) / (t - 1)) -
          0.388 * Math.cos((6 * Math.PI * i) / (t - 1)) +
          0.028 * Math.cos((8 * Math.PI * i) / (t - 1));
      break;
    case "cosine":
      for (i = 0; i < t; i++)
        this.windowValues[i] = Math.cos((Math.PI * i) / (t - 1) - Math.PI / 2);
      break;
    case "gauss":
      for (r = r || 0.25, i = 0; i < t; i++)
        this.windowValues[i] = Math.pow(
          Math.E,
          -0.5 * Math.pow((i - (t - 1) / 2) / ((r * (t - 1)) / 2), 2),
        );
      break;
    case "hamming":
      for (i = 0; i < t; i++)
        this.windowValues[i] =
          0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (t - 1));
      break;
    case "hann":
    case void 0:
      for (i = 0; i < t; i++)
        this.windowValues[i] =
          0.5 * (1 - Math.cos((2 * Math.PI * i) / (t - 1)));
      break;
    case "lanczoz":
      for (i = 0; i < t; i++)
        this.windowValues[i] =
          Math.sin(Math.PI * ((2 * i) / (t - 1) - 1)) /
          (Math.PI * ((2 * i) / (t - 1) - 1));
      break;
    case "rectangular":
      for (i = 0; i < t; i++) this.windowValues[i] = 1;
      break;
    case "triangular":
      for (i = 0; i < t; i++)
        this.windowValues[i] = (2 / t) * (t / 2 - Math.abs(i - (t - 1) / 2));
      break;
    default:
      throw Error("No such window function '" + s + "'");
  }
  for (var i, a = 1, n = t >> 1; a < t; ) {
    for (i = 0; i < a; i++) this.reverseTable[i + a] = this.reverseTable[i] + n;
    ((a <<= 1), (n >>= 1));
  }
  for (i = 0; i < t; i++)
    ((this.sinTable[i] = Math.sin(-Math.PI / i)),
      (this.cosTable[i] = Math.cos(-Math.PI / i)));
  this.calculateSpectrum = function (t) {
    var e,
      s,
      r,
      i = this.bufferSize,
      a = this.cosTable,
      n = this.sinTable,
      h = this.reverseTable,
      o = new Float32Array(i),
      l = new Float32Array(i),
      c = 2 / this.bufferSize,
      u = Math.sqrt,
      f = new Float32Array(i / 2),
      p = Math.floor(Math.log(i) / Math.LN2);
    if (Math.pow(2, p) !== i)
      throw "Invalid buffer size, must be a power of 2.";
    if (i !== t.length)
      throw (
        "Supplied buffer is not the same size as defined FFT. FFT Size: " +
        i +
        " Buffer Size: " +
        t.length
      );
    for (var d, w, g, b, M, m, y, v, T = 1, k = 0; k < i; k++)
      ((o[k] = t[h[k]] * this.windowValues[h[k]]), (l[k] = 0));
    for (; T < i; ) {
      ((d = a[T]), (w = n[T]), (g = 1), (b = 0));
      for (var z = 0; z < T; z++) {
        for (k = z; k < i; )
          ((m = g * o[(M = k + T)] - b * l[M]),
            (y = g * l[M] + b * o[M]),
            (o[M] = o[k] - m),
            (l[M] = l[k] - y),
            (o[k] += m),
            (l[k] += y),
            (k += T << 1));
        ((g = (v = g) * d - b * w), (b = v * w + b * d));
      }
      T <<= 1;
    }
    k = 0;
    for (var F = i / 2; k < F; k++)
      ((r = c * u((e = o[k]) * e + (s = l[k]) * s)) > this.peak &&
        ((this.peakBand = k), (this.peak = r)),
        (f[k] = r));
    return f;
  };
}
const n = (1e3 * Math.log(10)) / 107.939;
class h extends s {
  static create(t) {
    return new h(t || {});
  }
  constructor(t) {
    var e, s;
    if (
      (super(t),
      (this.frequenciesDataUrl = t.frequenciesDataUrl),
      (this.container =
        "string" == typeof t.container
          ? document.querySelector(t.container)
          : t.container),
      t.colorMap && "string" != typeof t.colorMap)
    ) {
      if (t.colorMap.length < 256)
        throw new Error("Colormap must contain 256 elements");
      for (let e = 0; e < t.colorMap.length; e++) {
        if (4 !== t.colorMap[e].length)
          throw new Error("ColorMap entries must contain 4 values");
      }
      this.colorMap = t.colorMap;
    } else
      switch (((this.colorMap = t.colorMap || "roseus"), this.colorMap)) {
        case "gray":
          this.colorMap = [];
          for (let t = 0; t < 256; t++) {
            const e = (255 - t) / 256;
            this.colorMap.push([e, e, e, 1]);
          }
          break;
        case "igray":
          this.colorMap = [];
          for (let t = 0; t < 256; t++) {
            const e = t / 256;
            this.colorMap.push([e, e, e, 1]);
          }
          break;
        case "roseus":
          this.colorMap = [
            [0.004528, 0.004341, 0.004307, 1],
            [0.005625, 0.006156, 0.00601, 1],
            [0.006628, 0.008293, 0.008161, 1],
            [0.007551, 0.010738, 0.01079, 1],
            [0.008382, 0.013482, 0.013941, 1],
            [0.009111, 0.01652, 0.017662, 1],
            [0.009727, 0.019846, 0.022009, 1],
            [0.010223, 0.023452, 0.027035, 1],
            [0.010593, 0.027331, 0.032799, 1],
            [0.010833, 0.031475, 0.039361, 1],
            [0.010941, 0.035875, 0.046415, 1],
            [0.010918, 0.04052, 0.053597, 1],
            [0.010768, 0.045158, 0.060914, 1],
            [0.010492, 0.049708, 0.068367, 1],
            [0.010098, 0.054171, 0.075954, 1],
            [0.009594, 0.058549, 0.083672, 1],
            [0.008989, 0.06284, 0.091521, 1],
            [0.008297, 0.067046, 0.099499, 1],
            [0.00753, 0.071165, 0.107603, 1],
            [0.006704, 0.075196, 0.11583, 1],
            [0.005838, 0.07914, 0.124178, 1],
            [0.004949, 0.082994, 0.132643, 1],
            [0.004062, 0.086758, 0.141223, 1],
            [0.003198, 0.09043, 0.149913, 1],
            [0.002382, 0.09401, 0.158711, 1],
            [0.001643, 0.097494, 0.167612, 1],
            [0.001009, 0.100883, 0.176612, 1],
            [514e-6, 0.104174, 0.185704, 1],
            [187e-6, 0.107366, 0.194886, 1],
            [66e-6, 0.110457, 0.204151, 1],
            [186e-6, 0.113445, 0.213496, 1],
            [587e-6, 0.116329, 0.222914, 1],
            [0.001309, 0.119106, 0.232397, 1],
            [0.002394, 0.121776, 0.241942, 1],
            [0.003886, 0.124336, 0.251542, 1],
            [0.005831, 0.126784, 0.261189, 1],
            [0.008276, 0.12912, 0.270876, 1],
            [0.011268, 0.131342, 0.280598, 1],
            [0.014859, 0.133447, 0.290345, 1],
            [0.0191, 0.135435, 0.300111, 1],
            [0.024043, 0.137305, 0.309888, 1],
            [0.029742, 0.139054, 0.319669, 1],
            [0.036252, 0.140683, 0.329441, 1],
            [0.043507, 0.142189, 0.339203, 1],
            [0.050922, 0.143571, 0.348942, 1],
            [0.058432, 0.144831, 0.358649, 1],
            [0.066041, 0.145965, 0.368319, 1],
            [0.073744, 0.146974, 0.377938, 1],
            [0.081541, 0.147858, 0.387501, 1],
            [0.089431, 0.148616, 0.396998, 1],
            [0.097411, 0.149248, 0.406419, 1],
            [0.105479, 0.149754, 0.415755, 1],
            [0.113634, 0.150134, 0.424998, 1],
            [0.121873, 0.150389, 0.434139, 1],
            [0.130192, 0.150521, 0.443167, 1],
            [0.138591, 0.150528, 0.452075, 1],
            [0.147065, 0.150413, 0.460852, 1],
            [0.155614, 0.150175, 0.469493, 1],
            [0.164232, 0.149818, 0.477985, 1],
            [0.172917, 0.149343, 0.486322, 1],
            [0.181666, 0.148751, 0.494494, 1],
            [0.190476, 0.148046, 0.502493, 1],
            [0.199344, 0.147229, 0.510313, 1],
            [0.208267, 0.146302, 0.517944, 1],
            [0.217242, 0.145267, 0.52538, 1],
            [0.226264, 0.144131, 0.532613, 1],
            [0.235331, 0.142894, 0.539635, 1],
            [0.24444, 0.141559, 0.546442, 1],
            [0.253587, 0.140131, 0.553026, 1],
            [0.262769, 0.138615, 0.559381, 1],
            [0.271981, 0.137016, 0.5655, 1],
            [0.281222, 0.135335, 0.571381, 1],
            [0.290487, 0.133581, 0.577017, 1],
            [0.299774, 0.131757, 0.582404, 1],
            [0.30908, 0.129867, 0.587538, 1],
            [0.318399, 0.12792, 0.592415, 1],
            [0.32773, 0.125921, 0.597032, 1],
            [0.337069, 0.123877, 0.601385, 1],
            [0.346413, 0.121793, 0.605474, 1],
            [0.355758, 0.119678, 0.609295, 1],
            [0.365102, 0.11754, 0.612846, 1],
            [0.374443, 0.115386, 0.616127, 1],
            [0.383774, 0.113226, 0.619138, 1],
            [0.393096, 0.111066, 0.621876, 1],
            [0.402404, 0.108918, 0.624343, 1],
            [0.411694, 0.106794, 0.62654, 1],
            [0.420967, 0.104698, 0.628466, 1],
            [0.430217, 0.102645, 0.630123, 1],
            [0.439442, 0.100647, 0.631513, 1],
            [0.448637, 0.098717, 0.632638, 1],
            [0.457805, 0.096861, 0.633499, 1],
            [0.46694, 0.095095, 0.6341, 1],
            [0.47604, 0.093433, 0.634443, 1],
            [0.485102, 0.091885, 0.634532, 1],
            [0.494125, 0.090466, 0.63437, 1],
            [0.503104, 0.08919, 0.633962, 1],
            [0.512041, 0.088067, 0.633311, 1],
            [0.520931, 0.087108, 0.63242, 1],
            [0.529773, 0.086329, 0.631297, 1],
            [0.538564, 0.085738, 0.629944, 1],
            [0.547302, 0.085346, 0.628367, 1],
            [0.555986, 0.085162, 0.626572, 1],
            [0.564615, 0.08519, 0.624563, 1],
            [0.573187, 0.085439, 0.622345, 1],
            [0.581698, 0.085913, 0.619926, 1],
            [0.590149, 0.086615, 0.617311, 1],
            [0.598538, 0.087543, 0.614503, 1],
            [0.606862, 0.0887, 0.611511, 1],
            [0.61512, 0.090084, 0.608343, 1],
            [0.623312, 0.09169, 0.605001, 1],
            [0.631438, 0.093511, 0.601489, 1],
            [0.639492, 0.095546, 0.597821, 1],
            [0.647476, 0.097787, 0.593999, 1],
            [0.655389, 0.100226, 0.590028, 1],
            [0.66323, 0.102856, 0.585914, 1],
            [0.670995, 0.105669, 0.581667, 1],
            [0.678686, 0.108658, 0.577291, 1],
            [0.686302, 0.111813, 0.57279, 1],
            [0.69384, 0.115129, 0.568175, 1],
            [0.7013, 0.118597, 0.563449, 1],
            [0.708682, 0.122209, 0.558616, 1],
            [0.715984, 0.125959, 0.553687, 1],
            [0.723206, 0.12984, 0.548666, 1],
            [0.730346, 0.133846, 0.543558, 1],
            [0.737406, 0.13797, 0.538366, 1],
            [0.744382, 0.142209, 0.533101, 1],
            [0.751274, 0.146556, 0.527767, 1],
            [0.758082, 0.151008, 0.522369, 1],
            [0.764805, 0.155559, 0.516912, 1],
            [0.771443, 0.160206, 0.511402, 1],
            [0.777995, 0.164946, 0.505845, 1],
            [0.784459, 0.169774, 0.500246, 1],
            [0.790836, 0.174689, 0.494607, 1],
            [0.797125, 0.179688, 0.488935, 1],
            [0.803325, 0.184767, 0.483238, 1],
            [0.809435, 0.189925, 0.477518, 1],
            [0.815455, 0.19516, 0.471781, 1],
            [0.821384, 0.200471, 0.466028, 1],
            [0.827222, 0.205854, 0.460267, 1],
            [0.832968, 0.211308, 0.454505, 1],
            [0.838621, 0.216834, 0.448738, 1],
            [0.844181, 0.222428, 0.442979, 1],
            [0.849647, 0.22809, 0.43723, 1],
            [0.855019, 0.233819, 0.431491, 1],
            [0.860295, 0.239613, 0.425771, 1],
            [0.865475, 0.245471, 0.420074, 1],
            [0.870558, 0.251393, 0.414403, 1],
            [0.875545, 0.25738, 0.408759, 1],
            [0.880433, 0.263427, 0.403152, 1],
            [0.885223, 0.269535, 0.397585, 1],
            [0.889913, 0.275705, 0.392058, 1],
            [0.894503, 0.281934, 0.386578, 1],
            [0.898993, 0.288222, 0.381152, 1],
            [0.903381, 0.294569, 0.375781, 1],
            [0.907667, 0.300974, 0.370469, 1],
            [0.911849, 0.307435, 0.365223, 1],
            [0.915928, 0.313953, 0.360048, 1],
            [0.919902, 0.320527, 0.354948, 1],
            [0.923771, 0.327155, 0.349928, 1],
            [0.927533, 0.333838, 0.344994, 1],
            [0.931188, 0.340576, 0.340149, 1],
            [0.934736, 0.347366, 0.335403, 1],
            [0.938175, 0.354207, 0.330762, 1],
            [0.941504, 0.361101, 0.326229, 1],
            [0.944723, 0.368045, 0.321814, 1],
            [0.947831, 0.375039, 0.317523, 1],
            [0.950826, 0.382083, 0.313364, 1],
            [0.953709, 0.389175, 0.309345, 1],
            [0.956478, 0.396314, 0.305477, 1],
            [0.959133, 0.403499, 0.301766, 1],
            [0.961671, 0.410731, 0.298221, 1],
            [0.964093, 0.418008, 0.294853, 1],
            [0.966399, 0.425327, 0.291676, 1],
            [0.968586, 0.43269, 0.288696, 1],
            [0.970654, 0.440095, 0.285926, 1],
            [0.972603, 0.44754, 0.28338, 1],
            [0.974431, 0.455025, 0.281067, 1],
            [0.976139, 0.462547, 0.279003, 1],
            [0.977725, 0.470107, 0.277198, 1],
            [0.979188, 0.477703, 0.275666, 1],
            [0.980529, 0.485332, 0.274422, 1],
            [0.981747, 0.492995, 0.273476, 1],
            [0.98284, 0.50069, 0.272842, 1],
            [0.983808, 0.508415, 0.272532, 1],
            [0.984653, 0.516168, 0.27256, 1],
            [0.985373, 0.523948, 0.272937, 1],
            [0.985966, 0.531754, 0.273673, 1],
            [0.986436, 0.539582, 0.274779, 1],
            [0.98678, 0.547434, 0.276264, 1],
            [0.986998, 0.555305, 0.278135, 1],
            [0.987091, 0.563195, 0.280401, 1],
            [0.987061, 0.5711, 0.283066, 1],
            [0.986907, 0.579019, 0.286137, 1],
            [0.986629, 0.58695, 0.289615, 1],
            [0.986229, 0.594891, 0.293503, 1],
            [0.985709, 0.602839, 0.297802, 1],
            [0.985069, 0.610792, 0.302512, 1],
            [0.98431, 0.618748, 0.307632, 1],
            [0.983435, 0.626704, 0.313159, 1],
            [0.982445, 0.634657, 0.319089, 1],
            [0.981341, 0.642606, 0.32542, 1],
            [0.98013, 0.650546, 0.332144, 1],
            [0.978812, 0.658475, 0.339257, 1],
            [0.977392, 0.666391, 0.346753, 1],
            [0.97587, 0.67429, 0.354625, 1],
            [0.974252, 0.68217, 0.362865, 1],
            [0.972545, 0.690026, 0.371466, 1],
            [0.97075, 0.697856, 0.380419, 1],
            [0.968873, 0.705658, 0.389718, 1],
            [0.966921, 0.713426, 0.399353, 1],
            [0.964901, 0.721157, 0.409313, 1],
            [0.962815, 0.728851, 0.419594, 1],
            [0.960677, 0.7365, 0.430181, 1],
            [0.95849, 0.744103, 0.44107, 1],
            [0.956263, 0.751656, 0.452248, 1],
            [0.954009, 0.759153, 0.463702, 1],
            [0.951732, 0.766595, 0.475429, 1],
            [0.949445, 0.773974, 0.487414, 1],
            [0.947158, 0.781289, 0.499647, 1],
            [0.944885, 0.788535, 0.512116, 1],
            [0.942634, 0.795709, 0.524811, 1],
            [0.940423, 0.802807, 0.537717, 1],
            [0.938261, 0.809825, 0.550825, 1],
            [0.936163, 0.81676, 0.564121, 1],
            [0.934146, 0.823608, 0.577591, 1],
            [0.932224, 0.830366, 0.59122, 1],
            [0.930412, 0.837031, 0.604997, 1],
            [0.928727, 0.843599, 0.618904, 1],
            [0.927187, 0.850066, 0.632926, 1],
            [0.925809, 0.856432, 0.647047, 1],
            [0.92461, 0.862691, 0.661249, 1],
            [0.923607, 0.868843, 0.675517, 1],
            [0.92282, 0.874884, 0.689832, 1],
            [0.922265, 0.880812, 0.704174, 1],
            [0.921962, 0.886626, 0.718523, 1],
            [0.92193, 0.892323, 0.732859, 1],
            [0.922183, 0.897903, 0.747163, 1],
            [0.922741, 0.903364, 0.76141, 1],
            [0.92362, 0.908706, 0.77558, 1],
            [0.924837, 0.913928, 0.789648, 1],
            [0.926405, 0.919031, 0.80359, 1],
            [0.92834, 0.924015, 0.817381, 1],
            [0.930655, 0.928881, 0.830995, 1],
            [0.93336, 0.933631, 0.844405, 1],
            [0.936466, 0.938267, 0.857583, 1],
            [0.939982, 0.942791, 0.870499, 1],
            [0.943914, 0.947207, 0.883122, 1],
            [0.948267, 0.951519, 0.895421, 1],
            [0.953044, 0.955732, 0.907359, 1],
            [0.958246, 0.959852, 0.918901, 1],
            [0.963869, 0.963887, 0.930004, 1],
            [0.969909, 0.967845, 0.940623, 1],
            [0.976355, 0.971737, 0.950704, 1],
            [0.983195, 0.97558, 0.960181, 1],
            [0.990402, 0.979395, 0.968966, 1],
            [0.99793, 0.983217, 0.97692, 1],
          ];
          break;
        default:
          throw Error("No such colormap '" + this.colorMap + "'");
      }
    ((this.fftSamples = t.fftSamples || 512),
      (this.height = t.height || 200),
      (this.noverlap = t.noverlap || null),
      (this.windowFunc = t.windowFunc || "hann"),
      (this.alpha = t.alpha),
      (this.frequencyMin = t.frequencyMin || 0),
      (this.frequencyMax = t.frequencyMax || 0),
      (this.gainDB = null !== (e = t.gainDB) && void 0 !== e ? e : 20),
      (this.rangeDB = null !== (s = t.rangeDB) && void 0 !== s ? s : 80),
      (this.scale = t.scale || "mel"),
      (this.numMelFilters = this.fftSamples / 2),
      (this.numLogFilters = this.fftSamples / 2),
      (this.numBarkFilters = this.fftSamples / 2),
      (this.numErbFilters = this.fftSamples / 2),
      this.createWrapper(),
      this.createCanvas());
  }
  onInit() {
    ((this.container = this.container || this.wavesurfer.getWrapper()),
      this.container.appendChild(this.wrapper),
      this.wavesurfer.options.fillParent &&
        Object.assign(this.wrapper.style, {
          width: "100%",
          overflowX: "hidden",
          overflowY: "hidden",
        }),
      this.subscriptions.push(
        this.wavesurfer.on("redraw", () => this.render()),
      ));
  }
  destroy() {
    (this.unAll(),
      this.wavesurfer.un("ready", this._onReady),
      this.wavesurfer.un("redraw", this._onRender),
      (this.wavesurfer = null),
      (this.util = null),
      (this.options = null),
      this.wrapper && (this.wrapper.remove(), (this.wrapper = null)),
      super.destroy());
  }
  loadFrequenciesData(e) {
    return t(this, void 0, void 0, function* () {
      const t = yield fetch(e);
      if (!t.ok) throw new Error("Unable to fetch frequencies data");
      const s = yield t.json();
      this.drawSpectrogram(s);
    });
  }
  createWrapper() {
    ((this.wrapper = i("div", {
      style: { display: "block", position: "relative", userSelect: "none" },
    })),
      this.options.labels &&
        (this.labelsEl = i(
          "canvas",
          {
            part: "spec-labels",
            style: {
              position: "absolute",
              zIndex: 9,
              width: "55px",
              height: "100%",
            },
          },
          this.wrapper,
        )),
      this.wrapper.addEventListener("click", this._onWrapperClick));
  }
  createCanvas() {
    ((this.canvas = i(
      "canvas",
      {
        style: {
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          zIndex: 4,
        },
      },
      this.wrapper,
    )),
      (this.spectrCc = this.canvas.getContext("2d")));
  }
  render() {
    var t;
    if (this.frequenciesDataUrl)
      this.loadFrequenciesData(this.frequenciesDataUrl);
    else {
      const e =
        null === (t = this.wavesurfer) || void 0 === t
          ? void 0
          : t.getDecodedData();
      e && this.drawSpectrogram(this.getFrequencies(e));
    }
  }
  drawSpectrogram(t) {
    (isNaN(t[0][0]) || (t = [t]),
      (this.wrapper.style.height = this.height * t.length + "px"),
      (this.canvas.width = this.getWidth()),
      (this.canvas.height = this.height * t.length));
    const e = this.spectrCc,
      s = this.height,
      r = this.getWidth(),
      i = this.buffer.sampleRate / 2,
      a = this.frequencyMin,
      n = this.frequencyMax;
    if (e) {
      if (n > i) {
        const i = this.colorMap[this.colorMap.length - 1];
        ((e.fillStyle = `rgba(${i[0]}, ${i[1]}, ${i[2]}, ${i[3]})`),
          e.fillRect(0, 0, r, s * t.length));
      }
      for (let h = 0; h < t.length; h++) {
        const o = this.resample(t[h]),
          l = o[0].length,
          c = new ImageData(r, l);
        for (let t = 0; t < o.length; t++)
          for (let e = 0; e < o[t].length; e++) {
            const s = this.colorMap[o[t][e]],
              i = 4 * ((l - e - 1) * r + t);
            ((c.data[i] = 255 * s[0]),
              (c.data[i + 1] = 255 * s[1]),
              (c.data[i + 2] = 255 * s[2]),
              (c.data[i + 3] = 255 * s[3]));
          }
        const u = this.hzToScale(a) / this.hzToScale(i),
          f = this.hzToScale(n) / this.hzToScale(i),
          p = Math.min(1, f);
        createImageBitmap(
          c,
          0,
          Math.round(l * (1 - p)),
          r,
          Math.round(l * (p - u)),
        ).then((t) => {
          e.drawImage(t, 0, s * (h + 1 - p / f), r, (s * p) / f);
        });
      }
      (this.options.labels &&
        this.loadLabels(
          this.options.labelsBackground,
          "12px",
          "12px",
          "",
          this.options.labelsColor,
          this.options.labelsHzColor || this.options.labelsColor,
          "center",
          "#specLabels",
          t.length,
        ),
        this.emit("ready"));
    }
  }
  createFilterBank(t, e, s, r) {
    const i = s(0),
      a = s(e / 2),
      n = Array.from({ length: t }, () =>
        Array(this.fftSamples / 2 + 1).fill(0),
      ),
      h = e / this.fftSamples;
    for (let e = 0; e < t; e++) {
      let s = r(i + (e / t) * (a - i)),
        o = Math.floor(s / h),
        l = o * h,
        c = (s - l) / ((o + 1) * h - l);
      ((n[e][o] = 1 - c), (n[e][o + 1] = c));
    }
    return n;
  }
  hzToMel(t) {
    return 2595 * Math.log10(1 + t / 700);
  }
  melToHz(t) {
    return 700 * (Math.pow(10, t / 2595) - 1);
  }
  createMelFilterBank(t, e) {
    return this.createFilterBank(t, e, this.hzToMel, this.melToHz);
  }
  hzToLog(t) {
    return Math.log10(Math.max(1, t));
  }
  logToHz(t) {
    return Math.pow(10, t);
  }
  createLogFilterBank(t, e) {
    return this.createFilterBank(t, e, this.hzToLog, this.logToHz);
  }
  hzToBark(t) {
    let e = (26.81 * t) / (1960 + t) - 0.53;
    return (
      e < 2 && (e += 0.15 * (2 - e)),
      e > 20.1 && (e += 0.22 * (e - 20.1)),
      e
    );
  }
  barkToHz(t) {
    return (
      t < 2 && (t = (t - 0.3) / 0.85),
      t > 20.1 && (t = (t + 4.422) / 1.22),
      ((t + 0.53) / (26.28 - t)) * 1960
    );
  }
  createBarkFilterBank(t, e) {
    return this.createFilterBank(t, e, this.hzToBark, this.barkToHz);
  }
  hzToErb(t) {
    return n * Math.log10(1 + 0.00437 * t);
  }
  erbToHz(t) {
    return (Math.pow(10, t / n) - 1) / 0.00437;
  }
  createErbFilterBank(t, e) {
    return this.createFilterBank(t, e, this.hzToErb, this.erbToHz);
  }
  hzToScale(t) {
    switch (this.scale) {
      case "mel":
        return this.hzToMel(t);
      case "logarithmic":
        return this.hzToLog(t);
      case "bark":
        return this.hzToBark(t);
      case "erb":
        return this.hzToErb(t);
    }
    return t;
  }
  scaleToHz(t) {
    switch (this.scale) {
      case "mel":
        return this.melToHz(t);
      case "logarithmic":
        return this.logToHz(t);
      case "bark":
        return this.barkToHz(t);
      case "erb":
        return this.erbToHz(t);
    }
    return t;
  }
  applyFilterBank(t, e) {
    const s = e.length,
      r = Float32Array.from({ length: s }, () => 0);
    for (let i = 0; i < s; i++)
      for (let s = 0; s < t.length; s++) r[i] += t[s] * e[i][s];
    return r;
  }
  getWidth() {
    return this.wavesurfer.getWrapper().offsetWidth;
  }
  getFrequencies(t) {
    var e, s;
    const r = this.fftSamples,
      i = (
        null !== (e = this.options.splitChannels) && void 0 !== e
          ? e
          : null === (s = this.wavesurfer) || void 0 === s
            ? void 0
            : s.options.splitChannels
      )
        ? t.numberOfChannels
        : 1;
    if (((this.frequencyMax = this.frequencyMax || t.sampleRate / 2), !t))
      return;
    this.buffer = t;
    const n = t.sampleRate,
      h = [];
    let o = this.noverlap;
    if (!o) {
      const e = t.length / this.canvas.width;
      o = Math.max(0, Math.round(r - e));
    }
    const l = new a(r, n, this.windowFunc, this.alpha);
    let c;
    switch (this.scale) {
      case "mel":
        c = this.createFilterBank(
          this.numMelFilters,
          n,
          this.hzToMel,
          this.melToHz,
        );
        break;
      case "logarithmic":
        c = this.createFilterBank(
          this.numLogFilters,
          n,
          this.hzToLog,
          this.logToHz,
        );
        break;
      case "bark":
        c = this.createFilterBank(
          this.numBarkFilters,
          n,
          this.hzToBark,
          this.barkToHz,
        );
        break;
      case "erb":
        c = this.createFilterBank(
          this.numErbFilters,
          n,
          this.hzToErb,
          this.erbToHz,
        );
    }
    for (let e = 0; e < i; e++) {
      const s = t.getChannelData(e),
        i = [];
      let a = 0;
      for (; a + r < s.length; ) {
        const t = s.slice(a, a + r),
          e = new Uint8Array(r / 2);
        let n = l.calculateSpectrum(t);
        c && (n = this.applyFilterBank(n, c));
        for (let t = 0; t < r / 2; t++) {
          const s = n[t] > 1e-12 ? n[t] : 1e-12,
            r = 20 * Math.log10(s);
          r < -this.gainDB - this.rangeDB
            ? (e[t] = 0)
            : r > -this.gainDB
              ? (e[t] = 255)
              : (e[t] = ((r + this.gainDB) / this.rangeDB) * 255 + 256);
        }
        (i.push(e), (a += r - o));
      }
      h.push(i);
    }
    return h;
  }
  freqType(t) {
    return t >= 1e3 ? (t / 1e3).toFixed(1) : Math.round(t);
  }
  unitType(t) {
    return t >= 1e3 ? "kHz" : "Hz";
  }
  getLabelFrequency(t, e) {
    const s = this.hzToScale(this.frequencyMin),
      r = this.hzToScale(this.frequencyMax);
    return this.scaleToHz(s + (t / e) * (r - s));
  }
  loadLabels(t, e, s, r, i, a, n, h, o) {
    ((t = t || "rgba(68,68,68,0)"),
      (e = e || "12px"),
      (s = s || "12px"),
      (r = r || "Helvetica"),
      (i = i || "#fff"),
      (a = a || "#fff"),
      (n = n || "center"));
    const l = this.height || 512,
      c = (l / 256) * 5;
    this.frequencyMin;
    this.frequencyMax;
    const u = this.labelsEl.getContext("2d"),
      f = window.devicePixelRatio;
    if (
      ((this.labelsEl.height = this.height * o * f),
      (this.labelsEl.width = 55 * f),
      u.scale(f, f),
      u)
    )
      for (let h = 0; h < o; h++) {
        let o;
        for (
          u.fillStyle = t,
            u.fillRect(0, h * l, 55, (1 + h) * l),
            u.fill(),
            o = 0;
          o <= c;
          o++
        ) {
          ((u.textAlign = n), (u.textBaseline = "middle"));
          const t = this.getLabelFrequency(o, c),
            f = this.freqType(t),
            p = this.unitType(t),
            d = 16;
          let w = (1 + h) * l - (o / c) * l;
          ((w = Math.min(Math.max(w, h * l + 10), (1 + h) * l - 10)),
            (u.fillStyle = a),
            (u.font = s + " " + r),
            u.fillText(p, d + 24, w),
            (u.fillStyle = i),
            (u.font = e + " " + r),
            u.fillText(f, d, w));
        }
      }
  }
  resample(t) {
    const e = this.getWidth(),
      s = [],
      r = 1 / t.length,
      i = 1 / e;
    let a;
    for (a = 0; a < e; a++) {
      const e = new Array(t[0].length);
      let n;
      for (n = 0; n < t.length; n++) {
        const s = n * r,
          h = s + r,
          o = a * i,
          l = o + i,
          c = Math.max(0, Math.min(h, l) - Math.max(s, o));
        let u;
        if (c > 0)
          for (u = 0; u < t[0].length; u++)
            (null == e[u] && (e[u] = 0), (e[u] += (c / i) * t[n][u]));
      }
      const h = new Uint8Array(t[0].length);
      let o;
      for (o = 0; o < t[0].length; o++) h[o] = e[o];
      s.push(h);
    }
    return s;
  }
}
export { h as default };
