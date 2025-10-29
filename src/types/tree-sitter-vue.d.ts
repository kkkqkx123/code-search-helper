declare module 'tree-sitter-vue' {
  const grammar: {
    language: unknown;
    nodeTypeInfo: (
      | {
          type: string;
          named: boolean;
          subtypes: {
            type: string;
            named: boolean;
          }[];
        }
      | {
          type: string;
          named: boolean;
          fields: { [name: string]: {
            multiple: boolean;
            required: boolean;
            types: {
              type: string;
              named: boolean;
            }[];
          } };
          children: {
            multiple: boolean;
            required: boolean;
            types: {
              type: string;
              named: boolean;
            }[];
          }[];
        }
    )[];
  };
  export default grammar;
}