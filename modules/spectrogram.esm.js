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

        // cache for filter banks to avoid rebuilding on each render
        this._filterBankCache = {};
        // cache for resample mappings keyed by inputLen:outputWidth
        this._resampleCache = {};
        
        // --- 優化開始: 預計算 Uint32 顏色表 ---
        this._colorMapUint = new Uint8ClampedArray(256 * 4);
        this._colorMap32 = new Uint32Array(256); // 新增: 32位顏色緩存

        if (this.colorMap) {
            for (let ii = 0; ii < 256; ii++) {
                const cc = this.colorMap[ii] || [0, 0, 0, 1];
                const r = Math.round(255 * cc[0]);
                const g = Math.round(255 * cc[1]);
                const b = Math.round(255 * cc[2]);
                const a = Math.round(255 * cc[3]);
                
                this._colorMapUint[ii * 4] = r;
                this._colorMapUint[ii * 4 + 1] = g;
                this._colorMapUint[ii * 4 + 2] = b;
                this._colorMapUint[ii * 4 + 3] = a;

                // 預計算 Little Endian (ABGR) 格式的整數，用於快速寫入
                this._colorMap32[ii] = (a << 24) | (b << 16) | (g << 8) | r;
            }
        }
        // 預計算特殊顏色的 Uint32 值
        // #FF70FC (RGB: 255, 112, 252) -> ABGR: 255, 252, 112, 255
        this._highPeakColor32 = (255 << 24) | (252 << 16) | (112 << 8) | 255;
        
        // 紅色 (RGB: 255, 0, 0) -> ABGR: 255, 0, 0, 255
        this._peakColor32 = (255 << 24) | (0 << 16) | (0 << 8) | 255;
        // --- 優化結束 ---
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
    render() {
        var t;
        if (this.frequenciesDataUrl)
            this.loadFrequenciesData(this.frequenciesDataUrl);
        else {
            const e = null === (t = this.wavesurfer) || void 0 === t ? void 0 : t.getDecodedData();
            e && this.drawSpectrogram(this.getFrequencies(e))
        }
    }
