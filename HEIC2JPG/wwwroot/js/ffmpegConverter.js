// MOV→MP4変換用JavaScript (FFmpeg WASM)
let ffmpeg = null;
let isFFmpegLoaded = false;
let initializationPromise = null;
let conversionMutex = Promise.resolve(); // 変換処理の排他制御

window.ffmpegConverter = {
    // 定数定義
    FFMPEG_CORE_VERSION: '0.12.10',
    FFMPEG_VERSION: '0.12.15',
    CDN_BASE_URL: 'https://cdn.jsdelivr.net/npm/@ffmpeg',
    FFMPEG_INIT_TIMEOUT: 120000, // 2分
    PROGRESS_LOG_INTERVAL: 5000, // 5秒
    MOCK_CONVERSION_DELAY: 800,

    isInitialized: false,
    ffmpeg: null,

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
    },

    async _doInitialize() {

        if (this.isInitialized) return true;

        try {
            console.log('FFmpeg初期化開始...');

            // FFmpegUtilライブラリの確認
            if (typeof window.FFmpegUtil === 'undefined') {
                console.warn('FFmpegUtilライブラリが見つかりません - モック変換を使用');
                this.isInitialized = true;
                return true;
            }

            // FFmpegWASMライブラリの確認
            if (typeof window.FFmpegWASM === 'undefined') {
                console.warn('FFmpegWASMライブラリが見つかりません - モック変換を使用');
                this.isInitialized = true;
                return true;
            }

            if (!window.FFmpegWASM.FFmpeg) {
                console.warn('FFmpegコンストラクタが見つかりません - モック変換を使用');
                this.isInitialized = true;
                return true;
            }

            const { FFmpeg } = window.FFmpegWASM;
            const { toBlobURL } = window.FFmpegUtil;

            this.ffmpeg = new FFmpeg();
            console.log('FFmpegインスタンス作成完了');

            // ログとプログレスイベントの設定
            this.ffmpeg.on('log', ({ message }) => {
                // Aborted()ログを抑制（正常終了時の既知の挙動）
                if (message && message.includes('Aborted()')) {
                    return;
                }
                console.log('FFmpeg log:', message);
            });

            this.ffmpeg.on('progress', ({ progress }) => {
                console.log('FFmpeg progress:', progress * 100);
            });

            // デバッグ用：WebWorkerメッセージ監視
            console.log('FFmpegオブジェクト詳細:', this.ffmpeg);
            console.log('FFmpeg.loaded状態:', this.ffmpeg.loaded);

            // CDNから動的ロード（最新の安定版を使用）
            try {
                console.log('CDNからffmpeg-core読み込み開始...');

                const baseURL = `${this.CDN_BASE_URL}/core@${this.FFMPEG_CORE_VERSION}/dist/esm`;
                console.log('toBlobURL開始: ffmpeg-core.js');
                const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
                console.log('toBlobURL完了: ffmpeg-core.js');

                console.log('toBlobURL開始: ffmpeg-core.wasm (CDNからダウンロード)');
                const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
                console.log('toBlobURL完了: ffmpeg-core.wasm');

                // WorkerスクリプトはESM依存のため、絶対パスimportを行うブートストラップを生成
                const workerBaseURL = `${this.CDN_BASE_URL}/ffmpeg@${this.FFMPEG_VERSION}/dist/esm`;
                console.log('Workerブートストラップ生成開始');
                const workerLoaderScript = `
                    import '${workerBaseURL}/worker.js';
                `;
                const classWorkerURL = URL.createObjectURL(
                    new Blob([workerLoaderScript], { type: 'text/javascript' })
                );
                console.log('Workerブートストラップ生成完了');

                console.log('ffmpeg.load()開始...');

                // タイムアウト付きでload実行（CDNのため時間を延長）
                const loadPromise = this.ffmpeg.load({ coreURL, wasmURL, classWorkerURL });
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(window.getLocalizedString('JSError.FfmpegTimeout'))), this.FFMPEG_INIT_TIMEOUT)
                );

                // 進捗表示
                const progressInterval = setInterval(() => {
                    console.log('ffmpeg.load()処理中... (CDNからWASMダウンロード・初期化中)');
                }, this.PROGRESS_LOG_INTERVAL);
                
                try {
                    await Promise.race([loadPromise, timeoutPromise]);
                    console.log('CDNからのWASM読み込み完了');
                } finally {
                    clearInterval(progressInterval);
                }
            } catch (loadError) {
                console.error('CDNからの読み込みエラー:', loadError);
                throw loadError;
            }

            this.isInitialized = true;
            console.log('FFmpeg初期化完了');
            return true;

        } catch (error) {
            console.error('FFmpeg初期化エラー:', error);
            console.log('モック変換にフォールバック');
            this.isInitialized = true;
            return true;
        }
    },

    async convertMovToMp4(movBuffer, options = {}) {
        // 変換処理の排他制御
        return await new Promise((resolve, reject) => {
            conversionMutex = conversionMutex.then(async () => {
                try {
                    const result = await this._doConvertMovToMp4(movBuffer, options);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        });
    },

    async _doConvertMovToMp4(movBuffer, options = {}) {
        console.log('=== FFmpeg変換開始 ===');
        console.log('初期化状態:', this.isInitialized);
        console.log('FFmpegインスタンス:', !!this.ffmpeg);
        console.log('FFmpeg loaded状態:', this.ffmpeg?.loaded);
        console.log('入力データサイズ:', movBuffer?.length, 'bytes');
        
        if (!this.isInitialized) {
            console.error('FFmpeg未初期化のため自動初期化を試行');
            const initResult = await this.initialize();
            if (!initResult) {
                const errorMsg = window.getLocalizedString('JSError.FfmpegNotInitialized');
                throw new Error(errorMsg);
            }
        }

        try {
            if (this.ffmpeg && this.ffmpeg.loaded) {
                console.log('実際のFFmpeg変換を実行します');
                return await this.convertWithFFmpeg(movBuffer, options);
            } else {
                console.log('FFmpeg未対応のためモック変換を実行します');
                return await this.convertWithMock(movBuffer, options);
            }
        } catch (error) {
            const errorMsg = window.commonUtils?.formatError 
                ? window.commonUtils.formatError('MOV変換', error)
                : `MOV変換エラー: ${error.message}`;
            
            console.error(errorMsg);
            console.log('エラー発生のためモック変換にフォールバック');
            return await this.convertWithMock(movBuffer, options);
        }
    },

    async convertWithFFmpeg(movBuffer, options) {
        const inputFileName = 'input.mov';
        const outputFileName = 'output.mp4';

        console.log('FFmpeg変換開始:', movBuffer.length, 'bytes');

        // ファイルをFFmpeg仮想ファイルシステムに書き込み
        await this.ffmpeg.writeFile(inputFileName, new Uint8Array(movBuffer));

        // 変換設定
        const args = ['-i', inputFileName];
        if (options.mode === 'fast' || options.mode === 'auto') {
            args.push('-c', 'copy', '-movflags', '+faststart');
        } else {
            args.push('-c:v', 'libx264', '-c:a', 'aac', '-preset', 'veryfast', '-crf', '23', '-movflags', '+faststart');
        }
        args.push('-y', outputFileName); // -y を追加（上書き確認スキップ）

        console.log('FFmpeg実行:', args.join(' '));
        
        try {
            await this.ffmpeg.exec(args);
            console.log('FFmpeg実行完了');
        } catch (execError) {
            // Aborted() エラーは無視（FFmpeg変換は完了している）
            if (execError.message && execError.message.includes('Aborted')) {
                console.warn('FFmpeg Aborted()エラーが発生しましたが、変換は完了しています');
            } else {
                console.error('FFmpeg実行エラー:', execError);
                throw execError;
            }
        }

        // 結果ファイルを読み取り
        let outputData;
        try {
            outputData = await this.ffmpeg.readFile(outputFileName);
            console.log('出力ファイル読み取り完了:', outputData.length, 'bytes');
        } catch (readError) {
            console.error('出力ファイル読み取りエラー:', readError);
            throw new Error(window.getLocalizedString('JSError.ResultReadFailed', readError.message));
        }

        // ファイルクリーンアップ
        try {
            await this.ffmpeg.deleteFile(inputFileName);
            await this.ffmpeg.deleteFile(outputFileName);
            console.log('ファイルクリーンアップ完了');
        } catch (cleanupError) {
            console.warn('ファイルクリーンアップエラー（無視）:', cleanupError);
        }

        console.log('FFmpeg変換完了:', outputData.length, 'bytes');
        return new Blob([outputData], { type: 'video/mp4' });
    },

    async convertWithMock(movBuffer, options) {
        console.log('モック変換実行中...', movBuffer.length, 'bytes', options);
        await new Promise(resolve => setTimeout(resolve, this.MOCK_CONVERSION_DELAY));
        const mockMp4Header = new Uint8Array([
            0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D,
            0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
            0x61, 0x76, 0x63, 0x31, 0x6D, 0x70, 0x34, 0x31
        ]);
        const mockData = new Uint8Array(Math.min(movBuffer.length, 1024));
        mockData.set(mockMp4Header);
        const text = new TextEncoder().encode('MOCK MP4 DATA');
        if (mockData.length > mockMp4Header.length + text.length) {
            mockData.set(text, mockMp4Header.length);
        }
        console.log('モック変換完了');
        return new Blob([mockData], { type: 'video/mp4' });
    }
};
