namespace HEIC2JPG.Services;

/// <summary>
/// 多言語対応サービスのインターフェース
/// </summary>
public interface ILocalizationService
{
    /// <summary>
    /// 現在の言語コード（例: "ja-JP", "en-US", "zh-CN"）
    /// </summary>
    string CurrentLanguage { get; }

    /// <summary>
    /// サポート言語一覧
    /// </summary>
    IReadOnlyList<LanguageInfo> SupportedLanguages { get; }

    /// <summary>
    /// 言語を設定（localStorage保存 + UI再描画）
    /// </summary>
    /// <param name="languageCode">言語コード（例: "ja-JP", "en-US", "zh-CN"）</param>
    Task SetLanguageAsync(string languageCode);

    /// <summary>
    /// リソースキーから文字列取得
    /// </summary>
    /// <param name="key">リソースキー</param>
    /// <returns>ローカライズされた文字列</returns>
    string GetString(string key);

    /// <summary>
    /// リソースキーから文字列取得（パラメータ付き）
    /// </summary>
    /// <param name="key">リソースキー</param>
    /// <param name="args">フォーマットパラメータ</param>
    /// <returns>ローカライズされた文字列</returns>
    string GetString(string key, params object[] args);

    /// <summary>
    /// JavaScript用のローカライズ辞書を取得
    /// </summary>
    /// <returns>キーと値のペアの辞書</returns>
    Dictionary<string, string> GetJavaScriptStrings();

    /// <summary>
    /// 言語変更イベント
    /// </summary>
    event EventHandler? LanguageChanged;
}

/// <summary>
/// 言語情報クラス
/// </summary>
public class LanguageInfo
{
    /// <summary>
    /// 言語コード（例: "ja-JP", "en-US", "zh-CN"）
    /// </summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>
    /// ネイティブ名称（例: "日本語", "English", "简体中文"）
    /// </summary>
    public string NativeName { get; set; } = string.Empty;

    /// <summary>
    /// アイコン（例: "🇯🇵", "🇺🇸", "🇨🇳"）
    /// </summary>
    public string Icon { get; set; } = string.Empty;
}
