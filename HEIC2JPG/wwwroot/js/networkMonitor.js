// ネットワークリクエスト監視モジュール
// プライバシー保護のため、外部への通信を検出してカウントする
window.networkMonitor = (function() {
    'use strict';

    // プライベート変数
    let dotNetRef = null;
    let requestCount = 0;
    const originalFetch = window.fetch;
    const originalXHROpen = XMLHttpRequest.prototype.open;

    /**
     * URLが外部ドメインかどうか判定
     * @param {string} url - 判定対象のURL
     * @returns {boolean} 外部ドメインの場合 true
     */
    function isExternalRequest(url) {
        try {
            const urlObj = new URL(url, window.location.href);
            return urlObj.hostname !== window.location.hostname;
        } catch (e) {
            // URL解析失敗時は外部とみなさない（相対パス等）
            return false;
        }
    }

    /**
     * 外部リクエストを検出したときの処理
     */
    function incrementCount() {
        requestCount++;
        if (dotNetRef) {
            try {
                dotNetRef.invokeMethodAsync('OnNetworkRequest');
            } catch (e) {
                console.warn('Failed to notify .NET about network request:', e);
            }
        }
    }

    /**
     * fetch API のフック
     */
    function hookFetch() {
        window.fetch = function(resource, options) {
            // URL文字列またはRequestオブジェクトから URL を取得
            const url = typeof resource === 'string' ? resource : resource.url;

            if (isExternalRequest(url)) {
                incrementCount();
            }

            // オリジナルのfetchを呼び出し
            return originalFetch.apply(this, arguments);
        };
    }

    /**
     * XMLHttpRequest のフック
     */
    function hookXHR() {
        XMLHttpRequest.prototype.open = function(method, url) {
            if (isExternalRequest(url)) {
                incrementCount();
            }

            // オリジナルのopenを呼び出し
            return originalXHROpen.apply(this, arguments);
        };
    }

    /**
     * PerformanceObserver による監視（img/script タグ等の検出）
     */
    function setupPerformanceObserver() {
        if (!window.PerformanceObserver) {
            console.warn('PerformanceObserver not supported, using fetch/XHR hooks only');
            return;
        }

        try {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    // fetch/XHR 以外のリソース（img、script等）を検出
                    if (entry.initiatorType !== 'fetch' &&
                        entry.initiatorType !== 'xmlhttprequest') {
                        if (isExternalRequest(entry.name)) {
                            incrementCount();
                        }
                    }
                }
            });

            observer.observe({ entryTypes: ['resource'] });
        } catch (e) {
            console.warn('PerformanceObserver setup failed:', e);
        }
    }

    // 公開API
    return {
        /**
         * 監視を初期化
         * @param {DotNetObjectReference} dotnetRef - C#側のオブジェクト参照
         */
        init: function(dotnetRef) {
            dotNetRef = dotnetRef;
            requestCount = 0;

            hookFetch();
            hookXHR();
            setupPerformanceObserver();

            console.log('Network monitor initialized');
        },

        /**
         * 現在のリクエストカウントを取得
         * @returns {number} リクエスト数
         */
        getRequestCount: function() {
            return requestCount;
        },

        /**
         * カウントをリセット（テスト用）
         */
        resetCount: function() {
            requestCount = 0;
        }
    };
})();
