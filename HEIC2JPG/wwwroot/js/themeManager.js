/**
 * Theme Manager for HEIC2JPG
 * ダークモード/ライトモードの切り替え管理
 */

window.themeManager = {
    STORAGE_KEY: 'heic2jpg.theme',
    THEMES: {
        LIGHT: 'light',
        DARK: 'dark',
        AUTO: 'auto'
    },

    /**
     * 初期化 - ページロード時に呼び出し
     */
    initialize() {
        const savedTheme = this.getSavedTheme();
        this.applyTheme(savedTheme);

        // システムテーマ変更を監視
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                const currentTheme = this.getSavedTheme();
                if (currentTheme === this.THEMES.AUTO) {
                    this.applyTheme(this.THEMES.AUTO);
                }
            });
        }
    },

    /**
     * 保存されたテーマ設定を取得
     */
    getSavedTheme() {
        try {
            return localStorage.getItem(this.STORAGE_KEY) || this.THEMES.AUTO;
        } catch (e) {
            console.warn('localStorage access failed:', e);
            return this.THEMES.AUTO;
        }
    },

    /**
     * テーマ設定を保存
     */
    saveTheme(theme) {
        try {
            localStorage.setItem(this.STORAGE_KEY, theme);
        } catch (e) {
            console.warn('localStorage save failed:', e);
        }
    },

    /**
     * システムのダークモード設定を検出
     */
    getSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return this.THEMES.DARK;
        }
        return this.THEMES.LIGHT;
    },

    /**
     * 実際に適用するテーマを決定
     */
    resolveTheme(theme) {
        if (theme === this.THEMES.AUTO) {
            return this.getSystemTheme();
        }
        return theme;
    },

    /**
     * テーマを適用
     */
    applyTheme(theme) {
        const resolvedTheme = this.resolveTheme(theme);
        const html = document.documentElement;

        // data-theme属性を設定
        html.setAttribute('data-theme', resolvedTheme);

        // メタタグのtheme-colorも更新
        this.updateThemeColor(resolvedTheme);

        console.log(`[ThemeManager] Theme applied: ${theme} (resolved: ${resolvedTheme})`);
        console.log(`[ThemeManager] HTML data-theme attribute:`, html.getAttribute('data-theme'));

        // 背景色を確認（デバッグ用）
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg');
        console.log(`[ThemeManager] Current --color-bg:`, bg);
    },

    /**
     * theme-color メタタグを更新
     */
    updateThemeColor(theme) {
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            if (theme === this.THEMES.DARK) {
                metaThemeColor.setAttribute('content', '#1E293B'); // ダークモード背景色
            } else {
                metaThemeColor.setAttribute('content', '#4F46E5'); // ライトモード（Indigo）
            }
        }
    },

    /**
     * テーマを切り替え
     */
    toggleTheme() {
        const currentTheme = this.getSavedTheme();
        let newTheme;

        // Light → Dark → Auto のサイクル
        if (currentTheme === this.THEMES.LIGHT) {
            newTheme = this.THEMES.DARK;
        } else if (currentTheme === this.THEMES.DARK) {
            newTheme = this.THEMES.AUTO;
        } else {
            newTheme = this.THEMES.LIGHT;
        }

        this.setTheme(newTheme);
        return newTheme;
    },

    /**
     * 特定のテーマを設定
     */
    setTheme(theme) {
        this.saveTheme(theme);
        this.applyTheme(theme);
    },

    /**
     * 現在の表示テーマを取得（解決済み）
     */
    getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme') || this.THEMES.LIGHT;
    },

    /**
     * 現在の設定テーマを取得（保存値）
     */
    getConfiguredTheme() {
        return this.getSavedTheme();
    }
};

// ページロード時に初期化（Blazorより先に実行）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.themeManager.initialize();
    });
} else {
    window.themeManager.initialize();
}
