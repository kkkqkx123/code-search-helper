// Mock for @nebula-contrib/nebula-nodejs
module.exports = {
  NebulaGraph: jest.fn().mockImplementation(() => {
    return {
      connect: jest.fn().mockResolvedValue(true),
      execute: jest.fn().mockResolvedValue({ results: [] }),
      close: jest.fn().mockResolvedValue(true),
    };
  }),
};