# 共通パターン・コマンド集

このドキュメントは、開発中に頻繁に使用するコマンド、コードスニペット、定型パターンを記録します。

---

## 開発コマンド

### ビルド・実行

```bash
# プロジェクトディレクトリに移動
cd HEIC2JPG

# ビルド
dotnet build

# 実行（開発サーバー起動）
dotnet run

# ビルド + 実行（一括）
dotnet build && dotnet run

# シェルスクリプト使用（プロジェクトルートから）
./build.sh
```

### コード品質チェック

```bash
# コードフォーマット（LINT）
dotnet format

# 警告を含めて表示
dotnet format --verify-no-changes

# ビルド時の警告レベル設定
dotnet build /p:TreatWarningsAsErrors=true
```

### Git 操作

```bash
# ステータス確認
git status

# 変更をステージング
git add .

# コミット
git commit -m "コミットメッセージ"

# プッシュ
git push origin main

# ログ確認
git log --oneline -10

# 差分確認
git diff
```

---

## C# コードスニペット

### 1. JSRuntime 呼び出しパターン

#### 戻り値なし（void）

```csharp
await _jsRuntime.InvokeVoidAsync("moduleName.functionName", arg1, arg2);
```

#### 戻り値あり（型指定）

```csharp
var result = await _jsRuntime.InvokeAsync<bool>("moduleName.functionName", arg1);
var data = await _jsRuntime.InvokeAsync<byte[]>("moduleName.functionName", arg1);
var obj = await _jsRuntime.InvokeAsync<IJSObjectReference>("moduleName.functionName");
```

#### CancellationToken 付き

```csharp
var result = await _jsRuntime.InvokeAsync<bool>(
    "moduleName.functionName",
    cancellationToken,
    arg1,
    arg2
);
```

### 2. DotNetObjectReference パターン

```csharp
// クラス定義
public class MyService : IAsyncDisposable
{
    private readonly IJSRuntime _jsRuntime;
    private DotNetObjectReference<MyService>? _dotNetRef;

    public MyService(IJSRuntime jsRuntime)
    {
        _jsRuntime = jsRuntime;
    }

    public async Task InitializeAsync()
    {
        _dotNetRef = DotNetObjectReference.Create(this);
        await _jsRuntime.InvokeVoidAsync("jsModule.init", _dotNetRef);
    }

    [JSInvokable]
    public void OnCallback(string data)
    {
        // JavaScript から呼び出される
        Console.WriteLine($"Callback received: {data}");
    }

    public async ValueTask DisposeAsync()
    {
        _dotNetRef?.Dispose();
        await Task.CompletedTask;
    }
}
```

### 3. LocalizationService 利用パターン

```csharp
// Razor コンポーネント内
@inject ILocalizationService Localizer

<h1>@Localizer.GetString("App.Title")</h1>
<p>@Localizer.GetString("Message.Welcome", userName)</p>

// C# コード内
private string GetMessage()
{
    return _localizer.GetString("Error.NotFound");
}
```

### 4. イベントハンドラパターン

```csharp
// イベント定義
public event EventHandler<MyEventArgs>? MyEvent;

// イベント発火
MyEvent?.Invoke(this, new MyEventArgs { Data = "example" });

// イベント購読（コンポーネント内）
protected override void OnInitialized()
{
    MyService.MyEvent += OnMyEvent;
}

private void OnMyEvent(object? sender, MyEventArgs e)
{
    InvokeAsync(StateHasChanged);
}

public void Dispose()
{
    MyService.MyEvent -= OnMyEvent;
}
```

---

## JavaScript コードスニペット

### 1. モジュールパターン

```javascript
window.myModule = (function() {
    'use strict';

    // プライベート変数
    let privateVar = null;

    // プライベート関数
    function privateFunction() {
        console.log('Private function');
    }

    // 公開 API
    return {
        init: function(options) {
            privateVar = options;
            console.log('Module initialized');
        },

        publicFunction: function(arg) {
            privateFunction();
            return arg + 1;
        }
    };
})();
```

### 2. C# コールバック呼び出し

```javascript
// DotNetObjectReference を受け取る
let dotNetRef = null;

window.myModule = {
    init: function(dotnetRef) {
        dotNetRef = dotnetRef;
    },

    async callDotNet() {
        if (dotNetRef) {
            try {
                await dotNetRef.invokeMethodAsync('OnCallback', 'data');
            } catch (e) {
                console.error('Failed to call .NET:', e);
            }
        }
    }
};
```

### 3. Blob / ArrayBuffer 変換

```javascript
// Blob → ArrayBuffer
async function blobToArrayBuffer(blob) {
    return await blob.arrayBuffer();
}

// ArrayBuffer → Uint8Array
function arrayBufferToUint8Array(buffer) {
    return new Uint8Array(buffer);
}

// Uint8Array → Blob
function uint8ArrayToBlob(uint8Array, mimeType) {
    return new Blob([uint8Array], { type: mimeType });
}
```

### 4. localStorage 操作

```javascript
// 保存
localStorage.setItem('key', 'value');

// 取得
const value = localStorage.getItem('key');

// 削除
localStorage.removeItem('key');

// JSON 保存
localStorage.setItem('key', JSON.stringify({ foo: 'bar' }));

// JSON 取得
const obj = JSON.parse(localStorage.getItem('key'));
```

---

## Razor コンポーネントパターン

### 1. 基本コンポーネント構造

