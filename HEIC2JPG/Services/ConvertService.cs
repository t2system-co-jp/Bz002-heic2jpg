using HEIC2JPG.Models;
using Microsoft.JSInterop;

namespace HEIC2JPG.Services;

public class ConvertService : IConvertService
{
    private readonly IJSRuntime _jsRuntime;
    private readonly ILocalizationService _localizer;

    // 進捗値の定数
    private const int PROGRESS_START = 10;
    private const int PROGRESS_FILE_LOAD = 30;
    private const int PROGRESS_CONVERTING = 70;
    private const int PROGRESS_FINALIZE = 90;
    private const int PROGRESS_COMPLETED = 100;

    // ファイルサイズの上限
    private const long MAX_FILE_SIZE = 2147483648; // 2GB

    // タイムスタンプフォーマット
    private const string TIMESTAMP_FORMAT = "yyyyMMdd-HHmmss";

    public ConvertService(IJSRuntime jsRuntime, ILocalizationService localizer)
    {
        _jsRuntime = jsRuntime;
        _localizer = localizer;
    }

    public event EventHandler<ConversionProgressEventArgs>? ProgressChanged;

    #region 共通ヘルパーメソッド

    /// <summary>
    /// 進捗通知を送信
    /// </summary>
    private void NotifyProgress(string fileId, int progress, string messageKey)
    {
        ProgressChanged?.Invoke(this, new ConversionProgressEventArgs
        {
            FileId = fileId,
            Progress = progress,
            StatusMessage = _localizer.GetString(messageKey)
        });
    }

    /// <summary>
    /// コンバーターの初期化を確認
    /// </summary>
    private async Task EnsureConverterInitializedAsync(string converterName, string errorMessageKey, CancellationToken cancellationToken)
    {
        var initResult = await _jsRuntime.InvokeAsync<bool>($"{converterName}.initialize", cancellationToken);
        if (!initResult)
        {
            throw new Exception(_localizer.GetString(errorMessageKey));
        }
    }

    /// <summary>
    /// エラー結果を生成
    /// </summary>
    private ConvertResult CreateErrorResult(string errorMessageKey, string? errorDetail = null)
    {
        return new ConvertResult
        {
            Success = false,
            ErrorMessage = errorDetail != null
                ? _localizer.GetString(errorMessageKey, errorDetail)
                : _localizer.GetString(errorMessageKey)
        };
    }

    #endregion

    public async Task<ConvertResult> ConvertHeicToJpgAsync(byte[] heicData, ConvertOptions options, CancellationToken cancellationToken = default)
    {
        try
        {
            // libheif初期化確認
            await EnsureConverterInitializedAsync("heicConverter", "ConversionMessage.InitializationFailed.Heic", cancellationToken);

            // 進捗通知：変換開始
            NotifyProgress("heic-conversion", PROGRESS_START, "ConversionMessage.Starting");
            await Task.Delay(300, cancellationToken);

            // HEIC→JPEG変換
            var jpegBlob = await _jsRuntime.InvokeAsync<IJSObjectReference>(
                "heicConverter.convertHeicToJpeg",
                cancellationToken,
                heicData,
                options.JpgQuality,
                options.KeepExif
            );

            // 進捗通知：変換中
            NotifyProgress("heic-conversion", PROGRESS_CONVERTING, "ConversionMessage.GeneratingJpeg");
            await Task.Delay(300, cancellationToken);

            // BlobからArrayBufferを取得
            var arrayBuffer = await _jsRuntime.InvokeAsync<byte[]>("getBlobArrayBuffer", cancellationToken, jpegBlob);

            // 進捗通知：完了
            NotifyProgress("heic-conversion", PROGRESS_COMPLETED, "ConversionMessage.Completed");

            return new ConvertResult
            {
                Success = true,
                Data = arrayBuffer,
                FileName = GenerateJpegFileName()
            };
        }
        catch (OperationCanceledException)
        {
            return CreateErrorResult("ConversionMessage.Cancelled");
        }
        catch (Exception ex)
        {
            return CreateErrorResult("ConversionError.HeicConversion", ex.Message);
        }
    }

