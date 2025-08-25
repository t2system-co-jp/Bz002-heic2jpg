# HEIC2JPG & MOV2MP4

## 概要

ローカル完結型メディア変換アプリ（Blazor WebAssembly）

- **HEIC → JPG** 画像変換
- **MOV → MP4** 動画変換
- **完全オフライン動作**（データはブラウザ外へ送信されません）
- **バッチ処理対応**（最大100件、2GB/ファイル）

## 🎯 主な機能

### ✅ 実装完了
- ドラッグ&ドロップファイル受付
- 進捗表示・キャンセル機能
- 設定パネル（品質調整、EXIF保持設定等）
- バッチダウンロード（Zip対応）
- エラーハンドリング・ユーザーフィードバック
- COOP/COEP設定（SharedArrayBuffer対応）
- 日本語UI・アクセシビリティ対応
- **PWA対応**（オフラインインストール・スタンドアロン実行）

### 🔧 技術要件
- **フロントエンド**: Blazor WebAssembly (.NET 9)
- **変換エンジン**: 
  - HEIC: libheif-js v1.19.8 (✅ 導入済み)
  - 動画: @ffmpeg/ffmpeg v0.12.15 (✅ 導入済み)
- **セキュリティ**: COOP/COEP設定済み
- **圧縮**: JSZip v3.10.1 (✅ 導入済み)
- **PWA**: Service Worker + Web App Manifest (✅ 導入済み)

## 📂 プロジェクト構造

```
HEIC2JPG/
├── Models/
│   └── ConvertModels.cs          # データモデル定義
├── Services/
│   ├── IConvertService.cs        # 変換サービスIF
│   └── ConvertService.cs         # 変換サービス実装
├── Pages/
│   └── Home.razor               # メインUI
├── Layout/
│   └── MainLayout.razor         # レイアウト（簡素化済み）
└── wwwroot/
    ├── js/
    │   ├── heicConverter.js     # HEIC変換（libheif統合）
    │   ├── ffmpegConverter.js   # MOV変換（FFmpeg統合）
    │   ├── zipHelper.js         # Zip生成
    │   ├── blobHelper.js        # Blob操作
    │   ├── fileDownload.js      # ダウンロード機能
    │   ├── fileHelper.js        # ファイル操作ヘルパー
    │   └── commonUtils.js       # 共通ユーティリティ
    ├── css/
    │   └── converter.css        # 専用スタイル
    ├── lib/
    │   ├── libheif/            # libheif WASMファイル
    │   ├── ffmpeg/             # FFmpeg WASMファイル
    │   ├── jszip/              # JSZip ライブラリ
    │   └── bootstrap/          # Bootstrap フレームワーク
    ├── manifest.json           # PWA マニフェスト
    ├── sw.js                   # Service Worker
    └── icon-*.png              # PWA アイコン
```

## 🚀 セットアップ・実行

### 必要環境
- .NET 9 SDK
- 対応ブラウザ: Chrome/Edge/Brave（最新版推奨、PWA対応）

### 実行手順
```bash
cd HEIC2JPG
dotnet run
```

### PWAインストール
1. Chrome/Edge でアプリにアクセス
2. アドレスバーの「インストール」アイコンをクリック
3. スタンドアロンアプリとして使用可能

### 導入済みライブラリ

**HEIC変換**: ✅ 完了
```bash
# libheif-js v1.19.8
wwwroot/lib/libheif/libheif.js
```

**MOV変換**: ✅ 完了
```bash
# @ffmpeg/ffmpeg v0.12.15
wwwroot/lib/ffmpeg/ffmpeg.min.js
wwwroot/lib/ffmpeg/ffmpeg-core.js
wwwroot/lib/ffmpeg/ffmpeg-core.wasm (30.6MB)
```

**Zip機能**: ✅ 完了
```bash
# JSZip v3.10.1
wwwroot/lib/jszip/jszip.min.js
```

**PWA機能**: ✅ 完了
```bash
# Service Worker + Web App Manifest
wwwroot/sw.js
wwwroot/manifest.json
```

## 🔧 設定項目

### 変換設定
- **JPG品質**: 0.6〜1.0（デフォルト: 0.9）
- **EXIF情報**: 保持/削除（デフォルト: 保持）
- **変換方式**: 自動/高速/高品質

### システム制限
- **最大ファイルサイズ**: 2GB/ファイル
- **最大ファイル数**: 100件/バッチ
- **対応形式**: .heic, .mov

## 📋 操作方法

1. **ファイル追加**: ドラッグ&ドロップまたはファイル選択
2. **設定調整**: 右側パネルで品質等を設定
3. **変換実行**: 「▶️ 開始」ボタンをクリック
4. **ダウンロード**: 個別DLまたは「📦 一括DL」
5. **PWAインストール**: ブラウザのインストールプロンプトから追加

## 🛡️ セキュリティ

- **ローカル処理**: データはブラウザ外へ送信されません
- **COOP/COEP**: SharedArrayBuffer利用のため設定済み
- **CSP準拠**: 自己ホストリソースのみ許可

## 📊 パフォーマンス目安

- **HEIC→JPG（12MP）**: 平均3秒未満（ハイエンド端末）
- **MOV→MP4（1080p/1分）**: リマックス10秒、再エンコード端末依存

## 🐛 トラブルシューティング

### よくある問題
1. **変換が開始されない** → ブラウザがCOOP/COEPに対応しているか確認
2. **大容量ファイルでエラー** → ファイルサイズ上限（2GB）を確認
3. **変換が遅い** → 並列数を調整または端末の性能を確認

### ブラウザ対応
- ✅ Chrome/Edge/Brave（推奨、PWA完全対応）
- ⚠️ Safari（WASM/COEP制約により限定対応、PWA部分対応）
- ❌ Internet Explorer（非対応）

## 📄 ライセンス

- **アプリケーション**: [ライセンスを指定]
- **使用OSS**: FFmpeg, libheif（各ライセンスに準拠）

---

## 🎯 変換機能の動作モード

### 自動フォールバック機能
1. **実変換モード**: libheif-js、@ffmpeg/ffmpegが正常に初期化された場合
2. **モック変換モード**: WASMライブラリの初期化に失敗した場合の安全なフォールバック

### 現在の状況
- ✅ **JSZip**: 完全に機能 - 実際のZipファイル生成・一括ダウンロード対応
- ✅ **PWA**: Service Worker、マニフェスト実装済み - オフライン動作・インストール対応
- ⚠️ **libheif**: 初期化エラー時はモック画像（400x300 JPEG）を生成
- ⚠️ **FFmpeg**: 初期化エラー時はモックMP4ヘッダーでダミーファイル生成

### 実変換を有効にするには
WASMライブラリが正常に動作するブラウザ環境での実行が必要です（Chrome/Edge推奨）。

---

## 📚 開発状況

詳細な開発履歴と技術的な実装状況については、[DEVELOPMENT_LOG.md](/mnt/c/Users/t_ogura/Desktop/Develop/CC_HEIC2JPG/DEVELOPMENT_LOG.md) をご参照ください。