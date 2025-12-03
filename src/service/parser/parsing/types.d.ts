export type BaseNode = {
  type: string;
  named: boolean;
};

export type ChildNode = {
  multiple: boolean;
  required: boolean;
  types: BaseNode[];
};

export type NodeInfo =
  | (BaseNode & {
      subtypes: BaseNode[];
    })
  | (BaseNode & {
      fields: { [name: string]: ChildNode };
      children: ChildNode[];
    });

export type Language = {
  language: unknown;
  nodeTypeInfo: NodeInfo[];
};