    public async Task<ConvertResult> ConvertMovToMp4Async(byte[] movData, ConvertOptions options, CancellationToken cancellationToken = default)
    {
        try
        {
            // FFmpeg初期化確認
            await EnsureConverterInitializedAsync("ffmpegConverter", "ConversionMessage.InitializationFailed.Ffmpeg", cancellationToken);

            // 進捗通知：変換開始
            NotifyProgress("mov-conversion", PROGRESS_START, "ConversionMessage.Starting");
            await Task.Delay(500, cancellationToken);

            // 変換オプション準備
            var jsOptions = new
            {
                mode = options.ConversionMode,
                quality = options.JpgQuality
            };

            // MOV→MP4変換
            IJSObjectReference mp4Blob;
            try
            {
                mp4Blob = await _jsRuntime.InvokeAsync<IJSObjectReference>(
                    "ffmpegConverter.convertMovToMp4",
                    cancellationToken,
                    movData,
                    jsOptions
                );
            }
            catch (JSException jsEx)
            {
                // JavaScript側のAborted()エラーなど、FFmpeg内部エラーを適切に処理
                var errorMsg = jsEx.Message;
                if (errorMsg.Contains("Aborted") || errorMsg.Contains("ffmpeg"))
                {
                    throw new Exception(_localizer.GetString("ConversionError.FfmpegError", errorMsg));
                }
                throw new Exception(_localizer.GetString("ConversionError.JavaScriptError", errorMsg));
            }

            // 進捗通知：変換中
            NotifyProgress("mov-conversion", PROGRESS_CONVERTING, "ConversionMessage.GeneratingMp4");
            await Task.Delay(500, cancellationToken);

            // BlobからArrayBufferを取得
            byte[] arrayBuffer;
            try
            {
                arrayBuffer = await _jsRuntime.InvokeAsync<byte[]>("getBlobArrayBuffer", cancellationToken, mp4Blob);
            }
            catch (JSException jsEx)
            {
                throw new Exception(_localizer.GetString("ConversionError.ResultRetrievalFailed", jsEx.Message));
            }

            // 進捗通知：完了
            NotifyProgress("mov-conversion", PROGRESS_COMPLETED, "ConversionMessage.Completed");

            return new ConvertResult
            {
                Success = true,
                Data = arrayBuffer,
                FileName = GenerateMp4FileName()
            };
        }
        catch (OperationCanceledException)
        {
            return CreateErrorResult("ConversionMessage.Cancelled");
        }
        catch (Exception ex)
        {
            return CreateErrorResult("ConversionError.MovConversion", ex.Message);
        }
    }

    private string GenerateJpegFileName()
    {
        var timestamp = DateTime.Now.ToString(TIMESTAMP_FORMAT);
        return $"converted_{timestamp}.jpg";
    }

    private string GenerateMp4FileName()
    {
        var timestamp = DateTime.Now.ToString(TIMESTAMP_FORMAT);
        return $"converted_{timestamp}.mp4";
    }

    private string GenerateMp3FileName()
    {
        var timestamp = DateTime.Now.ToString(TIMESTAMP_FORMAT);
        return $"converted_{timestamp}.mp3";
    }

    /// <summary>
    /// 動画ファイルかどうかを判定
    /// </summary>
    private static bool IsVideoType(FileType type)
    {
        return type == FileType.MOV || type == FileType.MP4 ||
               type == FileType.AVI || type == FileType.MKV ||
               type == FileType.WMV || type == FileType.FLV ||
               type == FileType.WEBM;
    }

