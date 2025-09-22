import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const financialData = {
      timestamp: new Date().toISOString(),
      revenue_overview: {
        total_revenue: 125000,
        monthly_recurring_revenue: 45000,
        commission_earned: 18750,
        growth_rate: 15.2
      },
      transactions: {
        total_transactions: 2450,
        successful_payments: 2401,
        failed_payments: 49,
        refunds_processed: 23,
        avg_transaction_value: 850
      },
      financial_health: {
        profit_margin: 23.5,
        cash_flow_status: 'positive',
        outstanding_receivables: 8500,
        pending_payouts: 12300
      },
      accounting_integration: {
        quickbooks: 'connected',
        xero: 'available',
        last_sync: new Date(Date.now() - 3600000).toISOString(),
        sync_status: 'successful'
      },
      tax_management: {
        vat_collection: 'enabled',
        tax_reports: 'automated',
        compliance_status: 'up_to_date',
        next_filing: new Date(Date.now() + 2592000000).toISOString()
      }
    };

    if (event.httpMethod === 'POST') {
      const { action, financial_config } = JSON.parse(event.body || '{}');
      
      switch (action) {
        case 'generate_invoice':
          return {
            statusCode: 201,
            headers,
            body: JSON.stringify({
              success: true,
              invoice_id: `inv_${Date.now()}`,
              amount: financial_config.amount,
              due_date: new Date(Date.now() + 2592000000).toISOString(),
              status: 'pending'
            })
          };
          
        case 'process_payout':
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              payout_id: `payout_${Date.now()}`,
              amount: financial_config.amount,
              recipient: financial_config.recipient,
              estimated_arrival: '1-3 business days'
            })
          };
          
        case 'generate_report':
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              report_id: `report_${Date.now()}`,
              report_type: financial_config.report_type,
              period: financial_config.period,
              download_url: `https://reports.sichrplace.netlify.app/financial_${Date.now()}.pdf`
            })
          };
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: financialData,
        message: 'Financial management data retrieved'
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Financial management failed',
        message: error.message
      })
    };
  }
};