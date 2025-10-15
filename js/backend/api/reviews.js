const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const auth = require('../middleware/auth');

/**
 * @route   POST /api/reviews
 * @desc    Submit a new review for an apartment
 * @access  Private (authenticated users only)
 */
router.post('/', auth, async (req, res) => {
  try {
    const { apartment_id, viewing_request_id, rating, title, comment } = req.body;
    const user_id = req.user.id;

    // Validation
    if (!apartment_id || !rating || !title || !comment) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: apartment_id, rating, title, comment'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }

    if (title.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Title must not exceed 100 characters'
      });
    }

    if (comment.length < 10 || comment.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Comment must be between 10 and 1000 characters'
      });
    }

    // Check if user already reviewed this apartment
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('apartment_id', apartment_id)
      .eq('user_id', user_id)
      .single();

    if (existingReview) {
      return res.status(400).json({
        success: false,
        error: 'You have already reviewed this apartment'
      });
    }

    // Verify apartment exists
    const { data: apartment, error: apartmentError } = await supabase
      .from('apartments')
      .select('id, landlord_id')
      .eq('id', apartment_id)
      .single();

    if (apartmentError || !apartment) {
      return res.status(404).json({
        success: false,
        error: 'Apartment not found'
      });
    }

    // Basic profanity/spam check (simple version)
    const suspiciousPatterns = /viagra|cialis|casino|lottery|winner|click here|buy now/gi;
    if (suspiciousPatterns.test(comment) || suspiciousPatterns.test(title)) {
      // Auto-flag for moderation but still create
      const { data: review, error } = await supabase
        .from('reviews')
        .insert({
          apartment_id,
          user_id,
          viewing_request_id: viewing_request_id || null,
          rating,
          title,
          comment,
          status: 'pending', // Flagged for manual review
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Review creation error:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to submit review'
        });
      }

      return res.status(201).json({
        success: true,
        review,
        message: 'Review submitted and pending moderation'
      });
    }

    // Create review (auto-approved for clean content)
    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        apartment_id,
        user_id,
        viewing_request_id: viewing_request_id || null,
        rating,
        title,
        comment,
        status: 'approved', // Auto-approve clean reviews
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Review creation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to submit review'
      });
    }

    // TODO: Send notification to landlord
    // TODO: Update apartment average rating

    res.status(201).json({
      success: true,
      review,
      message: 'Review submitted successfully'
    });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/reviews/apartment/:apartmentId
 * @desc    Get all approved reviews for an apartment
 * @access  Public
 */
