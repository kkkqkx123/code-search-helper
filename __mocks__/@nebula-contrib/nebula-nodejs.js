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
  connect: jest.fn().mockResolvedValue(true),
  session: jest.fn().mockResolvedValue(mockSession),
  close: jest.fn().mockResolvedValue(true),
};

module.exports = {
  NebulaGraph: {
    Client: jest.fn().mockImplementation(() => mockClient)
  }
};