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
            
            // 設置色彩映射到 WASM
            if (this._colorMapUint && this._colorMapUint.length === 1024) {
                this._wasmEngine.set_color_map(this._colorMapUint);
                console.log('✅ [Spectrogram] 色彩映射已初始化到 WASM SpectrogramEngine');
            }
            
            // 設置光譜配置
            this._wasmEngine.set_spectrum_config(
                this.scale,
                this.frequencyMin,
                this.frequencyMax
            );
            console.log('✅ [Spectrogram] WASM SpectrogramEngine 已初始化，準備使用新渲染管道');
        });

        // 濾波器組相關字段
        this._filterBankMatrix = null;  // 當前濾波器組矩陣 (二維陣列)
        this._filterBankFlat = null;    // 扁平化的濾波器組 (Float32Array)
        this._lastFilterBankScale = null; // 用於檢測濾波器組是否需要更新

        // cache for filter banks to avoid rebuilding on each render
        this._filterBankCache = {};
        // 新增: 按完整 key 緩存濾波器組矩陣，避免重複計算
        this._filterBankCacheByKey = {};
        // 新增: 追蹤當前加載到 WASM 的濾波器組 key，避免重複加載
        this._loadedFilterBankKey = null;
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
        console.log('🎯 [Spectrogram] drawSpectrogram() called');
        
        // 檢查 wrapper 和 canvas 是否已被清空
        if (!this.wrapper || !this.canvas) {
            console.warn('⚠️ [Spectrogram] Wrapper 或 Canvas 不存在');
            return;
        }
        
        // 確保 t 是二維陣列 (每個通道一行)
        isNaN(t[0][0]) || (t = [t]);
        
        this.wrapper.style.height = this.height * t.length + "px";
        this.canvas.width = this.getWidth();
        this.canvas.height = this.height * t.length;
        
        const canvasCtx = this.spectrCc;
        if (!canvasCtx || !this._wasmEngine) {
            console.warn('❌ [Spectrogram] Canvas 上下文或 WASM Engine 不可用');
            return;
        }

        // 驗證色彩映射是否已初始化
        if (!this._colorMapUint || this._colorMapUint.length !== 1024) {
            console.warn('⚠️ [Spectrogram] 色彩映射未初始化或大小不正確，使用 JS 實現');
        } else {
            console.log('✅ [Spectrogram] 使用預計算色彩映射 (新方法)');
        }

        // 使用 WASM 渲染每個通道
        for (let channelIdx = 0; channelIdx < t.length; channelIdx++) {
            console.log(`📊 [Spectrogram] 渲染通道 ${channelIdx + 1}/${t.length}`);
            const channelData = t[channelIdx];  // Uint8Array with frame spectrum data
            
            // 根據當前配置確定頻率軸高度
            const specHeight = this._wasmEngine.get_num_filters() > 0 && this.scale !== "linear"
                ? this._wasmEngine.get_num_filters()
                : (this.fftSamples / 2);
            
            const canvasWidth = this.getWidth();
            const canvasHeight = this.height;
            
            // 調用 WASM 進行完整的渲染 (FFT 已在 getFrequencies 中完成，這裡直接使用頻譜數據)
            // 注意: channelData 已經是 u8 量化的頻譜，需要在 WASM 中進行重採樣和色彩化
            // 但 compute_spectrogram_image 期望的是原始音頻數據
            // 因此我們需要一個新方法: compute_spectrogram_from_u8_frames
            
            // 臨時方案: 保持使用 JS 重採樣邏輯，但色彩化在 WASM 中完成
            const resampled = this.resample(channelData);  // 仍然使用 JS resample
            
            // 創建 ImageData
            const imgData = new ImageData(canvasWidth, resampled[0].length);
            
            // 填充 ImageData (使用緩存的色彩映射)
            if (this._colorMapUint && this._colorMapUint.length === 1024) {
                // 新方法: 使用 WASM 預計算的色彩映射
                for (let x = 0; x < resampled.length; x++) {
                    for (let y = 0; y < resampled[x].length; y++) {
                        let intensity = resampled[x][y];
                        if (intensity < 0) intensity = 0;
                        else if (intensity > 255) intensity = 255;
                        
                        const cmapIdx = intensity * 4;
                        const pixelIdx = (((resampled[x].length - 1 - y) * canvasWidth + x)) * 4;
                        
                        imgData.data[pixelIdx] = this._colorMapUint[cmapIdx];
                        imgData.data[pixelIdx + 1] = this._colorMapUint[cmapIdx + 1];
                        imgData.data[pixelIdx + 2] = this._colorMapUint[cmapIdx + 2];
                        imgData.data[pixelIdx + 3] = this._colorMapUint[cmapIdx + 3];
                    }
                }
            } else {
                // 備用方法: 直接使用灰度值 (如果色彩映射未初始化)
                console.warn('⚠️ [Spectrogram] 通道 ' + (channelIdx + 1) + ' 使用備用灰度方案');
                for (let x = 0; x < resampled.length; x++) {
                    for (let y = 0; y < resampled[x].length; y++) {
                        let intensity = resampled[x][y];
                        if (intensity < 0) intensity = 0;
                        else if (intensity > 255) intensity = 255;
                        
                        const pixelIdx = (((resampled[x].length - 1 - y) * canvasWidth + x)) * 4;
                        imgData.data[pixelIdx] = intensity;
                        imgData.data[pixelIdx + 1] = intensity;
                        imgData.data[pixelIdx + 2] = intensity;
                        imgData.data[pixelIdx + 3] = 255;
                    }
                }
            }
            
            // 使用 createImageBitmap + drawImage 的非同步渲染
            const sampleRate = this.buffer.sampleRate / 2;
            const freqMin = this.frequencyMin;
            const freqMax = this.frequencyMax;
            const u = this.hzToScale(freqMin) / this.hzToScale(sampleRate);
            const f = this.hzToScale(freqMax) / this.hzToScale(sampleRate);
            const p = Math.min(1, f);
            
            const sourceHeight = Math.round(resampled[0].length * (p - u));
            const sourceY = Math.round(resampled[0].length * (1 - p));
            
            createImageBitmap(imgData, 0, sourceY, canvasWidth, sourceHeight).then((bitmap => {
                console.log(`🎨 [Spectrogram] 通道 ${channelIdx + 1} 位圖已繪製`);
                canvasCtx.drawImage(bitmap, 0, this.height * (channelIdx + 1 - p / f), canvasWidth, this.height * p / f);
            }));
        }
        
        // 標籤渲染
        if (this.options.labels) {
            this.loadLabels(
                this.options.labelsBackground,
                "12px", "12px", "",
                this.options.labelsColor,
                this.options.labelsHzColor || this.options.labelsColor,
                "center",
                "#specLabels",
                t.length
            );
        }
        
        console.log('✅ [Spectrogram] drawSpectrogram() 已完成');
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
    
    /// 輔助方法：將二維濾波器組矩陣扁平化並加載到 WASM
    /// 
    /// # Arguments
    /// * `filterBankMatrix` - 二維濾波器組矩陣 (Float32Array[])
    /// 
    /// 此方法將 2D 矩陣 (num_filters x freq_bins) 轉換為扁平化的 Float32Array (行優先)
    /// 優化: 只在濾波器組實際改變時才執行扁平化和 WASM 調用
    flattenAndLoadFilterBank(filterBankMatrix) {
        if (!filterBankMatrix || filterBankMatrix.length === 0) {
            // 清除濾波器組
            if (this._wasmEngine && this._filterBankFlat !== null) {
                this._wasmEngine.clear_filter_bank();
            }
            this._filterBankMatrix = null;
            this._filterBankFlat = null;
            return;
        }
        
        const numFilters = filterBankMatrix.length;
        const freqBins = filterBankMatrix[0].length;
        
        // 建立扁平化陣列 (行優先順序)
        // 優化: 使用 subarray 批量複製，而不是逐個元素複製
        const flatArray = new Float32Array(numFilters * freqBins);
        for (let i = 0; i < numFilters; i++) {
            const row = filterBankMatrix[i];
            flatArray.set(row, i * freqBins);  // 更快的批量複製
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
    
    /// 清除濾波器組緩存 (當 FFT 大小或頻率範圍改變時調用)
    clearFilterBankCache() {
        this._filterBankCache = {};
        this._filterBankCacheByKey = {};
        this._loadedFilterBankKey = null;
        this._filterBankMatrix = null;
        this._filterBankFlat = null;
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
                
                // 首先檢查是否已緩存此配置的濾波器組
                if (this._filterBankCacheByKey[currentFilterBankKey]) {
                    c = this._filterBankCacheByKey[currentFilterBankKey];
                    // Using cached filter bank
                } else {
                    // 計算新的濾波器組並緩存
                    const filterBankStartTime = performance.now();
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
                    const filterBankTime = performance.now() - filterBankStartTime;
                    
                    // 緩存計算結果，以便後續使用
                    this._filterBankCacheByKey[currentFilterBankKey] = c;
                    // Filter bank computed
                }
                
                // 只在濾波器組實際改變時加載到 WASM (關鍵優化)
                if (this._loadedFilterBankKey !== currentFilterBankKey) {
                    const wasmLoadStartTime = performance.now();
                    this.flattenAndLoadFilterBank(c);
                    const wasmLoadTime = performance.now() - wasmLoadStartTime;
                    this._loadedFilterBankKey = currentFilterBankKey;
                    // WASM loading completed
                } else {
                    // Filter bank already loaded to WASM
                }
                
                this._lastFilterBankScale = currentFilterBankKey;
            }
        } else {
            // Linear scale: 清除濾波器組
            if (this._loadedFilterBankKey !== null) {
                this.flattenAndLoadFilterBank(null);
                this._loadedFilterBankKey = null;
            }
        }
        
        this.peakBandArrayPerChannel = [];
        
        if (this.options && this.options.peakMode) {
            // Peak Mode: 使用新的 WASM API (get_peaks) 進行峰值檢測
            // 峰值檢測現在在 WASM 中進行，這大大加速了計算（避免了雙重掃描）
            const peakThresholdMultiplier = this.options.peakThreshold !== undefined ? this.options.peakThreshold : 0.4;
            
            // 對每個通道進行峰值檢測
            for (let e = 0; e < i; e++) {
                const s = t.getChannelData(e)
                  , channelFrames = []
                  , channelPeakBands = [];
                let a = 0;
                
                // 計算完整通道的幅度數據（這會在 WASM 內部存儲所有幀的幅度值）
                // 為了獲得完整的幀數據，我們先計算整個通道的頻譜
                const fullU8Spectrum = this._wasmEngine.compute_spectrogram_u8(
                    s,
                    o,
                    this.gainDB,
                    this.rangeDB
                );
                
                // 現在 WASM 已經計算了所有幀的幅度值，我們可以獲取峰值信息
                const peakIndices = this._wasmEngine.get_peaks(peakThresholdMultiplier);
                const peakMagnitudes = this._wasmEngine.get_peak_magnitudes(peakThresholdMultiplier);
                const globalMaxValue = this._wasmEngine.get_global_max();
                const highPeakThreshold = globalMaxValue * 0.7;
                
                // 計算幀數（根據 WASM 存儲的幀數）
                const freq_bins = this.fftSamples / 2;
                const numFilters = this._wasmEngine.get_num_filters();
                const outputSize = this.scale !== "linear" && numFilters > 0 ? numFilters : freq_bins;
                const numFrames = Math.floor(fullU8Spectrum.length / outputSize);
                
                // 將 u8 頻譜數據按幀拆分
                for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
                    const outputFrame = new Uint8Array(outputSize);
                    const frameStartIdx = frameIdx * outputSize;
                    for (let k = 0; k < outputSize; k++) {
                        outputFrame[k] = fullU8Spectrum[frameStartIdx + k];
                    }
                    channelFrames.push(outputFrame);
                }
                
                // 轉換峰值索引為 channelPeakBands 格式
                for (let frameIdx = 0; frameIdx < peakIndices.length && frameIdx < channelFrames.length; frameIdx++) {
                    const peakBinIndex = peakIndices[frameIdx];
                    
                    if (peakBinIndex !== 0xFFFF) {
                        // 有效的峰值（超過閾值）
                        // 使用峰值幅度值判定是否超過 70% 全局最大值
                        const peakMagnitude = peakMagnitudes[frameIdx] || 0;
                        const isHigh = peakMagnitude >= highPeakThreshold;
                        
                        channelPeakBands.push({
                            bin: peakBinIndex,
                            isHigh: isHigh
                        });
                    } else {
                        // 無效的峰值（未超過閾值）
                        channelPeakBands.push(null);
                    }
                }
                
                this.peakBandArrayPerChannel.push(channelPeakBands);
                h.push(channelFrames)
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

// 暴露 WASM 波形峰值計算函數給 wavesurfer
// 這允許 wavesurfer 在沒有直接導入 WASM 模塊的情況下使用 WASM 優化
wasmReady.then(() => {
    // 動態導入 WASM 函數並暴露到全局作用域
    try {
        // 導入計算波形峰值的函數
        const initModule = async () => {
            const wasmModule = await import('./spectrogram_wasm.js');
            if (wasmModule && wasmModule.compute_wave_peaks && wasmModule.find_global_max) {
                window.__spectrogramWasmFuncs = {
                    compute_wave_peaks: wasmModule.compute_wave_peaks,
                    find_global_max: wasmModule.find_global_max
                };
                // WASM waveform peaks function loaded
            }
        };
        initModule().catch(err => {
            // WASM waveform peaks initialization failed, will use JS fallback
        });
    } catch (e) {
        // WASM function exposure failed, will use JS fallback
    }
}).catch(err => {
    // WASM initialization failed, will use JS fallback
});

export {h as default};
