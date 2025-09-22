// SichrPlace Landlord Reference Check API
// Handles previous landlord references, rental history verification, and tenant reputation

import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

export default async function handler(req, context) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_ANON_KEY
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get authentication token
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const action = url.pathname.split('/').pop()

    switch (action) {
      case 'submit-references':
        if (req.method === 'POST') return await submitLandlordReferences(req, supabase, user)
        break
      case 'verify-reference':
        if (req.method === 'POST') return await verifyLandlordReference(req, supabase, user)
        break
      case 'get-status':
        if (req.method === 'GET') return await getReferenceStatus(req, supabase, user)
        break
      case 'landlord-response':
        if (req.method === 'POST') return await handleLandlordResponse(req, supabase)
        break
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid endpoint' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Landlord Reference Check Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function submitLandlordReferences(req, supabase, user) {
  try {
    const body = await req.json()
    const {
      apartmentId,
      references
    } = body

    // Validate required fields
    if (!references || !Array.isArray(references) || references.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one landlord reference is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate each reference
    const validatedReferences = []
    for (let i = 0; i < references.length; i++) {
      const ref = references[i]
      
      if (!ref.landlordName || !ref.landlordEmail || !ref.propertyAddress || !ref.tenancyStartDate || !ref.tenancyEndDate) {
        return new Response(
          JSON.stringify({ 
            error: `Reference ${i + 1} missing required fields`,
            required: ['landlordName', 'landlordEmail', 'propertyAddress', 'tenancyStartDate', 'tenancyEndDate']
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(ref.landlordEmail)) {
        return new Response(
          JSON.stringify({ error: `Invalid email format for reference ${i + 1}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Calculate tenancy duration
      const startDate = new Date(ref.tenancyStartDate)
      const endDate = new Date(ref.tenancyEndDate)
      const durationMonths = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24 * 30))

      validatedReferences.push({
        ...ref,
        durationMonths,
        recentTenancy: endDate > new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000) // Last 2 years
      })
    }

    // Create reference check record
    const { data: referenceCheck, error: insertError } = await supabase
      .from('landlord_reference_checks')
      .insert([
        {
          user_id: user.id,
          apartment_id: apartmentId,
          total_references: validatedReferences.length,
          references_data: validatedReferences,
          status: 'pending',
          overall_score: 0,
          verification_attempts: 0
        }
      ])
      .select()
      .single()

    if (insertError) {
      throw new Error(`Database insert failed: ${insertError.message}`)
    }

    // Create individual reference records and send verification emails
    const referenceResults = []
    
    for (let i = 0; i < validatedReferences.length; i++) {
      const ref = validatedReferences[i]
      
      // Generate unique verification token
      const verificationToken = generateVerificationToken()
      
      const { data: individualRef, error: refError } = await supabase
        .from('individual_landlord_references')
        .insert([
          {
            reference_check_id: referenceCheck.id,
            user_id: user.id,
            landlord_name: ref.landlordName,
            landlord_email: ref.landlordEmail,
            landlord_phone: ref.landlordPhone,
            property_address: ref.propertyAddress,
            tenancy_start_date: ref.tenancyStartDate,
            tenancy_end_date: ref.tenancyEndDate,
            monthly_rent_paid: ref.monthlyRentPaid,
            duration_months: ref.durationMonths,
            reason_for_leaving: ref.reasonForLeaving,
            verification_token: verificationToken,
            status: 'pending',
            is_recent_tenancy: ref.recentTenancy
          }
        ])
        .select()
        .single()

      if (refError) {
        console.error(`Failed to create reference ${i + 1}:`, refError)
        continue
      }

      // Send verification email to landlord
      const emailResult = await sendReferenceVerificationEmail(
        ref.landlordEmail,
        ref.landlordName,
        user.email,
        verificationToken,
        individualRef.id
      )

      referenceResults.push({
        referenceId: individualRef.id,
        landlordName: ref.landlordName,
        landlordEmail: ref.landlordEmail,
        emailSent: emailResult.success,
        status: 'pending'
      })
    }

    // Log the screening event
    await supabase
      .from('tenant_screening_logs')
      .insert([
        {
          user_id: user.id,
          apartment_id: apartmentId,
          screening_type: 'landlord_references',
          status: 'pending',
          result_summary: {
            totalReferences: validatedReferences.length,
            emailsSent: referenceResults.filter(r => r.emailSent).length,
            recentTenancies: validatedReferences.filter(r => r.recentTenancy).length
          }
        }
      ])

    return new Response(
      JSON.stringify({
        success: true,
        referenceCheckId: referenceCheck.id,
        totalReferences: validatedReferences.length,
        references: referenceResults,
        message: 'Landlord reference verification emails sent'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Submit Landlord References Error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to submit landlord references', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleLandlordResponse(req, supabase) {
  try {
    const body = await req.json()
    const { verificationToken, responses } = body

    if (!verificationToken || !responses) {
      return new Response(
        JSON.stringify({ error: 'Missing verification token or responses' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find the reference by verification token
    const { data: reference, error: findError } = await supabase
      .from('individual_landlord_references')
      .select('*')
      .eq('verification_token', verificationToken)
      .eq('status', 'pending')
      .single()

    if (findError || !reference) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired verification token' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate reference score based on responses
    const referenceScore = calculateReferenceScore(responses)

    // Update reference with landlord responses
    const { data: updatedRef, error: updateError } = await supabase
      .from('individual_landlord_references')
      .update({
        status: 'completed',
        landlord_responses: responses,
        reference_score: referenceScore.score,
        score_breakdown: referenceScore.breakdown,
        would_rent_again: responses.wouldRentAgain,
        payment_history: responses.paymentHistory,
        property_condition: responses.propertyCondition,
        tenant_behavior: responses.tenantBehavior,
        completed_at: new Date().toISOString(),
        landlord_verified: true
      })
      .eq('id', reference.id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to update reference: ${updateError.message}`)
    }

    // Update overall reference check status
    await updateOverallReferenceStatus(supabase, reference.reference_check_id)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Thank you for providing the reference information',
        referenceScore: referenceScore.score
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Handle Landlord Response Error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to process landlord response', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function getReferenceStatus(req, supabase, user) {
  try {
    const url = new URL(req.url)
    const referenceCheckId = url.searchParams.get('referenceCheckId')
    const apartmentId = url.searchParams.get('apartmentId')

    let query = supabase
      .from('landlord_reference_checks')
      .select(`
        *,
        individual_landlord_references (*)
      `)
      .eq('user_id', user.id)

    if (referenceCheckId) {
      query = query.eq('id', referenceCheckId)
    } else if (apartmentId) {
      query = query.eq('apartment_id', apartmentId)
    }

    const { data: referenceChecks, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      throw new Error(`Database query failed: ${error.message}`)
    }

    if (!referenceChecks || referenceChecks.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No landlord reference check found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const referenceCheck = referenceChecks[0]

    return new Response(
      JSON.stringify({
        success: true,
        referenceCheck: {
          id: referenceCheck.id,
          status: referenceCheck.status,
          overallScore: referenceCheck.overall_score,
          totalReferences: referenceCheck.total_references,
          completedReferences: referenceCheck.individual_landlord_references.filter(r => r.status === 'completed').length,
          pendingReferences: referenceCheck.individual_landlord_references.filter(r => r.status === 'pending').length,
          approved: referenceCheck.overall_score >= 70,
          createdAt: referenceCheck.created_at,
          completedAt: referenceCheck.completed_at,
          references: referenceCheck.individual_landlord_references.map(ref => ({
            id: ref.id,
            landlordName: ref.landlord_name,
            landlordEmail: ref.landlord_email,
            propertyAddress: ref.property_address,
            status: ref.status,
            referenceScore: ref.reference_score,
            wouldRentAgain: ref.would_rent_again,
            completedAt: ref.completed_at
          }))
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Get Reference Status Error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to get reference status', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

function calculateReferenceScore(responses) {
  let score = 0
  const breakdown = []

  // Would rent again (40 points)
  if (responses.wouldRentAgain === 'yes') {
    score += 40
    breakdown.push({ factor: 'Would rent again', points: 40 })
  } else if (responses.wouldRentAgain === 'maybe') {
    score += 20
    breakdown.push({ factor: 'Might rent again', points: 20 })
  } else {
    breakdown.push({ factor: 'Would not rent again', points: 0 })
  }

  // Payment history (25 points)
  switch (responses.paymentHistory) {
    case 'always_on_time':
      score += 25
      breakdown.push({ factor: 'Always paid on time', points: 25 })
      break
    case 'mostly_on_time':
      score += 20
      breakdown.push({ factor: 'Mostly paid on time', points: 20 })
      break
    case 'sometimes_late':
      score += 10
      breakdown.push({ factor: 'Sometimes late payments', points: 10 })
      break
    case 'frequently_late':
      score += 5
      breakdown.push({ factor: 'Frequently late payments', points: 5 })
      break
    default:
      breakdown.push({ factor: 'Poor payment history', points: 0 })
  }

  // Property condition (20 points)
  switch (responses.propertyCondition) {
    case 'excellent':
      score += 20
      breakdown.push({ factor: 'Excellent property care', points: 20 })
      break
    case 'good':
      score += 15
      breakdown.push({ factor: 'Good property care', points: 15 })
      break
    case 'fair':
      score += 10
      breakdown.push({ factor: 'Fair property care', points: 10 })
      break
    case 'poor':
      score += 5
      breakdown.push({ factor: 'Poor property care', points: 5 })
      break
    default:
      breakdown.push({ factor: 'Damaged property', points: 0 })
  }

  // Tenant behavior (15 points)
  switch (responses.tenantBehavior) {
    case 'excellent':
      score += 15
      breakdown.push({ factor: 'Excellent tenant behavior', points: 15 })
      break
    case 'good':
      score += 12
      breakdown.push({ factor: 'Good tenant behavior', points: 12 })
      break
    case 'fair':
      score += 8
      breakdown.push({ factor: 'Fair tenant behavior', points: 8 })
      break
    case 'poor':
      score += 3
      breakdown.push({ factor: 'Poor tenant behavior', points: 3 })
      break
    default:
      breakdown.push({ factor: 'Problematic tenant behavior', points: 0 })
  }

  return {
    score: Math.min(100, score),
    breakdown
  }
}

async function updateOverallReferenceStatus(supabase, referenceCheckId) {
  try {
    // Get all references for this check
    const { data: references, error: fetchError } = await supabase
      .from('individual_landlord_references')
      .select('*')
      .eq('reference_check_id', referenceCheckId)

    if (fetchError) {
      throw new Error(`Failed to fetch references: ${fetchError.message}`)
    }

    const completedReferences = references.filter(r => r.status === 'completed')
    const totalReferences = references.length

    // Calculate overall score
    let overallScore = 0
    if (completedReferences.length > 0) {
      const totalScore = completedReferences.reduce((sum, ref) => sum + (ref.reference_score || 0), 0)
      overallScore = Math.round(totalScore / completedReferences.length)
    }

    // Determine status
    let status = 'pending'
    if (completedReferences.length === totalReferences) {
      status = 'completed'
    } else if (completedReferences.length > 0) {
      status = 'partial'
    }

    // Update reference check
    await supabase
      .from('landlord_reference_checks')
      .update({
        status: status,
        overall_score: overallScore,
        completed_references: completedReferences.length,
        completion_rate: Math.round((completedReferences.length / totalReferences) * 100),
        completed_at: status === 'completed' ? new Date().toISOString() : null
      })
      .eq('id', referenceCheckId)

  } catch (error) {
    console.error('Update Overall Reference Status Error:', error)
  }
}

// Generate unique verification token
function generateVerificationToken() {
  return `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Send reference verification email to landlord
async function sendReferenceVerificationEmail(landlordEmail, landlordName, tenantEmail, verificationToken, referenceId) {
  try {
    // In production, integrate with your email service (SendGrid, etc.)
    // For now, simulate email sending
    
    const verificationUrl = `https://sichrplace.com/verify-reference?token=${verificationToken}`
    
    console.log(`Sending reference verification email to: ${landlordEmail}`)
    console.log(`Verification URL: ${verificationUrl}`)
    console.log(`Reference ID: ${referenceId}`)
    
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    return {
      success: true,
      emailSent: true,
      verificationUrl: verificationUrl
    }
    
  } catch (error) {
    console.error('Send Reference Email Error:', error)
    return {
      success: false,
      emailSent: false,
      error: error.message
    }
  }
}