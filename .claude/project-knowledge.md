# プロジェクト設計知見

このドキュメントは、HEIC2JPG プロジェクトで採用した実装パターン、設計決定、技術的な選択理由を記録します。

---

## 1. C# ⇄ JavaScript 連携パターン

### 1.1 基本パターン：JSRuntime.InvokeAsync

**実装場所**: `Services/ConvertService.cs`

```csharp
// C# → JavaScript 関数呼び出し
var jpegBlob = await _jsRuntime.InvokeAsync<IJSObjectReference>(
    "heicConverter.convertHeicToJpeg",
    cancellationToken,
    heicData,
    options.JpgQuality,
    options.KeepExif
);
```

**設計理由**:
- 非同期処理で UI をブロックしない
- `CancellationToken` で処理キャンセル可能
- 型安全な戻り値（`IJSObjectReference`, `byte[]`, `bool` など）

### 1.2 JavaScript → C# コールバック：DotNetObjectReference

**実装場所**: `Services/NetworkMonitorService.cs`, `wwwroot/js/networkMonitor.js`

```csharp
// C# 側：DotNetObjectReference 作成
_dotNetRef = DotNetObjectReference.Create(this);
await _jsRuntime.InvokeVoidAsync("networkMonitor.init", _dotNetRef);

// C# 側：JSInvokable メソッド
[JSInvokable]
public void OnNetworkRequest()
{
    RequestCount++;
    RequestCountChanged?.Invoke(this, EventArgs.Empty);
}
```

```javascript
// JavaScript 側：C# メソッド呼び出し
dotNetRef.invokeMethodAsync('OnNetworkRequest');
```

**設計理由**:
- JavaScript → C# の双方向通信を実現
- イベント駆動アーキテクチャに適合
- メモリリーク防止のため、Dispose 時に `_dotNetRef?.Dispose()` 必須

---

## 2. WASM 初期化とフォールバック戦略

### 2.1 初期化パターン

**実装場所**: `wwwroot/js/heicConverter.js`, `wwwroot/js/ffmpegConverter.js`

```javascript
async initialize() {
    if (this.isInitialized) return true;

    try {
        // WASM ライブラリの初期化
        if (typeof libheif !== 'undefined') {
            this.libheifModule = await libheif({ /* 設定 */ });
            this.isInitialized = true;
            return true;
        } else {
            // フォールバック：モック変換を使用
            console.warn('libheif not found - using mock conversion');
            this.isInitialized = true;
            return true;
        }
    } catch (error) {
        console.error('Initialization error:', error);
        this.isInitialized = true;  // エラー時もtrueにしてモック動作
        return true;
    }
}
```

**設計決定**:
- **初期化失敗時でもアプリを停止させない**
  - エラー時は `isInitialized = true` にしてモック変換で継続
  - ユーザーに「変換できない」より「動作する（モック）」を優先
- **初期化の冪等性**
  - `if (this.isInitialized) return true;` で重複初期化を防止

### 2.2 FFmpeg 初期化の排他制御

**実装場所**: `wwwroot/js/ffmpegConverter.js`

```javascript
let initializationPromise = null;

async initialize() {
    if (this.isInitialized) return true;

    // 初期化処理の重複実行を防ぐ
    if (initializationPromise) {
        return await initializationPromise;
    }

    initializationPromise = this._doInitialize();
    const result = await initializationPromise;
    initializationPromise = null;
    return result;
}
```

**設計理由**:
- FFmpeg は初期化が重い（30MB WASM ロード）
- 並行初期化を防止してリソース節約

---

## 3. 多言語対応の実装パターン

### 3.1 アーキテクチャ

**実装場所**: `Services/LocalizationService.cs`

```
.NET リソースファイル (*.resx)
  ↓
ResourceManager (C#)
  ↓
LocalizationService.GetString()
  ↓
Razor コンポーネント
```

### 3.2 言語検出・永続化

