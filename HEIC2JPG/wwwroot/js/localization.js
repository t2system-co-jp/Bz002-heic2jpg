// JavaScript Localization Bridge
// C#のLocalizationServiceから受け取った辞書を管理し、JS側でローカライズ文字列を取得する

window.localizationStrings = {};

/**
 * C#から呼ばれて辞書を更新する
 * @param {Object} strings - キーと値のペアの辞書
 */
window.updateLocalizationStrings = function(strings) {
    window.localizationStrings = strings || {};
    console.log('Localization strings updated:', Object.keys(window.localizationStrings).length, 'keys');
};

/**
 * ローカライズされた文字列を取得
 * @param {string} key - リソースキー (例: "JSError.HeicNotInitialized")
 * @param {...any} args - string.formatパラメータ（{0}, {1}などを置換）
 * @returns {string} - ローカライズされた文字列
 */
window.getLocalizedString = function(key, ...args) {
    let result = window.localizationStrings[key] || `[${key}]`;

    // {0}, {1}などのプレースホルダーを置換
    args.forEach((arg, index) => {
        result = result.replace(`{${index}}`, arg);
    });

    return result;
};
