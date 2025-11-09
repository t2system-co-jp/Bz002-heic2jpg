using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Microsoft.Extensions.DependencyInjection;
using HEIC2JPG;
using HEIC2JPG.Services;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
builder.Services.AddScoped<IConvertService, ConvertService>();
builder.Services.AddScoped<ILocalizationService, LocalizationService>();

var host = builder.Build();

await InitializeLocalizationAsync(host);
await host.RunAsync();

static async Task InitializeLocalizationAsync(WebAssemblyHost host)
{
    try
    {
        var localizer = host.Services.GetRequiredService<ILocalizationService>();
        if (localizer is LocalizationService typedLocalizer)
        {
            await typedLocalizer.InitializeAsync();
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Localization initialization failed: {ex.Message}");
    }
}
