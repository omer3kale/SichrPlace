const DEFAULT_TEST_EMAIL = 'ci@sichrplace.dev';

const handleTestEnvironment = (req, next) => {
  if (req.user) {
    next();
    return true;
  }

  const injectedUserId = req.headers['x-test-user-id'] || (req.body && req.body.userId);
  if (injectedUserId) {
    const role = req.headers['x-test-role'] || 'user';
    req.user = { id: injectedUserId, email: DEFAULT_TEST_EMAIL };
    req.user.role = role;
    next();
    return true;
  }

  return false;
};

module.exports = {
  handleTestEnvironment,
  DEFAULT_TEST_EMAIL
};
