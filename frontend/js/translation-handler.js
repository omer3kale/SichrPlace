/**
 * SichrPlace Translation Handler
 * Unified language switching system with localStorage persistence
 * Supports: English (en), German (de), Turkish (tr)
 * 
 * @version 2.0.0
 * @date October 15, 2025
 */

class TranslationHandler {
  constructor() {
    this.currentLang = localStorage.getItem('sichrplace-language') || 'en';
    this.translations = {};
    this.isLoading = false;
    this.loadAttempts = 0;
    this.maxLoadAttempts = 3;
    
    // Supported languages
    this.supportedLanguages = ['en', 'de', 'tr'];
    
    // Initialize immediately
    this.init();
  }

  /**
   * Initialize translation system
   */
  async init() {
    try {
      await this.loadTranslations();
      this.setupEventListeners();
      this.applyLanguage(this.currentLang);
      this.updateUI(this.currentLang);
      console.log('✅ Translation system initialized:', this.currentLang);
    } catch (error) {
      console.error('❌ Translation initialization failed:', error);
      this.handleInitError(error);
    }
  }

  /**
   * Load translations from JSON file with retry logic
   */
  async loadTranslations() {
    if (this.isLoading) return;
    
    this.isLoading = true;
    
    try {
      const response = await fetch('/js/translations.json', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.translations = await response.json();
      
      // Validate translations loaded
      if (!this.translations || Object.keys(this.translations).length === 0) {
        throw new Error('Empty translations received');
      }

      // Cache to localStorage for offline support
      try {
        localStorage.setItem('sichrplace-translations-cache', JSON.stringify(this.translations));
        localStorage.setItem('sichrplace-translations-timestamp', Date.now().toString());
      } catch (e) {
        console.warn('Could not cache translations:', e);
      }

      this.isLoading = false;
      this.loadAttempts = 0;
      
    } catch (error) {
      this.isLoading = false;
      this.loadAttempts++;
      
      console.error(`Translation load attempt ${this.loadAttempts} failed:`, error);
      
      // Try to load from cache
      const cached = this.loadFromCache();
      if (cached) {
        console.log('✅ Using cached translations');
        this.translations = cached;
        return;
      }
      
      // Retry if under max attempts
      if (this.loadAttempts < this.maxLoadAttempts) {
        console.log(`Retrying in 1 second... (${this.loadAttempts}/${this.maxLoadAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.loadTranslations();
      }
      
      // Use fallback translations
      console.warn('⚠️ Using fallback translations');
      this.translations = this.getFallbackTranslations();
    }
  }

  /**
   * Load translations from localStorage cache
   */
  loadFromCache() {
    try {
      const cached = localStorage.getItem('sichrplace-translations-cache');
      const timestamp = localStorage.getItem('sichrplace-translations-timestamp');
      
      if (!cached) return null;
      
      // Check if cache is less than 24 hours old
      const cacheAge = Date.now() - parseInt(timestamp || '0');
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (cacheAge > maxAge) {
        console.log('Translation cache expired');
        return null;
      }
      
      return JSON.parse(cached);
    } catch (error) {
      console.error('Cache load failed:', error);
      return null;
    }
  }

  /**
   * Setup event listeners for language switcher
   */
  setupEventListeners() {
    // Language option click handlers
    const langOptions = document.querySelectorAll('.lang-option');
    langOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        e.preventDefault();
        const selectedLang = option.getAttribute('data-lang');
        if (selectedLang) {
          this.switchLanguage(selectedLang);
        }
      });
    });

    // Dropdown toggle button
    const languageBtn = document.getElementById('language-btn');
    const languageDropdown = document.querySelector('.language-dropdown');
    
    if (languageBtn && languageDropdown) {
      // Toggle dropdown
      languageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = languageDropdown.classList.contains('active');
        
        if (isActive) {
          this.closeDropdown();
        } else {
          this.openDropdown();
        }
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!languageBtn.contains(e.target) && !languageDropdown.contains(e.target)) {
          this.closeDropdown();
        }
      });

      // Keyboard navigation
      languageBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          languageBtn.click();
        } else if (e.key === 'Escape') {
          this.closeDropdown();
        }
      });

      // Close on ESC key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeDropdown();
        }
      });
    }
  }

  /**
   * Open language dropdown
   */
  openDropdown() {
    const languageBtn = document.getElementById('language-btn');
    const languageDropdown = document.querySelector('.language-dropdown');
    
    if (languageDropdown) {
      languageDropdown.classList.add('active');
    }
    if (languageBtn) {
      languageBtn.classList.add('active');
      languageBtn.setAttribute('aria-expanded', 'true');
    }
  }

  /**
   * Close language dropdown
   */
  closeDropdown() {
    const languageBtn = document.getElementById('language-btn');
    const languageDropdown = document.querySelector('.language-dropdown');
    
    if (languageDropdown) {
      languageDropdown.classList.remove('active');
    }
    if (languageBtn) {
      languageBtn.classList.remove('active');
      languageBtn.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * Switch to a different language
   * @param {string} lang - Language code (en, de, tr)
   */
  switchLanguage(lang) {
    // Validate language
    if (!this.supportedLanguages.includes(lang)) {
      console.warn(`Language '${lang}' not supported, falling back to EN`);
      lang = 'en';
    }

    // Check if translations exist
    if (!this.translations[lang]) {
      console.warn(`Translations for '${lang}' not found, falling back to EN`);
      lang = 'en';
    }

    // Update state
    this.currentLang = lang;
    
    // Persist to localStorage
    try {
      localStorage.setItem('sichrplace-language', lang);
    } catch (error) {
      console.error('Could not save language preference:', error);
    }

    // Apply translations
    this.applyLanguage(lang);
    
    // Update UI
    this.updateUI(lang);
    
    // Show confirmation (optional)
    this.showLanguageChangeNotification(lang);
    
    console.log(`✅ Language switched to: ${lang.toUpperCase()}`);
  }

  /**
   * Apply language translations to all elements
   * @param {string} lang - Language code
   */
  applyLanguage(lang) {
    // Update data-translate elements
    const elements = document.querySelectorAll('[data-translate]');
    elements.forEach(element => {
      const key = element.getAttribute('data-translate');
      const translation = this.getTranslation(key, lang);
      
      if (translation) {
        // Handle different element types
        if (element.tagName === 'INPUT' && element.type !== 'submit' && element.type !== 'button') {
          element.placeholder = translation;
        } else if (element.tagName === 'META') {
          element.content = translation;
        } else {
          // Use innerHTML to support HTML tags like <br>
          element.innerHTML = translation;
        }
      }
    });

    // Update data-translate-placeholder
    const placeholderElements = document.querySelectorAll('[data-translate-placeholder]');
    placeholderElements.forEach(element => {
      const key = element.getAttribute('data-translate-placeholder');
      const translation = this.getTranslation(key, lang);
      if (translation) {
        element.placeholder = translation;
      }
    });

    // Update data-translate-title
    const titleElements = document.querySelectorAll('[data-translate-title]');
    titleElements.forEach(element => {
      const key = element.getAttribute('data-translate-title');
      const translation = this.getTranslation(key, lang);
      if (translation) {
        element.title = translation;
      }
    });

    // Update data-translate-aria
    const ariaElements = document.querySelectorAll('[data-translate-aria]');
    ariaElements.forEach(element => {
      const key = element.getAttribute('data-translate-aria');
      const translation = this.getTranslation(key, lang);
      if (translation) {
        element.setAttribute('aria-label', translation);
      }
    });

    // Update data-translate-value (for button values)
    const valueElements = document.querySelectorAll('[data-translate-value]');
    valueElements.forEach(element => {
      const key = element.getAttribute('data-translate-value');
      const translation = this.getTranslation(key, lang);
      if (translation) {
        element.value = translation;
      }
    });

    // Update document language attribute
    document.documentElement.lang = lang;
    
    // Update meta description if exists
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      const descKey = metaDesc.getAttribute('data-translate');
      if (descKey) {
        const descTranslation = this.getTranslation(descKey, lang);
        if (descTranslation) {
          metaDesc.content = descTranslation;
        }
      }
    }
  }

  /**
   * Update UI elements (button, active states)
   * @param {string} lang - Language code
   */
  updateUI(lang) {
    // Update button text to show current language
    const currentLangSpan = document.getElementById('current-lang');
    if (currentLangSpan) {
      currentLangSpan.textContent = lang.toUpperCase();
    }

    // Update active state on language options
    const langOptions = document.querySelectorAll('.lang-option');
    langOptions.forEach(option => {
      const optionLang = option.getAttribute('data-lang');
      if (optionLang === lang) {
        option.classList.add('active');
        option.setAttribute('aria-selected', 'true');
      } else {
        option.classList.remove('active');
        option.setAttribute('aria-selected', 'false');
      }
    });

    // Close dropdown after selection
    this.closeDropdown();
  }

  /**
   * Get translation for a key
   * @param {string} key - Translation key (e.g., 'nav.home')
   * @param {string} lang - Language code
   * @returns {string} - Translated text or key if not found
   */
  getTranslation(key, lang) {
    if (!key) return '';
    
    // Try requested language
    const translation = this.translations[lang]?.[key];
    if (translation) return translation;
    
    // Fallback to English
    const fallback = this.translations['en']?.[key];
    if (fallback) {
      console.warn(`Translation missing for '${key}' in ${lang}, using EN`);
      return fallback;
    }
    
    // Return key if no translation found
    console.warn(`Translation key '${key}' not found`);
    return key;
  }

  /**
   * Show language change notification (optional feature)
   * @param {string} lang - Language code
   */
  showLanguageChangeNotification(lang) {
    // Check if notifications are enabled
    const notificationsEnabled = localStorage.getItem('sichrplace-language-notifications') !== 'false';
    if (!notificationsEnabled) return;

    const languageNames = {
      en: 'English',
      de: 'Deutsch',
      tr: 'Türkçe'
    };

    const message = `Language changed to ${languageNames[lang] || lang}`;
    
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'language-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: var(--primary, #4A90E2);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: var(--body-font, Arial, sans-serif);
      font-size: 14px;
      animation: slideInUp 0.3s ease, fadeOut 0.3s ease 2.7s;
      opacity: 1;
    `;

    document.body.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  /**
   * Handle initialization errors
   * @param {Error} error - Error object
   */
  handleInitError(error) {
    console.error('Translation system failed to initialize:', error);
    
    // Use fallback translations
    this.translations = this.getFallbackTranslations();
    
    // Try to setup basic functionality
    try {
      this.setupEventListeners();
      this.updateUI(this.currentLang);
    } catch (e) {
      console.error('Could not setup event listeners:', e);
    }
  }

  /**
   * Get minimal fallback translations
   * @returns {Object} - Fallback translation object
   */
  getFallbackTranslations() {
    return {
      en: {
        'nav.home': 'Home',
        'nav.apartments': 'Apartments',
        'nav.about': 'About',
        'nav.contact': 'Contact',
        'nav.login': 'Login',
        'nav.register': 'Register',
        'nav.dashboard': 'Dashboard',
        'nav.view': 'View',
        'nav.marketplace.label': 'Marketplace',
        'hero.title': 'Find Your Next Apartment<br>with Confidence',
        'hero.subtitle': 'Secure, transparent, and easy apartment hunting for students and professionals in Germany.',
        'footer.copyright': '© 2025 SichrPlace. All rights reserved.'
      },
      de: {
        'nav.home': 'Startseite',
        'nav.apartments': 'Wohnungen',
        'nav.about': 'Über uns',
        'nav.contact': 'Kontakt',
        'nav.login': 'Anmelden',
        'nav.register': 'Registrieren',
        'nav.dashboard': 'Dashboard',
        'nav.view': 'Ansehen',
        'nav.marketplace.label': 'Marktplatz',
        'hero.title': 'Finden Sie Ihre nächste Wohnung<br>mit Vertrauen',
        'hero.subtitle': 'Sichere, transparente und einfache Wohnungssuche für Studenten und Berufstätige in Deutschland.',
        'footer.copyright': '© 2025 SichrPlace. Alle Rechte vorbehalten.'
      },
      tr: {
        'nav.home': 'Ana Sayfa',
        'nav.apartments': 'Daireler',
        'nav.about': 'Hakkımızda',
        'nav.contact': 'İletişim',
        'nav.login': 'Giriş Yap',
        'nav.register': 'Kayıt Ol',
        'nav.dashboard': 'Kontrol Paneli',
        'nav.view': 'Görüntüle',
        'nav.marketplace.label': 'Pazar Yeri',
        'hero.title': 'Güvenle Bir Sonraki Daireyi<br>Bulun',
        'hero.subtitle': 'Almanya\'daki öğrenciler ve profesyoneller için güvenli, şeffaf ve kolay daire arama.',
        'footer.copyright': '© 2025 SichrPlace. Tüm hakları saklıdır.'
      }
    };
  }

  /**
   * Get current language
   * @returns {string} - Current language code
   */
  getCurrentLanguage() {
    return this.currentLang;
  }

  /**
   * Get all supported languages
   * @returns {Array} - Array of language codes
   */
  getSupportedLanguages() {
    return this.supportedLanguages;
  }

  /**
   * Check if a language is supported
   * @param {string} lang - Language code
   * @returns {boolean}
   */
  isLanguageSupported(lang) {
    return this.supportedLanguages.includes(lang);
  }
}

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.translationHandler = new TranslationHandler();
  });
} else {
  // DOM already loaded
  window.translationHandler = new TranslationHandler();
}

// Add animation keyframes
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInUp {
    from {
      transform: translateY(100px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  @keyframes fadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TranslationHandler;
}