router.get('/apartment/:apartmentId', async (req, res) => {
  try {
    const { apartmentId } = req.params;
    const { limit = 10, offset = 0, sort = 'recent' } = req.query;

    let query = supabase
      .from('reviews')
      .select(`
        id,
        rating,
        title,
        comment,
        created_at,
        user_id,
        users:user_id (
          id,
          username,
          profile_picture
        )
      `)
      .eq('apartment_id', apartmentId)
      .eq('status', 'approved')
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Sort options
    if (sort === 'recent') {
      query = query.order('created_at', { ascending: false });
    } else if (sort === 'highest') {
      query = query.order('rating', { ascending: false });
    } else if (sort === 'lowest') {
      query = query.order('rating', { ascending: true });
    }

    const { data: reviews, error, count } = await query;

    if (error) {
      console.error('Fetch reviews error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch reviews'
      });
    }

    // Get average rating and total count
    const { data: stats } = await supabase
      .from('reviews')
      .select('rating')
      .eq('apartment_id', apartmentId)
      .eq('status', 'approved');

    const totalReviews = stats?.length || 0;
    const averageRating = totalReviews > 0
      ? (stats.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
      : 0;

    // Anonymize user data for privacy
    const anonymizedReviews = reviews.map(review => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      created_at: review.created_at,
      reviewer: {
        name: review.users?.username ? `${review.users.username.substring(0, 1)}***` : 'Anonymous',
        verified: true
      }
    }));

    res.json({
      success: true,
      reviews: anonymizedReviews,
      pagination: {
        total: totalReviews,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < totalReviews
      },
      stats: {
        averageRating: parseFloat(averageRating),
        totalReviews,
        distribution: {
          5: stats?.filter(r => r.rating === 5).length || 0,
          4: stats?.filter(r => r.rating === 4).length || 0,
          3: stats?.filter(r => r.rating === 3).length || 0,
          2: stats?.filter(r => r.rating === 2).length || 0,
          1: stats?.filter(r => r.rating === 1).length || 0
        }
      }
    });
  } catch (error) {
    console.error('Get apartment reviews error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/reviews/user
 * @desc    Get current user's reviews
 * @access  Private
 */
router.get('/user', auth, async (req, res) => {
  try {
    const user_id = req.user.id;

    const { data: reviews, error } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        title,
        comment,
        status,
        created_at,
        updated_at,
        apartments:apartment_id (
          id,
          title,
          address,
          city
        )
      `)
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch user reviews error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch your reviews'
      });
    }

    res.json({
      success: true,
      reviews
    });
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @route   PUT /api/reviews/:reviewId
 * @desc    Update user's own review
 * @access  Private
 */
router.put('/:reviewId', auth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, title, comment } = req.body;
    const user_id = req.user.id;

    // Verify review belongs to user
    const { data: existingReview, error: fetchError } = await supabase
      .from('reviews')
      .select('user_id')
      .eq('id', reviewId)
      .single();

    if (fetchError || !existingReview) {
      return res.status(404).json({
        success: false,
        error: 'Review not found'
      });
    }

    if (existingReview.user_id !== user_id) {
      return res.status(403).json({
        success: false,
        error: 'You can only edit your own reviews'
      });
    }

    // Validation
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }

    const updateData = {
      updated_at: new Date().toISOString(),
      status: 'pending' // Re-moderate after edit
    };

    if (rating) updateData.rating = rating;
    if (title) updateData.title = title;
    if (comment) updateData.comment = comment;

    const { data: updatedReview, error } = await supabase
      .from('reviews')
      .update(updateData)
      .eq('id', reviewId)
      .select()
      .single();

    if (error) {
      console.error('Update review error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update review'
      });
    }

    res.json({
      success: true,
      review: updatedReview,
      message: 'Review updated and pending re-moderation'
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @route   DELETE /api/reviews/:reviewId
 * @desc    Delete user's own review
 * @access  Private
 */
router.delete('/:reviewId', auth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const user_id = req.user.id;

    // Verify review belongs to user
    const { data: existingReview, error: fetchError } = await supabase
      .from('reviews')
      .select('user_id')
      .eq('id', reviewId)
      .single();

    if (fetchError || !existingReview) {
      return res.status(404).json({
        success: false,
        error: 'Review not found'
      });
    }

    if (existingReview.user_id !== user_id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'You can only delete your own reviews'
      });
    }

    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId);

    if (error) {
      console.error('Delete review error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete review'
      });
    }

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/reviews/pending
 * @desc    Get all pending reviews for moderation
 * @access  Admin only
 */
router.get('/pending', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const { data: reviews, error } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        title,
        comment,
        status,
        created_at,
        users:user_id (
          id,
          username,
          email
        ),
        apartments:apartment_id (
          id,
          title,
          city
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Fetch pending reviews error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch pending reviews'
      });
    }

    res.json({
      success: true,
      reviews,
      total: reviews.length
    });
  } catch (error) {
    console.error('Get pending reviews error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @route   PUT /api/reviews/:reviewId/moderate
 * @desc    Approve or reject a review
 * @access  Admin only
 */
router.put('/:reviewId/moderate', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const { reviewId } = req.params;
    const { status, moderation_note } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be either "approved" or "rejected"'
      });
    }

    const { data: review, error } = await supabase
      .from('reviews')
      .update({
        status,
        moderation_note: moderation_note || null,
        moderated_at: new Date().toISOString(),
        moderated_by: req.user.id
      })
      .eq('id', reviewId)
      .select()
      .single();

    if (error) {
      console.error('Moderate review error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to moderate review'
      });
    }

    res.json({
      success: true,
      review,
      message: `Review ${status} successfully`
    });
  } catch (error) {
    console.error('Moderate review error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/reviews/stats/apartment/:apartmentId
 * @desc    Get review statistics for an apartment
 * @access  Public
 */
router.get('/stats/apartment/:apartmentId', async (req, res) => {
  try {
    const { apartmentId } = req.params;

    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('rating')
      .eq('apartment_id', apartmentId)
      .eq('status', 'approved');

    if (error) {
      console.error('Fetch review stats error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch review statistics'
      });
    }

    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
      : 0;

    const distribution = {
      5: reviews.filter(r => r.rating === 5).length,
      4: reviews.filter(r => r.rating === 4).length,
      3: reviews.filter(r => r.rating === 3).length,
      2: reviews.filter(r => r.rating === 2).length,
      1: reviews.filter(r => r.rating === 1).length
    };

    res.json({
      success: true,
      stats: {
        totalReviews,
        averageRating: parseFloat(averageRating),
        distribution,
        percentages: {
          5: totalReviews > 0 ? ((distribution[5] / totalReviews) * 100).toFixed(1) : 0,
          4: totalReviews > 0 ? ((distribution[4] / totalReviews) * 100).toFixed(1) : 0,
          3: totalReviews > 0 ? ((distribution[3] / totalReviews) * 100).toFixed(1) : 0,
          2: totalReviews > 0 ? ((distribution[2] / totalReviews) * 100).toFixed(1) : 0,
          1: totalReviews > 0 ? ((distribution[1] / totalReviews) * 100).toFixed(1) : 0
        }
      }
    });
  } catch (error) {
    console.error('Get review stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
