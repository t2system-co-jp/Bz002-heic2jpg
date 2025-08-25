// Zip生成用JavaScript - commonUtils.js に統合済み
// このファイルは後方互換性のため残していますが、commonUtils.js の使用を推奨します

window.zipHelper = {
    isInitialized: false,
    
    async initialize() {
        if (this.isInitialized) return true;
        
        // commonUtils.js の機能を使用
        this.isInitialized = true;
        const isAvailable = window.commonUtils.isJSZipAvailable();
        
        if (isAvailable) {
            console.log('JSZip初期化完了 (commonUtils経由)');
            return true;
        } else {
            console.warn('JSZip未実装 - 個別ダウンロードのみ対応');
            return false;
        }
    },
    
    async createZipFromFiles(files) {
        // commonUtils.js に移行
        return await window.commonUtils.createZipFromFiles(files);
    },
    
    async downloadZip(zipBlob, fileName = 'converted_files.zip') {
        // commonUtils.js に移行
        return await window.commonUtils.downloadSingleFile(zipBlob, fileName);
    },
    
    async downloadFilesIndividually(files) {
        // commonUtils.js に移行
        return await window.commonUtils.downloadFilesIndividually(files);
    },
    
    async downloadSingleFile(data, fileName) {
        // commonUtils.js に移行
        return await window.commonUtils.downloadSingleFile(data, fileName);
    }
};

console.warn('zipHelper.js は非推奨です。commonUtils.js を直接使用してください。');