// Mock for @nebula-contrib/nebula-nodejs
module.exports = {
  createClient: jest.fn(() => ({
    execute: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
  })),
};