// Simple Feedback Widget for SichrPlace
class FeedbackWidget {
  constructor() {
    this.isOpen = false;
    this.init();
  }

  init() {
    this.createStyles();
    this.createWidget();
    this.attachEventListeners();
  }

  createStyles() {
    const styles = `
      .feedback-widget {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 10000;
        font-family: var(--body-font, 'Roboto', sans-serif);
      }

      .feedback-trigger {
        background: var(--primary, #2563EB);
        color: white;
        border: none;
        border-radius: 25px;
        padding: 12px 20px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        transition: all 0.3s ease;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .feedback-trigger:hover {
        background: var(--primary-dark, #1d4ed8);
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
      }

      .feedback-modal {
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 320px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        transform: translateY(20px) scale(0.9);
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
        border: 1px solid #e5e7eb;
      }

      .feedback-modal.open {
        transform: translateY(0) scale(1);
        opacity: 1;
        visibility: visible;
      }

      .feedback-header {
        padding: 16px 20px;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .feedback-title {
        font-weight: 600;
        color: var(--text, #222);
        margin: 0;
        font-size: 16px;
      }

      .feedback-close {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #6b7280;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .feedback-body {
        padding: 20px;
      }

      .feedback-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .feedback-select,
      .feedback-textarea,
      .feedback-input {
        border: 1px solid #d1d5db;
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 14px;
        font-family: inherit;
        width: 100%;
        box-sizing: border-box;
      }

      .feedback-textarea {
        min-height: 80px;
        resize: vertical;
      }

      .feedback-input::placeholder,
      .feedback-textarea::placeholder {
        color: #9ca3af;
      }

      .feedback-submit {
        background: var(--primary, #2563EB);
        color: white;
        border: none;
        border-radius: 6px;
        padding: 10px 16px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s ease;
      }

      .feedback-submit:hover:not(:disabled) {
        background: var(--primary-dark, #1d4ed8);
      }

      .feedback-submit:disabled {
        background: #9ca3af;
        cursor: not-allowed;
      }

      .feedback-success {
        text-align: center;
        padding: 20px;
        color: var(--success, #059669);
      }

      .feedback-error {
        color: var(--error, #dc2626);
        font-size: 13px;
        margin-top: 4px;
      }

      @media (max-width: 480px) {
        .feedback-modal {
          left: 20px;
          right: 20px;
          width: auto;
        }
      }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  createWidget() {
    const widget = document.createElement('div');
    widget.className = 'feedback-widget';
    widget.innerHTML = `
      <button class="feedback-trigger" id="feedback-trigger">
        💬 <span>Feedback</span>
      </button>
      <div class="feedback-modal" id="feedback-modal">
        <div class="feedback-header">
          <h3 class="feedback-title">Send Feedback</h3>
          <button class="feedback-close" id="feedback-close">×</button>
        </div>
        <div class="feedback-body">
          <form class="feedback-form" id="feedback-form">
            <select class="feedback-select" id="feedback-category" required>
              <option value="">Select category...</option>
              <option value="bug">🐛 Bug Report</option>
              <option value="feature_request">💡 Feature Request</option>
              <option value="general">💬 General Feedback</option>
              <option value="complaint">😞 Complaint</option>
              <option value="compliment">😊 Compliment</option>
            </select>
            
            <select class="feedback-select" id="feedback-severity">
              <option value="low">Low Priority</option>
              <option value="medium" selected>Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="critical">🚨 Critical</option>
            </select>

            <textarea 
              class="feedback-textarea" 
              id="feedback-message" 
              placeholder="Tell us what you think..." 
              required
            ></textarea>

            <input 
              type="email" 
              class="feedback-input" 
              id="feedback-email" 
              placeholder="Your email (optional)"
            >

            <button type="submit" class="feedback-submit" id="feedback-submit">
              Send Feedback
            </button>
            
            <div class="feedback-error" id="feedback-error"></div>
          </form>
          
          <div class="feedback-success" id="feedback-success" style="display: none;">
            <div style="font-size: 24px; margin-bottom: 8px;">✅</div>
            <div style="font-weight: 600;">Thank you!</div>
            <div style="font-size: 14px; color: #6b7280;">Your feedback has been received.</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(widget);
  }

