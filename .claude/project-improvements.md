# プロジェクト改善履歴

このドキュメントは、試行錯誤、改善履歴、学んだ教訓を記録します。

---

## 改善履歴

### 2025-11-10: WASM変換機能の動作検証完了

**背景**:
- libheif（HEIC→JPG）とFFmpeg（MOV→MP4）の実変換が正しく動作するか確認が必要だった

**検証内容**:
- **HEIC → JPG変換**: libheif-js による実変換が正常動作を確認
- **MOV → MP4変換**: FFmpeg.wasm による実変換が正常動作を確認

**成果**:
- モックフォールバックではなく、実際の変換エンジンが動作している
- HEIC画像とMOV動画の両方で本番環境での変換が可能

**確認事項**:
- CDNからのWASMファイルロードが正常
- 変換処理が期待通りの出力を生成
- エラーハンドリングが適切に機能

**次のステップ**:
- Phase C（品質チェック・最終調整）へ進む準備完了

---

### 2025-11-09: Network Shield 実装

**背景**:
- プライバシー保護を訴求する上で、「本当にローカル処理か」をユーザーが検証できる仕組みが必要
- オンライン変換サービスへの不信感を持つユーザーへの安心材料

**実装内容**:
- `NetworkMonitorService.cs`: ネットワークリクエストカウンタ
- `networkMonitor.js`: fetch/XHR/PerformanceObserver をフック
- `NetworkShield.razor`: 外部リクエスト数を常時表示するバッジ
- `TrustCenter.razor`: 検証方法を案内するダイアログ

**成果**:
- 「LOCAL ONLY | 0」表示でプライバシー保護を可視化
- ユーザー自身による検証が可能（開発者ツールでの確認手順を提供）

**学んだこと**:
- JavaScript のグローバルオブジェクト（fetch, XMLHttpRequest）をフックする技術
- DotNetObjectReference によるイベント駆動アーキテクチャの実装
- PerformanceObserver API の活用

**残課題**:
- WebSocket 監視は未実装（現状は不要だが、将来的に拡張時は対応必要）

---

### 2025-11-09: 多言語対応実装

**背景**:
- グローバル展開を見据えた機能拡張
- 日本語のみでは海外ユーザーが使えない

**実装内容**:
- .NET リソースファイル（Strings.resx, Strings.en.resx, Strings.zh-Hans.resx）
- `LocalizationService.cs`: 言語管理サービス
- `LanguageSelector.razor`: 言語切替メニュー
- JavaScript 側エラーメッセージの多言語対応

**成果**:
- 日本語・英語・中国語簡体字に対応
- ブラウザ言語の自動検出
- localStorage での言語設定永続化

**試行錯誤**:
1. **当初案**: i18next（JavaScript ライブラリ）を使用
   - 問題: C# 側との統合が困難、型安全性がない
   - 却下理由: .NET リソースファイルが .NET エコシステムに適合

2. **最終案**: .NET Resources + ResourceManager
   - メリット: ビルド時検証、型安全、C# 側で一元管理
   - デメリット: JavaScript 側は別途辞書を渡す必要あり

**学んだこと**:
- CultureInfo の適切な設定方法（`ja-JP` と `en` の違い）
- ブラウザ言語検出（`navigator.languages`）
- ResourceManager による動的リソース取得

**残課題**:
- リソースキーの命名規則を統一（現状は `App.*`, `Button.*` など）
- 翻訳品質の確認（特に中国語）

---

### 2025-08-25: CDN から取得に修正

**背景**:
- libheif, FFmpeg の WASM ファイルをプロジェクトに含めるとリポジトリサイズが肥大化
- 特に ffmpeg-core.wasm は 30MB と大容量

**実装内容**:
- CDN（unpkg.com, jsdelivr.net）から動的にロード
- `index.html` でスクリプトタグを追加
- ローカルファイルは削除

**成果**:
- リポジトリサイズを大幅削減（約 30MB → 数 KB）
- 初回ロード時のみ CDN から取得、以降はブラウザキャッシュ利用

**試行錯誤**:
1. **問題**: CORS エラーが発生
   - 原因: CDN の CORS ヘッダー設定が不十分
   - 解決: `crossorigin="anonymous"` 属性を追加

2. **問題**: WASM ファイルのパス解決失敗
   - 原因: libheif が相対パスで WASM を探す
   - 解決: `locateFile` オプションで絶対パスを指定

**学んだこと**:
- WASM ファイルの動的ロードとパス解決
- COOP/COEP ヘッダーと CDN の組み合わせ
- unpkg.com と jsdelivr.net の違い（jsdelivr.net が安定）

**残課題**:
- CDN 障害時のフォールバック（現状はモック変換で動作）
- オフライン完全動作のために Service Worker でキャッシュ

---

### 2025-08-25: build.sh の追加

**背景**:
- ビルドコマンドを毎回入力するのが面倒
- CI/CD 準備のためのスクリプト化

