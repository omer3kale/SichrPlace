// Simple Language Switcher for SichrPlace
let currentLanguage = 'en';
let translations = {};

// Load translations and initialize
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Load translations
        const response = await fetch('js/translations.json');
        translations = await response.json();
        
        // Set up language dropdown
        setupLanguageDropdown();
        
        // Apply initial language
        applyLanguage(currentLanguage);
        
    } catch (error) {
        console.error('Error loading language switcher:', error);
    }
});

function setupLanguageDropdown() {
    const languageBtn = document.getElementById('language-btn');
    const languageDropdown = document.getElementById('language-dropdown');
    
    if (languageBtn && languageDropdown) {
        // Toggle dropdown
        languageBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            languageDropdown.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!languageBtn.contains(e.target) && !languageDropdown.contains(e.target)) {
                languageDropdown.classList.remove('show');
            }
        });
        
        // Language option clicks
        const langOptions = languageDropdown.querySelectorAll('.lang-option');
        langOptions.forEach(function(option) {
            option.addEventListener('click', function(e) {
                e.preventDefault();
                const lang = option.getAttribute('data-lang');
                switchLanguage(lang);
                languageDropdown.classList.remove('show');
            });
        });
    }
}

function switchLanguage(lang) {
    if (translations[lang]) {
        currentLanguage = lang;
        localStorage.setItem('sichrplace-language', lang);
        applyLanguage(lang);
        updateLanguageDisplay();
    }
}

function applyLanguage(lang) {
    // Translate text content
    const elements = document.querySelectorAll('[data-translate]');
    elements.forEach(function(element) {
        const key = element.getAttribute('data-translate');
        const translation = getTranslation(key, lang);
        if (translation) {
            element.innerHTML = translation;
        }
    });
    
    // Translate placeholders
    const placeholderElements = document.querySelectorAll('[data-translate-placeholder]');
    placeholderElements.forEach(function(element) {
        const key = element.getAttribute('data-translate-placeholder');
        const translation = getTranslation(key, lang);
        if (translation) {
            element.placeholder = translation;
        }
    });
    
    // Translate aria-labels
    const ariaElements = document.querySelectorAll('[data-translate-aria]');
    ariaElements.forEach(function(element) {
        const key = element.getAttribute('data-translate-aria');
        const translation = getTranslation(key, lang);
        if (translation) {
            element.setAttribute('aria-label', translation);
        }
    });
    
    // Translate title attributes
    const titleElements = document.querySelectorAll('[data-translate-title]');
    titleElements.forEach(function(element) {
        const key = element.getAttribute('data-translate-title');
        const translation = getTranslation(key, lang);
        if (translation) {
            element.setAttribute('title', translation);
        }
    });
    
    // Update page language
    document.documentElement.setAttribute('lang', lang);
}

function getTranslation(key, lang) {
    const keys = key.split('.');
    let translation = translations[lang];
    
    for (let i = 0; i < keys.length; i++) {
        if (translation && translation[keys[i]]) {
            translation = translation[keys[i]];
        } else {
            // Fallback to English
            translation = translations['en'];
            for (let j = 0; j < keys.length; j++) {
                if (translation && translation[keys[j]]) {
                    translation = translation[keys[j]];
                } else {
                    return null;
                }
            }
            break;
        }
    }
    
    return translation;
}

function updateLanguageDisplay() {
    const currentLangElement = document.getElementById('current-lang');
    if (currentLangElement) {
        currentLangElement.textContent = currentLanguage.toUpperCase();
    }
    
    // Update active state
    const langOptions = document.querySelectorAll('.lang-option');
    langOptions.forEach(function(option) {
        const lang = option.getAttribute('data-lang');
        if (lang === currentLanguage) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
}