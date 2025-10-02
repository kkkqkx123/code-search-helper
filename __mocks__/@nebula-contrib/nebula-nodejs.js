// Mock for @nebula-contrib/nebula-nodejs
const mockSession = {
  execute: jest.fn().mockResolvedValue({
    results: [],
    data: {
      table: {},
      results: [],
      rows: [],
      data: []
    }
  }),
  release: jest.fn().mockResolvedValue(true),
};

const mockClient = {
  session: jest.fn().mockResolvedValue(mockSession),
  close: jest.fn().mockResolvedValue(true),
};

const createClient = jest.fn().mockImplementation(() => mockClient);

module.exports = {
  createClient
};