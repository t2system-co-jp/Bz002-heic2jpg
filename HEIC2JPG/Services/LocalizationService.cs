using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Resources;
using Microsoft.JSInterop;

namespace HEIC2JPG.Services;

/// <summary>
/// アプリ全体で利用するローカライズサービス。
/// </summary>
public class LocalizationService : ILocalizationService
{
    private readonly IJSRuntime _jsRuntime;
    private readonly ResourceManager _resourceManager;
    private string _currentLanguage;
    private CultureInfo _currentCulture;
    private bool _isInitialized;

    private const string LocalStorageKey = "heic2jpg.lang";

    private static readonly List<LanguageInfo> _supportedLanguages = new()
    {
        new LanguageInfo { Code = "ja-JP", NativeName = "日本語", Icon = "🇯🇵" },
        new LanguageInfo { Code = "en-US", NativeName = "English", Icon = "🇺🇸" },
        new LanguageInfo { Code = "zh-CN", NativeName = "简体中文", Icon = "🇨🇳" },
    };

    public LocalizationService(IJSRuntime jsRuntime)
    {
        _jsRuntime = jsRuntime;
        _resourceManager = new ResourceManager("HEIC2JPG.Resources.Strings", typeof(LocalizationService).Assembly);
        _currentLanguage = "ja-JP";
        _currentCulture = new CultureInfo("ja-JP");
        ApplyCulture(_currentCulture);
    }

    public string CurrentLanguage => _currentLanguage;

    public IReadOnlyList<LanguageInfo> SupportedLanguages => _supportedLanguages.AsReadOnly();

    public event EventHandler? LanguageChanged;

    public async Task InitializeAsync()
    {
        if (_isInitialized)
        {
            return;
        }

        try
        {
            var savedLanguage = await _jsRuntime.InvokeAsync<string?>( "localStorage.getItem", LocalStorageKey);

            if (!string.IsNullOrEmpty(savedLanguage) && IsLanguageSupported(savedLanguage))
            {
                await SetLanguageInternalAsync(savedLanguage, persistPreference: false, raiseEvent: false);
            }
            else
            {
                var browserLanguages = await _jsRuntime.InvokeAsync<string[]>("commonUtils.getBrowserLanguages");

                if (browserLanguages is { Length: > 0 })
                {
                    var detected = DetectSupportedLanguage(browserLanguages);
                    await SetLanguageInternalAsync(detected, persistPreference: false, raiseEvent: false);
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Localization initialization fallback: {ex.Message}");
        }
        finally
        {
            _isInitialized = true;
        }
    }

    public async Task SetLanguageAsync(string languageCode)
    {
        await SetLanguageInternalAsync(languageCode, persistPreference: true, raiseEvent: true);
    }

    public string GetString(string key)
    {
        try
        {
            var value = _resourceManager.GetString(key, _currentCulture);
            if (value == null)
            {
                Console.WriteLine($"Missing resource key '{key}' for culture {_currentCulture.Name}");
                return $"[{key}]";
            }

            return value;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Localization error GetString({key}): {ex.Message}");
            return $"[{key}]";
        }
    }

    public string GetString(string key, params object[] args)
    {
        try
        {
            return string.Format(GetString(key), args);
        }
        catch (Exception)
        {
            return $"[{key}]";
        }
    }

    public Dictionary<string, string> GetJavaScriptStrings()
    {
        var result = new Dictionary<string, string>();

        try
        {
            var resourceSet = _resourceManager.GetResourceSet(_currentCulture, true, true);
            if (resourceSet != null)
            {
                foreach (System.Collections.DictionaryEntry entry in resourceSet)
                {
                    var key = entry.Key?.ToString();
                    if (key != null && (key.StartsWith("JSError.", StringComparison.Ordinal) ||
                                        key.StartsWith("JSMock.", StringComparison.Ordinal)))
                    {
                        result[key] = entry.Value?.ToString() ?? $"[{key}]";
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"GetJavaScriptStrings error: {ex.Message}");
        }

        return result;
    }

    private async Task SetLanguageInternalAsync(string languageCode, bool persistPreference, bool raiseEvent)
    {
        if (!IsLanguageSupported(languageCode))
        {
            throw new ArgumentException($"Unsupported language: {languageCode}", nameof(languageCode));
        }

        var oldLanguage = _currentLanguage;
        _currentLanguage = languageCode;
        _currentCulture = CreateCultureInfo(languageCode);
        ApplyCulture(_currentCulture);

        if (persistPreference)
        {
            try
            {
                await _jsRuntime.InvokeVoidAsync("localStorage.setItem", LocalStorageKey, languageCode);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to persist language '{languageCode}': {ex.Message}");
            }
        }

        if (raiseEvent && oldLanguage != languageCode)
        {
            LanguageChanged?.Invoke(this, EventArgs.Empty);
        }
    }

    private static void ApplyCulture(CultureInfo culture)
    {
        CultureInfo.CurrentCulture = culture;
        CultureInfo.CurrentUICulture = culture;
        CultureInfo.DefaultThreadCurrentCulture = culture;
        CultureInfo.DefaultThreadCurrentUICulture = culture;
    }

    private static bool IsLanguageSupported(string languageCode)
    {
        return _supportedLanguages.Any(lang =>
            lang.Code.Equals(languageCode, StringComparison.OrdinalIgnoreCase));
    }

    private static string DetectSupportedLanguage(string[] browserLanguages)
    {
        foreach (var browserLang in browserLanguages)
        {
            var exactMatch = _supportedLanguages.FirstOrDefault(lang =>
                lang.Code.Equals(browserLang, StringComparison.OrdinalIgnoreCase));
            if (exactMatch != null)
            {
                return exactMatch.Code;
            }

            var prefix = browserLang.Split('-')[0];
            var partialMatch = _supportedLanguages.FirstOrDefault(lang =>
                lang.Code.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));
            if (partialMatch != null)
            {
                return partialMatch.Code;
            }
        }

        return "ja-JP";
    }

    private static CultureInfo CreateCultureInfo(string languageCode)
    {
        try
        {
            return languageCode switch
            {
                "en-US" => new CultureInfo("en"),
                "zh-CN" => new CultureInfo("zh-Hans"),
                _ => new CultureInfo(languageCode),
            };
        }
        catch (CultureNotFoundException)
        {
            return new CultureInfo("ja-JP");
        }
    }
}
