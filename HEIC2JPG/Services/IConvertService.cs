using HEIC2JPG.Models;

namespace HEIC2JPG.Services;

public interface IConvertService
{
    Task<ConvertResult> ConvertHeicToJpgAsync(byte[] heicData, ConvertOptions options, CancellationToken cancellationToken = default);
    Task<ConvertResult> ConvertMovToMp4Async(byte[] movData, ConvertOptions options, CancellationToken cancellationToken = default);
    Task ConvertFilesAsync(List<ConvertFile> files, ConversionSettings settings, Action<Guid, int> progressCallback);
    event EventHandler<ConversionProgressEventArgs>? ProgressChanged;
}