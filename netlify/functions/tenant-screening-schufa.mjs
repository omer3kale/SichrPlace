// SichrPlace SCHUFA Credit Check API Integration
// Handles German credit verification and tenant screening

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

    if (req.method === 'POST') {
      return await requestSchufaCheck(req, supabase, user)
    }

    if (req.method === 'GET') {
      return await getSchufaStatus(req, supabase, user)
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('SCHUFA Credit Check Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function requestSchufaCheck(req, supabase, user) {
  try {
    const body = await req.json()
    const {
      firstName,
      lastName,
      dateOfBirth,
      address,
      postalCode,
      city,
      apartmentId,
      consentGiven,
      identityDocumentUrl
    } = body

    // Validate required fields
    if (!firstName || !lastName || !dateOfBirth || !address || !consentGiven) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          required: ['firstName', 'lastName', 'dateOfBirth', 'address', 'consentGiven']
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate German postal code
    const germanPostalRegex = /^\d{5}$/
    if (!germanPostalRegex.test(postalCode)) {
      return new Response(
        JSON.stringify({ error: 'Invalid German postal code format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user already has recent SCHUFA check
    const { data: existingCheck } = await supabase
      .from('schufa_checks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) // 90 days
      .single()

    if (existingCheck) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Recent SCHUFA check found',
          checkId: existingCheck.id,
          status: 'completed',
          score: existingCheck.credit_score,
          valid_until: existingCheck.valid_until
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create new SCHUFA check request
    const { data: schufaCheck, error: insertError } = await supabase
      .from('schufa_checks')
      .insert([
        {
          user_id: user.id,
          apartment_id: apartmentId,
          first_name: firstName,
          last_name: lastName,
          geburtsdatum: dateOfBirth,
          address: address,
          postal_code: postalCode,
          city: city,
          identity_document_url: identityDocumentUrl,
          consent_given: consentGiven,
          consent_timestamp: new Date().toISOString(),
          status: 'processing',
          request_type: 'automated'
        }
      ])
      .select()
      .single()

    if (insertError) {
      throw new Error(`Database insert failed: ${insertError.message}`)
    }

    // Simulate SCHUFA API request (in production, integrate with actual SCHUFA API)
    const schufaResult = await simulateSchufaAPI({
      firstName,
      lastName,
      dateOfBirth,
      address,
      postalCode,
      city
    })

    // Update SCHUFA check with results
    const { data: updatedCheck, error: updateError } = await supabase
      .from('schufa_checks')
      .update({
        status: schufaResult.status,
        credit_score: schufaResult.creditScore,
        risk_category: schufaResult.riskCategory,
        score_details: schufaResult.details,
        api_response: schufaResult.rawResponse,
        completed_at: new Date().toISOString(),
        valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days validity
        processing_time_ms: schufaResult.processingTime
      })
      .eq('id', schufaCheck.id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`)
    }

    // Log the screening event
    await supabase
      .from('tenant_screening_logs')
      .insert([
        {
          user_id: user.id,
          apartment_id: apartmentId,
          screening_type: 'schufa_credit_check',
          status: schufaResult.status,
          result_summary: {
            creditScore: schufaResult.creditScore,
            riskCategory: schufaResult.riskCategory,
            approved: schufaResult.creditScore >= 600
          },
          processing_time_ms: schufaResult.processingTime
        }
      ])

    return new Response(
      JSON.stringify({
        success: true,
        checkId: updatedCheck.id,
        status: updatedCheck.status,
        creditScore: updatedCheck.credit_score,
        riskCategory: updatedCheck.risk_category,
        approved: updatedCheck.credit_score >= 600,
        validUntil: updatedCheck.valid_until,
        message: 'SCHUFA credit check completed successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Request SCHUFA Check Error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to process SCHUFA check', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function getSchufaStatus(req, supabase, user) {
  try {
    const url = new URL(req.url)
    const checkId = url.searchParams.get('checkId')
    const apartmentId = url.searchParams.get('apartmentId')

    let query = supabase
      .from('schufa_checks')
      .select('*')
      .eq('user_id', user.id)

    if (checkId) {
      query = query.eq('id', checkId)
    } else if (apartmentId) {
      query = query.eq('apartment_id', apartmentId)
    }

    const { data: checks, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      throw new Error(`Database query failed: ${error.message}`)
    }

    if (!checks || checks.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No SCHUFA check found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const check = checks[0]

    return new Response(
      JSON.stringify({
        success: true,
        check: {
          id: check.id,
          status: check.status,
          creditScore: check.credit_score,
          riskCategory: check.risk_category,
          approved: check.credit_score >= 600,
          createdAt: check.created_at,
          completedAt: check.completed_at,
          validUntil: check.valid_until,
          processingTimeMs: check.processing_time_ms
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Get SCHUFA Status Error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to get SCHUFA status', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

// Simulate SCHUFA API (replace with actual SCHUFA integration in production)
async function simulateSchufaAPI(personalData) {
  const startTime = Date.now()
  
  // Simulate API processing delay
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000))
  
  // Generate realistic credit score based on data
  const baseScore = 650 + Math.random() * 250 // 650-900 range
  const creditScore = Math.round(baseScore)
  
  // Determine risk category
  let riskCategory = 'HIGH'
  if (creditScore >= 800) riskCategory = 'VERY_LOW'
  else if (creditScore >= 700) riskCategory = 'LOW'
  else if (creditScore >= 600) riskCategory = 'MEDIUM'
  
  const processingTime = Date.now() - startTime

  return {
    status: 'completed',
    creditScore: creditScore,
    riskCategory: riskCategory,
    details: {
      score: creditScore,
      maxScore: 1000,
      factors: [
        { factor: 'Payment History', impact: 'positive', weight: 35 },
        { factor: 'Credit Utilization', impact: creditScore > 700 ? 'positive' : 'neutral', weight: 30 },
        { factor: 'Length of Credit History', impact: 'positive', weight: 15 },
        { factor: 'Types of Credit', impact: 'neutral', weight: 10 },
        { factor: 'Recent Credit Inquiries', impact: 'neutral', weight: 10 }
      ],
      recommendation: creditScore >= 600 ? 'APPROVE' : 'REVIEW_REQUIRED',
      notes: creditScore >= 600 ? 'Good creditworthiness' : 'Credit score below recommended threshold'
    },
    rawResponse: {
      schufaScore: creditScore,
      timestamp: new Date().toISOString(),
      apiVersion: '2.1',
      requestId: `SCHUFA_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },
    processingTime: processingTime
  }
}