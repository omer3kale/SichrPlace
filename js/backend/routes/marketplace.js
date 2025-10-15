const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const supabaseModule = require('../config/supabase');
const supabase = supabaseModule.supabase || supabaseModule;

/**
 * GET /api/marketplace/listings
 * Get all marketplace listings with optional filters
 */
router.get('/listings', async (req, res) => {
  try {
    const { category, status, min_price, max_price } = req.query;

    let query = supabase
      .from('marketplace_listings')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }
    if (status) {
      query = query.eq('status', status);
    } else {
      // Default to available listings
      query = query.eq('status', 'available');
    }
    if (min_price) {
      query = query.gte('price', parseFloat(min_price));
    }
    if (max_price) {
      query = query.lte('price', parseFloat(max_price));
    }

    const { data: listings, error } = await query;

    if (error) throw error;

    res.json(listings || []);
  } catch (error) {
    console.error('Marketplace listings fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch marketplace listings'
    });
  }
});

/**
 * POST /api/marketplace/listings
 * Create a new marketplace listing
 */
router.post('/listings', auth, async (req, res) => {
  try {
    const { title, description, category, price, condition, images } = req.body;

    if (!title || !description || !category || price === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Title, description, category, and price are required'
      });
    }

    const { data: listing, error } = await supabase
      .from('marketplace_listings')
      .insert({
        seller_id: req.user.id,
        title,
        description,
        category,
        price: parseFloat(price),
        condition: condition || 'good',
        images: images || [],
        status: 'available'
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(listing);
  } catch (error) {
    console.error('Marketplace listing creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create marketplace listing'
    });
  }
});

/**
 * DELETE /api/marketplace/listings/:id
 * Delete a marketplace listing
 */
router.delete('/listings/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const { data: listing, error: fetchError } = await supabase
      .from('marketplace_listings')
      .select('seller_id')
      .eq('id', id)
      .single();

    if (fetchError || !listing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found'
      });
    }

    if (listing.seller_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const { error: deleteError } = await supabase
      .from('marketplace_listings')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    res.json({
      success: true,
      message: 'Listing deleted successfully'
    });
  } catch (error) {
    console.error('Marketplace listing deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete listing'
    });
  }
});

/**
 * GET /api/marketplace/chats
 * Get all chats for the authenticated user
 */