  attachEventListeners() {
    const trigger = document.getElementById('feedback-trigger');
    const modal = document.getElementById('feedback-modal');
    const close = document.getElementById('feedback-close');
    const form = document.getElementById('feedback-form');

    trigger.addEventListener('click', () => this.toggleModal());
    close.addEventListener('click', () => this.closeModal());
    form.addEventListener('submit', (e) => this.handleSubmit(e));

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.closeModal();
      }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this.isOpen && !modal.contains(e.target) && !trigger.contains(e.target)) {
        this.closeModal();
      }
    });
  }

  toggleModal() {
    if (this.isOpen) {
      this.closeModal();
    } else {
      this.openModal();
    }
  }

  openModal() {
    const modal = document.getElementById('feedback-modal');
    modal.classList.add('open');
    this.isOpen = true;

    // Focus on the category select
    setTimeout(() => {
      document.getElementById('feedback-category').focus();
    }, 100);
  }

  closeModal() {
    const modal = document.getElementById('feedback-modal');
    modal.classList.remove('open');
    this.isOpen = false;
    this.resetForm();
  }

  resetForm() {
    const form = document.getElementById('feedback-form');
    const success = document.getElementById('feedback-success');
    const error = document.getElementById('feedback-error');

    form.style.display = 'flex';
    success.style.display = 'none';
    error.textContent = '';
    form.reset();
    
    // Reset severity to medium
    document.getElementById('feedback-severity').value = 'medium';
  }

  async handleSubmit(e) {
    e.preventDefault();

    const submitButton = document.getElementById('feedback-submit');
    const errorDiv = document.getElementById('feedback-error');
    const form = document.getElementById('feedback-form');
    const success = document.getElementById('feedback-success');

    // Get form data
    const formData = {
      category: document.getElementById('feedback-category').value,
      severity: document.getElementById('feedback-severity').value,
      message: document.getElementById('feedback-message').value,
      email: document.getElementById('feedback-email').value || null,
      user_id: this.getCurrentUserId() // Try to get user ID if logged in
    };

    // Validation
    if (!formData.message.trim()) {
      errorDiv.textContent = 'Please enter your feedback message.';
      return;
    }

    if (!formData.category) {
      errorDiv.textContent = 'Please select a feedback category.';
      return;
    }

    // Submit feedback
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';
    errorDiv.textContent = '';

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Show success message
        form.style.display = 'none';
        success.style.display = 'block';

        // Track feedback submission in analytics
        if (window.trackEvent) {
          window.trackEvent('feedback_submitted', {
            category: formData.category,
            severity: formData.severity,
            has_email: !!formData.email
          });
        }

        // Auto-close after 3 seconds
        setTimeout(() => {
          this.closeModal();
        }, 3000);

      } else {
        throw new Error(result.error || 'Failed to submit feedback');
      }

    } catch (error) {
      console.error('Feedback submission error:', error);
      errorDiv.textContent = 'Failed to send feedback. Please try again.';
      
      // Track error in analytics
      if (window.trackEvent) {
        window.trackEvent('feedback_error', {
          error: error.message
        });
      }

    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Send Feedback';
    }
  }

  getCurrentUserId() {
    // Try to get user ID from various sources
    try {
      // From localStorage
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        return user.id || user.user_id;
      }

      // From sessionStorage
      const sessionData = sessionStorage.getItem('user');
      if (sessionData) {
        const user = JSON.parse(sessionData);
        return user.id || user.user_id;
      }

      // From global user object
      if (window.currentUser && window.currentUser.id) {
        return window.currentUser.id;
      }

    } catch (error) {
      console.warn('Could not determine user ID:', error);
    }

    return null;
  }
}

// Initialize feedback widget when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new FeedbackWidget();
  });
} else {
  new FeedbackWidget();
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FeedbackWidget;
}