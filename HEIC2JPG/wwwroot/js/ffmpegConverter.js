// MOV→MP4変換用JavaScript (FFmpeg WASM)
let initializationPromise = null;
let conversionMutex = Promise.resolve(); // 変換処理の排他制御

window.ffmpegConverter = {
    // 定数定義
    FFMPEG_CORE_VERSION: '0.12.10',
    FFMPEG_VERSION: '0.12.15',
    CDN_BASE_URL: 'https://cdn.jsdelivr.net/npm/@ffmpeg',
    FFMPEG_INIT_TIMEOUT: 120000, // 2分
    PROGRESS_LOG_INTERVAL: 5000, // 5秒

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
                console.error('FFmpegUtilライブラリが見つかりません');
                return false;
            }

            // FFmpegWASMライブラリの確認
            if (typeof window.FFmpegWASM === 'undefined') {
                console.error('FFmpegWASMライブラリが見つかりません');
                return false;
            }

            if (!window.FFmpegWASM.FFmpeg) {
                console.error('FFmpegコンストラクタが見つかりません');
                return false;
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
            let coreURL = null;
            let wasmURL = null;
            let classWorkerURL = null;
            try {
                console.log('CDNからffmpeg-core読み込み開始...');

                const baseURL = `${this.CDN_BASE_URL}/core@${this.FFMPEG_CORE_VERSION}/dist/esm`;
                console.log('toBlobURL開始: ffmpeg-core.js');
                coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
                console.log('toBlobURL完了: ffmpeg-core.js');

                console.log('toBlobURL開始: ffmpeg-core.wasm (CDNからダウンロード)');
                wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
                console.log('toBlobURL完了: ffmpeg-core.wasm');

                // WorkerスクリプトはESM依存のため、絶対パスimportを行うブートストラップを生成
                const workerBaseURL = `${this.CDN_BASE_URL}/ffmpeg@${this.FFMPEG_VERSION}/dist/esm`;
                console.log('Workerブートストラップ生成開始');
                const workerLoaderScript = `
                    import '${workerBaseURL}/worker.js';
                `;
                classWorkerURL = URL.createObjectURL(
                    new Blob([workerLoaderScript], { type: 'text/javascript' })
                );
                console.log('Workerブートストラップ生成完了');

                console.log('ffmpeg.load()開始...');

                // タイムアウト付きでload実行（CDNのため時間を延長）
                const loadPromise = this.ffmpeg.load({ coreURL, wasmURL, classWorkerURL });
                let timeoutId;
                const timeoutPromise = new Promise((_, reject) => {
                    timeoutId = setTimeout(
                        () => reject(new Error(window.getLocalizedString('JSError.FfmpegTimeout'))),
                        this.FFMPEG_INIT_TIMEOUT
                    );
                });

                // 進捗表示
                const progressInterval = setInterval(() => {
                    console.log('ffmpeg.load()処理中... (CDNからWASMダウンロード・初期化中)');
                }, this.PROGRESS_LOG_INTERVAL);
                
                try {
                    await Promise.race([loadPromise, timeoutPromise]);
                    console.log('CDNからのWASM読み込み完了');
                } finally {
                    clearTimeout(timeoutId);
                    clearInterval(progressInterval);
                }
            } catch (loadError) {
                console.error('CDNからの読み込みエラー:', loadError);
                this.ffmpeg?.terminate();
                this.ffmpeg = null;
                throw loadError;
            } finally {
                for (const url of [coreURL, wasmURL, classWorkerURL]) {
                    if (url) {
                        URL.revokeObjectURL(url);
                    }
                }
            }

            this.isInitialized = true;
            console.log('FFmpeg初期化完了');
            return true;

        } catch (error) {
            console.error('FFmpeg初期化エラー:', error);
            this.ffmpeg = null;
            this.isInitialized = false;
            return false;
        }
    },

    createJobId() {
        if (globalThis.crypto?.randomUUID) {
            return globalThis.crypto.randomUUID();
        }

        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    },

    async deleteVirtualFiles(...fileNames) {
        if (!this.ffmpeg?.loaded) {
            return;
        }

        for (const fileName of fileNames) {
            try {
                await this.ffmpeg.deleteFile(fileName);
            } catch (cleanupError) {
                // writeFile前の失敗など、ファイルが存在しない場合もある。
                console.debug(`FFmpeg仮想ファイル削除をスキップ: ${fileName}`, cleanupError);
            }
        }
    },

    dispose() {
        if (this.ffmpeg) {
            this.ffmpeg.terminate();
        }

        this.ffmpeg = null;
        this.isInitialized = false;
        initializationPromise = null;
        // conversionMutex はリセットしない。差し替えると待機中のジョブが
        // 別チェーンで動き出し、FFmpegの直列化が崩れるため。
    },
    /**
     * ffmpeg.writeFile はバッファをWorkerへtransfer（detach）するため、
     * バッファ全体を占有するUint8Arrayはコピーせずそのまま渡してピークメモリを抑える。
     */
    toTransferableBuffer(buffer) {
        if (buffer instanceof Uint8Array
            && buffer.byteOffset === 0
            && buffer.byteLength === buffer.buffer.byteLength) {
            return buffer;
        }

        return new Uint8Array(buffer);
    },

    // FFmpegは同時実行できないため、変換処理を直列化する
    runExclusively(task) {
        return new Promise((resolve, reject) => {
            conversionMutex = conversionMutex.then(async () => {
                try {
                    resolve(await task());
                } catch (error) {
                    reject(error);
                }
            });
        });
    },

    async ensureReady() {
        if (!this.isInitialized) {
            console.error('FFmpeg未初期化のため自動初期化を試行');
            await this.initialize();
        }

        if (!this.ffmpeg?.loaded) {
            throw new Error(window.getLocalizedString('JSError.FfmpegNotInitialized'));
        }
    },

    /**
     * 変換1件分の共通処理（一時ファイル採番・書き込み・実行・読み出し・後始末）
     * @param {string} label - ログ・エラーメッセージ用のラベル
     * @param {Uint8Array} buffer - 入力データ
     * @param {{inputExt: string, outputExt: string, mimeType: string, buildArgs: Function}} spec
     */
    async runJob(label, buffer, spec) {
        console.log(`=== ${label}開始 ===`);
        console.log('初期化状態:', this.isInitialized, '/ FFmpeg loaded状態:', this.ffmpeg?.loaded);
        console.log('入力データサイズ:', buffer?.length, 'bytes');

        await this.ensureReady();

        const jobId = this.createJobId();
        const inputFileName = `input-${jobId}.${spec.inputExt}`;
        const outputFileName = `output-${jobId}.${spec.outputExt}`;

        try {
            await this.ffmpeg.writeFile(inputFileName, this.toTransferableBuffer(buffer));

            const args = spec.buildArgs(inputFileName, outputFileName);
            console.log('FFmpeg実行:', args.join(' '));

            const exitCode = await this.ffmpeg.exec(args);
            if (exitCode !== 0) {
                throw new Error(`FFmpeg exited with code ${exitCode}`);
            }

            const outputData = await this.ffmpeg.readFile(outputFileName);
            console.log(`${label}完了:`, outputData.length, 'bytes');

            return new Blob([outputData], { type: spec.mimeType });
        } catch (error) {
            const errorMsg = window.commonUtils?.formatError
                ? window.commonUtils.formatError(label, error)
                : `${label}エラー: ${error.message}`;

            console.error(errorMsg);
            throw new Error(errorMsg, { cause: error });
        } finally {
            await this.deleteVirtualFiles(inputFileName, outputFileName);
        }
    },

    // MP4出力の共通引数（MOV変換・汎用動画変換で共用）
    buildMp4Args(options) {
        return (inputFileName, outputFileName) => {
            const args = ['-i', inputFileName];
            if (options.mode === 'fast' || options.mode === 'auto') {
                args.push('-c', 'copy', '-movflags', '+faststart');
            } else {
                args.push('-c:v', 'libx264', '-c:a', 'aac', '-preset', 'veryfast', '-crf', '23', '-movflags', '+faststart');
            }
            args.push('-y', outputFileName);
            return args;
        };
    },

    async convertMovToMp4(movBuffer, options = {}) {
        return await this.runExclusively(() => this.runJob('MOV変換', movBuffer, {
            inputExt: 'mov',
            outputExt: 'mp4',
            mimeType: 'video/mp4',
            buildArgs: this.buildMp4Args(options)
        }));
    },

    // 汎用動画変換（MP4への統一）
    async convertVideo(videoBuffer, options = {}) {
        return await this.runExclusively(() => this.runJob('動画変換', videoBuffer, {
            inputExt: 'video',
            outputExt: 'mp4',
            mimeType: 'video/mp4',
            buildArgs: this.buildMp4Args(options)
        }));
    },

    // 動画から音声抽出（MP3）
    // -vn: 映像を無効化 / -acodec libmp3lame: MP3エンコーダー / -q:a: 音質（0が最高、9が最低）
    async convertToMp3(videoBuffer, options = {}) {
        return await this.runExclusively(() => this.runJob('MP3変換', videoBuffer, {
            inputExt: 'video',
            outputExt: 'mp3',
            mimeType: 'audio/mpeg',
            buildArgs: (inputFileName, outputFileName) => [
                '-i', inputFileName,
                '-vn',
                '-acodec', 'libmp3lame',
                '-q:a', options.quality || '2',
                '-y', outputFileName
            ]
        }));
    }
};
