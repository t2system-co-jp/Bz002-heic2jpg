# プロジェクトコンテキスト

## プロジェクト概要

### プロジェクト名
HEIC2JPG & MOV2MP4 Converter

### 目的
- HEIC（iPhone画像形式）をJPGに変換
- MOV（動画ファイル）をMP4に変換
- **完全ローカル処理**でプライバシーを保護
- ネットワーク送信一切なし（検証可能）

### ターゲットユーザー
- iPhoneユーザー（HEIC形式の写真を他デバイスで扱いたい）
- プライバシーを重視するユーザー（オンライン変換サービスを避けたい）
- オフライン環境で作業する必要があるユーザー

---

## 技術スタック

### フロントエンド
- **フレームワーク**: Blazor WebAssembly (.NET 9)
- **言語**: C# 12 / JavaScript ES6+
- **UIライブラリ**: Bootstrap 5

### 変換エンジン（WASM）
- **HEIC変換**: libheif-js v1.19.8
- **動画変換**: @ffmpeg/ffmpeg v0.12.15

### その他ライブラリ
- **Zip生成**: JSZip v3.10.1
- **PWA**: Service Worker + Web App Manifest

### 実行環境
- **推奨ブラウザ**: Chrome, Edge, Brave（最新版）
- **制約ブラウザ**: Safari（WASM/COEP制約により部分対応）
- **非対応**: Internet Explorer

---

## 制約事項

### 技術制約
1. **SharedArrayBuffer必須**: FFmpegがSharedArrayBufferに依存
   - COOP/COEP ヘッダー設定が必須
   - `Cross-Origin-Opener-Policy: same-origin`
   - `Cross-Origin-Embedder-Policy: require-corp`

2. **ファイルサイズ上限**:
   - 最大2GB/ファイル（ブラウザメモリ制約）
   - バッチ処理最大100件

3. **並行処理制限**:
   - MOV変換時は並行数1に制限（FFmpeg排他制御）
   - HEIC変換は並行可能（デフォルト2並列）

### セキュリティ制約
1. **CSP（Content Security Policy）**:
   - 自己ホストリソースのみ許可
   - インラインスクリプト禁止（nonce利用）

2. **外部リソース**:
   - CDNから取得（libheif, FFmpeg）
   - 一度ダウンロード後はキャッシュ利用

### パフォーマンス制約
- **HEIC変換**: 平均3秒/12MP（ハイエンド端末）
- **MOV変換**: リマックス10秒/1080p 1分、再エンコードは端末依存

---

## プライバシー・セキュリティ要件

### ローカル完結の保証
1. **ファイルデータ**: ブラウザメモリ内でのみ処理
2. **ネットワーク送信**: 一切なし（NetworkMonitorServiceで監視）
3. **検証可能**: Trust Centerで検証手順を公開

### プライバシー保護UI
1. **Network Shield バッジ**:
   - 外部リクエスト数を常時表示
   - 「LOCAL ONLY | 0」が正常状態

2. **Trust Center**:
   - 技術的裏付けを表示
   - ユーザー自身による検証方法を案内

3. **No Upload ラベル**:
   - ファイル入力UIに常時表示

---

## アーキテクチャ基本方針

### レイヤー構造
```
UI Layer (Blazor Razor Components)
  ↓
Service Layer (C# Services)
  ↓
JavaScript Interop Layer (JSRuntime)
  ↓
JavaScript Modules (変換エンジン統合)
  ↓
WASM Layer (libheif, FFmpeg)
```

### 責務分離
- **UI**: 表示・ユーザーインタラクションのみ
- **Service**: ビジネスロジック・進捗管理
- **JSInterop**: C#⇄JavaScript橋渡し
- **JS Modules**: WASM初期化・変換処理

### エラーハンドリング
- 各レイヤーで例外をキャッチ
- ユーザーフレンドリーなエラーメッセージに変換（多言語対応）
- フォールバック機能（WASM初期化失敗時はモック変換）

---

## 多言語対応

### サポート言語
- 日本語（ja-JP）: デフォルト
- 英語（en-US）: English
- 中国語簡体字（zh-CN）: 简体中文

### 実装方式
- **.NET リソースファイル**: Resources/Strings.*.resx
- **LocalizationService**: C#側でリソース管理
- **localStorage永続化**: 選択言語を保存
- **自動検出**: 初回起動時に `navigator.languages` から判定

---

## PWA対応

### 機能
- **オフラインインストール**: Service Worker対応
- **スタンドアロン実行**: manifest.json設定
- **オフライン動作**: 全リソースをキャッシュ

### インストール方法
1. Chrome/Edge でアプリにアクセス
2. アドレスバーの「インストール」アイコンをクリック
3. スタンドアロンアプリとして使用可能

---

## 開発環境

### 必要ツール
- .NET 9 SDK
- Visual Studio 2022 / VS Code + C# Extension
- Node.js（ライブラリ取得用、オプション）

### ビルド・実行
```bash
cd HEIC2JPG
dotnet build
dotnet run
```

### テスト
- 動作チェックは手動テスト（ユーザー側で実施）
- LINT: `dotnet format`

---

## 重要な注意事項

1. **実行スクリプト周囲の完全禁止**: データ損失防止のため、ファイル削除・移動スクリプトは作成しない
2. **承認フロー**: 実装前に差分表示 → 承認確認 → 実装開始
3. **品質基準**: LINT/test実行を実装後に必ず実施
4. **日本語での会話**: 常に日本語でコミュニケーション

---

## リンク

- README: [README.md](../README.md)
- 開発ログ: [DEVELOPMENT_LOG.md](../DEVELOPMENT_LOG.md)
- 設計知見: [project-knowledge.md](project-knowledge.md)
- 改善履歴: [project-improvements.md](project-improvements.md)