drawSpectrogram(t) {
        if (!t || t.length === 0) return;
        
        isNaN(t[0][0]) || (t = [t]);
        this.wrapper.style.height = this.height * t.length + "px";
        this.canvas.width = this.getWidth();
        this.canvas.height = this.height * t.length;
        
        const ctx = this.spectrCc;
        const h = this.height;
        const w = this.getWidth();
        
        if (!ctx) return;

        // 填充背景色
        const bgPixel = this._colorMap32[this._colorMap32.length - 1] || 0;
        // 注意: 這裡fillRect仍需字符串，或者我们可以直接操作Buffer。
        // 為保持兼容簡單，用原方法填充背景，覆蓋操作很快
        const i = this.colorMap[this.colorMap.length - 1];
        ctx.fillStyle = `rgba(${i[0]}, ${i[1]}, ${i[2]}, ${i[3]})`;
        ctx.fillRect(0, 0, w, h * t.length);

        // 計算 Peak Mode 閾值 (在渲染時計算，因為我們現在才有了最終的 globalMaxPeakValue)
        const peakThreshold = this.globalMaxPeakValue * (this.options.peakThreshold || 0.4);
        const highPeakThreshold = this.globalMaxPeakValue * 0.7;

        for (let ch = 0; ch < t.length; ch++) {
            const channelData = t[ch];
            const channelPeakInfos = this.peakBandArrayPerChannel[ch];
            
            // 創建圖像數據緩衝區
            const imgData = ctx.createImageData(w, h);
            // 使用 Uint32Array 視圖來操作像素 (Little Endian systems: ABGR)
            const data32 = new Uint32Array(imgData.data.buffer);
            
            const dataLen = channelData.length;
            const timeScale = dataLen / w; // 用於直接計算採樣索引
            
            const bins = channelData[0].length;
            const freqScale = bins / h; // 簡單的頻率縮放
            
            // 優化: 雙重循環反轉 (X軸優先，因為圖像數據是行優先存儲的，但這裡為了邏輯清晰保持 X->Y)
            // 為了最大化緩存命中，我們應該儘量按內存順序寫入，但頻譜圖是垂直繪製的
            
            for (let x = 0; x < w; x++) {
                // 1. 內聯重採樣 (Inline Resampling) - Nearest Neighbor
                // 直接計算當前像素 X 對應原始數據的哪一列
                const srcIdx = Math.floor(x * timeScale);
                const safeSrcIdx = Math.min(dataLen - 1, srcIdx);
                
                const colData = channelData[safeSrcIdx];
                const colPeakInfo = channelPeakInfos[safeSrcIdx];

                // 預先判斷該列的 Peak 狀態
                let peakBin = -1;
                let isHighPeak = false;
                
                if (this.options.peakMode && colPeakInfo && colPeakInfo.val >= peakThreshold) {
                     peakBin = colPeakInfo.bin;
                     isHighPeak = colPeakInfo.val >= highPeakThreshold;
                }

                // 2. 繪製該列的所有像素 (Y軸)
                for (let y = 0; y < h; y++) {
                    // 頻譜圖通常低頻在下，高頻在上。canvas y=0 是頂部。
                    // 計算對應的頻率 Bin 索引
                    const invertedY = h - y - 1; 
                    // 如果沒有縮放 (bins == h)，直接映射。否則簡單縮放
                    const binIdx = Math.floor(invertedY * freqScale); 
                    
                    // 計算 Buffer 中的索引 (行優先: y * w + x)
                    const pixelIndex = y * w + x;
                    
                    // 判斷是否是 Peak 點
                    // 注意: 這裡需要處理縮放帶來的模糊。如果縮放比例大，可能需要檢查範圍
                    // 為了效能，這裡採用精確匹配或簡單範圍匹配
                    let isPeakPixel = false;
                    if (peakBin >= 0) {
                        if (Math.abs(binIdx - peakBin) < Math.max(1, freqScale)) {
                             isPeakPixel = true;
                        }
                    }

                    if (isPeakPixel) {
                        if (isHighPeak) {
                            data32[pixelIndex] = this._highPeakColor32; // #FF70FC
                        } else {
                            data32[pixelIndex] = this._peakColor32;     // 紅色
                        }
                    } else {
                        // 普通頻譜顏色
                        // 安全檢查
                        const val = colData[Math.min(bins-1, binIdx)] || 0;
                        data32[pixelIndex] = this._colorMap32[val];
                    }
                }
            }
            
            // 將構建好的圖像放到 Canvas 上
            // 計算垂直位置
            const yPos = h * ch;
            createImageBitmap(imgData).then(bmp => {
                ctx.drawImage(bmp, 0, yPos);
            });
        }
        
        this.options.labels && this.loadLabels(this.options.labelsBackground, "12px", "12px", "", this.options.labelsColor, this.options.labelsHzColor || this.options.labelsColor, "center", "#specLabels", t.length);
        this.emit("ready");
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
    getWidth() {
        return this.wavesurfer.getWrapper().offsetWidth
    }
    getFrequencies(t) {
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
        
        const l = new a(r,n,this.windowFunc,this.alpha);
        let c;
        switch (this.scale) {
        case "mel":
            c = this.createFilterBank(this.numMelFilters, n, this.hzToMel, this.melToHz);
            break;
        case "logarithmic":
            c = this.createFilterBank(this.numLogFilters, n, this.hzToLog, this.logToHz);
            break;
        case "bark":
            c = this.createFilterBank(this.numBarkFilters, n, this.hzToBark, this.barkToHz);
            break;
        case "erb":
            c = this.createFilterBank(this.numErbFilters, n, this.hzToErb, this.erbToHz)
        }
        
        this.peakBandArrayPerChannel = [];
        
        const gainDBNeg = -this.gainDB;
        const gainDBNegRange = gainDBNeg - this.rangeDB;
        const rangeDBReciprocal = 255 / this.rangeDB;
        
        if (this.options.peakMode) {
            // 1. 第一次掃描：找出全局最大峰值
            let globalMaxPeakValue = 0;
            
            for (let e = 0; e < i; e++) {
                const s = t.getChannelData(e);
                let a = 0;
                
                for (; a + r < s.length; ) {
                    const tSlice = s.subarray(a, a + r);
                    l.peak = 0;
                    let spectrumData = l.calculateSpectrum(tSlice);
                    
                    let peakValueInRange = 0;
                    for (let k = minBinFull; k < maxBinFull && k < spectrumData.length; k++) {
                      peakValueInRange = Math.max(peakValueInRange, spectrumData[k] || 0);
                    }
                    
                    globalMaxPeakValue = Math.max(globalMaxPeakValue, peakValueInRange);
                    a += r - o;
                }
            }
            
            // 2. 計算閾值：基本顯示閾值 (40%) 和 高峰值變色閾值 (70%)
            const peakThresholdMultiplier = this.options.peakThreshold !== undefined ? this.options.peakThreshold : 0.4;
            const peakThreshold = globalMaxPeakValue * peakThresholdMultiplier;
            const highPeakThreshold = globalMaxPeakValue * 0.7; // 新增：70% 閾值
            
            // 3. 第二次掃描：記錄數據
            for (let e = 0; e < i; e++) {
                const s = t.getChannelData(e)
                  , i = []
                  , channelPeakBands = [];
                let a = 0;
                for (; a + r < s.length; ) {
                    const tSlice = s.subarray(a, a + r)
                        , e = new Uint8Array(r / 2);
                    
                    l.peak = 0;
                    let spectrumData = l.calculateSpectrum(tSlice);
                    
                    let peakBandInRange = Math.max(0, minBinFull);
                    let peakValueInRange = spectrumData[peakBandInRange] || 0;
                    for (let k = minBinFull; k < maxBinFull && k < spectrumData.length; k++) {
                      if ((spectrumData[k] || 0) > peakValueInRange) {
                        peakValueInRange = spectrumData[k];
                        peakBandInRange = k;
                      }
                    }
                    
                    // 修改：存儲對象而不是單純的索引
                    if (peakValueInRange >= peakThreshold) {
                      channelPeakBands.push({
                          bin: peakBandInRange,
                          isHigh: peakValueInRange >= highPeakThreshold // 標記是否超過 70%
                      });
                    } else {
                      channelPeakBands.push(null);
                    }
                    
                    let n = spectrumData;
                    c && (n = this.applyFilterBank(n, c));
                    
                    const startBin = c ? 0 : minBinFull;
                    const endBin = c ? r / 2 : Math.min(maxBinFull, r / 2);
                    
                    for (let t = startBin; t < endBin; t++) {
                        const s = n[t] > 1e-12 ? n[t] : 1e-12
                          , r = 20 * Math.log10(s);
                        if (r < gainDBNegRange) {
                            e[t] = 0;
                        } else if (r > gainDBNeg) {
                            e[t] = 255;
                        } else {
                            e[t] = (r + this.gainDB) * rangeDBReciprocal + 256;
                        }
                    }
                    i.push(e),
                    a += r - o
                }
                this.peakBandArrayPerChannel.push(channelPeakBands);
                h.push(i)
            }
        } else {
            // Peak Mode 禁用時的邏輯
            for (let e = 0; e < i; e++) {
                const s = t.getChannelData(e)
                  , i = [];
                let a = 0;
                for (; a + r < s.length; ) {
                    const e = new Uint8Array(r / 2);
                    l.peak = 0;
                    let n = l.calculateSpectrum(s.subarray(a, a + r));
                    c && (n = this.applyFilterBank(n, c));
                    
                    const startBin = c ? 0 : minBinFull;
                    const endBin = c ? r / 2 : Math.min(maxBinFull, r / 2);
                    
                    for (let t = startBin; t < endBin; t++) {
                        const s = n[t] > 1e-12 ? n[t] : 1e-12
                          , r = 20 * Math.log10(s);
                        if (r < gainDBNegRange) {
                            e[t] = 0;
                        } else if (r > gainDBNeg) {
                            e[t] = 255;
                        } else {
                            e[t] = (r + this.gainDB) * rangeDBReciprocal + 256;
                        }
                    }
                    i.push(e),
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