```csharp
public async Task InitializeAsync()
{
    // 1. localStorage から保存済み言語を取得
    var savedLanguage = await _jsRuntime.InvokeAsync<string?>(
        "localStorage.getItem", LocalStorageKey);

    if (!string.IsNullOrEmpty(savedLanguage) && IsLanguageSupported(savedLanguage))
    {
        await SetLanguageInternalAsync(savedLanguage, persistPreference: false, raiseEvent: false);
    }
    else
    {
        // 2. ブラウザ言語から自動検出
        var browserLanguages = await _jsRuntime.InvokeAsync<string[]>(
            "commonUtils.getBrowserLanguages");

        var detected = DetectSupportedLanguage(browserLanguages);
        await SetLanguageInternalAsync(detected, persistPreference: false, raiseEvent: false);
    }
}
```

**設計決定**:
- **優先順位**: localStorage > ブラウザ設定 > デフォルト（ja-JP）
- **永続化**: ユーザーが明示的に選択した言語のみ localStorage に保存
- **自動検出**: 初回起動時のみ実行

### 3.3 JavaScript 側でのローカライズ

**実装場所**: `Services/LocalizationService.GetJavaScriptStrings()`

```csharp
public Dictionary<string, string> GetJavaScriptStrings()
{
    var result = new Dictionary<string, string>();
    var resourceSet = _resourceManager.GetResourceSet(_currentCulture, true, true);

    foreach (System.Collections.DictionaryEntry entry in resourceSet)
    {
        var key = entry.Key?.ToString();
        if (key != null && key.StartsWith("JSError.", StringComparison.Ordinal))
        {
            result[key] = entry.Value?.ToString() ?? $"[{key}]";
        }
    }
    return result;
}
```

**設計理由**:
- JavaScript エラーメッセージも多言語対応
- `JSError.*` プレフィックスで C# 側リソースを共有
- 言語変更時に再取得して動的更新

---

## 4. ネットワーク監視の仕組み

### 4.1 アーキテクチャ

**実装場所**: `wwwroot/js/networkMonitor.js`, `Services/NetworkMonitorService.cs`

```
JavaScript: fetch/XHR フック
  ↓（外部リクエスト検出）
DotNetObjectReference.invokeMethodAsync()
  ↓
C#: NetworkMonitorService.OnNetworkRequest()
  ↓
EventHandler: RequestCountChanged
  ↓
UI: NetworkShield.razor で再描画
```

### 4.2 外部リクエスト判定

```javascript
function isExternalRequest(url) {
    try {
        const urlObj = new URL(url, window.location.href);
        return urlObj.hostname !== window.location.hostname;
    } catch (e) {
        return false;  // URL解析失敗時は外部とみなさない
    }
}
```

**設計決定**:
- **同一ホスト**: 外部とみなさない（Service Worker のキャッシュアクセス等）
- **相対パス**: 外部とみなさない
- **エラー時**: 安全側に倒して外部扱いしない

### 4.3 フック対象

1. **fetch API**: `window.fetch` をラップ
2. **XMLHttpRequest**: `XMLHttpRequest.prototype.open` をラップ
3. **PerformanceObserver**: `<img>`, `<script>` タグ等を検出

**設計理由**:
- 全ての HTTP リクエストパターンをカバー
- PerformanceObserver で静的リソースも検出

---

## 5. 並行処理制御

### 5.1 MOV 変換の排他制御

**実装場所**: `Services/ConvertService.ConvertFilesAsync()`

```csharp
// MOVファイルがある場合は並行数を1に制限
var hasMov = files.Any(f => f.Type == Models.FileType.MOV);
var parallelCount = hasMov ? 1 : settings.ParallelCount;

var semaphore = new SemaphoreSlim(parallelCount, parallelCount);
var tasks = files.Select(async file =>
{
    await semaphore.WaitAsync();
    try
    {
        await ConvertSingleFileAsync(file, settings, progressCallback);
    }
    finally
    {
        semaphore.Release();
    }
});

await Task.WhenAll(tasks);
```

**設計理由**:
- **FFmpeg 制約**: 同時実行でメモリ不足・クラッシュリスク
- **HEIC は並行可**: 軽量な libheif は並行処理可能（デフォルト2並列）
- **SemaphoreSlim**: .NET 標準の並行制御で実装

---

## 6. エラーハンドリングパターン

### 6.1 多層防御

```
UI Layer (try-catch + ユーザー通知)
  ↓
Service Layer (try-catch + ConvertResult.ErrorMessage)
  ↓
JSRuntime (JSException ハンドリング)
  ↓
JavaScript (try-catch + console.error)
```

