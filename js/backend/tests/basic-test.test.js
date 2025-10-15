/**
 * Simple test to verify Jest configuration
 */
describe('Basic Jest Setup', () => {
  test('should run basic test', () => {
    expect(1 + 1).toBe(2);
  });

  test('should have environment variables set', () => {
    expect(process.env.SUPABASE_URL).toBeDefined();
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeDefined();
    expect(process.env.JWT_SECRET).toBeDefined();
  });

  test('should have mocked console', () => {
    console.log('test message');
    expect(console.log).toHaveBeenCalled();
  });
});