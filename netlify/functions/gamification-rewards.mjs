export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const gameData = {
      timestamp: new Date().toISOString(),
      gamification_status: 'active',
      user_engagement: {
        total_active_users: 2450,
        daily_active_users: 850,
        weekly_challenges_completed: 1250,
        avg_session_time: '12m 34s'
      },
      achievement_system: {
        total_achievements: 45,
        user_achievements_unlocked: 15420,
        completion_rate: '68.2%',
        rare_achievements: 8
      },
      leaderboards: [
        { type: 'property_views', leader: 'user_12345', score: 2450 },
        { type: 'successful_bookings', leader: 'user_67890', score: 156 },
        { type: 'property_listings', leader: 'user_11111', score: 89 },
        { type: 'community_engagement', leader: 'user_22222', score: 3420 }
      ],
      reward_system: {
        points_economy: 'active',
        total_points_distributed: 1250000,
        redemption_rate: '45.8%',
        reward_categories: ['discounts', 'premium_features', 'merchandise']
      },
      challenges: [
        { id: 'weekly_explorer', participants: 450, completion_rate: '72%' },
        { id: 'monthly_host', participants: 180, completion_rate: '85%' },
        { id: 'community_helper', participants: 320, completion_rate: '65%' }
      ]
    };

    if (event.httpMethod === 'POST') {
      const { action, game_config } = JSON.parse(event.body || '{}');
      
      switch (action) {
        case 'award_points':
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              transaction_id: `points_${Date.now()}`,
              user_id: game_config.user_id,
              points_awarded: game_config.points,
              reason: game_config.reason,
              new_balance: Math.floor(Math.random() * 10000) + game_config.points
            })
          };
          
        case 'unlock_achievement':
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              achievement_id: `achievement_${Date.now()}`,
              user_id: game_config.user_id,
              achievement_type: game_config.achievement_type,
              points_bonus: 500,
              badge_url: `https://badges.sichrplace.netlify.app/${game_config.achievement_type}.png`
            })
          };
          
        case 'join_challenge':
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              participation_id: `challenge_${Date.now()}`,
              user_id: game_config.user_id,
              challenge_id: game_config.challenge_id,
              start_date: new Date().toISOString(),
              end_date: new Date(Date.now() + 604800000).toISOString()
            })
          };
          
        case 'redeem_reward':
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              redemption_id: `redeem_${Date.now()}`,
              user_id: game_config.user_id,
              reward_type: game_config.reward_type,
              points_cost: game_config.points_cost,
              delivery_method: 'digital'
            })
          };
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: gameData,
        message: 'Gamification and rewards data retrieved'
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Gamification and rewards failed',
        message: error.message
      })
    };
  }
};