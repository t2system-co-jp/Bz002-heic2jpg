# 開発ログ

このドキュメントは、HEIC2JPG & MOV2MP4 Converter の詳細な開発履歴と技術的な実装状況を記録します。

---

## 開発タイムライン

### 2025-11-09: Network Shield 実装

**コミット**: `6b360f4 NetworkShield実装`

**実装内容**:

#### 1. NetworkMonitorService の実装
- **ファイル**: `HEIC2JPG/Services/NetworkMonitorService.cs`
- **機能**:
  - JavaScript からの外部リクエスト検出
  - リクエストカウンタの管理
  - イベント駆動でのUI更新

#### 2. networkMonitor.js の実装
- **ファイル**: `HEIC2JPG/wwwroot/js/networkMonitor.js`
- **機能**:
  - `fetch` API のフック
  - `XMLHttpRequest` のフック
  - `PerformanceObserver` による静的リソース監視
  - 外部ドメイン判定ロジック

#### 3. UI コンポーネント
- **NetworkShield.razor**:
  - 外部リクエスト数のリアルタイム表示
  - 「LOCAL ONLY | 0」バッジ
  - Trust Center ダイアログのトリガー

- **TrustCenter.razor**:
  - プライバシー保護の技術的裏付け表示
  - 検証手順の案内
  - 開発者ツールでの確認方法

**技術的な決定**:
- `DotNetObjectReference` による双方向通信
- イベントハンドラによるリアルタイムUI更新
- メモリリーク防止のための適切な Dispose 実装

**成果**:
- ユーザーが「本当にローカル処理か」を検証可能に
- プライバシー保護の可視化によるユーザー信頼性向上

---

### 2025-11-09: 多言語対応実装

**コミット**: `ce6235a 多言語対応`

**実装内容**:

#### 1. リソースファイルの作成
- `HEIC2JPG/Resources/Strings.resx`（日本語）
- `HEIC2JPG/Resources/Strings.en.resx`（英語）
- `HEIC2JPG/Resources/Strings.zh-Hans.resx`（中国語簡体字）

**リソースキー数**: 約100個（UI全体をカバー）

#### 2. LocalizationService の実装
- **ファイル**: `HEIC2JPG/Services/LocalizationService.cs`
- **機能**:
  - ResourceManager による多言語リソース管理
  - ブラウザ言語の自動検出
  - localStorage での言語設定永続化
  - JavaScript 側へのリソース提供（`GetJavaScriptStrings()`）

#### 3. UI コンポーネント
- **LanguageSelector.razor**: 言語切替ドロップダウンメニュー
- **MainLayout.razor**: 言語セレクタの配置
- **Home.razor 他**: 全てのテキストをローカライズ

#### 4. 初期化処理
- **Program.cs**: アプリ起動時に `LocalizationService.InitializeAsync()` を実行

**技術的な決定**:
- .NET Resources を採用（i18next を却下）
  - 理由: C# との統合性、型安全性、ビルド時検証
- `CultureInfo` の適切な設定
  - `ja-JP` → `CultureInfo("ja-JP")`
  - `en-US` → `CultureInfo("en")`
  - `zh-CN` → `CultureInfo("zh-Hans")`

**成果**:
- 3言語対応（日本語・英語・中国語簡体字）
- ブラウザ言語の自動検出
- 言語変更時のリアルタイムUI更新

---

### 2025-08-25: CDN から取得に修正

**コミット**: `7d171b0 CDNから取得に修正`

**実装内容**:

#### 1. WASM ライブラリの CDN 化
- **変更前**: ローカルファイルとして `wwwroot/lib/` に配置
- **変更後**: CDN（jsdelivr.net）から動的ロード

**変更ファイル**:
- `HEIC2JPG/wwwroot/index.html`:
  ```html
  <script src="https://cdn.jsdelivr.net/npm/libheif-js@1.19.8/libheif.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/umd/ffmpeg.min.js"></script>
  ```

#### 2. CORS 対応
- `crossorigin="anonymous"` 属性を追加
- WASM ファイルのパス解決を修正

#### 3. パス解決の修正
- **heicConverter.js**:
  ```javascript
  locateFile: (path, prefix) => {
      if (path.endsWith('.wasm')) {
          return '/lib/libheif/' + path;
      }
      return prefix + path;
  }
  ```

**成果**:
- リポジトリサイズを約30MB削減
- 初回ロード時のみ CDN から取得、以降はブラウザキャッシュ利用

**課題**:
- CDN 障害時のフォールバック（現状はモック変換で動作）

---

### 2025-08-25: build.sh の追加

**コミット**: `db15bd9 build.shの追加`

**実装内容**:

#### 1. ビルドスクリプト作成
- **ファイル**: `build.sh`
- **内容**:
  ```bash
  #!/bin/bash
  cd HEIC2JPG
  dotnet build && dotnet run
  ```

#### 2. 実行権限付与
```bash
chmod +x build.sh
```

**成果**:
- `./build.sh` で即座にビルド・実行可能
- CI/CD 準備の基盤

**課題**:
- Windows ネイティブ環境向けに `build.bat` も必要（今後の課題）

---

### 2025-08-25: 初回コミット

**コミット**: `51ca8fc first commit`

