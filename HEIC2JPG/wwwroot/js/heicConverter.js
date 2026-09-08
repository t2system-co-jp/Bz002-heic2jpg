// HEIC→JPEG変換用JavaScript
window.heicConverter = {
    // 定数定義
    DEFAULT_QUALITY: 0.9,

    isInitialized: false,
    libheifModule: null,
    initializationPromise: null,

    async initialize() {
        if (this.isInitialized) return true;

        // 並列変換時に初期化が多重実行され、libheifモジュールが複数生成されるのを防ぐ
        if (this.initializationPromise) {
            return await this.initializationPromise;
        }

        this.initializationPromise = this._doInitialize();
        try {
            return await this.initializationPromise;
        } finally {
            this.initializationPromise = null;
        }
    },

    async _doInitialize() {
        if (this.isInitialized) return true;

        try {
            // libheif WASMライブラリの初期化
            console.log('libheif初期化開始...');
            
            if (typeof libheif !== 'undefined') {
                console.log('libheifオブジェクト検出');
                // locateFileでWASMファイルのパスを明示的に指定
                this.libheifModule = await libheif({
                    locateFile: (path, prefix) => {
                        console.log('libheif locateFile:', path, prefix);
                        // WASMファイルの場所を明示的に指定
                        if (path.endsWith('.wasm')) {
                            const wasmPath = '/lib/libheif/' + path;
                            console.log('WASM file path:', wasmPath);
                            return wasmPath;
                        }
                        // その他のファイルはデフォルトパス
                        return prefix + path;
                    }
                });
                console.log('libheifモジュール初期化完了', this.libheifModule);
                
                this.isInitialized = true;
                console.log('libheif初期化完了');
                return true;
            } else {
                console.error('libheifオブジェクトが見つかりません');
                return false;
            }
        } catch (error) {
            console.error('libheif初期化エラー:', error);
            this.libheifModule = null;
            this.isInitialized = false;
            return false;
        }
    },
    
    async convertHeicToJpeg(heicBuffer, quality = this.DEFAULT_QUALITY, keepExif = true) {
        if (!this.isInitialized) {
            const errorMsg = window.getLocalizedString('JSError.HeicNotInitialized');
            throw new Error(errorMsg);
        }
        
        try {
            // libheifが利用可能な場合の実装
            if (this.libheifModule) {
                return await this.convertWithLibheif(heicBuffer, quality, keepExif);
            } else {
                throw new Error(window.getLocalizedString('JSError.HeicNotInitialized'));
            }
        } catch (error) {
            const errorMsg = window.commonUtils?.formatError 
                ? window.commonUtils.formatError('HEIC変換', error)
                : `HEIC変換エラー: ${error.message}`;
            
            console.error(errorMsg);
            throw new Error(errorMsg, { cause: error });
        }
    },
    
    async convertWithLibheif(heicBuffer, quality, keepExif) {
        let decoder = null;
        let images = [];
        let canvas = null;

        try {
            console.log('libheif変換開始...', heicBuffer.length, 'bytes');

            decoder = new this.libheifModule.HeifDecoder();
            images = decoder.decode(heicBuffer) || [];

            if (images.length === 0) {
                throw new Error(window.getLocalizedString('JSError.ImageDataEmpty'));
            }

            const image = images[0];
            const width = image.get_width();
            const height = image.get_height();

            console.log(`デコード成功: ${width}x${height}`);

            canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error(window.getLocalizedString('JSError.DisplayDataFailed'));
            }

            const imageData = ctx.createImageData(width, height);
            const displayData = await new Promise((resolve, reject) => {
                image.display(imageData, (result) => {
                    if (result) {
                        resolve(result);
                    } else {
                        reject(new Error(window.getLocalizedString('JSError.DisplayDataFailed')));
                    }
                });
            });

            ctx.putImageData(displayData, 0, 0);

            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob((result) => {
                    if (result) {
                        resolve(result);
                    } else {
                        reject(new Error(window.getLocalizedString('JSError.JpegConversionFailed')));
                    }
                }, 'image/jpeg', quality);
            });

            console.log('libheif変換完了');
            return blob;
        } finally {
            for (const image of images) {
                try {
                    image.free();
                } catch (cleanupError) {
                    console.warn('libheif画像リソース解放エラー:', cleanupError);
                }
            }

            try {
                // HeifDecoder.decoder は heif_context_alloc() が返す生ポインタ（数値）なので
                // heif_context_free() で解放する必要がある。
                if (decoder?.decoder) {
                    this.libheifModule?.heif_context_free(decoder.decoder);
                    decoder.decoder = null;
                }
            } catch (cleanupError) {
                console.warn('libheifデコーダー解放エラー:', cleanupError);
            }

            if (canvas) {
                canvas.width = 0;
                canvas.height = 0;
            }
        }
    },

    dispose() {
        this.libheifModule = null;
        this.isInitialized = false;
    }
};
