// ファイル操作ヘルパー - commonUtils.js に統合済み
// 後方互換性のため、関数は commonUtils.js で定義されています
// このファイルは削除予定です

// ドラッグ&ドロップファイル処理
window.handleFileDrop = () => {
    console.log('File drop handled by JavaScript');
    // 実際のドロップ処理はBlazorのInputFileで行う
};

console.warn('fileHelper.js は非推奨です。commonUtils.js を使用してください。');