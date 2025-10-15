module.exports = class JestHtmlReportersMock {
  constructor() {
    // no-op mock to satisfy Jest reporter resolution during local runs
  }

  onRunComplete() {
    // swallows reporter output
  }
};