    /// <summary>
    /// 動画から音声抽出（MP3変換）
    /// </summary>
    public async Task<ConvertResult> ConvertVideoToMp3Async(byte[] videoData, ConvertOptions options, CancellationToken cancellationToken = default)
    {
        try
        {
            // FFmpeg初期化確認
            await EnsureConverterInitializedAsync("ffmpegConverter", "ConversionMessage.InitializationFailed.Ffmpeg", cancellationToken);

            // 進捗通知：変換開始
            NotifyProgress("mp3-conversion", PROGRESS_START, "ConversionMessage.Starting");
            await Task.Delay(500, cancellationToken);

            // 変換オプション準備
            var jsOptions = new
            {
                quality = "2"  // 高品質（0-9、2が推奨）
            };

            // 動画→MP3変換
            IJSObjectReference mp3Blob;
            try
            {
                mp3Blob = await _jsRuntime.InvokeAsync<IJSObjectReference>(
                    "ffmpegConverter.convertToMp3",
                    cancellationToken,
                    videoData,
                    jsOptions
                );
            }
            catch (JSException jsEx)
            {
                var errorMsg = jsEx.Message;
                if (errorMsg.Contains("Aborted") || errorMsg.Contains("ffmpeg"))
                {
                    throw new Exception(_localizer.GetString("ConversionError.FfmpegError", errorMsg));
                }
                throw new Exception(_localizer.GetString("ConversionError.JavaScriptError", errorMsg));
            }

            // 進捗通知：変換中
            NotifyProgress("mp3-conversion", PROGRESS_CONVERTING, "ConversionMessage.GeneratingMp3");
            await Task.Delay(500, cancellationToken);

            // BlobからArrayBufferを取得
            byte[] arrayBuffer;
            try
            {
                arrayBuffer = await _jsRuntime.InvokeAsync<byte[]>("getBlobArrayBuffer", cancellationToken, mp3Blob);
            }
            catch (JSException jsEx)
            {
                throw new Exception(_localizer.GetString("ConversionError.ResultRetrievalFailed", jsEx.Message));
            }

            // 進捗通知：完了
            NotifyProgress("mp3-conversion", PROGRESS_COMPLETED, "ConversionMessage.Completed");

            return new ConvertResult
            {
                Success = true,
                Data = arrayBuffer,
                FileName = GenerateMp3FileName()
            };
        }
        catch (OperationCanceledException)
        {
            return CreateErrorResult("ConversionMessage.Cancelled");
        }
        catch (Exception ex)
        {
            return CreateErrorResult("ConversionError.Mp3Conversion", ex.Message);
        }
    }

    /// <summary>
    /// 汎用動画変換（MP4への統一）
    /// </summary>
    public async Task<ConvertResult> ConvertVideoAsync(byte[] videoData, ConvertOptions options, CancellationToken cancellationToken = default)
    {
        try
        {
            // FFmpeg初期化確認
            await EnsureConverterInitializedAsync("ffmpegConverter", "ConversionMessage.InitializationFailed.Ffmpeg", cancellationToken);

            // 進捗通知：変換開始
            NotifyProgress("video-conversion", PROGRESS_START, "ConversionMessage.Starting");
            await Task.Delay(500, cancellationToken);

            // 変換オプション準備
            var jsOptions = new
            {
                mode = options.ConversionMode,
                quality = options.JpgQuality
            };

            // 動画変換
            IJSObjectReference mp4Blob;
            try
            {
                mp4Blob = await _jsRuntime.InvokeAsync<IJSObjectReference>(
                    "ffmpegConverter.convertVideo",
                    cancellationToken,
                    videoData,
                    jsOptions
                );
            }
            catch (JSException jsEx)
            {
                var errorMsg = jsEx.Message;
                if (errorMsg.Contains("Aborted") || errorMsg.Contains("ffmpeg"))
                {
                    throw new Exception(_localizer.GetString("ConversionError.FfmpegError", errorMsg));
                }
                throw new Exception(_localizer.GetString("ConversionError.JavaScriptError", errorMsg));
            }

            // 進捗通知：変換中
            NotifyProgress("video-conversion", PROGRESS_CONVERTING, "ConversionMessage.GeneratingMp4");
            await Task.Delay(500, cancellationToken);

            // BlobからArrayBufferを取得
            byte[] arrayBuffer;
            try
            {
                arrayBuffer = await _jsRuntime.InvokeAsync<byte[]>("getBlobArrayBuffer", cancellationToken, mp4Blob);
            }
            catch (JSException jsEx)
            {
                throw new Exception(_localizer.GetString("ConversionError.ResultRetrievalFailed", jsEx.Message));
            }

            // 進捗通知：完了
            NotifyProgress("video-conversion", PROGRESS_COMPLETED, "ConversionMessage.Completed");

            return new ConvertResult
            {
                Success = true,
                Data = arrayBuffer,
                FileName = GenerateMp4FileName()
            };
        }
        catch (OperationCanceledException)
        {
            return CreateErrorResult("ConversionMessage.Cancelled");
        }
        catch (Exception ex)
        {
            return CreateErrorResult("ConversionError.VideoConversion", ex.Message);
        }
    }

