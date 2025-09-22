// SichrPlace Salary Requirements Validation API
// Handles 3x rent rule, income documentation, and financial qualification assessment

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
      case 'validate-income':
        if (req.method === 'POST') return await validateIncomeRequirements(req, supabase, user)
        break
      case 'upload-documents':
        if (req.method === 'POST') return await uploadIncomeDocuments(req, supabase, user)
        break
      case 'verify-documents':
        if (req.method === 'POST') return await verifyIncomeDocuments(req, supabase, user)
        break
      case 'get-qualification':
        if (req.method === 'GET') return await getFinancialQualification(req, supabase, user)
        break
      case 'calculate-affordability':
        if (req.method === 'POST') return await calculateAffordability(req, supabase, user)
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
    console.error('Salary Requirements Validation Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function validateIncomeRequirements(req, supabase, user) {
  try {
    const body = await req.json()
    const {
      apartmentId,
      monthlyRent,
      primaryIncome,
      secondaryIncome,
      bonusIncome,
      freelanceIncome,
      socialBenefits,
      partnerIncome,
      existingDebts,
      monthlyExpenses,
      hasGuarantor,
      guarantorIncome,
      incomeType,
      documentation
    } = body

    // Validate required fields
    if (!apartmentId || !monthlyRent || !primaryIncome) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          required: ['apartmentId', 'monthlyRent', 'primaryIncome']
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate numeric values
    const numericFields = {
      monthlyRent,
      primaryIncome,
      secondaryIncome: secondaryIncome || 0,
      bonusIncome: bonusIncome || 0,
      freelanceIncome: freelanceIncome || 0,
      socialBenefits: socialBenefits || 0,
      partnerIncome: partnerIncome || 0,
      existingDebts: existingDebts || 0,
      monthlyExpenses: monthlyExpenses || 0,
      guarantorIncome: guarantorIncome || 0
    }

    for (const [field, value] of Object.entries(numericFields)) {
      if (value < 0) {
        return new Response(
          JSON.stringify({ error: `${field} cannot be negative` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Calculate total monthly income
    const totalGrossIncome = numericFields.primaryIncome + 
                            numericFields.secondaryIncome + 
                            numericFields.bonusIncome + 
                            numericFields.freelanceIncome + 
                            numericFields.socialBenefits + 
                            numericFields.partnerIncome

    // Estimate net income (simplified German tax calculation)
    const estimatedNetIncome = calculateNetIncome(totalGrossIncome, incomeType)

    // Calculate disposable income after expenses and debts
    const disposableIncome = estimatedNetIncome - numericFields.existingDebts - numericFields.monthlyExpenses

    // Apply 3x rent rule and variations
    const rentToIncomeAnalysis = analyzeRentToIncomeRatio(
      disposableIncome,
      numericFields.monthlyRent,
      hasGuarantor,
      numericFields.guarantorIncome
    )

    // Assess income stability
    const incomeStability = assessIncomeStability({
      incomeType,
      primaryIncome: numericFields.primaryIncome,
      secondaryIncome: numericFields.secondaryIncome,
      freelanceIncome: numericFields.freelanceIncome,
      bonusIncome: numericFields.bonusIncome,
      hasPartner: numericFields.partnerIncome > 0,
      hasGuarantor,
      documentation
    })

    // Determine overall qualification
    const qualification = determineFinancialQualification(
      rentToIncomeAnalysis,
      incomeStability,
      totalGrossIncome,
      disposableIncome,
      numericFields.monthlyRent
    )

    // Create financial qualification record
    const { data: financialRecord, error: insertError } = await supabase
      .from('financial_qualifications')
      .insert([
        {
          user_id: user.id,
          apartment_id: apartmentId,
          monthly_rent: numericFields.monthlyRent,
          total_gross_income: totalGrossIncome,
          estimated_net_income: estimatedNetIncome,
          disposable_income: disposableIncome,
          existing_debts: numericFields.existingDebts,
          monthly_expenses: numericFields.monthlyExpenses,
          income_breakdown: {
            primary: numericFields.primaryIncome,
            secondary: numericFields.secondaryIncome,
            bonus: numericFields.bonusIncome,
            freelance: numericFields.freelanceIncome,
            benefits: numericFields.socialBenefits,
            partner: numericFields.partnerIncome
          },
          has_guarantor: hasGuarantor,
          guarantor_income: numericFields.guarantorIncome,
          income_type: incomeType,
          meets_three_times_rule: rentToIncomeAnalysis.meetsThreeTimesRule,
          income_ratio: rentToIncomeAnalysis.ratio,
          affordability_score: qualification.score,
          qualification_level: qualification.level,
          risk_factors: qualification.riskFactors,
          recommendations: qualification.recommendations,
          stability_score: incomeStability.score,
          status: 'calculated',
          documentation_required: qualification.documentationRequired
        }
      ])
      .select()
      .single()

    if (insertError) {
      throw new Error(`Database insert failed: ${insertError.message}`)
    }

    // Log the screening event
    await supabase
      .from('tenant_screening_logs')
      .insert([
        {
          user_id: user.id,
          apartment_id: apartmentId,
          screening_type: 'financial_qualification',
          status: 'completed',
          result_summary: {
            meetsThreeTimesRule: rentToIncomeAnalysis.meetsThreeTimesRule,
            incomeRatio: rentToIncomeAnalysis.ratio,
            qualificationLevel: qualification.level,
            affordabilityScore: qualification.score
          }
        }
      ])

    return new Response(
      JSON.stringify({
        success: true,
        qualificationId: financialRecord.id,
        qualification: {
          level: qualification.level,
          score: qualification.score,
          approved: qualification.approved,
          meetsThreeTimesRule: rentToIncomeAnalysis.meetsThreeTimesRule,
          incomeRatio: Math.round(rentToIncomeAnalysis.ratio * 100) / 100,
          totalGrossIncome: totalGrossIncome,
          estimatedNetIncome: estimatedNetIncome,
          disposableIncome: disposableIncome,
          monthlyRent: numericFields.monthlyRent,
          requiredIncome: numericFields.monthlyRent * 3,
          riskFactors: qualification.riskFactors,
          recommendations: qualification.recommendations,
          stabilityScore: incomeStability.score,
          documentationRequired: qualification.documentationRequired
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Validate Income Requirements Error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to validate income requirements', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function calculateAffordability(req, supabase, user) {
  try {
    const body = await req.json()
    const {
      monthlyIncome,
      existingDebts,
      monthlyExpenses,
      preferredLocation,
      incomeStability
    } = body

    if (!monthlyIncome || monthlyIncome <= 0) {
      return new Response(
        JSON.stringify({ error: 'Valid monthly income is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const disposableIncome = monthlyIncome - (existingDebts || 0) - (monthlyExpenses || 0)
    
    // Calculate different affordability scenarios
    const affordabilityScenarios = {
      conservative: {
        maxRent: Math.floor(disposableIncome / 3.5), // More conservative than 3x rule
        description: 'Conservative estimate (3.5x rule)',
        recommendation: 'Safest option with buffer for unexpected expenses'
      },
      standard: {
        maxRent: Math.floor(disposableIncome / 3), // Standard 3x rule
        description: 'Standard affordability (3x rule)',
        recommendation: 'Most commonly accepted by landlords'
      },
      optimistic: {
        maxRent: Math.floor(disposableIncome / 2.5), // More aggressive
        description: 'Optimistic estimate (2.5x rule)',
        recommendation: 'Higher rent but requires careful budgeting'
      }
    }

    // Adjust based on income stability
    if (incomeStability === 'unstable' || incomeStability === 'freelance') {
      // Reduce affordability for unstable income
      Object.keys(affordabilityScenarios).forEach(scenario => {
        affordabilityScenarios[scenario].maxRent = Math.floor(affordabilityScenarios[scenario].maxRent * 0.8)
      })
    }

    // Get average rent data for preferred location (mock data)
    const locationRentData = getLocationRentData(preferredLocation)

    return new Response(
      JSON.stringify({
        success: true,
        affordability: {
          monthlyIncome,
          disposableIncome,
          scenarios: affordabilityScenarios,
          locationData: locationRentData,
          budgetRecommendations: generateBudgetRecommendations(disposableIncome, affordabilityScenarios)
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Calculate Affordability Error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to calculate affordability', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

// Helper functions

function calculateNetIncome(grossIncome, incomeType) {
  // Simplified German tax calculation
  let taxRate = 0.2 // Base rate
  
  if (grossIncome > 5000) taxRate = 0.35
  else if (grossIncome > 3000) taxRate = 0.28
  else if (grossIncome > 1500) taxRate = 0.22
  
  // Adjust for income type
  if (incomeType === 'freelance' || incomeType === 'self-employed') {
    taxRate += 0.05 // Additional social security
  }
  
  return Math.round(grossIncome * (1 - taxRate))
}

function analyzeRentToIncomeRatio(disposableIncome, monthlyRent, hasGuarantor, guarantorIncome) {
  const ratio = disposableIncome / monthlyRent
  const meetsThreeTimesRule = ratio >= 3
  
  // Consider guarantor if tenant doesn't meet requirements
  let adjustedMeetsRule = meetsThreeTimesRule
  if (!meetsThreeTimesRule && hasGuarantor && guarantorIncome) {
    const guarantorRatio = guarantorIncome / monthlyRent
    adjustedMeetsRule = guarantorRatio >= 3
  }
  
  return {
    ratio,
    meetsThreeTimesRule: adjustedMeetsRule,
    originalMeetsRule: meetsThreeTimesRule,
    guarantorHelps: hasGuarantor && !meetsThreeTimesRule && adjustedMeetsRule
  }
}

function assessIncomeStability(incomeData) {
  let score = 100
  const factors = []
  
  // Income type impact
  switch (incomeData.incomeType) {
    case 'permanent_employment':
      score += 20
      factors.push({ factor: 'Permanent employment', impact: 'positive', points: 20 })
      break
    case 'temporary_employment':
      score -= 10
      factors.push({ factor: 'Temporary employment', impact: 'negative', points: -10 })
      break
    case 'freelance':
      score -= 20
      factors.push({ factor: 'Freelance income', impact: 'negative', points: -20 })
      break
    case 'self_employed':
      score -= 15
      factors.push({ factor: 'Self-employed', impact: 'negative', points: -15 })
      break
  }
  
  // Income diversification
  const totalIncomeSources = [
    incomeData.primaryIncome > 0,
    incomeData.secondaryIncome > 0,
    incomeData.freelanceIncome > 0,
    incomeData.bonusIncome > 0
  ].filter(Boolean).length
  
  if (totalIncomeSources >= 3) {
    score += 10
    factors.push({ factor: 'Multiple income sources', impact: 'positive', points: 10 })
  } else if (totalIncomeSources === 1) {
    score -= 10
    factors.push({ factor: 'Single income source', impact: 'negative', points: -10 })
  }
  
  // Partner income helps stability
  if (incomeData.hasPartner) {
    score += 15
    factors.push({ factor: 'Partner income', impact: 'positive', points: 15 })
  }
  
  // Guarantor provides security
  if (incomeData.hasGuarantor) {
    score += 25
    factors.push({ factor: 'Guarantor available', impact: 'positive', points: 25 })
  }
  
  // Documentation quality
  if (incomeData.documentation && incomeData.documentation.length >= 3) {
    score += 10
    factors.push({ factor: 'Complete documentation', impact: 'positive', points: 10 })
  } else if (!incomeData.documentation || incomeData.documentation.length === 0) {
    score -= 15
    factors.push({ factor: 'Missing documentation', impact: 'negative', points: -15 })
  }
  
  return {
    score: Math.max(0, Math.min(150, score)),
    factors
  }
}

function determineFinancialQualification(rentAnalysis, stabilityAnalysis, totalIncome, disposableIncome, monthlyRent) {
  let score = 0
  const riskFactors = []
  const recommendations = []
  let level = 'REJECTED'
  let approved = false
  let documentationRequired = []
  
  // Base score from rent ratio
  if (rentAnalysis.ratio >= 4) {
    score += 40
  } else if (rentAnalysis.ratio >= 3) {
    score += 30
  } else if (rentAnalysis.ratio >= 2.5) {
    score += 15
  } else {
    score += 0
    riskFactors.push('Income below recommended 3x rent rule')
  }
  
  // Stability score contribution
  score += Math.round(stabilityAnalysis.score * 0.4)
  
  // Additional factors
  if (totalIncome >= 3000) {
    score += 10
  } else if (totalIncome < 1500) {
    score -= 10
    riskFactors.push('Low total income')
  }
  
  if (disposableIncome < monthlyRent * 2) {
    riskFactors.push('Limited disposable income after expenses')
  }
  
  // Determine qualification level
  if (score >= 120) {
    level = 'EXCELLENT'
    approved = true
    recommendations.push('Strong financial profile - excellent tenant candidate')
  } else if (score >= 100) {
    level = 'GOOD'
    approved = true
    recommendations.push('Good financial standing - recommended for approval')
  } else if (score >= 80) {
    level = 'ACCEPTABLE'
    approved = true
    recommendations.push('Acceptable risk - consider with standard deposit')
    documentationRequired.push('Recent payslips', 'Employment contract')
  } else if (score >= 60) {
    level = 'REVIEW_REQUIRED'
    approved = false
    recommendations.push('Manual review required - consider higher deposit or guarantor')
    documentationRequired.push('Recent payslips', 'Employment contract', 'Bank statements', 'Tax returns')
  } else {
    level = 'REJECTED'
    approved = false
    recommendations.push('High financial risk - not recommended for approval')
    riskFactors.push('Overall financial profile below acceptance threshold')
  }
  
  return {
    score,
    level,
    approved,
    riskFactors,
    recommendations,
    documentationRequired
  }
}

function getLocationRentData(location) {
  // Mock data - in production, integrate with real market data
  const rentData = {
    'Berlin': { averageRent: 12.50, trend: 'increasing', market: 'competitive' },
    'Munich': { averageRent: 18.20, trend: 'stable', market: 'very_competitive' },
    'Hamburg': { averageRent: 14.80, trend: 'increasing', market: 'competitive' },
    'Cologne': { averageRent: 13.90, trend: 'stable', market: 'moderate' },
    'Frankfurt': { averageRent: 16.50, trend: 'increasing', market: 'competitive' }
  }
  
  return rentData[location] || { averageRent: 12.00, trend: 'stable', market: 'moderate' }
}

function generateBudgetRecommendations(disposableIncome, scenarios) {
  return {
    housing: `${Math.round((scenarios.standard.maxRent / disposableIncome) * 100)}% of income on housing`,
    emergency: `Keep €${Math.round(disposableIncome * 0.1)} monthly for emergencies`,
    savings: `Try to save €${Math.round(disposableIncome * 0.15)} monthly`,
    utilities: 'Budget additional €150-250 for utilities not included in rent',
    insurance: 'Consider tenant insurance (€5-15/month)'
  }
}

async function getFinancialQualification(req, supabase, user) {
  try {
    const url = new URL(req.url)
    const qualificationId = url.searchParams.get('qualificationId')
    const apartmentId = url.searchParams.get('apartmentId')

    let query = supabase
      .from('financial_qualifications')
      .select('*')
      .eq('user_id', user.id)

    if (qualificationId) {
      query = query.eq('id', qualificationId)
    } else if (apartmentId) {
      query = query.eq('apartment_id', apartmentId)
    }

    const { data: qualifications, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      throw new Error(`Database query failed: ${error.message}`)
    }

    if (!qualifications || qualifications.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No financial qualification found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const qualification = qualifications[0]

    return new Response(
      JSON.stringify({
        success: true,
        qualification: {
          id: qualification.id,
          level: qualification.qualification_level,
          score: qualification.affordability_score,
          approved: qualification.qualification_level !== 'REJECTED',
          meetsThreeTimesRule: qualification.meets_three_times_rule,
          incomeRatio: qualification.income_ratio,
          totalGrossIncome: qualification.total_gross_income,
          disposableIncome: qualification.disposable_income,
          monthlyRent: qualification.monthly_rent,
          riskFactors: qualification.risk_factors,
          recommendations: qualification.recommendations,
          stabilityScore: qualification.stability_score,
          documentationRequired: qualification.documentation_required,
          createdAt: qualification.created_at
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Get Financial Qualification Error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to get financial qualification', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}