module.exports = function jestSonarReporterMock() {
  return {
    onRunComplete() {
      // noop
    }
  };
};
