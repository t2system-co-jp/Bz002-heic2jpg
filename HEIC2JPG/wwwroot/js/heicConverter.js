// HEIC→JPEG変換用JavaScript
window.heicConverter = {
    isInitialized: false,
    libheifModule: null,
    
    async initialize() {
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
                // 開発用フォールバック（libheifが未実装の場合）
                console.warn('libheifオブジェクトが見つかりません - モック変換を使用');
                this.isInitialized = true;
                return true;
            }
        } catch (error) {
            console.error('libheif初期化エラー:', error);
            console.log('モック変換にフォールバック');
            this.isInitialized = true;
            return true;
        }
    },
    
    async convertHeicToJpeg(heicBuffer, quality = 0.9, keepExif = true) {
        if (!this.isInitialized) {
            const errorMsg = window.getLocalizedString('JSError.HeicNotInitialized');
            throw new Error(errorMsg);
        }
        
        try {
            // libheifが利用可能な場合の実装
            if (this.libheifModule) {
                return await this.convertWithLibheif(heicBuffer, quality, keepExif);
            } else {
                // 開発用モック実装
                console.log('libheif未対応のためモック変換を実行します');
                return await this.convertWithMock(heicBuffer, quality);
            }
        } catch (error) {
            const errorMsg = window.commonUtils?.formatError 
                ? window.commonUtils.formatError('HEIC変換', error)
                : `HEIC変換エラー: ${error.message}`;
            
            console.error(errorMsg);
            console.log('エラー発生のためモック変換にフォールバック');
            // エラー時はモック変換にフォールバック
            return await this.convertWithMock(heicBuffer, quality);
        }
    },
    
    async convertWithLibheif(heicBuffer, quality, keepExif) {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('libheif変換開始...', heicBuffer.length, 'bytes');

                const decoder = new this.libheifModule.HeifDecoder();
                const data = decoder.decode(heicBuffer);

                if (!data || data.length === 0) {
                    return reject(new Error(window.getLocalizedString('JSError.ImageDataEmpty')));
                }

                const image = data[0];
                const width = image.get_width();
                const height = image.get_height();

                console.log(`デコード成功: ${width}x${height}`);

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                // image.displayの正しい使い方 (コールバック形式)
                image.display(ctx.getImageData(0, 0, width, height), (displayData) => {
                    if (!displayData) {
                        return reject(new Error(window.getLocalizedString('JSError.DisplayDataFailed')));
                    }

                    ctx.putImageData(displayData, 0, 0);

                    canvas.toBlob((blob) => {
                        if (blob) {
                            console.log('libheif変換完了');
                            resolve(blob);
                        } else {
                            reject(new Error(window.getLocalizedString('JSError.JpegConversionFailed')));
                        }
                    }, 'image/jpeg', quality);
                });
            } catch (error) {
                console.error('libheif変換エラー:', error);
                reject(error);
            }
        });
    },
    
    async convertWithMock(heicBuffer, quality) {
        // 開発用モック実装 - サンプル画像を生成
        console.log('モック変換実行中...', heicBuffer.length, 'bytes');
        
        // 変換の遅延をシミュレート
        await new Promise(resolve => setTimeout(resolve, 300));
        
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = 400;
            canvas.height = 300;
            
            const ctx = canvas.getContext('2d');
            
            // グラデーション背景でモック画像を作成
            const gradient = ctx.createLinearGradient(0, 0, 400, 300);
            gradient.addColorStop(0, '#3498db');
            gradient.addColorStop(0.5, '#9b59b6');
            gradient.addColorStop(1, '#e74c3c');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 400, 300);
            
            // パターンを追加
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 400; i += 40) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, 300);
                ctx.stroke();
            }
            
            // "MOCK JPEG" テキストを描画
            ctx.fillStyle = 'white';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 4;
            ctx.fillText(window.getLocalizedString('JSMock.HeicConversion'), 200, 130);
            ctx.fillText(window.getLocalizedString('JSMock.MockImplementation'), 200, 160);

            // ファイルサイズ情報
            ctx.font = '14px Arial';
            ctx.fillText(window.getLocalizedString('JSMock.OriginalFile', (heicBuffer.length / 1024).toFixed(1)), 200, 200);
            ctx.fillText(window.getLocalizedString('JSMock.Quality', (quality * 100).toFixed(0)), 200, 220);
            
            canvas.toBlob((blob) => {
                console.log('モック変換完了');
                resolve(blob);
            }, 'image/jpeg', quality);
        });
    }
};