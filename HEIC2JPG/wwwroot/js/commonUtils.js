// 共通ユーティリティ関数
// 重複コードを統合し、再利用可能な関数を提供

window.commonUtils = {
    // ========== Blob操作関連 ==========
    
    /**
     * BlobからArrayBufferを取得（Blazor互換形式）
     * @param {Blob} blob - 変換するBlob
     * @returns {Promise<Uint8Array>} - Uint8Array形式のデータ
     */
    async getBlobArrayBuffer(blob) {
        try {
            console.log('getBlobArrayBuffer呼び出し:', blob?.size, 'bytes');
            if (!blob || typeof blob.arrayBuffer !== 'function') {
                throw new Error('有効なBlobオブジェクトではありません');
            }
            
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            console.log('ArrayBuffer変換完了:', uint8Array.length, 'bytes');
            return uint8Array;
        } catch (error) {
            console.error('Blob→ArrayBuffer変換エラー:', error);
            throw new Error(`Blob変換エラー: ${error.message}`);
        }
    },

    /**
     * ArrayBufferからBlobを作成
     * @param {ArrayBuffer|Uint8Array} arrayBuffer - データ
     * @param {string} mimeType - MIMEタイプ
     * @returns {Blob} - 作成されたBlob
     */
    createBlobFromArray(arrayBuffer, mimeType) {
        return new Blob([arrayBuffer], { type: mimeType });
    },

    /**
     * Base64文字列からBlobを作成
     * @param {string} base64Data - Base64エンコードされたデータ
     * @param {string} mimeType - MIMEタイプ
     * @returns {Blob} - 作成されたBlob
     */
    createBlobFromBase64(base64Data, mimeType = 'application/octet-stream') {
        try {
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            
            const byteArray = new Uint8Array(byteNumbers);
            return new Blob([byteArray], { type: mimeType });
        } catch (error) {
            console.error('Base64→Blob変換エラー:', error);
            throw new Error(`Base64変換エラー: ${error.message}`);
        }
    },

    // ========== ファイルダウンロード関連 ==========
    
    /**
     * 単一ファイルのダウンロード（統合版）
     * @param {Blob|ArrayBuffer|string} data - ダウンロードするデータ
     * @param {string} fileName - ファイル名
     * @param {string} mimeType - MIMEタイプ（オプション）
     */
    async downloadSingleFile(data, fileName, mimeType = 'application/octet-stream') {
        try {
            let blob;
            
            // データタイプに応じてBlob作成
            if (data instanceof Blob) {
                blob = data;
            } else if (typeof data === 'string') {
                blob = this.createBlobFromBase64(data, mimeType);
            } else {
                blob = this.createBlobFromArray(data, mimeType);
            }
            
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
            
            console.log('ファイルダウンロード完了:', fileName);
        } catch (error) {
            console.error('ファイルダウンロードエラー:', error);
            throw new Error(`ダウンロードエラー: ${error.message}`);
        }
    },

    /**
     * 複数ファイルの個別ダウンロード
     * @param {Array} files - {data, fileName, mimeType}の配列
     * @param {number} interval - ダウンロード間隔（ミリ秒）
     */
    async downloadFilesIndividually(files, interval = 500) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.data && file.fileName) {
                await this.downloadSingleFile(file.data, file.fileName, file.mimeType);
                
                // 連続ダウンロードの間隔を開ける
                if (i < files.length - 1) {
                    await this.delay(interval);
                }
            }
        }
    },

    // ========== Zip操作関連 ==========
    
    /**
     * JSZipライブラリの初期化チェック
     * @returns {boolean} - JSZipが利用可能かどうか
     */
    isJSZipAvailable() {
        return typeof JSZip !== 'undefined';
    },

    /**
     * 複数ファイルからZipを作成
     * @param {Array} files - {data, fileName}の配列
     * @param {Object} options - 圧縮オプション
     * @returns {Promise<Blob>} - ZipのBlob
     */
    async createZipFromFiles(files, options = {}) {
        if (!this.isJSZipAvailable()) {
            throw new Error('JSZipライブラリが利用できません');
        }
        
        try {
            const zip = new JSZip();
            
            // ファイルをZipに追加
            files.forEach((file, index) => {
                if (file.data && file.fileName) {
                    zip.file(file.fileName, file.data);
                } else {
                    console.warn(`無効なファイルデータ (index: ${index}):`, file);
                }
            });
            
            // Zipを生成
            const zipBlob = await zip.generateAsync({ 
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: options.compressionLevel || 6 }
            });
            
            console.log('Zip生成完了:', zipBlob.size, 'bytes');
            return zipBlob;
        } catch (error) {
            console.error('Zip生成エラー:', error);
            throw new Error(`Zip生成エラー: ${error.message}`);
        }
    },

    /**
     * Zipファイルのダウンロード
     * @param {Array} files - ファイル配列
     * @param {string} zipFileName - Zipファイル名
     * @param {Object} options - オプション
     */
    async downloadFilesAsZip(files, zipFileName = null, options = {}) {
        try {
            if (this.isJSZipAvailable()) {
                // Zip生成・ダウンロード
                const zipBlob = await this.createZipFromFiles(files, options);
                const timestamp = new Date().toISOString().slice(0, 16).replace(/:/g, '-');
                const fileName = zipFileName || `converted_files_${timestamp}.zip`;
                
                await this.downloadSingleFile(zipBlob, fileName);
                console.log('Zip一括ダウンロード完了');
            } else {
                // JSZip未対応時は個別ダウンロード
                console.warn('JSZip未対応 - 個別ダウンロードを実行');
                await this.downloadFilesIndividually(files);
            }
        } catch (error) {
            console.error('Zipダウンロードエラー - 個別ダウンロードにフォールバック:', error);
            await this.downloadFilesIndividually(files);
        }
    },

    // ========== ユーティリティ関数 ==========
    
    /**
     * 指定時間だけ待機
     * @param {number} ms - 待機時間（ミリ秒）
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * エラーメッセージの統一フォーマット
     * @param {string} operation - 操作名
     * @param {Error} error - エラーオブジェクト
     * @returns {string} - フォーマットされたエラーメッセージ
     */
    formatError(operation, error) {
        const message = error?.message || '不明なエラー';
        return `${operation}エラー: ${message}`;
    },

    /**
     * ファイルサイズの人間可読フォーマット
     * @param {number} bytes - バイト数
     * @returns {string} - フォーマットされたサイズ
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    /**
     * ファイル入力トリガー（fileHelper.jsから移行）
     * @param {HTMLElement} element - input要素
     */
    triggerFileInput(element) {
        if (element) {
            element.click();
        }
    },

    // ========== ブラウザ情報取得 ==========

    /**
     * ブラウザの優先言語リストを取得
     * @returns {Array<string>} - 言語コードの配列
     */
    getBrowserLanguages() {
        try {
            if (navigator.languages && navigator.languages.length > 0) {
                return Array.from(navigator.languages);
            } else if (navigator.language) {
                return [navigator.language];
            } else if (navigator.userLanguage) {
                return [navigator.userLanguage];
            }
            return ['ja-JP']; // デフォルト
        } catch (error) {
            console.error('ブラウザ言語取得エラー:', error);
            return ['ja-JP'];
        }
    },

    // ========== UI操作関連 ==========

    /**
     * 要素へスクロール
     * @param {HTMLElement} element - スクロール先の要素
     * @param {Object} options - スクロールオプション
     */
    scrollToElement(element, options = {}) {
        if (!element) {
            console.warn('scrollToElement: 要素が見つかりません');
            return;
        }

        try {
            element.scrollIntoView({
                behavior: options.behavior || 'smooth',
                block: options.block || 'start',
                inline: options.inline || 'nearest'
            });
        } catch (error) {
            console.error('スクロールエラー:', error);
            // フォールバック: 古いブラウザ対応
            element.scrollIntoView();
        }
    }
};

// グローバル関数として後方互換性を維持
window.getBlobArrayBuffer = window.commonUtils.getBlobArrayBuffer.bind(window.commonUtils);
window.downloadBlob = window.commonUtils.downloadSingleFile.bind(window.commonUtils);
window.createBlobFromArray = window.commonUtils.createBlobFromArray.bind(window.commonUtils);
window.downloadFile = window.commonUtils.downloadSingleFile.bind(window.commonUtils);
window.downloadFilesAsZip = window.commonUtils.downloadFilesAsZip.bind(window.commonUtils);
window.triggerFileInput = window.commonUtils.triggerFileInput.bind(window.commonUtils);
window.scrollToElement = window.commonUtils.scrollToElement.bind(window.commonUtils);

console.log('commonUtils.js 読み込み完了');