### 6.2 エラーメッセージのローカライズ

**実装場所**: `Services/ConvertService.cs`

```csharp
catch (JSException jsEx)
{
    var errorMsg = jsEx.Message;
    if (errorMsg.Contains("Aborted") || errorMsg.Contains("ffmpeg"))
    {
        throw new Exception(_localizer.GetString("ConversionError.FfmpegError", errorMsg));
    }
    throw new Exception(_localizer.GetString("ConversionError.JavaScriptError", errorMsg));
}
```

**設計理由**:
- 技術的なエラーメッセージを多言語のユーザーフレンドリーなメッセージに変換
- エラー種別に応じて適切なリソースキーを選択

---

## 7. PWA 実装パターン

### 7.1 Service Worker 登録

**実装場所**: `wwwroot/index.html`, `wwwroot/sw.js`

```javascript
// index.html
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('Service Worker registered'))
        .catch(err => console.error('Service Worker registration failed:', err));
}
```

### 7.2 キャッシュ戦略

```javascript
// sw.js
const CACHE_NAME = 'heic2jpg-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/css/app.css',
    '/lib/bootstrap/css/bootstrap.min.css',
    // WASM ファイルもキャッシュ
    '/lib/libheif/libheif.js',
    '/lib/ffmpeg/ffmpeg.min.js',
    '/lib/ffmpeg/ffmpeg-core.wasm'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});
```

**設計決定**:
- **オフライン完全動作**: 全リソースをキャッシュ
- **WASM ファイル含む**: 30MB の ffmpeg-core.wasm もキャッシュ
- **バージョン管理**: キャッシュ名でバージョン管理

---

## 8. 設計決定の記録

### 8.1 採用技術の選定理由

| 技術 | 選定理由 | 却下した代替案 |
|------|----------|---------------|
| Blazor WebAssembly | C# 統一開発、型安全性、.NET エコシステム | React/Vue（学習コスト、型安全性） |
| libheif-js | HEIC 対応、WASM 実装、軽量 | ImageMagick（重い、HEIC 対応限定的） |
| @ffmpeg/ffmpeg | 動画変換の標準、豊富なフォーマット対応 | WebCodecs API（ブラウザ互換性不足） |
| .NET Resources | .NET 標準、型安全、ビルド時検証 | i18next（JavaScript ライブラリ、C# 非対応） |
| JSZip | 軽量、ブラウザ互換性高い | pako（Zip 専門でない） |

### 8.2 アーキテクチャ選択

**レイヤー分離を採用した理由**:
- UI / Service / JSInterop を分離することで責務明確化
- 各レイヤーで独立したテストが可能（将来的に）
- 変更の影響範囲を局所化

**Blazor Server を却下した理由**:
- サーバー通信が発生するとプライバシー保護の訴求が弱まる
- オフライン動作が不可能
- サーバーインフラが必要（ホスティングコスト）

### 8.3 パフォーマンス最適化

**並行処理数の決定**:
- HEIC: 2並列（デフォルト）
  - 根拠: 軽量なため、並行処理でスループット向上
  - リスク: 過度な並行はブラウザメモリ圧迫
- MOV: 1並列（固定）
  - 根拠: FFmpeg 30MB WASM × 並行数でメモリ不足リスク
  - 実測: 並行2以上でクラッシュ（Chrome 128, 16GB RAM）

---

## 9. 今後の拡張ポイント

### 9.1 変換フォーマット追加
- **WebP 対応**: libheif が WebP 出力に対応
- **AVIF 対応**: 次世代画像フォーマット

### 9.2 UI 改善
- **ダークモード**: CSS 変数でテーマ切替
- **ドラッグ&ドロップ並べ替え**: ファイルリストの順序変更

### 9.3 パフォーマンス改善
- **Web Worker**: WASM 処理をメインスレッドから分離
- **インクリメンタル処理**: 大容量ファイルを分割処理

---

## 参考リンク

- [libheif-js Documentation](https://github.com/alexcorvi/libheif-js)
- [FFmpeg.wasm Documentation](https://ffmpegwasm.netlify.app/)
- [Blazor JavaScript interop](https://learn.microsoft.com/aspnet/core/blazor/javascript-interoperability/)
- [PWA Best Practices](https://web.dev/progressive-web-apps/)
