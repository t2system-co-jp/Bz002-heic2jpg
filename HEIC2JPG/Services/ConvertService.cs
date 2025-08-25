using HEIC2JPG.Models;
using Microsoft.JSInterop;

namespace HEIC2JPG.Services;

public class ConvertService : IConvertService
{
    private readonly IJSRuntime _jsRuntime;

    public ConvertService(IJSRuntime jsRuntime)
    {
        _jsRuntime = jsRuntime;
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
                throw new Exception("HEIC変換ライブラリの初期化に失敗しました");
            }
            
            // 進捗通知：変換開始
            ProgressChanged?.Invoke(this, new ConversionProgressEventArgs
            {
                FileId = "heic-conversion",
                Progress = 10,
                StatusMessage = "変換開始..."
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
                StatusMessage = "JPEG生成中..."
            });
            
            await Task.Delay(300, cancellationToken);
            
            // BlobからArrayBufferを取得
            var arrayBuffer = await _jsRuntime.InvokeAsync<byte[]>("getBlobArrayBuffer", cancellationToken, jpegBlob);
            
            // 進捗通知：完了
            ProgressChanged?.Invoke(this, new ConversionProgressEventArgs
            {
                FileId = "heic-conversion",
                Progress = 100,
                StatusMessage = "変換完了"
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
                ErrorMessage = "変換がキャンセルされました"
            };
        }
        catch (Exception ex)
        {
            return new ConvertResult
            {
                Success = false,
                ErrorMessage = $"HEIC変換エラー: {ex.Message}"
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
                throw new Exception("FFmpeg変換ライブラリの初期化に失敗しました");
            }
            
            // 進捗通知：変換開始
            ProgressChanged?.Invoke(this, new ConversionProgressEventArgs
            {
                FileId = "mov-conversion",
                Progress = 10,
                StatusMessage = "変換開始..."
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
                    throw new Exception($"FFmpeg変換処理でエラーが発生しました: {errorMsg}");
                }
                throw new Exception($"JavaScript実行エラー: {errorMsg}");
            }
            
            // 進捗通知：変換中
            ProgressChanged?.Invoke(this, new ConversionProgressEventArgs
            {
                FileId = "mov-conversion", 
                Progress = 70,
                StatusMessage = "MP4生成中..."
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
                throw new Exception($"変換結果の取得に失敗しました: {jsEx.Message}");
            }
            
            // 進捗通知：完了
            ProgressChanged?.Invoke(this, new ConversionProgressEventArgs
            {
                FileId = "mov-conversion",
                Progress = 100,
                StatusMessage = "変換完了"
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
                ErrorMessage = "変換がキャンセルされました"
            };
        }
        catch (Exception ex)
        {
            return new ConvertResult
            {
                Success = false,
                ErrorMessage = $"MOV変換エラー: {ex.Message}"
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
                throw new NotSupportedException($"ファイルタイプ {file.Type} はサポートされていません");
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
                file.ErrorMessage = result.ErrorMessage ?? "変換に失敗しました";
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
                StatusMessage = i == 100 ? "完了" : "変換中..."
            });
            
            await Task.Delay(200, cancellationToken);
        }
    }
}