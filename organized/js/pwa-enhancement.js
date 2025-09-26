// SichrPlace PWA Enhancement Script
// Generates PWA icons and improves mobile experience

const fs = require('fs');
const sharp = require('sharp'); // Will use online converter as fallback

// PWA icon sizes needed
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];
const logoPath = './frontend/img/SichrPlaceLogo_944x944.jpg';

console.log('🚀 SichrPlace PWA Enhancement Starting...');

// Function to create favicon and PWA icons
async function createIcons() {
  console.log('📱 Creating PWA icons from logo...');
  
  try {
    // Check if sharp is available (for server-side processing)
    if (typeof sharp !== 'undefined') {
      for (const size of iconSizes) {
        await sharp(logoPath)
          .resize(size, size)
          .png()
          .toFile(`./frontend/img/pwa-icon-${size}.png`);
        console.log(`✅ Created pwa-icon-${size}.png`);
      }
      
      // Create favicon
      await sharp(logoPath)
        .resize(32, 32)
        .png()
        .toFile('./frontend/img/favicon-32x32.png');
      
      await sharp(logoPath)
        .resize(16, 16)
        .png()
        .toFile('./frontend/img/favicon-16x16.png');
        
      console.log('✅ Created favicon files');
      
    } else {
      console.log('⚠️  Sharp not available, using online converter fallback...');
      // Fallback instructions
      console.log(`
📱 PWA ICON GENERATION INSTRUCTIONS:

1. Use online converter (e.g., https://favicon.io/favicon-converter/)
2. Upload: ${logoPath}
3. Generate these sizes and save to frontend/img/:
   
   ${iconSizes.map(size => `- pwa-icon-${size}.png (${size}x${size})`).join('\n   ')}
   
4. Additional icons needed:
   - favicon-16x16.png
   - favicon-32x32.png
   - apple-touch-icon.png (180x180)
   - web-app-manifest-192x192.png (192x192)
   - web-app-manifest-512x512.png (512x512)

🔧 Or install sharp package: npm install sharp
`);
    }
    
  } catch (error) {
    console.error('❌ Error creating icons:', error);
    console.log('📝 Manual icon generation required - see instructions above');
  }
}

// Enhanced mobile styles
const mobileCSS = `
/* PWA Mobile Enhancement Styles */

/* Enhanced touch targets */
.btn, button, a, input, select, textarea {
  min-height: 44px;
  min-width: 44px;
  touch-action: manipulation;
}

/* Mobile-first responsive grid */
@media (max-width: 768px) {
  .container {
    padding: 0 16px;
  }
  
  .grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  /* Enhanced mobile navigation */
  .navbar {
    position: sticky;
    top: 0;
    z-index: 1000;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  
  /* Mobile-optimized forms */
  .form-group {
    margin-bottom: 20px;
  }
  
  input, select, textarea {
    font-size: 16px; /* Prevents zoom on iOS */
    padding: 12px 16px;
    border-radius: 8px;
  }
  
  /* Swipe gestures for cards */
  .apartment-card {
    position: relative;
    overflow: hidden;
    transition: transform 0.3s ease;
  }
  
  .apartment-card.swiped-left {
    transform: translateX(-100%);
  }
  
  .apartment-card.swiped-right {
    transform: translateX(100%);
  }
}

/* PWA-specific enhancements */
@media (display-mode: standalone) {
  body {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
  
  .navbar {
    padding-top: calc(env(safe-area-inset-top) + 16px);
  }
  
  /* Hide browser UI elements when in app mode */
  .browser-only {
    display: none !important;
  }
}

/* Pull-to-refresh indicator */
.pull-to-refresh {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary);
  color: white;
  transform: translateY(-100%);
  transition: transform 0.3s ease;
}

.pull-to-refresh.active {
  transform: translateY(0);
}

/* Enhanced loading states */
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Mobile-optimized modals */
@media (max-width: 768px) {
  .modal {
    margin: 0;
    height: 100vh;
    border-radius: 0;
    animation: slideUpModal 0.3s ease-out;
  }
  
  @keyframes slideUpModal {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
}
`;

