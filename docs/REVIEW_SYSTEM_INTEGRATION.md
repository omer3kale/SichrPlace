# Review System Integration Guide

## Quick Start

The review system is now fully implemented! Here's how to add it to your apartment detail pages:

## Step 1: Add CSS and JS to Your Apartment Page

In the `<head>` section of your apartment detail page:

```html
<link rel="stylesheet" href="/css/reviews.css">
<script src="/js/reviews.js" defer></script>
```

## Step 2: Add the Review Section HTML

Copy the entire reviews section from `frontend/reviews-template.html` and paste it into your apartment detail page where you want reviews to appear (typically after apartment description).

## Step 3: Initialize the Review System

The template includes initialization code, but make sure to replace `{{APARTMENT_ID}}` with the actual apartment ID:

```javascript
// Example: Get apartment ID from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const apartmentId = urlParams.get('id');

if (apartmentId) {
  const reviewSystem = new ReviewSystem('/api');
  reviewSystem.init(apartmentId);
}
```

## Step 4: Update Homepage Stats (Optional)

Once reviews are integrated, update the sample apartment cards on index.html to show real review counts instead of placeholder numbers.

## Features Included

✅ **For Users:**
- View all approved reviews for an apartment
- Submit reviews with star rating, title, and comment
- Edit/delete their own reviews
- See rating distribution and average rating

✅ **For Admins:**
- Moderation queue for pending reviews
- Approve/reject reviews with notes
- View all review statistics

✅ **Security:**
- Authentication required to submit reviews
- One review per user per apartment
- Automatic spam detection
- Anonymous user display for privacy

## API Endpoints Available

All endpoints are registered at `/api/reviews`:

- `POST /api/reviews` - Submit new review (auth required)
- `GET /api/reviews/apartment/:id` - Get reviews for apartment (public)
- `GET /api/reviews/user` - Get current user's reviews (auth required)
- `PUT /api/reviews/:id` - Update review (auth required)
- `DELETE /api/reviews/:id` - Delete review (auth required)
- `GET /api/reviews/pending` - Get pending reviews (admin only)
- `PUT /api/reviews/:id/moderate` - Moderate review (admin only)
- `GET /api/reviews/stats/apartment/:id` - Get review stats (public)

## Styling

The review system uses your existing SichrPlace color scheme:
- Primary gradient: `#667eea` to `#764ba2`
- Responsive design for mobile/tablet/desktop
- Smooth animations and transitions
- Accessibility features included

## Next Steps

1. ✅ Backend API routes registered
2. ✅ Frontend components created
3. ⏳ **TODO:** Add review section to apartment detail page(s)
4. ⏳ **TODO:** Test with real apartment IDs
5. ⏳ **TODO:** Update homepage to reflect review feature is live

That's it! The review system is ready to use. 🎉
