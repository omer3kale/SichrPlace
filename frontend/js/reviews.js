/**
 * SichrPlace Review System
 * Handles review submission, display, and management
 */

class ReviewSystem {
  constructor(apiBaseUrl = '/api') {
    this.apiBaseUrl = apiBaseUrl;
    this.currentApartmentId = null;
    this.userToken = localStorage.getItem('authToken');
  }

  /**
   * Initialize review system for an apartment page
   */
  async init(apartmentId) {
    this.currentApartmentId = apartmentId;
    await this.loadReviews(apartmentId);
    this.attachEventListeners();
  }

  /**
   * Load and display reviews for an apartment
   */
  async loadReviews(apartmentId, options = {}) {
    const { limit = 10, offset = 0, sort = 'recent' } = options;

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/reviews/apartment/${apartmentId}?limit=${limit}&offset=${offset}&sort=${sort}`
      );

      if (!response.ok) {
        throw new Error('Failed to load reviews');
      }

      const data = await response.json();

      if (data.success) {
        this.renderReviews(data.reviews, data.stats, data.pagination);
      }
    } catch (error) {
      console.error('Load reviews error:', error);
      this.showError('Unable to load reviews. Please try again later.');
    }
  }

  /**
   * Render reviews to the page
   */
  renderReviews(reviews, stats, pagination) {
    // Render statistics
    this.renderStats(stats);

    // Render review list
    const container = document.getElementById('reviews-list');
    if (!container) return;

    if (reviews.length === 0) {
      container.innerHTML = `
        <div class="no-reviews">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <h3>No reviews yet</h3>
          <p>Be the first to share your experience with this apartment!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = reviews.map(review => this.renderReviewCard(review)).join('');

    // Render pagination if needed
    if (pagination.hasMore) {
      this.renderPagination(pagination, container);
    }
  }

  /**
   * Render individual review card
   */
  renderReviewCard(review) {
    const date = new Date(review.created_at).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const stars = this.renderStars(review.rating);

    return `
      <div class="review-card" data-review-id="${review.id}">
        <div class="review-header">
          <div class="review-author">
            <div class="author-avatar">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <div class="author-info">
              <h4>${review.reviewer.name}</h4>
              ${review.reviewer.verified ? '<span class="verified-badge">✓ Verified Tenant</span>' : ''}
            </div>
          </div>
          <div class="review-rating">
            ${stars}
          </div>
        </div>
        
        <h3 class="review-title">${this.escapeHtml(review.title)}</h3>
        <p class="review-comment">${this.escapeHtml(review.comment)}</p>
        
        <div class="review-footer">
          <span class="review-date">${date}</span>
        </div>
      </div>
    `;
  }

  /**
   * Render review statistics
   */
  renderStats(stats) {
    const statsContainer = document.getElementById('review-stats');
    if (!statsContainer) return;

    const stars = this.renderStars(stats.averageRating, true);

    statsContainer.innerHTML = `
      <div class="stats-summary">
        <div class="average-rating">
          <span class="rating-number">${stats.averageRating}</span>
          <div class="rating-stars">${stars}</div>
          <span class="total-reviews">${stats.totalReviews} ${stats.totalReviews === 1 ? 'Review' : 'Reviews'}</span>
        </div>
      </div>
      
      <div class="rating-distribution">
        ${this.renderRatingDistribution(stats.distribution, stats.totalReviews)}
      </div>
    `;
  }

  /**
   * Render rating distribution bars
   */
  renderRatingDistribution(distribution, total) {
    let html = '';
    for (let i = 5; i >= 1; i--) {
      const count = distribution[i] || 0;
      const percentage = total > 0 ? (count / total) * 100 : 0;

      html += `
        <div class="distribution-row">
          <span class="star-label">${i}★</span>
          <div class="distribution-bar">
            <div class="distribution-fill" style="width: ${percentage}%"></div>
          </div>
          <span class="count-label">${count}</span>
        </div>
      `;
    }
    return html;
  }

