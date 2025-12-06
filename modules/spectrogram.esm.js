import init, { SpectrogramEngine } from './spectrogram_wasm.js';

// WASM 初始化 Promise
let wasmReady = init();

function t(t, e, s, r) {
    return new (s || (s = Promise))((function(i, a) {
        function n(t) {
            try {
                o(r.next(t))
            } catch (t) {
                a(t)
            }
        }
        function h(t) {
            try {
                o(r.throw(t))
            } catch (t) {
                a(t)
            }
        }
        function o(t) {
            var e;
            t.done ? i(t.value) : (e = t.value,
            e instanceof s ? e : new s((function(t) {
                t(e)
            }
            ))).then(n, h)
        }
        o((r = r.apply(t, e || [])).next())
    }
    ))
}
"function" == typeof SuppressedError && SuppressedError;
class e {
    constructor() {
        this.listeners = {}
    }
    on(t, e, s) {
        if (this.listeners[t] || (this.listeners[t] = new Set),
        this.listeners[t].add(e),
        null == s ? void 0 : s.once) {
            const s = () => {
                this.un(t, s),
                this.un(t, e)
            }
            ;
            return this.on(t, s),
            s
        }
        return () => this.un(t, e)
    }
    un(t, e) {
        var s;
        null === (s = this.listeners[t]) || void 0 === s || s.delete(e)
    }
    once(t, e) {
        return this.on(t, e, {
            once: !0
        })
    }
    unAll() {
        this.listeners = {}
    }
    emit(t, ...e) {
        this.listeners[t] && this.listeners[t].forEach((t => t(...e)))
    }
}
class s extends e {
    constructor(t) {
        super(),
        this.subscriptions = [],
        this.options = t
    }
    onInit() {}
    _init(t) {
        this.wavesurfer = t,
        this.onInit()
    }
    destroy() {
        this.emit("destroy"),
        this.subscriptions.forEach((t => t()))
    }
}
function r(t, e) {
    const s = e.xmlns ? document.createElementNS(e.xmlns, t) : document.createElement(t);
    for (const [t,i] of Object.entries(e))
        if ("children" === t)
            for (const [t,i] of Object.entries(e))
                "string" == typeof i ? s.appendChild(document.createTextNode(i)) : s.appendChild(r(t, i));
        else
            "style" === t ? Object.assign(s.style, i) : "textContent" === t ? s.textContent = i : s.setAttribute(t, i.toString());
    return s
}
function i(t, e, s) {
    const i = r(t, e || {});
    return null == s || s.appendChild(i),
    i
}
function a(t, e, s, r) {
    switch (this.bufferSize = t,
    this.sampleRate = e,
    this.bandwidth = 2 / t * (e / 2),
    this.sinTable = new Float32Array(t),
    this.cosTable = new Float32Array(t),
    this.windowValues = new Float32Array(t),
    this.reverseTable = new Uint32Array(t),
    this.peakBand = 0,
    this.peak = 0,
    s) {
    case "bartlett":
        for (i = 0; i < t; i++)
            this.windowValues[i] = 2 / (t - 1) * ((t - 1) / 2 - Math.abs(i - (t - 1) / 2));
        break;
    case "bartlettHann":
        for (i = 0; i < t; i++)
            this.windowValues[i] = .62 - .48 * Math.abs(i / (t - 1) - .5) - .38 * Math.cos(2 * Math.PI * i / (t - 1));
        break;
    case "blackman":
        for (r = r || .16,
        i = 0; i < t; i++)
            this.windowValues[i] = (1 - r) / 2 - .5 * Math.cos(2 * Math.PI * i / (t - 1)) + r / 2 * Math.cos(4 * Math.PI * i / (t - 1));
        break;
    case "cosine":
        for (i = 0; i < t; i++)
            this.windowValues[i] = Math.cos(Math.PI * i / (t - 1) - Math.PI / 2);
        break;
    case "gauss":
        for (r = r || .25,
        i = 0; i < t; i++)
            this.windowValues[i] = Math.pow(Math.E, -.5 * Math.pow((i - (t - 1) / 2) / (r * (t - 1) / 2), 2));
        break;
    case "hamming":
        for (i = 0; i < t; i++)
            this.windowValues[i] = .54 - .46 * Math.cos(2 * Math.PI * i / (t - 1));
        break;
    case "hann":
    case void 0:
        for (i = 0; i < t; i++)
            this.windowValues[i] = .5 * (1 - Math.cos(2 * Math.PI * i / (t - 1)));
        break;
    case "lanczoz":
        for (i = 0; i < t; i++)
            this.windowValues[i] = Math.sin(Math.PI * (2 * i / (t - 1) - 1)) / (Math.PI * (2 * i / (t - 1) - 1));
        break;
    case "rectangular":
        for (i = 0; i < t; i++)
            this.windowValues[i] = 1;
        break;
    case "triangular":
        for (i = 0; i < t; i++)
            this.windowValues[i] = 2 / t * (t / 2 - Math.abs(i - (t - 1) / 2));
        break;
    default:
        throw Error("No such window function '" + s + "'")
    }
    for (var i, a = 1, n = t >> 1; a < t; ) {
        for (i = 0; i < a; i++)
            this.reverseTable[i + a] = this.reverseTable[i] + n;
        a <<= 1,
        n >>= 1
    }
    for (i = 0; i < t; i++)
        this.sinTable[i] = Math.sin(-Math.PI / i),
        this.cosTable[i] = Math.cos(-Math.PI / i);
    // allocate reusable temporary arrays to avoid per-call allocations
    this._o = new Float32Array(t);
    this._l = new Float32Array(t);
    this._f = new Float32Array(t >> 1);

    this.calculateSpectrum = function(t) {
        var e, s, r, i = this.bufferSize, a = this.cosTable, n = this.sinTable, h = this.reverseTable, o = this._o, l = this._l, c = 2 / this.bufferSize, u = Math.sqrt, f = this._f, p = Math.floor(Math.log(i) / Math.LN2);
        if (Math.pow(2, p) !== i)
            throw "Invalid buffer size, must be a power of 2.";
        if (i !== t.length)
            throw "Supplied buffer is not the same size as defined FFT. FFT Size: " + i + " Buffer Size: " + t.length;
        for (var d, w, g, b, M, m, y, v, T = 1, k = 0; k < i; k++)
            o[k] = t[h[k]] * this.windowValues[h[k]],
            l[k] = 0;
        for (; T < i; ) {
            d = a[T],
            w = n[T],
            g = 1,
            b = 0;
            for (var z = 0; z < T; z++) {
                for (k = z; k < i; )
                    m = g * o[M = k + T] - b * l[M],
                    y = g * l[M] + b * o[M],
                    o[M] = o[k] - m,
                    l[M] = l[k] - y,
                    o[k] += m,
                    l[k] += y,
                    k += T << 1;
                g = (v = g) * d - b * w,
                b = v * w + b * d
            }
            T <<= 1
        }
        k = 0;
        for (var F = i / 2; k < F; k++)
            (r = c * u((e = o[k]) * e + (s = l[k]) * s)) > this.peak && (this.peakBand = k,
            this.peak = r),
            f[k] = r;
        return f
    }
}
const n = 1e3 * Math.log(10) / 107.939;
class h extends s {
    static create(t) {
        return new h(t || {})
    }
    constructor(t) {
        var e, s;
        if (super(t),
        this.frequenciesDataUrl = t.frequenciesDataUrl,
        this.container = "string" == typeof t.container ? document.querySelector(t.container) : t.container,
        t.colorMap && "string" != typeof t.colorMap) {
            if (t.colorMap.length < 256)
                throw new Error("Colormap must contain 256 elements");
            for (let e = 0; e < t.colorMap.length; e++) {
                if (4 !== t.colorMap[e].length)
                    throw new Error("ColorMap entries must contain 4 values")
            }
            this.colorMap = t.colorMap
        } else
            switch (this.colorMap = t.colorMap || "roseus",
            this.colorMap) {
            case "gray":
                this.colorMap = [];
                for (let t = 0; t < 256; t++) {
                    const e = (255 - t) / 256;
                    this.colorMap.push([e, e, e, 1])
                }
                break;
            case "igray":
                this.colorMap = [];
                for (let t = 0; t < 256; t++) {
                    const e = t / 256;
                    this.colorMap.push([e, e, e, 1])
                }
                break;
            default:
                throw Error("No such colormap '" + this.colorMap + "'")
            }
        this.fftSamples = t.fftSamples || 512,
        this.height = t.height || 200,
        this.noverlap = t.noverlap || null,
        this.windowFunc = t.windowFunc || "hann",
        this.alpha = t.alpha,
        this.frequencyMin = t.frequencyMin || 0,
        this.frequencyMax = t.frequencyMax || 0,
        this.gainDB = null !== (e = t.gainDB) && void 0 !== e ? e : 20,
        this.rangeDB = null !== (s = t.rangeDB) && void 0 !== s ? s : 80,
        this.scale = t.scale || "mel",
        this.numMelFilters = this.fftSamples / 2,
        this.numLogFilters = this.fftSamples / 2,
        this.numBarkFilters = this.fftSamples / 2,
        this.numErbFilters = this.fftSamples / 2,
        this.createWrapper(),
        this.createCanvas();

        // WASM integration
        this._wasmEngine = null;
        this._wasmReady = wasmReady.then(() => {
            this._wasmEngine = new SpectrogramEngine(
                this.fftSamples,
                this.windowFunc,
                this.alpha
            );
        });

        // 濾波器組相關字段
        this._filterBankMatrix = null;  // 當前濾波器組矩陣 (二維陣列)
        this._filterBankFlat = null;    // 扁平化的濾波器組 (Float32Array)
        this._lastFilterBankScale = null; // 用於檢測濾波器組是否需要更新

        // cache for filter banks to avoid rebuilding on each render
        this._filterBankCache = {};
        // cache for resample mappings keyed by inputLen:outputWidth
        this._resampleCache = {};
        // precomputed uint8 colormap (RGBA 0-255)
        this._colorMapUint = new Uint8ClampedArray(256 * 4);
        if (this.colorMap && this._colorMapUint) {
            for (let ii = 0; ii < 256; ii++) {
                const cc = this.colorMap[ii] || [0, 0, 0, 1];
                this._colorMapUint[ii * 4] = Math.round(255 * cc[0]);
                this._colorMapUint[ii * 4 + 1] = Math.round(255 * cc[1]);
                this._colorMapUint[ii * 4 + 2] = Math.round(255 * cc[2]);
                this._colorMapUint[ii * 4 + 3] = Math.round(255 * cc[3]);
            }
        }
    }
    onInit() {
        this.container = this.container || this.wavesurfer.getWrapper(),
        this.container.appendChild(this.wrapper),
        this.wavesurfer.options.fillParent && Object.assign(this.wrapper.style, {
            width: "100%",
            overflowX: "hidden",
            overflowY: "hidden"
        }),
        this.subscriptions.push(this.wavesurfer.on("redraw", ( () => this.render())))
    }
    destroy() {
        this.unAll(),
        this.wavesurfer.un("ready", this._onReady),
        this.wavesurfer.un("redraw", this._onRender),
        this.wavesurfer = null,
        this.util = null,
        this.options = null,
        this.wrapper && (this.wrapper.remove(),
        this.wrapper = null),
        super.destroy()
    }
    loadFrequenciesData(e) {
        return t(this, void 0, void 0, (function*() {
            const t = yield fetch(e);
            if (!t.ok)
                throw new Error("Unable to fetch frequencies data");
            const s = yield t.json();
            this.drawSpectrogram(s)
        }
        ))
    }
    createWrapper() {
        this.wrapper = i("div", {
            style: {
                display: "block",
                position: "relative",
                userSelect: "none"
            }
        }),
        this.options.labels && (this.labelsEl = i("canvas", {
            part: "spec-labels",
            style: {
                position: "absolute",
                zIndex: 9,
                width: "55px",
                height: "100%"
            }
        }, this.wrapper)),
        this.wrapper.addEventListener("click", this._onWrapperClick)
    }
    createCanvas() {
        this.canvas = i("canvas", {
            style: {
                position: "absolute",
                left: 0,
                top: 0,
                width: "100%",
                height: "100%",
                zIndex: 4
            }
        }, this.wrapper),
        this.spectrCc = this.canvas.getContext("2d")
    }
    async render() {
        var t;
        if (this.frequenciesDataUrl)
            this.loadFrequenciesData(this.frequenciesDataUrl);
        else {
            const e = null === (t = this.wavesurfer) || void 0 === t ? void 0 : t.getDecodedData();
            if (e) {
                const frequencies = await this.getFrequencies(e);
                if (frequencies) {
                    this.drawSpectrogram(frequencies);
                }
            }
        }
    }
    drawSpectrogram(t) {
        // 檢查 wrapper 和 canvas 是否已被清空（在 destroy 或 selection mode 切換時可能發生）
        if (!this.wrapper || !this.canvas) {
            return;
        }
        
        isNaN(t[0][0]) || (t = [t]),
        this.wrapper.style.height = this.height * t.length + "px",
        this.canvas.width = this.getWidth(),
        this.canvas.height = this.height * t.length;
        const e = this.spectrCc
          , s = this.height
          , r = this.getWidth()
          , i = this.buffer.sampleRate / 2
          , a = this.frequencyMin
          , n = this.frequencyMax;
        if (e) {
            if (n > i) {
                const i = this.colorMap[this.colorMap.length - 1];
                e.fillStyle = `rgba(${i[0]}, ${i[1]}, ${i[2]}, ${i[3]})`,
                e.fillRect(0, 0, r, s * t.length)
            }
            for (let h = 0; h < t.length; h++) {
                const o = this.resample(t[h])
                  , l = o[0].length
                  , c = new ImageData(r,l)
                  , channelPeakBands = this.peakBandArrayPerChannel && this.peakBandArrayPerChannel[h] ? this.peakBandArrayPerChannel[h] : [];
                
                const cacheKey = `${t[h].length}:${r}`;
                const mapping = this._resampleCache[cacheKey];
                
                for (let t = 0; t < o.length; t++)
                    for (let e = 0; e < o[t].length; e++) {
                        let idx = o[t][e];
                        if (idx < 0) idx = 0; else if (idx > 255) idx = 255;
                        const cmapBase = idx * 4;
                        const i = 4 * ((l - e - 1) * r + t);
                        
                        // Peak Mode 渲染邏輯
                        let isPeakColumn = false;
                        let isHighPeak = false; // 用於標記是否為高強度峰值

                        if (this.options.peakMode && mapping && mapping[t]) {
                          for (let m = 0; m < mapping[t].length; m++) {
                            const sourceIdx = mapping[t][m][0];
                            
                            // 獲取峰值數據對象
                            const peakData = channelPeakBands[sourceIdx];
                            
                            // 檢查數據是否存在且當前 Bin 匹配
                            if (peakData && peakData.bin === e) {
                              isPeakColumn = true;
                              isHighPeak = peakData.isHigh; // 讀取是否超過70%
                              break;
                            }
                          }
                        }
                        
                        if (isPeakColumn) {
                          if (isHighPeak) {
                              // 超過 70% 顯示為 #FF70FC (RGB: 255, 112, 252)
                              c.data[i] = 255;      // R
                              c.data[i + 1] = 112;    // G
                              c.data[i + 2] = 252;  // B
                              c.data[i + 3] = 255;  // A
                          } else {
                              // 普通峰值顯示紅色
                              c.data[i] = 255;      // R
                              c.data[i + 1] = 0;    // G
                              c.data[i + 2] = 0;    // B
                              c.data[i + 3] = 255;  // A
                          }
                        } else {
                          c.data[i] = this._colorMapUint[cmapBase];
                          c.data[i + 1] = this._colorMapUint[cmapBase + 1];
                          c.data[i + 2] = this._colorMapUint[cmapBase + 2];
                          c.data[i + 3] = this._colorMapUint[cmapBase + 3];
                        }
                    }
                const u = this.hzToScale(a) / this.hzToScale(i)
                  , f = this.hzToScale(n) / this.hzToScale(i)
                  , p = Math.min(1, f);
                createImageBitmap(c, 0, Math.round(l * (1 - p)), r, Math.round(l * (p - u))).then((t => {
                    e.drawImage(t, 0, s * (h + 1 - p / f), r, s * p / f)
                }
                ))
            }
            this.options.labels && this.loadLabels(this.options.labelsBackground, "12px", "12px", "", this.options.labelsColor, this.options.labelsHzColor || this.options.labelsColor, "center", "#specLabels", t.length),
            this.emit("ready")
        }
    }
    createFilterBank(t, e, s, r) {
                // cache by scale name + params to avoid rebuilding
                // Include frequency range in cache key for optimization
                const freqMinStr = this.frequencyMin || "0";
                const freqMaxStr = this.frequencyMax || "0";
                const cacheKey = `${this.scale}:${t}:${e}:${this.fftSamples}:${freqMinStr}:${freqMaxStr}`;
                if (this._filterBankCache[cacheKey])
                        return this._filterBankCache[cacheKey];

                const i = s(0)
                    , a = s(e / 2);
                
                // Optimize: Only create filters for the specified frequency range
                const fMin = this.frequencyMin > 0 ? s(this.frequencyMin) : i;
                const fMax = this.frequencyMax > 0 && this.frequencyMax < e / 2 ? s(this.frequencyMax) : a;
                
                const n = Array.from({
                        length: t
                }, ( () => {
                    const fftHalfSize = this.fftSamples / 2 + 1;
                    const arr = new Float32Array(fftHalfSize);
                    arr.fill(0);
                    return arr;
                }));
                const h = e / this.fftSamples;
        for (let e = 0; e < t; e++) {
            let s = r(fMin + e / t * (fMax - fMin))
              , o = Math.floor(s / h)
              , l = o * h
              , c = (s - l) / ((o + 1) * h - l);
            if (o >= 0 && o < n[e].length) n[e][o] = 1 - c;
            if (o + 1 >= 0 && o + 1 < n[e].length) n[e][o + 1] = c;
        }
        this._filterBankCache[cacheKey] = n;
        return n
    }
    hzToMel(t) {
        return 2595 * Math.log10(1 + t / 700)
    }
    melToHz(t) {
        return 700 * (Math.pow(10, t / 2595) - 1)
    }
    createMelFilterBank(t, e) {
        return this.createFilterBank(t, e, this.hzToMel, this.melToHz)
    }
    hzToLog(t) {
        return Math.log10(Math.max(1, t))
    }
    logToHz(t) {
        return Math.pow(10, t)
    }
    createLogFilterBank(t, e) {
        return this.createFilterBank(t, e, this.hzToLog, this.logToHz)
    }
    hzToBark(t) {
        let e = 26.81 * t / (1960 + t) - .53;
        return e < 2 && (e += .15 * (2 - e)),
        e > 20.1 && (e += .22 * (e - 20.1)),
        e
    }
    barkToHz(t) {
        return t < 2 && (t = (t - .3) / .85),
        t > 20.1 && (t = (t + 4.422) / 1.22),
        (t + .53) / (26.28 - t) * 1960
    }
    createBarkFilterBank(t, e) {
        return this.createFilterBank(t, e, this.hzToBark, this.barkToHz)
    }
    hzToErb(t) {
        return n * Math.log10(1 + .00437 * t)
    }
    erbToHz(t) {
        return (Math.pow(10, t / n) - 1) / .00437
    }
    createErbFilterBank(t, e) {
        return this.createFilterBank(t, e, this.hzToErb, this.erbToHz)
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
            return this.hzToErb(t)
        }
        return t
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
            return this.erbToHz(t)
        }
        return t
    }
    applyFilterBank(t, e) {
        const s = e.length
          , r = Float32Array.from({
            length: s
        }, ( () => 0));
        for (let i = 0; i < s; i++)
            for (let s = 0; s < t.length; s++)
                r[i] += t[s] * e[i][s];
        return r
    }
    
    /// 輔助方法：將二維濾波器組矩陣扁平化並加載到 WASM
    /// 
    /// # Arguments
    /// * `filterBankMatrix` - 二維濾波器組矩陣 (Float32Array[])
    /// 
    /// 此方法將 2D 矩陣 (num_filters x freq_bins) 轉換為扁平化的 Float32Array (行優先)
    flattenAndLoadFilterBank(filterBankMatrix) {
        if (!filterBankMatrix || filterBankMatrix.length === 0) {
            // 清除濾波器組
            if (this._wasmEngine) {
                this._wasmEngine.clear_filter_bank();
            }
            this._filterBankMatrix = null;
            this._filterBankFlat = null;
            return;
        }
        
        const numFilters = filterBankMatrix.length;
        const freqBins = filterBankMatrix[0].length;
        
        // 建立扁平化陣列 (行優先順序)
        const flatArray = new Float32Array(numFilters * freqBins);
        for (let i = 0; i < numFilters; i++) {
            const row = filterBankMatrix[i];
            for (let j = 0; j < freqBins; j++) {
                flatArray[i * freqBins + j] = row[j];
            }
        }
        
        // 保存並加載到 WASM
        this._filterBankMatrix = filterBankMatrix;
        this._filterBankFlat = flatArray;
        
        if (this._wasmEngine) {
            this._wasmEngine.load_filter_bank(flatArray, numFilters);
        }
    }
    getWidth() {
        return this.wavesurfer.getWrapper().offsetWidth
    }
    
    async getFrequencies(t) {
        // 檢查 this.options 是否為 null（在 destroy 或 selection mode 切換時可能發生）
        if (!this.options || !t) {
            return;
        }
        
        var e, s;
        const r = this.fftSamples
          , i = (null !== (e = this.options.splitChannels) && void 0 !== e ? e : null === (s = this.wavesurfer) || void 0 === s ? void 0 : s.options.splitChannels) ? t.numberOfChannels : 1;
        if (this.frequencyMax = this.frequencyMax || t.sampleRate / 2,
        !t)
            return;
        this.buffer = t;
        const n = t.sampleRate
          , h = [];
        let o = this.noverlap;
        if (!o) {
            const e = t.length / this.canvas.width;
            o = Math.max(0, Math.round(r - e))
        }
        
        // OPTIMIZATION: Calculate frequency range bin indices once
        const minBinFull = Math.floor(this.frequencyMin * r / n);
        const maxBinFull = Math.ceil(this.frequencyMax * r / n);
        const binRangeSize = maxBinFull - minBinFull;
        
        // Wait for WASM to be ready
        await this._wasmReady;
        
        // 檢查是否需要重新計算濾波器組
        // 根據 scale、sampleRate 等決定是否需要更新
        let filterBankMatrix = null;
        const currentFilterBankKey = `${this.scale}:${n}:${this.frequencyMin}:${this.frequencyMax}`;
        
        if (this.scale !== "linear") {
            // 如果濾波器組需要更新，則計算新的濾波器組
            if (this._lastFilterBankScale !== currentFilterBankKey) {
                let c;
                let numFilters;
                switch (this.scale) {
                case "mel":
                    numFilters = this.numMelFilters;
                    c = this.createFilterBank(numFilters, n, this.hzToMel, this.melToHz);
                    break;
                case "logarithmic":
                    numFilters = this.numLogFilters;
                    c = this.createFilterBank(numFilters, n, this.hzToLog, this.logToHz);
                    break;
                case "bark":
                    numFilters = this.numBarkFilters;
                    c = this.createFilterBank(numFilters, n, this.hzToBark, this.barkToHz);
                    break;
                case "erb":
                    numFilters = this.numErbFilters;
                    c = this.createFilterBank(numFilters, n, this.hzToErb, this.erbToHz);
                    break;
                }
                
                filterBankMatrix = c;
                this._lastFilterBankScale = currentFilterBankKey;
                
                // 扁平化並加載到 WASM
                this.flattenAndLoadFilterBank(filterBankMatrix);
            }
        } else {
            // Linear scale: 不使用濾波器組
            this.flattenAndLoadFilterBank(null);
        }
        
        this.peakBandArrayPerChannel = [];
        
        if (this.options && this.options.peakMode) {
            // Peak Mode: 使用新的 WASM API (compute_spectrogram_u8) 獲得幅度值，然後進行峰值檢測
            // 第一次掃描：找出全局最大峰值（使用舊 API 獲得線性幅度值進行精確檢測）
            let globalMaxPeakValue = 0;
            
            for (let e = 0; e < i; e++) {
                const s = t.getChannelData(e);
                let a = 0;
                
                for (; a + r < s.length; ) {
                    const tSlice = s.subarray(a, a + r);
                    
                    // 使用舊 API 獲得線性幅度值進行峰值檢測
                    const magnitudeSpectrum = this._wasmEngine.compute_spectrogram(
                        tSlice,
                        o
                    );
                    
                    // 使用原始幅度值進行峰值檢測（比 dB 值更精確）
                    let peakValueInRange = 0;
                    for (let k = minBinFull; k < maxBinFull && k < magnitudeSpectrum.length; k++) {
                      peakValueInRange = Math.max(peakValueInRange, magnitudeSpectrum[k] || 0);
                    }
                    
                    globalMaxPeakValue = Math.max(globalMaxPeakValue, peakValueInRange);
                    a += r - o;
                }
            }
            
            // 2. 計算閾值
            const peakThresholdMultiplier = this.options.peakThreshold !== undefined ? this.options.peakThreshold : 0.4;
            const peakThreshold = globalMaxPeakValue * peakThresholdMultiplier;
            const highPeakThreshold = globalMaxPeakValue * 0.7;
            
            // 3. 第二次掃描：使用新 API 獲得 u8 頻譜，並記錄峰值信息
            for (let e = 0; e < i; e++) {
                const s = t.getChannelData(e)
                  , i = []
                  , channelPeakBands = [];
                let a = 0;
                for (; a + r < s.length; ) {
                    const tSlice = s.subarray(a, a + r);
                    
                    // 使用舊 API 獲得幅度值進行峰值檢測
                    const magnitudeSpectrum = this._wasmEngine.compute_spectrogram(
                        tSlice,
                        o
                    );
                    
                    // 進行峰值檢測
                    let peakBandInRange = Math.max(0, minBinFull);
                    let peakValueInRange = magnitudeSpectrum[peakBandInRange] || 0;
                    for (let k = minBinFull; k < maxBinFull && k < magnitudeSpectrum.length; k++) {
                      if ((magnitudeSpectrum[k] || 0) > peakValueInRange) {
                        peakValueInRange = magnitudeSpectrum[k];
                        peakBandInRange = k;
                      }
                    }
                    
                    // 存儲峰值信息
                    if (peakValueInRange >= peakThreshold) {
                      channelPeakBands.push({
                          bin: peakBandInRange,
                          isHigh: peakValueInRange >= highPeakThreshold
                      });
                    } else {
                      channelPeakBands.push(null);
                    }
                    
                    // 使用新 API 獲得 u8 頻譜（包含濾波器組處理和 dB 轉換）
                    const u8Spectrum = this._wasmEngine.compute_spectrogram_u8(
                        tSlice,
                        o,
                        this.gainDB,
                        this.rangeDB
                    );
                    
                    // 決定輸出大小（與 WASM 端的輸出大小一致）
                    const numFilters = this._wasmEngine.get_num_filters();
                    const outputSize = this.scale !== "linear" && numFilters > 0 ? numFilters : (r / 2);
                    
                    const outputFrame = new Uint8Array(outputSize);
                    for (let k = 0; k < Math.min(outputSize, u8Spectrum.length); k++) {
                        outputFrame[k] = u8Spectrum[k];
                    }
                    
                    i.push(outputFrame);
                    a += r - o
                }
                this.peakBandArrayPerChannel.push(channelPeakBands);
                h.push(i)
            }
        } else {
            // Peak Mode 禁用時：直接使用新 API
            for (let e = 0; e < i; e++) {
                const s = t.getChannelData(e)
                  , i = [];
                let a = 0;
                for (; a + r < s.length; ) {
                    const tSlice = s.subarray(a, a + r);
                    
                    // 使用新 API 獲得 u8 頻譜（包含濾波器組處理和 dB 轉換）
                    const u8Spectrum = this._wasmEngine.compute_spectrogram_u8(
                        tSlice,
                        o,
                        this.gainDB,
                        this.rangeDB
                    );
                    
                    // 決定輸出大小（與 WASM 端的輸出大小一致）
                    const numFilters = this._wasmEngine.get_num_filters();
                    const outputSize = this.scale !== "linear" && numFilters > 0 ? numFilters : (r / 2);
                    
                    const outputFrame = new Uint8Array(outputSize);
                    for (let k = 0; k < Math.min(outputSize, u8Spectrum.length); k++) {
                        outputFrame[k] = u8Spectrum[k];
                    }
                    
                    i.push(outputFrame);
                    a += r - o
                }
                h.push(i)
            }
        }
        return h
    }
    
    freqType(t) {
        return t >= 1e3 ? (t / 1e3).toFixed(1) : Math.round(t)
    }
    unitType(t) {
        return t >= 1e3 ? "kHz" : "Hz"
    }
    getLabelFrequency(t, e) {
        const s = this.hzToScale(this.frequencyMin)
          , r = this.hzToScale(this.frequencyMax);
        return this.scaleToHz(s + t / e * (r - s))
    }
    loadLabels(t, e, s, r, i, a, n, h, o) {
        t = t || "rgba(68,68,68,0)",
        e = e || "12px",
        s = s || "12px",
        r = r || "Helvetica",
        i = i || "#fff",
        a = a || "#fff",
        n = n || "center";
        const l = this.height || 512
          , c = l / 256 * 5;
        this.frequencyMin;
        this.frequencyMax;
        const u = this.labelsEl.getContext("2d")
          , f = window.devicePixelRatio;
        if (this.labelsEl.height = this.height * o * f,
        this.labelsEl.width = 55 * f,
        u.scale(f, f),
        u)
            for (let h = 0; h < o; h++) {
                let o;
                for (u.fillStyle = t,
                u.fillRect(0, h * l, 55, (1 + h) * l),
                u.fill(),
                o = 0; o <= c; o++) {
                    u.textAlign = n,
                    u.textBaseline = "middle";
                    const t = this.getLabelFrequency(o, c)
                      , f = this.freqType(t)
                      , p = this.unitType(t)
                      , d = 16;
                    let w = (1 + h) * l - o / c * l;
                    w = Math.min(Math.max(w, h * l + 10), (1 + h) * l - 10),
                    u.fillStyle = a,
                    u.font = s + " " + r,
                    u.fillText(p, d + 24, w),
                    u.fillStyle = i,
                    u.font = e + " " + r,
                    u.fillText(f, d, w)
                }
            }
    }
    resample(t) {
        const outW = this.getWidth()
          , out = []
          , invIn = 1 / t.length;

        const cacheKey = `${t.length}:${outW}`;
        let mapping = this._resampleCache[cacheKey];
        if (!mapping) {
            mapping = new Array(outW);
            const invOut = 1 / outW;
            for (let a = 0; a < outW; a++) {
                const contrib = [];
                for (let n = 0; n < t.length; n++) {
                    const s = n * invIn;
                    const h = s + invIn;
                    const o = a * invOut;
                    const l = o + invOut;
                    const c = Math.max(0, Math.min(h, l) - Math.max(s, o));
                    if (c > 0)
                        contrib.push([n, c / invOut]);
                }
                mapping[a] = contrib;
            }
            this._resampleCache[cacheKey] = mapping;
        }

        for (let a = 0; a < outW; a++) {
            const accum = new Array(t[0].length);
            const contrib = mapping[a];
            for (let j = 0; j < contrib.length; j++) {
                const nIdx = contrib[j][0];
                const weight = contrib[j][1];
                const src = t[nIdx];
                for (let u = 0; u < src.length; u++) {
                    if (accum[u] == null)
                        accum[u] = 0;
                    accum[u] += weight * src[u];
                }
            }
            const outArr = new Uint8Array(t[0].length);
            for (let o = 0; o < t[0].length; o++)
                outArr[o] = accum[o];
            out.push(outArr);
        }
        return out
    }
}
export {h as default};