    public async Task ConvertFilesAsync(List<ConvertFile> files, ConversionSettings settings, Action<Guid, int> progressCallback)
    {
        // 動画ファイルがある場合は並行数を1に制限（FFmpeg排他制御）
        var hasVideo = files.Any(f => IsVideoType(f.Type));
        var parallelCount = hasVideo ? 1 : settings.ParallelCount;

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
    }

    private async Task ConvertSingleFileAsync(ConvertFile file, ConversionSettings settings, Action<Guid, int> progressCallback)
    {
        try
        {
            file.Status = ConversionStatus.Processing;
            progressCallback(file.Id, 0);

            // ファイルデータ読み込み
            if (file.OriginalFile != null)
            {
                using var stream = file.OriginalFile.OpenReadStream(maxAllowedSize: MAX_FILE_SIZE);
                using var memoryStream = new MemoryStream();
                await stream.CopyToAsync(memoryStream);
                file.Data = memoryStream.ToArray();
            }

            progressCallback(file.Id, PROGRESS_FILE_LOAD);

            // 変換実行
            ConvertResult result;
            if (file.Type == FileType.HEIC)
            {
                var options = new ConvertOptions
                {
                    JpgQuality = settings.JpgQuality,
                    KeepExif = settings.PreserveExif,
                    ConversionMode = settings.ConversionMode.ToLower()
                };
                result = await ConvertHeicToJpgAsync(file.Data, options);
            }
            else if (IsVideoType(file.Type))
            {
                var options = new ConvertOptions
                {
                    ConversionMode = settings.ConversionMode.ToLower()
                };

                // 音声抽出モードの場合はMP3に変換
                if (settings.ExtractAudioOnly)
                {
                    result = await ConvertVideoToMp3Async(file.Data, options);
                }
                else
                {
                    // MOVの場合は既存のメソッドを使用（後方互換性）
                    if (file.Type == FileType.MOV)
                    {
                        result = await ConvertMovToMp4Async(file.Data, options);
                    }
                    else
                    {
                        // その他の動画形式は汎用変換メソッドを使用
                        result = await ConvertVideoAsync(file.Data, options);
                    }
                }
            }
            else
            {
                throw new NotSupportedException(_localizer.GetString("ConversionError.UnsupportedFileType", file.Type));
            }

            progressCallback(file.Id, PROGRESS_FINALIZE);

            if (result.Success && result.Data != null)
            {
                file.ConvertedData = result.Data;
                file.Status = ConversionStatus.Completed;
                progressCallback(file.Id, PROGRESS_COMPLETED);
            }
            else
            {
                file.Status = ConversionStatus.Error;
                file.ErrorMessage = result.ErrorMessage ?? _localizer.GetString("ConversionError.ConversionFailed");
                progressCallback(file.Id, 0);
            }
        }
        catch (Exception ex)
        {
            file.Status = ConversionStatus.Error;
            file.ErrorMessage = ex.Message;
            progressCallback(file.Id, 0);
        }
    }
}