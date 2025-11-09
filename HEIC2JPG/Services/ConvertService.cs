using HEIC2JPG.Models;
using Microsoft.JSInterop;

namespace HEIC2JPG.Services;

public class ConvertService : IConvertService
{
    private readonly IJSRuntime _jsRuntime;
    private readonly ILocalizationService _localizer;

    public ConvertService(IJSRuntime jsRuntime, ILocalizationService localizer)
    {
        _jsRuntime = jsRuntime;
        _localizer = localizer;
    }

    public event EventHandler<ConversionProgressEventArgs>? ProgressChanged;

    public async Task<ConvertResult> ConvertHeicToJpgAsync(byte[] heicData, ConvertOptions options, CancellationToken cancellationToken = default)
    {
        try
        {
            // libheif初期化確認
            var initResult = await _jsRuntime.InvokeAsync<bool>("heicConverter.initialize", cancellationToken);
            if (!initResult)
            {
                throw new Exception(_localizer.GetString("ConversionMessage.InitializationFailed.Heic"));
            }

            // 進捗通知：変換開始
            ProgressChanged?.Invoke(this, new ConversionProgressEventArgs
            {
                FileId = "heic-conversion",
                Progress = 10,
                StatusMessage = _localizer.GetString("ConversionMessage.Starting")
            });

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
            ProgressChanged?.Invoke(this, new ConversionProgressEventArgs
            {
                FileId = "heic-conversion",
                Progress = 70,
                StatusMessage = _localizer.GetString("ConversionMessage.GeneratingJpeg")
            });

            await Task.Delay(300, cancellationToken);

            // BlobからArrayBufferを取得
            var arrayBuffer = await _jsRuntime.InvokeAsync<byte[]>("getBlobArrayBuffer", cancellationToken, jpegBlob);

            // 進捗通知：完了
            ProgressChanged?.Invoke(this, new ConversionProgressEventArgs
            {
                FileId = "heic-conversion",
                Progress = 100,
                StatusMessage = _localizer.GetString("ConversionMessage.Completed")
            });

            return new ConvertResult
            {
                Success = true,
                Data = arrayBuffer,
                FileName = GenerateJpegFileName()
            };
        }
        catch (OperationCanceledException)
        {
            return new ConvertResult
            {
                Success = false,
                ErrorMessage = _localizer.GetString("ConversionMessage.Cancelled")
            };
        }
        catch (Exception ex)
        {
            return new ConvertResult
            {
                Success = false,
                ErrorMessage = _localizer.GetString("ConversionError.HeicConversion", ex.Message)
            };
        }
    }

    public async Task<ConvertResult> ConvertMovToMp4Async(byte[] movData, ConvertOptions options, CancellationToken cancellationToken = default)
    {
        try
        {
            // FFmpeg初期化確認
            var initResult = await _jsRuntime.InvokeAsync<bool>("ffmpegConverter.initialize", cancellationToken);
            if (!initResult)
            {
                throw new Exception(_localizer.GetString("ConversionMessage.InitializationFailed.Ffmpeg"));
            }

            // 進捗通知：変換開始
            ProgressChanged?.Invoke(this, new ConversionProgressEventArgs
            {
                FileId = "mov-conversion",
                Progress = 10,
                StatusMessage = _localizer.GetString("ConversionMessage.Starting")
            });

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
            ProgressChanged?.Invoke(this, new ConversionProgressEventArgs
            {
                FileId = "mov-conversion",
                Progress = 70,
                StatusMessage = _localizer.GetString("ConversionMessage.GeneratingMp4")
            });

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
            ProgressChanged?.Invoke(this, new ConversionProgressEventArgs
            {
                FileId = "mov-conversion",
                Progress = 100,
                StatusMessage = _localizer.GetString("ConversionMessage.Completed")
            });

            return new ConvertResult
            {
                Success = true,
                Data = arrayBuffer,
                FileName = GenerateMp4FileName()
            };
        }
        catch (OperationCanceledException)
        {
            return new ConvertResult
            {
                Success = false,
                ErrorMessage = _localizer.GetString("ConversionMessage.Cancelled")
            };
        }
        catch (Exception ex)
        {
            return new ConvertResult
            {
                Success = false,
                ErrorMessage = _localizer.GetString("ConversionError.MovConversion", ex.Message)
            };
        }
    }

    private string GenerateJpegFileName()
    {
        var timestamp = DateTime.Now.ToString("yyyyMMdd-HHmmss");
        return $"converted_{timestamp}.jpg";
    }

    private string GenerateMp4FileName()
    {
        var timestamp = DateTime.Now.ToString("yyyyMMdd-HHmmss");
        return $"converted_{timestamp}.mp4";
    }

    public async Task ConvertFilesAsync(List<ConvertFile> files, ConversionSettings settings, Action<Guid, int> progressCallback)
    {
        // MOVファイルがある場合は並行数を1に制限（FFmpeg排他制御）
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
                using var stream = file.OriginalFile.OpenReadStream(maxAllowedSize: 2147483648); // 2GB
                using var memoryStream = new MemoryStream();
                await stream.CopyToAsync(memoryStream);
                file.Data = memoryStream.ToArray();
            }

            progressCallback(file.Id, 30);

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
            else if (file.Type == FileType.MOV)
            {
                var options = new ConvertOptions
                {
                    ConversionMode = settings.ConversionMode.ToLower()
                };
                result = await ConvertMovToMp4Async(file.Data, options);
            }
            else
            {
                throw new NotSupportedException(_localizer.GetString("ConversionError.UnsupportedFileType", file.Type));
            }

            progressCallback(file.Id, 90);

            if (result.Success && result.Data != null)
            {
                file.ConvertedData = result.Data;
                file.Status = ConversionStatus.Completed;
                progressCallback(file.Id, 100);
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

    private async Task SimulateProgress(string fileId, CancellationToken cancellationToken)
    {
        for (int i = 0; i <= 100; i += 10)
        {
            cancellationToken.ThrowIfCancellationRequested();

            ProgressChanged?.Invoke(this, new ConversionProgressEventArgs
            {
                FileId = fileId,
                Progress = i,
                StatusMessage = i == 100 ? _localizer.GetString("ConversionMessage.Done") : _localizer.GetString("ConversionMessage.Processing")
            });

            await Task.Delay(200, cancellationToken);
        }
    }
}