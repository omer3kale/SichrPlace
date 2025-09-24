import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY1
);

async function testDatabase() {
  console.log('Testing database connection...');
  
  try {
    // First, let's test a simple query without joins
    const { data: apartmentsSimple, error: simpleError } = await supabase
      .from('apartments')
      .select('*')
      .limit(1);
    
    if (simpleError) {
      console.error('Simple query error:', simpleError);
    } else {
      console.log('✅ Simple apartments query successful!');
      console.log('Sample apartment data:', apartmentsSimple[0]);
    }

    // Now test the join query that's causing issues
    const { data: apartmentsWithJoin, error: joinError } = await supabase
      .from('apartments')
      .select(`
        *,
        users:owner_id (
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .limit(1);
    
    if (joinError) {
      console.error('Join query error:', joinError);
    } else {
      console.log('✅ Join query successful!');
      console.log('Sample apartment with user data:', apartmentsWithJoin[0]);
    }

    // Test environment variables
    console.log('Environment check:');
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing');
    console.log('SUPABASE_SERVICE_ROLE_KEY1:', process.env.SUPABASE_SERVICE_ROLE_KEY1 ? '✅ Set' : '❌ Missing');
    
  } catch (error) {
    console.error('Database test error:', error);
  }
}

testDatabase();