// Enhanced JavaScript for mobile interactions
const mobileJS = `
// SichrPlace Mobile Enhancement Features

class MobileEnhancements {
  constructor() {
    this.init();
  }
  
  init() {
    console.log('📱 Initializing mobile enhancements...');
    
    this.setupPullToRefresh();
    this.setupSwipeGestures();
    this.setupTouchOptimizations();
    this.setupKeyboardHandling();
    this.setupHapticFeedback();
    
    console.log('✅ Mobile enhancements initialized');
  }
  
  setupPullToRefresh() {
    let startY = 0;
    let currentY = 0;
    let isPulling = false;
    const threshold = 80;
    
    const indicator = document.createElement('div');
    indicator.className = 'pull-to-refresh';
    indicator.innerHTML = '<i class="fas fa-sync-alt"></i> Pull to refresh';
    document.body.insertBefore(indicator, document.body.firstChild);
    
    document.addEventListener('touchstart', (e) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    }, { passive: true });
    
    document.addEventListener('touchmove', (e) => {
      if (!isPulling) return;
      
      currentY = e.touches[0].clientY;
      const pullDistance = currentY - startY;
      
      if (pullDistance > 0 && pullDistance < threshold * 2) {
        const progress = Math.min(pullDistance / threshold, 1);
        indicator.style.transform = \`translateY(\${-100 + (progress * 100)}%)\`;
        
        if (pullDistance > threshold) {
          indicator.classList.add('active');
        } else {
          indicator.classList.remove('active');
        }
      }
    }, { passive: true });
    
    document.addEventListener('touchend', () => {
      if (isPulling && currentY - startY > threshold) {
        this.refreshPage();
      }
      
      isPulling = false;
      indicator.style.transform = 'translateY(-100%)';
      indicator.classList.remove('active');
    });
  }
  
  setupSwipeGestures() {
    const cards = document.querySelectorAll('.apartment-card');
    
    cards.forEach(card => {
      let startX = 0;
      let startY = 0;
      let currentX = 0;
      let currentY = 0;
      let isSwipe = false;
      
      card.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isSwipe = true;
      }, { passive: true });
      
      card.addEventListener('touchmove', (e) => {
        if (!isSwipe) return;
        
        currentX = e.touches[0].clientX;
        currentY = e.touches[0].clientY;
        
        const deltaX = currentX - startX;
        const deltaY = Math.abs(currentY - startY);
        
        // Only consider horizontal swipes
        if (Math.abs(deltaX) > deltaY && Math.abs(deltaX) > 50) {
          card.style.transform = \`translateX(\${deltaX}px)\`;
          
          // Add visual feedback
          if (deltaX > 100) {
            card.style.backgroundColor = '#10B981'; // Like action
          } else if (deltaX < -100) {
            card.style.backgroundColor = '#EF4444'; // Pass action
          } else {
            card.style.backgroundColor = '';
          }
        }
      }, { passive: true });
      
      card.addEventListener('touchend', () => {
        if (!isSwipe) return;
        
        const deltaX = currentX - startX;
        
        if (Math.abs(deltaX) > 150) {
          // Trigger swipe action
          if (deltaX > 0) {
            this.likeApartment(card);
            card.classList.add('swiped-right');
          } else {
            this.passApartment(card);
            card.classList.add('swiped-left');
          }
          
          // Remove card after animation
          setTimeout(() => {
            card.remove();
          }, 300);
        } else {
          // Snap back
          card.style.transform = '';
          card.style.backgroundColor = '';
        }
        
        isSwipe = false;
      });
    });
  }
  
  setupTouchOptimizations() {
    // Disable double-tap zoom on buttons
    document.querySelectorAll('button, .btn').forEach(btn => {
      btn.style.touchAction = 'manipulation';
    });
    
    // Add touch feedback to interactive elements
    document.querySelectorAll('button, .btn, .card, a').forEach(el => {
      el.addEventListener('touchstart', function() {
        this.style.opacity = '0.7';
        this.style.transform = 'scale(0.98)';
      }, { passive: true });
      
      el.addEventListener('touchend', function() {
        this.style.opacity = '';
        this.style.transform = '';
      });
    });
  }
  
  setupKeyboardHandling() {
    // Handle virtual keyboard
    let initialViewportHeight = window.innerHeight;
    
    window.addEventListener('resize', () => {
      const currentHeight = window.innerHeight;
      const heightDifference = initialViewportHeight - currentHeight;
      
      if (heightDifference > 150) {
        // Keyboard is likely open
        document.body.classList.add('keyboard-open');
        
        // Scroll focused input into view
        const focused = document.activeElement;
        if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA')) {
          setTimeout(() => {
            focused.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 300);
        }
      } else {
        document.body.classList.remove('keyboard-open');
      }
    });
  }
  
  setupHapticFeedback() {
    if ('vibrate' in navigator) {
      // Add haptic feedback to important actions
      document.querySelectorAll('.btn-primary, .heart-btn, .favorite-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          navigator.vibrate(50); // Short vibration
        });
      });
      
      // Error feedback
      document.querySelectorAll('.error, .alert-danger').forEach(el => {
        navigator.vibrate([100, 50, 100]); // Error pattern
      });
    }
  }
  
  refreshPage() {
    console.log('🔄 Pull to refresh triggered');
    
    // Show loading state
    const indicator = document.querySelector('.pull-to-refresh');
    indicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
    
    // Simulate refresh (in real app, this would reload data)
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }
  
  likeApartment(card) {
    console.log('❤️ Liked apartment');
    const apartmentId = card.dataset.apartmentId;
    
    // Add to favorites via API
    if (apartmentId) {
      fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apartmentId })
      }).catch(console.error);
    }
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  }
  
  passApartment(card) {
    console.log('👎 Passed apartment');
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
  }
}

// Initialize mobile enhancements
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new MobileEnhancements();
  });
} else {
  new MobileEnhancements();
}
`;

// Create the files
function createEnhancementFiles() {
  console.log('📝 Creating PWA enhancement files...');
  
  // Create mobile CSS
  fs.writeFileSync('./frontend/css/mobile-enhancements.css', mobileCSS);
  console.log('✅ Created mobile-enhancements.css');
  
  // Create mobile JS
  fs.writeFileSync('./frontend/js/mobile-enhancements.js', mobileJS);
  console.log('✅ Created mobile-enhancements.js');
  
  console.log(`
🎉 PWA Enhancement Complete!

📱 Mobile Features Added:
- Pull-to-refresh functionality
- Swipe gestures for apartment cards
- Enhanced touch targets (44px minimum)
- Haptic feedback
- Virtual keyboard handling
- Mobile-optimized modals
- Smooth animations and transitions

🔧 Next Steps:
1. Add mobile-enhancements.css to your HTML files
2. Add mobile-enhancements.js to your HTML files
3. Generate PWA icons (see instructions above)
4. Test on mobile devices

🚀 Your PWA is now mobile-optimized and robust!
`);
}

// Run the enhancement
createIcons();
createEnhancementFiles();