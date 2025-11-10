# デバッグログ

このドキュメントは、再発可能性の高いバグや、解決に時間を要した問題の詳細ログを記録します。

**記録基準**: 解決に30分以上費やした問題は必ず記録

---

## ログフォーマット

各バグエントリは以下の形式で記録します：

```markdown
### [YYYY-MM-DD] バグのタイトル

**症状**:
- 何が起きたか

**再現手順**:
1. ステップ1
2. ステップ2
3. ...

**環境**:
- OS: Windows 11 / macOS / Linux
- ブラウザ: Chrome 128 / Edge / Safari
- .NET SDK: 9.0.x

**原因**:
- 根本原因の説明

**解決方法**:
- 実施した修正内容

**予防策**:
- 再発防止のために実施した対策

**参考リンク**:
- 関連するドキュメント、Stack Overflow など
```

---

## バグログ

### [2025-11-10] （テンプレート）WASM初期化失敗時のフォールバック

**症状**:
- libheif / FFmpeg の初期化に失敗した場合、アプリがクラッシュする

**再現手順**:
1. WASM ファイルが読み込めない環境（CDN障害など）でアクセス
2. 変換ボタンをクリック
3. JavaScript エラーが発生し、アプリが停止

**環境**:
- OS: Windows 11
- ブラウザ: Chrome 128
- .NET SDK: 9.0.0

**原因**:
- WASM ライブラリの初期化失敗時に例外がスローされるが、適切にハンドリングされていない

**解決方法**:
- 初期化失敗時はモック変換にフォールバック
- `isInitialized = true` にして続行（ダミーデータを生成）

**予防策**:
- 全ての WASM 初期化に try-catch を追加
- フォールバック動作のテストケース追加

**参考リンク**:
- [FFmpeg.wasm Troubleshooting](https://ffmpegwasm.netlify.app/docs/troubleshooting)

---

### [今後のバグはここに追記]

---

## よくある問題と解決方法（FAQ）

### 1. SharedArrayBuffer is not defined

**症状**: FFmpeg 初期化時に `SharedArrayBuffer is not defined` エラー

**原因**: COOP/COEP ヘッダーが設定されていない

**解決方法**:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```
を設定（Blazor の場合は `Program.cs` または Nginx/IIS 設定）

---

### 2. CORS エラーでライブラリが読み込めない

**症状**: CDN からの libheif / FFmpeg ロード時に CORS エラー

**原因**: `<script>` タグに `crossorigin` 属性がない

**解決方法**:
```html
<script src="https://cdn.jsdelivr.net/..." crossorigin="anonymous"></script>
```

---

### 3. メモリ不足でブラウザがクラッシュ

**症状**: 大容量ファイルや並行処理時にブラウザがクラッシュ

**原因**: WASM × 並行数でメモリ使用量が急増

**解決方法**:
- MOV 変換は並行数を1に制限
- ファイルサイズ上限を2GBに設定
- 処理後は不要なバイナリデータを即座に破棄

---

### 4. DotNetObjectReference のメモリリーク

**症状**: 長時間使用後にメモリ使用量が増加し続ける

**原因**: `DotNetObjectReference.Dispose()` が呼ばれていない

**解決方法**:
```csharp
public async ValueTask DisposeAsync()
{
    _dotNetRef?.Dispose();  // 必ず呼び出す
    await Task.CompletedTask;
}
```

コンポーネントで `@implements IDisposable` または `IAsyncDisposable` を実装

---

### 5. ローカライズが反映されない

**症状**: 言語を切り替えても UI が日本語のまま

**原因**: `StateHasChanged()` が呼ばれていない

**解決方法**:
```csharp
private void OnLanguageChanged(object? sender, EventArgs e)
{
    InvokeAsync(StateHasChanged);  // UI を再描画
}
```

---

## デバッグツール・テクニック

### ブラウザ開発者ツール

```javascript
// Console タブでの確認
console.log(window.heicConverter.isInitialized);
console.log(window.ffmpegConverter.isInitialized);
console.log(window.networkMonitor.getRequestCount());

// Network タブ
// - 外部リクエストの監視
// - WASM ファイルのロード状態確認

// Application タブ → Local Storage
// - heic2jpg.lang の確認

// Performance タブ
// - メモリ使用量の監視
// - パフォーマンスボトルネックの特定
```

### .NET デバッグ

```bash
# デバッグモードでビルド
dotnet build --configuration Debug

# ログレベル設定
dotnet run --configuration Debug --verbosity detailed
```

```csharp
// ブレークポイント用コメント
// TODO: デバッグ時に確認
Console.WriteLine($"Debug: value={value}");
```

---

## セッション別ログの保存先

詳細なデバッグセッションログは `.claude/debug/` ディレクトリに保存します。

```
.claude/debug/
├── 2025-11-10_wasm-initialization.md
├── 2025-11-15_memory-leak-investigation.md
└── archive/
    └── 2025-10_old-sessions.md
```

**ファイル命名規則**: `YYYY-MM-DD_issue-name.md`

---

## 参考リンク

- [Blazor トラブルシューティング](https://learn.microsoft.com/aspnet/core/blazor/fundamentals/troubleshoot)
- [JavaScript Interop デバッグ](https://learn.microsoft.com/aspnet/core/blazor/javascript-interoperability/call-javascript-from-dotnet#troubleshooting)
- [WASM メモリデバッグ](https://developer.mozilla.org/en-US/docs/WebAssembly/Memory)