```razor
@page "/example"
@inject MyService Service
@implements IDisposable

<div class="example">
    <h1>@Title</h1>
    <button @onclick="HandleClick">Click</button>
</div>

@code {
    private string Title = "Example";

    protected override async Task OnInitializedAsync()
    {
        await Service.InitializeAsync();
        Service.SomeEvent += OnSomeEvent;
    }

    private async Task HandleClick()
    {
        await Service.DoSomethingAsync();
    }

    private void OnSomeEvent(object? sender, EventArgs e)
    {
        InvokeAsync(StateHasChanged);
    }

    public void Dispose()
    {
        Service.SomeEvent -= OnSomeEvent;
    }
}
```

### 2. パラメータ受け取り

```razor
@code {
    [Parameter]
    public string Title { get; set; } = string.Empty;

    [Parameter]
    public EventCallback<string> OnValueChanged { get; set; }

    private async Task NotifyParent(string value)
    {
        await OnValueChanged.InvokeAsync(value);
    }
}
```

### 3. 条件付きレンダリング

```razor
@if (isLoading)
{
    <p>Loading...</p>
}
else if (hasError)
{
    <p class="error">@errorMessage</p>
}
else
{
    <div class="content">@content</div>
}
```

### 4. リスト表示

```razor
@foreach (var item in items)
{
    <div class="item" key="@item.Id">
        <span>@item.Name</span>
    </div>
}
```

---

## リソースファイルパターン

### Strings.resx の構造

```xml
<?xml version="1.0" encoding="utf-8"?>
<root>
  <data name="App.Title" xml:space="preserve">
    <value>HEIC2JPG & MOV2MP4</value>
  </data>
  <data name="Button.Start" xml:space="preserve">
    <value>開始</value>
  </data>
  <data name="Error.NotFound" xml:space="preserve">
    <value>ファイルが見つかりません</value>
  </data>
  <data name="Message.Welcome" xml:space="preserve">
    <value>ようこそ、{0}さん</value>
    <comment>{0} = ユーザー名</comment>
  </data>
</root>
```

### リソースキーの命名規則

```
<カテゴリ>.<具体名>

例:
- App.Title
- App.Description
- Button.Start
- Button.Cancel
- Error.NotFound
- Error.NetworkError
- Message.Welcome
- ConversionMessage.Starting
- NetworkShield.Safe
- JSError.HeicNotInitialized
```

---

## Service Worker パターン

### キャッシュ戦略

```javascript
// sw.js
const CACHE_NAME = 'heic2jpg-v1';

// インストール時
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll([
                '/',
                '/index.html',
                '/css/app.css'
            ]))
    );
});

// フェッチ時
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});

// アクティベート時
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
```

---

## デバッグパターン

### ブラウザコンソールでの確認

```javascript
// libheif の初期化状態確認
console.log(window.heicConverter.isInitialized);

// FFmpeg の初期化状態確認
console.log(window.ffmpegConverter.isInitialized);

// Network Monitor のカウント確認
console.log(window.networkMonitor.getRequestCount());

// localStorage の確認
console.log(localStorage.getItem('heic2jpg.lang'));
```

### .NET ログ出力

```csharp
// コンソールログ
Console.WriteLine($"Debug: {value}");

// 条件付きログ
#if DEBUG
Console.WriteLine("Debug mode");
#endif
```

---

## ファイル構造パターン

### 新規サービス追加時のテンプレート

```
1. インターフェース定義: Services/IMyService.cs
2. 実装クラス: Services/MyService.cs
3. DI 登録: Program.cs に builder.Services.AddScoped<IMyService, MyService>();
4. Razor 注入: @inject IMyService MyService
```

### 新規 JavaScript モジュール追加時

```
1. ファイル作成: wwwroot/js/myModule.js
2. index.html に <script> 追加
3. C# から呼び出し: await _jsRuntime.InvokeAsync<T>("myModule.functionName");
```

---

## よく使う正規表現

### ファイル名検証

```csharp
// HEIC ファイル
var isHeic = Regex.IsMatch(fileName, @"\.(heic|HEIC)$");

// MOV ファイル
var isMov = Regex.IsMatch(fileName, @"\.(mov|MOV)$");

// 対応ファイル全般
var isSupported = Regex.IsMatch(fileName, @"\.(heic|mov|HEIC|MOV)$");
```

### リソースキーフィルタリング

```csharp
// JSError で始まるキーのみ抽出
if (key.StartsWith("JSError.", StringComparison.Ordinal))
{
    // 処理
}
```

---

## パフォーマンス計測パターン

```csharp
// 処理時間計測
var stopwatch = System.Diagnostics.Stopwatch.StartNew();

// 処理実行
await SomeOperationAsync();

stopwatch.Stop();
Console.WriteLine($"Elapsed: {stopwatch.ElapsedMilliseconds}ms");
```

```javascript
// JavaScript 側
console.time('operation');
await someOperation();
console.timeEnd('operation');
```

---

## エラーハンドリングパターン

```csharp
try
{
    await RiskyOperationAsync();
}
catch (JSException jsEx)
{
    // JavaScript 側のエラー
    var message = _localizer.GetString("Error.JavaScriptError", jsEx.Message);
    Console.WriteLine(message);
}
catch (OperationCanceledException)
{
    // キャンセル処理
    Console.WriteLine("Operation cancelled");
}
catch (Exception ex)
{
    // その他のエラー
    Console.WriteLine($"Unexpected error: {ex.Message}");
}
finally
{
    // クリーンアップ処理
}
```

---

## 参考リンク

- [Blazor チートシート](https://learn.microsoft.com/aspnet/core/blazor/)
- [JavaScript Interop ガイド](https://learn.microsoft.com/aspnet/core/blazor/javascript-interoperability/)
- [C# コーディング規約](https://learn.microsoft.com/dotnet/csharp/fundamentals/coding-style/coding-conventions)
