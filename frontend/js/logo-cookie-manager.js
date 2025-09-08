// 🍪 SichrPlace Logo Cookie Consent System
// Handles cookie consent for displaying logo images

class LogoCookieManager {
    constructor() {
        this.cookieName = 'sichrplace-logo-consent';
        this.hasConsent = this.getLogoConsent();
        this.init();
    }

    init() {
        if (!this.hasConsent) {
            this.showLogoConsentNotice();
        } else {
            this.enableLogos();
        }
    }

    getLogoConsent() {
        const consent = localStorage.getItem(this.cookieName);
        return consent === 'true';
    }

    setLogoConsent(consent) {
        localStorage.setItem(this.cookieName, consent.toString());
        this.hasConsent = consent;
        
        if (consent) {
            this.enableLogos();
        } else {
            this.disableLogos();
        }
    }

    showLogoConsentNotice() {
        const notice = document.createElement('div');
        notice.className = 'logo-cookie-notice';
        notice.innerHTML = `
            <h4>🛡️ Logo Display</h4>
            <p>We'd like to display our certified logos and shields. This helps verify our platform's authenticity and German certification status.</p>
            <div class="logo-cookie-buttons">
                <button class="logo-cookie-btn accept" onclick="logoCookieManager.acceptLogos()">
                    Allow Logos
                </button>
                <button class="logo-cookie-btn decline" onclick="logoCookieManager.declineLogos()">
                    Text Only
                </button>
            </div>
        `;

        document.body.appendChild(notice);
        
        // Show with animation
        setTimeout(() => {
            notice.classList.add('show');
        }, 500);
    }

    acceptLogos() {
        this.setLogoConsent(true);
        this.hideConsentNotice();
    }

    declineLogos() {
        this.setLogoConsent(false);
        this.hideConsentNotice();
    }

    hideConsentNotice() {
        const notice = document.querySelector('.logo-cookie-notice');
        if (notice) {
            notice.classList.remove('show');
            setTimeout(() => {
                notice.remove();
            }, 300);
        }
    }

    enableLogos() {
        document.body.classList.add('logos-enabled');
        document.body.classList.remove('logos-disabled');
        
        // Replace text-only logos with visual ones
        this.replacePlaceholderLogos();
    }

    disableLogos() {
        document.body.classList.add('logos-disabled');
        document.body.classList.remove('logos-enabled');
        
        // Replace visual logos with text-only versions
        this.replaceLogosWithText();
    }

    replacePlaceholderLogos() {
        // Find all logo placeholders and replace with visual logos
        const placeholders = document.querySelectorAll('.logo-placeholder');
        placeholders.forEach(placeholder => {
            const logoHtml = this.createVisualLogo(placeholder.dataset.type || 'default');
            placeholder.outerHTML = logoHtml;
        });

        // Update existing text-only logos
        const textLogos = document.querySelectorAll('.sichrplace-text-only');
        textLogos.forEach(textLogo => {
            // Simply replace with clean logo image
            textLogo.outerHTML = '<img src="img/SichrPlaceLogo_944x944.jpg" class="logo" alt="SichrPlace" style="height: 50px;">';
        });
    }

    replaceLogosWithText() {
        // Replace visual logos with simple text versions
        const logos = document.querySelectorAll('.sichrplace-logo');
        logos.forEach(logo => {
            logo.outerHTML = '<span class="sichrplace-text-only">SichrPlace</span>';
        });
    }

    createVisualLogo(type = 'default') {
        const logoTypes = {
            'navbar': `
                <img src="img/SichrPlaceLogo_944x944.jpg" class="logo" alt="SichrPlace" style="height: 50px;">
            `,
            'header': `
                <img src="img/SichrPlaceLogo_944x944.jpg" class="logo" alt="SichrPlace" style="height: 80px;">
            `,
            'footer': `
                <img src="img/SichrPlaceLogo_944x944.jpg" class="logo" alt="SichrPlace" style="height: 40px;">
            `,
            'default': `
                <img src="img/SichrPlaceLogo_944x944.jpg" class="logo" alt="SichrPlace" style="height: 50px;">
            `
        };

        return logoTypes[type] || logoTypes['default'];
    }

    createSimpleFooter() {
        return `
            <div class="simple-footer">
                <div class="footer-text">
                    SichrPlace - Secure apartment rental platform for Germany
                </div>
            </div>
        `;
    }

    // Public method to manually trigger logo update
    updateLogoDisplay() {
        if (this.hasConsent) {
            this.enableLogos();
        } else {
            this.disableLogos();
        }
    }
}

// Initialize logo cookie manager
const logoCookieManager = new LogoCookieManager();

// Make it globally available
window.logoCookieManager = logoCookieManager;

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LogoCookieManager;
}