**実装内容**:
- `build.sh`: `dotnet build && dotnet run` を実行
- 実行権限付与（`chmod +x build.sh`）

**成果**:
- `./build.sh` で即座にビルド・実行可能

**学んだこと**:
- シェルスクリプトの基本
- Windows での Git Bash / WSL 実行

**残課題**:
- Windows ネイティブ環境向けに `build.bat` も用意

---

### 2025-08-25: 初回コミット

**背景**:
- Blazor WebAssembly プロジェクトの新規作成
- HEIC/MOV 変換機能の基本実装

**実装内容**:
- プロジェクト構造の構築
- 基本的な UI（ドラッグ&ドロップ、ファイルリスト）
- ConvertService の実装
- libheif, FFmpeg の統合（初期版）

**成果**:
- 動作する最小限のプロトタイプ完成

**試行錯誤**:
1. **WASM 初期化のタイミング**
   - 問題: 変換時に毎回初期化していた（非効率）
   - 解決: `isInitialized` フラグで初期化済みを判定

2. **FFmpeg のメモリリーク**
   - 問題: 変換後にメモリが解放されない
   - 解決: `ffmpeg.terminate()` で明示的に終了（後に削除）

3. **Blob と ArrayBuffer の扱い**
   - 問題: JavaScript と C# 間でバイナリデータ転送が不安定
   - 解決: `getBlobArrayBuffer` ヘルパー関数を実装

**学んだこと**:
- Blazor WebAssembly の基本構造
- JSInterop の基本パターン
- WASM ライブラリの統合方法

---

## 技術的な教訓

### 1. WASM 初期化のベストプラクティス

**教訓**: WASM ライブラリの初期化は重い処理なので、以下に注意
- 初期化は1回のみ（冪等性を担保）
- 初期化失敗時はフォールバック（アプリを停止させない）
- 並行初期化を防止（FFmpeg は特に重要）

**具体例**:
```javascript
let initializationPromise = null;

async initialize() {
    if (this.isInitialized) return true;
    if (initializationPromise) return await initializationPromise;

    initializationPromise = this._doInitialize();
    const result = await initializationPromise;
    initializationPromise = null;
    return result;
}
```

---

### 2. メモリ管理の重要性

**教訓**: ブラウザのメモリは有限。特に WASM と大容量ファイルを扱う際は注意

**ベストプラクティス**:
- 不要になったバイナリデータは即座に破棄
- `DotNetObjectReference` は必ず `Dispose()`
- 並行処理数を制限（FFmpeg は1並列）

**失敗例**:
- MOV 変換を並行3で実行 → メモリ不足でクラッシュ
- DotNetObjectReference を Dispose せずにページ遷移 → メモリリーク

---

### 3. エラーハンドリングの多層防御

**教訓**: エラーは各レイヤーで適切にキャッチし、ユーザーフレンドリーなメッセージに変換

**レイヤー別の責務**:
- **JavaScript**: 技術的エラーをログ出力、例外スロー
- **C# Service**: JSException を catch、ローカライズされたメッセージに変換
- **UI**: エラーメッセージを表示、リトライオプション提供

**反面教師**:
- 当初は JavaScript のエラーをそのままユーザーに表示
  - 「Aborted()」などの技術用語が表示され、ユーザーが混乱
  - 改善: `ConversionError.FfmpegError` リソースキーで多言語対応

---

### 4. プライバシー保護の可視化

**教訓**: 「ローカル処理」を訴求するなら、検証可能にすることが信頼性向上につながる

**実装した仕組み**:
- Network Shield バッジ（外部リクエスト数を常時表示）
- Trust Center（検証手順を案内）
- 開発者ツールでの確認方法を明記

**ユーザーフィードバック（想定）**:
- 「本当にローカル処理か？」という疑問に対し、目に見える形で回答

---

## 今後の改善候補

### 優先度：高

1. **WASM ライブラリの動作検証**
   - 現状: モックフォールバックで動作
   - 目標: libheif, FFmpeg の実変換を確認

2. **エラーハンドリングの強化**
   - ファイルサイズ超過時の事前チェック
   - 対応形式外のファイル検出

3. **パフォーマンス測定**
   - 実際の変換時間を測定
   - ボトルネック分析

### 優先度：中

4. **UI/UX 改善**
   - 変換中のプレビュー表示
   - ファイル並べ替え機能

5. **テストコード追加**
   - Service 層の単体テスト
   - JavaScript モジュールのテスト

### 優先度：低

6. **ダークモード対応**
   - CSS 変数でテーマ切替

7. **WebP / AVIF 対応**
   - 次世代フォーマットへの変換

---

## 参考資料

- [Blazor WebAssembly のベストプラクティス](https://learn.microsoft.com/aspnet/core/blazor/webassembly-best-practices)
- [WASM メモリ管理](https://developer.mozilla.org/en-US/docs/WebAssembly/Memory)
- [JavaScript Interop のパフォーマンス](https://learn.microsoft.com/aspnet/core/blazor/javascript-interoperability/call-javascript-from-dotnet#performance)
