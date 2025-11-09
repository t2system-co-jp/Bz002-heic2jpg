using Microsoft.JSInterop;

namespace HEIC2JPG.Services;

/// <summary>
/// ネットワークリクエスト監視サービス
/// 外部への通信を検出してカウントし、プライバシー保護を可視化する
/// </summary>
public class NetworkMonitorService : IAsyncDisposable
{
    private readonly IJSRuntime _jsRuntime;
    private DotNetObjectReference<NetworkMonitorService>? _dotNetRef;
    private bool _isInitialized = false;

    /// <summary>外部リクエストカウント</summary>
    public int RequestCount { get; private set; } = 0;

    /// <summary>リクエストカウント変更イベント</summary>
    public event EventHandler? RequestCountChanged;

    public NetworkMonitorService(IJSRuntime jsRuntime)
    {
        _jsRuntime = jsRuntime;
    }

    /// <summary>
    /// JavaScript側のネットワーク監視を初期化
    /// </summary>
    public async Task InitializeAsync()
    {
        if (_isInitialized) return;

        try
        {
            _dotNetRef = DotNetObjectReference.Create(this);
            await _jsRuntime.InvokeVoidAsync("networkMonitor.init", _dotNetRef);
            _isInitialized = true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"NetworkMonitor initialization failed: {ex.Message}");
            // 初期化失敗時もアプリ動作は継続（監視機能のみ無効化）
        }
    }

    /// <summary>
    /// JavaScript側から呼び出される：外部リクエスト検出時
    /// </summary>
    [JSInvokable]
    public void OnNetworkRequest()
    {
        RequestCount++;
        RequestCountChanged?.Invoke(this, EventArgs.Empty);
    }

    /// <summary>
    /// カウントをリセット（テスト用）
    /// </summary>
    public void ResetCount()
    {
        RequestCount = 0;
        RequestCountChanged?.Invoke(this, EventArgs.Empty);
    }

    /// <summary>
    /// リソース解放
    /// </summary>
    public async ValueTask DisposeAsync()
    {
        _dotNetRef?.Dispose();
        await Task.CompletedTask;
    }
}