  /**
   * Render star rating
   */
  renderStars(rating, allowHalf = false) {
    const fullStars = Math.floor(rating);
    const hasHalf = allowHalf && (rating % 1 >= 0.5);
    let html = '';

    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        html += '<span class="star filled">★</span>';
      } else if (i === fullStars + 1 && hasHalf) {
        html += '<span class="star half">★</span>';
      } else {
        html += '<span class="star">★</span>';
      }
    }

    return html;
  }

  /**
   * Show review submission form
   */
  showReviewForm() {
    if (!this.userToken) {
      this.showLoginPrompt();
      return;
    }

    const modal = document.getElementById('review-modal');
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  /**
   * Submit a new review
   */
  async submitReview(formData) {
    if (!this.userToken) {
      this.showError('Please log in to submit a review');
      return;
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.userToken}`
        },
        body: JSON.stringify({
          apartment_id: this.currentApartmentId,
          rating: formData.rating,
          title: formData.title,
          comment: formData.comment,
          viewing_request_id: formData.viewing_request_id || null
        })
      });

      const data = await response.json();

      if (data.success) {
        this.showSuccess('Review submitted successfully! ' + 
          (data.review.status === 'pending' ? 'It will appear after moderation.' : ''));
        this.closeReviewForm();
        await this.loadReviews(this.currentApartmentId);
      } else {
        this.showError(data.error || 'Failed to submit review');
      }
    } catch (error) {
      console.error('Submit review error:', error);
      this.showError('Unable to submit review. Please try again later.');
    }
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Write review button
    const writeReviewBtn = document.getElementById('write-review-btn');
    if (writeReviewBtn) {
      writeReviewBtn.addEventListener('click', () => this.showReviewForm());
    }

    // Review form submission
    const reviewForm = document.getElementById('review-form');
    if (reviewForm) {
      reviewForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = {
          rating: parseInt(document.getElementById('review-rating').value),
          title: document.getElementById('review-title').value.trim(),
          comment: document.getElementById('review-comment').value.trim()
        };

        if (this.validateReviewForm(formData)) {
          this.submitReview(formData);
        }
      });
    }

    // Star rating interaction
    this.attachStarRatingListeners();

    // Close modal
    const closeBtn = document.querySelector('.close-review-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeReviewForm());
    }

    // Sort reviews
    const sortSelect = document.getElementById('review-sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.loadReviews(this.currentApartmentId, { sort: e.target.value });
      });
    }
  }

  /**
   * Attach star rating click listeners
   */
  attachStarRatingListeners() {
    const stars = document.querySelectorAll('.rating-input .star');
    const ratingInput = document.getElementById('review-rating');

    stars.forEach((star, index) => {
      star.addEventListener('click', () => {
        const rating = index + 1;
        ratingInput.value = rating;

        stars.forEach((s, i) => {
          if (i < rating) {
            s.classList.add('filled');
          } else {
            s.classList.remove('filled');
          }
        });
      });

      star.addEventListener('mouseenter', () => {
        stars.forEach((s, i) => {
          if (i <= index) {
            s.classList.add('hover');
          } else {
            s.classList.remove('hover');
          }
        });
      });
    });

    const ratingContainer = document.querySelector('.rating-input');
    if (ratingContainer) {
      ratingContainer.addEventListener('mouseleave', () => {
        stars.forEach(s => s.classList.remove('hover'));
      });
    }
  }

  /**
   * Validate review form
   */
  validateReviewForm(formData) {
    if (!formData.rating || formData.rating < 1 || formData.rating > 5) {
      this.showError('Please select a rating');
      return false;
    }

    if (!formData.title || formData.title.length < 3) {
      this.showError('Please enter a title (minimum 3 characters)');
      return false;
    }

    if (formData.title.length > 100) {
      this.showError('Title must not exceed 100 characters');
      return false;
    }

    if (!formData.comment || formData.comment.length < 10) {
      this.showError('Please enter a review (minimum 10 characters)');
      return false;
    }

    if (formData.comment.length > 1000) {
      this.showError('Review must not exceed 1000 characters');
      return false;
    }

    return true;
  }

  /**
   * Close review form modal
   */
  closeReviewForm() {
    const modal = document.getElementById('review-modal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }

    // Reset form
    const form = document.getElementById('review-form');
    if (form) form.reset();

    // Reset stars
    const stars = document.querySelectorAll('.rating-input .star');
    stars.forEach(s => s.classList.remove('filled'));
  }

  /**
   * Show login prompt
   */
  showLoginPrompt() {
    this.showError('Please log in to write a review');
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 2000);
  }

  /**
   * Show error message
   */
  showError(message) {
    this.showToast(message, 'error');
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    this.showToast(message, 'success');
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Render pagination
   */
  renderPagination(pagination, container) {
    const paginationHtml = `
      <div class="reviews-pagination">
        <button 
          class="load-more-btn" 
          data-offset="${pagination.offset + pagination.limit}"
          ${!pagination.hasMore ? 'disabled' : ''}
        >
          Load More Reviews
        </button>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', paginationHtml);

    const loadMoreBtn = container.querySelector('.load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        const offset = parseInt(loadMoreBtn.dataset.offset);
        this.loadReviews(this.currentApartmentId, { offset });
      });
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReviewSystem;
}
