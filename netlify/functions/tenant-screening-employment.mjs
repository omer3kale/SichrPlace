// SichrPlace Employment Verification API
// Handles income verification, employment status, and 3x rent rule validation

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
      return await submitEmploymentVerification(req, supabase, user)
    }

    if (req.method === 'GET') {
      return await getEmploymentStatus(req, supabase, user)
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Employment Verification Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function submitEmploymentVerification(req, supabase, user) {
  try {
    const body = await req.json()
    const {
      apartmentId,
      monthlyRent,
      employmentType,
      employerName,
      employerAddress,
      employerPhone,
      employerEmail,
      jobTitle,
      monthlyGrossSalary,
      monthlyNetSalary,
      employmentStartDate,
      contractType,
      payslipDocuments,
      employmentContractUrl,
      taxDocumentUrl,
      additionalIncome,
      otherIncomeSource,
      otherIncomeAmount,
      consentEmployerContact
    } = body

    // Validate required fields
    if (!employmentType || !employerName || !monthlyGrossSalary || !monthlyNetSalary) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          required: ['employmentType', 'employerName', 'monthlyGrossSalary', 'monthlyNetSalary']
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate salary amounts
    if (monthlyGrossSalary <= 0 || monthlyNetSalary <= 0) {
      return new Response(
        JSON.stringify({ error: 'Salary amounts must be positive numbers' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (monthlyNetSalary > monthlyGrossSalary) {
      return new Response(
        JSON.stringify({ error: 'Net salary cannot be higher than gross salary' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate total monthly income
    const totalMonthlyIncome = monthlyNetSalary + (additionalIncome ? parseFloat(otherIncomeAmount || 0) : 0)

    // Apply 3x rent rule validation
    const threeTimesRent = monthlyRent * 3
    const meetsRentRule = totalMonthlyIncome >= threeTimesRent
    const incomeRatio = totalMonthlyIncome / monthlyRent

    // Determine employment risk level
    const employmentRisk = calculateEmploymentRisk({
      employmentType,
      contractType,
      employmentStartDate,
      incomeRatio,
      hasDocuments: !!(payslipDocuments && payslipDocuments.length > 0)
    })

    // Create employment verification record
    const { data: verification, error: insertError } = await supabase
      .from('employment_verifications')
      .insert([
        {
          user_id: user.id,
          apartment_id: apartmentId,
          monthly_rent: monthlyRent,
          employment_type: employmentType,
          employer_name: employerName,
          employer_address: employerAddress,
          employer_phone: employerPhone,
          employer_email: employerEmail,
          job_title: jobTitle,
          monthly_gross_salary: monthlyGrossSalary,
          monthly_net_salary: monthlyNetSalary,
          employment_start_date: employmentStartDate,
          contract_type: contractType,
          payslip_documents: payslipDocuments,
          employment_contract_url: employmentContractUrl,
          tax_document_url: taxDocumentUrl,
          additional_income: additionalIncome,
          other_income_source: otherIncomeSource,
          other_income_amount: additionalIncome ? parseFloat(otherIncomeAmount || 0) : null,
          total_monthly_income: totalMonthlyIncome,
          three_times_rent: threeTimesRent,
          meets_rent_rule: meetsRentRule,
          income_ratio: incomeRatio,
          employment_risk: employmentRisk.level,
          risk_factors: employmentRisk.factors,
          consent_employer_contact: consentEmployerContact,
          status: 'processing',
          verification_score: employmentRisk.score
        }
      ])
      .select()
      .single()

    if (insertError) {
      throw new Error(`Database insert failed: ${insertError.message}`)
    }

    // Simulate employment verification process
    const verificationResult = await processEmploymentVerification(verification)

    // Update verification with results
    const { data: updatedVerification, error: updateError } = await supabase
      .from('employment_verifications')
      .update({
        status: verificationResult.status,
        verification_result: verificationResult.result,
        employer_confirmed: verificationResult.employerConfirmed,
        document_verified: verificationResult.documentVerified,
        final_approval: verificationResult.approved,
        verification_notes: verificationResult.notes,
        completed_at: new Date().toISOString(),
        processing_time_ms: verificationResult.processingTime
      })
      .eq('id', verification.id)
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
          screening_type: 'employment_verification',
          status: verificationResult.status,
          result_summary: {
            meetsRentRule: meetsRentRule,
            incomeRatio: incomeRatio,
            employmentRisk: employmentRisk.level,
            approved: verificationResult.approved
          },
          processing_time_ms: verificationResult.processingTime
        }
      ])

    return new Response(
      JSON.stringify({
        success: true,
        verificationId: updatedVerification.id,
        status: updatedVerification.status,
        meetsRentRule: meetsRentRule,
        incomeRatio: Math.round(incomeRatio * 100) / 100,
        employmentRisk: employmentRisk.level,
        approved: verificationResult.approved,
        totalMonthlyIncome: totalMonthlyIncome,
        requiredIncome: threeTimesRent,
        message: 'Employment verification completed successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Submit Employment Verification Error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to process employment verification', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function getEmploymentStatus(req, supabase, user) {
  try {
    const url = new URL(req.url)
    const verificationId = url.searchParams.get('verificationId')
    const apartmentId = url.searchParams.get('apartmentId')

    let query = supabase
      .from('employment_verifications')
      .select('*')
      .eq('user_id', user.id)

    if (verificationId) {
      query = query.eq('id', verificationId)
    } else if (apartmentId) {
      query = query.eq('apartment_id', apartmentId)
    }

    const { data: verifications, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      throw new Error(`Database query failed: ${error.message}`)
    }

    if (!verifications || verifications.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No employment verification found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const verification = verifications[0]

    return new Response(
      JSON.stringify({
        success: true,
        verification: {
          id: verification.id,
          status: verification.status,
          meetsRentRule: verification.meets_rent_rule,
          incomeRatio: verification.income_ratio,
          employmentRisk: verification.employment_risk,
          approved: verification.final_approval,
          totalMonthlyIncome: verification.total_monthly_income,
          requiredIncome: verification.three_times_rent,
          employmentType: verification.employment_type,
          employerName: verification.employer_name,
          createdAt: verification.created_at,
          completedAt: verification.completed_at,
          verificationNotes: verification.verification_notes
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Get Employment Status Error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to get employment status', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

function calculateEmploymentRisk(employmentData) {
  const { employmentType, contractType, employmentStartDate, incomeRatio, hasDocuments } = employmentData
  
  let score = 100 // Start with base score
  let factors = []

  // Employment type risk
  switch (employmentType) {
    case 'permanent':
      score += 20
      factors.push({ factor: 'Permanent employment', impact: 'positive', points: 20 })
      break
    case 'temporary':
      score -= 10
      factors.push({ factor: 'Temporary employment', impact: 'negative', points: -10 })
      break
    case 'freelance':
      score -= 20
      factors.push({ factor: 'Freelance work', impact: 'negative', points: -20 })
      break
    case 'self-employed':
      score -= 15
      factors.push({ factor: 'Self-employed', impact: 'negative', points: -15 })
      break
  }

  // Contract type risk
  if (contractType === 'unlimited') {
    score += 15
    factors.push({ factor: 'Unlimited contract', impact: 'positive', points: 15 })
  } else if (contractType === 'limited') {
    score -= 5
    factors.push({ factor: 'Limited contract', impact: 'negative', points: -5 })
  }

  // Employment duration
  if (employmentStartDate) {
    const startDate = new Date(employmentStartDate)
    const monthsEmployed = (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    
    if (monthsEmployed >= 24) {
      score += 10
      factors.push({ factor: '2+ years employment', impact: 'positive', points: 10 })
    } else if (monthsEmployed >= 12) {
      score += 5
      factors.push({ factor: '1+ year employment', impact: 'positive', points: 5 })
    } else if (monthsEmployed < 6) {
      score -= 10
      factors.push({ factor: 'Less than 6 months employment', impact: 'negative', points: -10 })
    }
  }

  // Income ratio (3x rent rule)
  if (incomeRatio >= 4) {
    score += 20
    factors.push({ factor: '4x+ rent income ratio', impact: 'positive', points: 20 })
  } else if (incomeRatio >= 3) {
    score += 10
    factors.push({ factor: 'Meets 3x rent rule', impact: 'positive', points: 10 })
  } else if (incomeRatio >= 2.5) {
    score -= 10
    factors.push({ factor: 'Below 3x rent rule', impact: 'negative', points: -10 })
  } else {
    score -= 30
    factors.push({ factor: 'Significantly below 3x rent rule', impact: 'negative', points: -30 })
  }

  // Document completeness
  if (hasDocuments) {
    score += 10
    factors.push({ factor: 'Complete documentation', impact: 'positive', points: 10 })
  } else {
    score -= 15
    factors.push({ factor: 'Missing documentation', impact: 'negative', points: -15 })
  }

  // Determine risk level
  let level = 'HIGH'
  if (score >= 120) level = 'VERY_LOW'
  else if (score >= 100) level = 'LOW'
  else if (score >= 80) level = 'MEDIUM'

  return {
    score: Math.max(0, Math.min(150, score)), // Clamp between 0-150
    level,
    factors
  }
}

// Simulate employment verification process
async function processEmploymentVerification(verification) {
  const startTime = Date.now()
  
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 5000))
  
  // Simulate verification checks
  const employerConfirmed = Math.random() > 0.1 // 90% success rate
  const documentVerified = verification.payslip_documents && verification.payslip_documents.length > 0
  
  // Determine approval based on multiple factors
  const meetsRentRule = verification.meets_rent_rule
  const goodEmploymentRisk = ['VERY_LOW', 'LOW'].includes(verification.employment_risk)
  const approved = employerConfirmed && documentVerified && meetsRentRule && goodEmploymentRisk

  const processingTime = Date.now() - startTime

  return {
    status: 'completed',
    employerConfirmed,
    documentVerified,
    approved,
    result: approved ? 'APPROVED' : 'REVIEW_REQUIRED',
    notes: generateVerificationNotes(verification, employerConfirmed, documentVerified, approved),
    processingTime
  }
}

function generateVerificationNotes(verification, employerConfirmed, documentVerified, approved) {
  const notes = []
  
  if (approved) {
    notes.push('✅ All employment verification checks passed')
    notes.push(`✅ Income ratio: ${Math.round(verification.income_ratio * 100) / 100}x rent`)
    notes.push(`✅ Employment risk: ${verification.employment_risk}`)
  } else {
    notes.push('⚠️ Employment verification requires review')
    
    if (!verification.meets_rent_rule) {
      notes.push(`❌ Does not meet 3x rent rule (${Math.round(verification.income_ratio * 100) / 100}x)`)
    }
    
    if (!employerConfirmed) {
      notes.push('❌ Employer confirmation failed')
    }
    
    if (!documentVerified) {
      notes.push('❌ Documentation incomplete or unverified')
    }
    
    if (!['VERY_LOW', 'LOW'].includes(verification.employment_risk)) {
      notes.push(`❌ High employment risk: ${verification.employment_risk}`)
    }
  }
  
  return notes.join('\n')
}