**実装内容**:

#### 1. プロジェクト構造の構築

```
HEIC2JPG/
├── Models/
│   └── ConvertModels.cs          # データモデル定義
├── Services/
│   ├── IConvertService.cs        # 変換サービスIF
│   └── ConvertService.cs         # 変換サービス実装
├── Pages/
│   └── Home.razor                # メインUI
├── Layout/
│   └── MainLayout.razor          # レイアウト
└── wwwroot/
    ├── js/
    │   ├── heicConverter.js      # HEIC変換
    │   ├── ffmpegConverter.js    # MOV変換
    │   ├── zipHelper.js          # Zip生成
    │   └── blobHelper.js         # Blob操作
    └── css/
        └── converter.css         # 専用スタイル
```

#### 2. 基本機能の実装

**UI機能**:
- ドラッグ&ドロップによるファイル受付
- ファイルキュー表示
- 進捗バー
- 変換ボタン
- 個別/一括ダウンロード

**変換機能**:
- HEIC → JPG 変換（libheif-js 統合）
- MOV → MP4 変換（FFmpeg.wasm 統合）
- 品質設定（0.6〜1.0）
- EXIF 情報保持/削除

**バッチ処理**:
- 並行処理対応（SemaphoreSlim 使用）
- 進捗管理
- エラーハンドリング

#### 3. JavaScript 統合

**heicConverter.js**:
- libheif WASM の初期化
- HEIC → JPEG 変換処理
- モックフォールバック

**ffmpegConverter.js**:
- FFmpeg WASM の初期化
- MOV → MP4 変換処理
- 排他制御（初期化の重複防止）

**zipHelper.js**:
- JSZip による Zip ファイル生成
- 一括ダウンロード機能

#### 4. データモデル

**ConvertFile**:
- ファイルメタデータ管理
- 変換ステータス管理
- 進捗管理

**ConvertOptions**:
- 品質設定
- EXIF保持設定
- 変換モード

**成果**:
- 動作する最小限のプロトタイプ完成
- HEIC/MOV 変換の基本機能実装

---

## 技術スタック

### フロントエンド
- **Blazor WebAssembly**: .NET 9
- **C#**: 12
- **Bootstrap**: 5

### 変換エンジン
- **libheif-js**: v1.19.8（HEIC変換）
- **@ffmpeg/ffmpeg**: v0.12.15（MOV変換）

### その他ライブラリ
- **JSZip**: v3.10.1（Zip生成）

### PWA
- **Service Worker**: オフライン対応
- **Web App Manifest**: スタンドアロンアプリ化

---

## アーキテクチャ

### レイヤー構造

```
┌─────────────────────────────────┐
│  UI Layer (Blazor Components)   │
│  - Home.razor                   │
│  - NetworkShield.razor          │
│  - LanguageSelector.razor       │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│  Service Layer (C#)             │
│  - ConvertService               │
│  - LocalizationService          │
│  - NetworkMonitorService        │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│  JSInterop Layer                │
│  - IJSRuntime                   │
│  - DotNetObjectReference        │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│  JavaScript Modules             │
│  - heicConverter.js             │
│  - ffmpegConverter.js           │
│  - networkMonitor.js            │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│  WASM Layer                     │
│  - libheif WASM                 │
│  - FFmpeg WASM                  │
└─────────────────────────────────┘
```

---

## パフォーマンス

### 変換速度（目安）

**HEIC → JPG**:
- 12MP（4032×3024）: 平均3秒未満（ハイエンド端末）
- 並行処理: 2並列（デフォルト）

**MOV → MP4**:
- 1080p 1分: リマックス約10秒
- 再エンコード: 端末性能に依存
- 並行処理: 1並列（固定）

### メモリ使用量

- **HEIC変換**: 約100MB/ファイル
- **MOV変換**: 約300MB/ファイル（FFmpeg WASM含む）
- **上限**: 2GB/ファイル（ブラウザ制約）

---

## セキュリティ

### ローカル完結の保証

1. **ファイルデータ**: ブラウザメモリ内でのみ処理
2. **ネットワーク送信**: 一切なし（NetworkMonitorServiceで監視）
3. **検証可能**: Trust Centerで検証手順を公開

### COOP/COEP 設定

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**理由**: SharedArrayBuffer 利用のため必須

---

## 今後の開発予定

### Phase B: WASM 変換機能の動作検証・修正
- libheif 実変換の動作確認
- FFmpeg 実変換の動作確認
- エラー時のフォールバック動作確認

### Phase C: 品質チェック・最終調整
- LINT実行（dotnet format）
- ビルド検証（dotnet build）
- ブラウザでの動作確認

### 今後の拡張候補
- WebP / AVIF 対応
- ダークモード
- ドラッグ&ドロップ並べ替え
- Web Worker による処理分離

---

## 参考資料

- [Blazor WebAssembly 公式ドキュメント](https://learn.microsoft.com/aspnet/core/blazor/)
- [libheif-js GitHub](https://github.com/alexcorvi/libheif-js)
- [FFmpeg.wasm 公式サイト](https://ffmpegwasm.netlify.app/)
- [JSZip 公式ドキュメント](https://stuk.github.io/jszip/)