router.get('/chats', auth, async (req, res) => {
  try {
    const { data: chats, error } = await supabase
      .from('marketplace_chats')
      .select(`
        *,
        listing:listing_id(id, title, price, status),
        buyer:buyer_id(id, email, vorname, nachname),
        seller:seller_id(id, email, vorname, nachname)
      `)
      .or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`)
      .order('last_message_at', { ascending: false });

    if (error) throw error;

    res.json(chats || []);
  } catch (error) {
    console.error('Marketplace chats fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chats'
    });
  }
});

/**
 * POST /api/marketplace/contact
 * Send contact message about marketplace listing
 */
router.post('/contact', auth, async (req, res) => {
  try {
    const { listing_id, seller_id, message, contact_method } = req.body;

    if (!listing_id || !message) {
      return res.status(400).json({
        success: false,
        error: 'Listing ID and message are required'
      });
    }

    // Create contact message
    const { data: contact, error } = await supabase
      .from('marketplace_contacts')
      .insert({
        listing_id,
        seller_id,
        buyer_id: req.user.id,
        message,
        contact_method: contact_method || 'email',
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // Create notification for seller
    await supabase.from('notifications').insert({
      user_id: seller_id,
      type: 'marketplace_inquiry',
      title: 'New marketplace inquiry',
      message: `${req.user.vorname || 'A user'} is interested in your listing`,
      related_entity_type: 'marketplace_contact',
      related_entity_id: contact.id,
      priority: 'normal'
    });

    res.json({
      success: true,
      message: 'Contact request sent successfully',
      data: contact
    });
  } catch (error) {
    console.error('Marketplace contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send contact request'
    });
  }
});

/**
 * POST /api/marketplace/chat
 * Initialize or continue chat about marketplace listing
 */
router.post('/chat', auth, async (req, res) => {
  try {
    const { listing_id, seller_id, initial_message } = req.body;

    if (!listing_id || !seller_id) {
      return res.status(400).json({
        success: false,
        error: 'Listing ID and seller ID are required'
      });
    }

    // Check if chat already exists
    const { data: existingChat } = await supabase
      .from('marketplace_chats')
      .select('*')
      .eq('listing_id', listing_id)
      .eq('buyer_id', req.user.id)
      .eq('seller_id', seller_id)
      .single();

    if (existingChat) {
      return res.json({
        success: true,
        message: 'Chat already exists',
        data: existingChat,
        redirect: `/chat.html?id=${existingChat.id}`
      });
    }

    // Create new chat
    const { data: chat, error } = await supabase
      .from('marketplace_chats')
      .insert({
        listing_id,
        buyer_id: req.user.id,
        seller_id,
        status: 'active',
        last_message_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Send initial message if provided
    if (initial_message) {
      await supabase.from('chat_messages').insert({
        chat_id: chat.id,
        sender_id: req.user.id,
        message: initial_message,
        message_type: 'text'
      });
    }

    res.json({
      success: true,
      message: 'Chat created successfully',
      data: chat,
      redirect: `/chat.html?id=${chat.id}`
    });
  } catch (error) {
    console.error('Marketplace chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create chat'
    });
  }
});

/**
 * POST /api/marketplace/payment
 * Process marketplace payment
 */
router.post('/payment', auth, async (req, res) => {
  try {
    const { listing_id, amount, payment_method, shipping_address } = req.body;

    if (!listing_id || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Listing ID and amount are required'
      });
    }

    // Fetch listing details
    const { data: listing, error: listingError } = await supabase
      .from('marketplace_listings')
      .select('*, seller:seller_id(id, email, vorname, nachname)')
      .eq('id', listing_id)
      .single();

    if (listingError || !listing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found'
      });
    }

    if (listing.status !== 'available') {
      return res.status(400).json({
        success: false,
        error: 'Listing is no longer available'
      });
    }

    // Create payment transaction
    const { data: payment, error: paymentError } = await supabase
      .from('marketplace_payments')
      .insert({
        listing_id,
        buyer_id: req.user.id,
        seller_id: listing.seller_id,
        amount,
        currency: 'EUR',
        payment_method: payment_method || 'paypal',
        shipping_address,
        status: 'pending'
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    // In a real implementation, you would integrate with PayPal API here
    // For now, we'll return the payment object for frontend to handle

    res.json({
      success: true,
      message: 'Payment initiated',
      data: payment,
      next_action: {
        type: 'redirect_to_paypal',
        payment_id: payment.id
      }
    });
  } catch (error) {
    console.error('Marketplace payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process payment'
    });
  }
});

/**
 * POST /api/marketplace/sale/confirm
 * Confirm sale completion
 */
router.post('/sale/confirm', auth, async (req, res) => {
  try {
    const { listing_id, payment_id, tracking_number } = req.body;

    if (!listing_id) {
      return res.status(400).json({
        success: false,
        error: 'Listing ID is required'
      });
    }

    // Update listing status
    const { data: listing, error: listingError } = await supabase
      .from('marketplace_listings')
      .update({
        status: 'sold',
        sold_at: new Date().toISOString(),
        sold_to: req.user.id
      })
      .eq('id', listing_id)
      .select('*, seller:seller_id(id, email, vorname)')
      .single();

    if (listingError) throw listingError;

    // Update payment if provided
    if (payment_id) {
      await supabase
        .from('marketplace_payments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          tracking_number
        })
        .eq('id', payment_id);
    }

    // Notify seller
    await supabase.from('notifications').insert({
      user_id: listing.seller_id,
      type: 'sale_confirmed',
      title: 'Item sold!',
      message: `Your listing "${listing.title}" has been sold`,
      related_entity_type: 'marketplace_listing',
      related_entity_id: listing_id,
      priority: 'high'
    });

    res.json({
      success: true,
      message: 'Sale confirmed successfully',
      data: listing
    });
  } catch (error) {
    console.error('Sale confirmation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm sale'
    });
  }
});

/**
 * GET /api/marketplace/sale/:id
 * Get sale details
 */
router.get('/sale/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: listing, error } = await supabase
      .from('marketplace_listings')
      .select(`
        *,
        seller:seller_id(id, email, vorname, nachname),
        buyer:sold_to(id, email, vorname, nachname),
        payment:marketplace_payments(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // Check if user has permission to view
    if (listing.seller_id !== req.user.id && listing.sold_to !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: listing
    });
  } catch (error) {
    console.error('Sale details fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sale details'
    });
  }
});

module.exports = router;
