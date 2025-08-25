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

    public string GetConvertedFileName()
    {
        if (Type == FileType.HEIC)
        {
            return Path.ChangeExtension(FileName, ".jpg");
        }
        else if (Type == FileType.MOV)
        {
            return Path.ChangeExtension(FileName, ".mp4");
        }
        return FileName;
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