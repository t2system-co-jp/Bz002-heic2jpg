namespace HEIC2JPG.Models;

public enum ConversionStatus
{
    Pending,
    Processing,
    Completed,
    Error,
    Cancelled
}

public enum FileType
{
    HEIC,
    MOV,
    MP4,
    AVI,
    MKV,
    WMV,
    FLV,
    WEBM,
    WAV,
    AAC,
    M4A,
    FLAC,
    WMA,
    MP3,
    Unknown
}

public class ConvertFile
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string FileName { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public FileType Type { get; set; }
    public byte[] Data { get; set; } = Array.Empty<byte>();
    public ConversionStatus Status { get; set; } = ConversionStatus.Pending;
    public int Progress { get; set; }
    public string? ErrorMessage { get; set; }
    public byte[]? ConvertedData { get; set; }
    public Microsoft.AspNetCore.Components.Forms.IBrowserFile? OriginalFile { get; set; }
    public CancellationTokenSource? CancellationToken { get; set; }

    public string GetConvertedFileName(bool extractAudioOnly = false)
    {
        if (Type == FileType.HEIC)
        {
            return Path.ChangeExtension(FileName, ".jpg");
        }
        else if (IsVideoType(Type))
        {
            // 音声抽出モードの場合はMP3に変換
            if (extractAudioOnly)
            {
                return Path.ChangeExtension(FileName, ".mp3");
            }
            // 動画形式の場合はMP4に統一
            return Path.ChangeExtension(FileName, ".mp4");
        }
        else if (IsAudioType(Type))
        {
            return Path.ChangeExtension(FileName, ".mp3");
        }
        return FileName;
    }

    private static bool IsVideoType(FileType type)
    {
        return type == FileType.MOV || type == FileType.MP4 ||
               type == FileType.AVI || type == FileType.MKV ||
               type == FileType.WMV || type == FileType.FLV ||
               type == FileType.WEBM;
    }

    private static bool IsAudioType(FileType type)
    {
        return type == FileType.MP3 || type == FileType.WAV ||
               type == FileType.AAC || type == FileType.M4A ||
               type == FileType.FLAC || type == FileType.WMA;
    }
}

public class ConvertOptions
{
    public double JpgQuality { get; set; } = 0.9;
    public bool KeepExif { get; set; } = true;
    public string ConversionMode { get; set; } = "auto";
    public int MaxConcurrentJobs { get; set; } = 0; // 0 = auto
}

public class ConversionSettings
{
    public double JpgQuality { get; set; } = 0.9;
    public bool PreserveExif { get; set; } = true;
    public string ConversionMode { get; set; } = "Auto";
    public int ParallelCount { get; set; } = 2;
    public bool ExtractAudioOnly { get; set; } = false;
}

public class ConvertResult
{
    public bool Success { get; set; }
    public byte[]? Data { get; set; }
    public string? FileName { get; set; }
    public string? ErrorMessage { get; set; }
}

public class ConversionProgressEventArgs : EventArgs
{
    public string FileId { get; set; } = string.Empty;
    public int Progress { get; set; }
    public string? StatusMessage { get; set; }
}