import Parser from 'tree-sitter';
import { HtmlHelperMethods } from './HtmlHelperMethods';
import { ReferenceRelationship, IRelationshipExtractor } from './HtmlRelationshipTypes';
import { LoggerService } from '../../../../../../utils/LoggerService';

/**
 * 引用关系提取器
 * 提取HTML元素之间的引用关系：ID引用、类引用、名称引用、for引用等
 */
export class ReferenceRelationshipExtractor implements IRelationshipExtractor {
  private logger: LoggerService;
  private idToElementMap: Map<string, Parser.SyntaxNode> = new Map();
  private classToElementsMap: Map<string, Parser.SyntaxNode[]> = new Map();
  private nameToElementMap: Map<string, Parser.SyntaxNode> = new Map();

  constructor() {
    this.logger = new LoggerService();
  }

  /**
   * 提取所有引用关系
   * @param ast AST根节点
   * @returns 引用关系数组
   */
  extractRelationships(ast: Parser.SyntaxNode): ReferenceRelationship[] {
    const relationships: ReferenceRelationship[] = [];

    // 首先构建引用映射表
    this.buildReferenceMaps(ast);

    // 提取ID引用
    this.extractIdReferences(ast, relationships);

    // 提取类引用
    this.extractClassReferences(ast, relationships);

    // 提取名称引用
    this.extractNameReferences(ast, relationships);

    // 提取for引用（label与表单控件）
    this.extractForReferences(ast, relationships);

    // 提取data-*属性引用
    this.extractDataAttributeReferences(ast, relationships);

    // 提取aria-*属性引用
    this.extractAriaAttributeReferences(ast, relationships);

    // 清理映射表
    this.clearReferenceMaps();

    this.logger.debug(`提取了 ${relationships.length} 个引用关系`);
    return relationships;
  }

  /**
   * 构建引用映射表
   * @param node AST根节点
   */
  private buildReferenceMaps(node: Parser.SyntaxNode): void {
    HtmlHelperMethods.traverseAST(node, (currentNode) => {
      if (HtmlHelperMethods.isElementNode(currentNode)) {
        const attributes = HtmlHelperMethods.getAllAttributes(currentNode);

        // 构建ID映射
        if (attributes.id) {
          this.idToElementMap.set(attributes.id, currentNode);
        }

        // 构建类名映射
        if (attributes.class) {
          const classes = attributes.class.split(/\s+/);
          for (const className of classes) {
            if (!this.classToElementsMap.has(className)) {
              this.classToElementsMap.set(className, []);
            }
            this.classToElementsMap.get(className)!.push(currentNode);
          }
        }

        // 构建名称映射
        if (attributes.name) {
          this.nameToElementMap.set(attributes.name, currentNode);
        }
      }
    });
  }

  /**
   * 提取ID引用
   * @param node AST根节点
   * @param relationships 关系数组
   */
  private extractIdReferences(
    node: Parser.SyntaxNode,
    relationships: ReferenceRelationship[]
  ): void {
    HtmlHelperMethods.traverseAST(node, (currentNode) => {
      if (HtmlHelperMethods.isElementNode(currentNode)) {
        const elementId = HtmlHelperMethods.generateElementId(currentNode);
        const attributes = HtmlHelperMethods.getAllAttributes(currentNode);
        const tagName = HtmlHelperMethods.getTagName(currentNode) || 'unknown';

        // 检查各种可能引用ID的属性
        const idRefAttributes = ['href', 'src', 'data-target', 'data-toggle', 'data-controls'];

        for (const attr of idRefAttributes) {
          const attrValue = attributes[attr];
          if (attrValue && attrValue.startsWith('#')) {
            const targetId = attrValue.substring(1);
            const targetElement = this.idToElementMap.get(targetId);

            if (targetElement) {
              const targetElementId = HtmlHelperMethods.generateElementId(targetElement);
              const targetTagName = HtmlHelperMethods.getTagName(targetElement) || 'unknown';

              relationships.push({
                type: 'id-reference',
                source: elementId,
                target: targetElementId,
                referenceType: 'id',
                referenceValue: targetId,
                referenceAttribute: attr,
                metadata: {
                  sourceTagName: tagName,
                  targetTagName,
                  attributeName: attr,
                  fullAttributeValue: attrValue,
                  sourceAttributes: attributes,
                  targetAttributes: HtmlHelperMethods.getAllAttributes(targetElement),
                  referenceContext: this.getIdReferenceContext(tagName, attr),
                  isValidReference: this.isValidIdReference(tagName, attr, targetTagName)
                }
              });
            }
          }
        }

        // 检查aria-labelledby和aria-describedby
        this.extractAriaIdReferences(currentNode, elementId, tagName, attributes, relationships);
      }
    });
  }

  /**
   * 提取类引用
   * @param node AST根节点
   * @param relationships 关系数组
   */
  private extractClassReferences(
    node: Parser.SyntaxNode,
    relationships: ReferenceRelationship[]
  ): void {
    HtmlHelperMethods.traverseAST(node, (currentNode) => {
      if (HtmlHelperMethods.isElementNode(currentNode)) {
        const elementId = HtmlHelperMethods.generateElementId(currentNode);
        const attributes = HtmlHelperMethods.getAllAttributes(currentNode);
        const tagName = HtmlHelperMethods.getTagName(currentNode) || 'unknown';

        // 检查可能引用类名的属性
        const classRefAttributes = ['data-class', 'data-target-class', 'data-toggle-class'];

        for (const attr of classRefAttributes) {
          const attrValue = attributes[attr];
          if (attrValue) {
            const classNames = attrValue.split(/\s+/);

            for (const className of classNames) {
              const targetElements = this.classToElementsMap.get(className);

              if (targetElements) {
                for (const targetElement of targetElements) {
                  const targetElementId = HtmlHelperMethods.generateElementId(targetElement);
                  const targetTagName = HtmlHelperMethods.getTagName(targetElement) || 'unknown';

                  relationships.push({
                    type: 'class-reference',
                    source: elementId,
                    target: targetElementId,
                    referenceType: 'class',
                    referenceValue: className,
                    referenceAttribute: attr,
                    metadata: {
                      sourceTagName: tagName,
                      targetTagName,
                      attributeName: attr,
                      fullAttributeValue: attrValue,
                      sourceAttributes: attributes,
                      targetAttributes: HtmlHelperMethods.getAllAttributes(targetElement),
                      referenceContext: this.getClassReferenceContext(tagName, attr),
                      isMultipleTargets: targetElements.length > 1
                    }
                  });
                }
              }
            }
          }
        }
      }
    });
  }

  /**
   * 提取名称引用
   * @param node AST根节点
   * @param relationships 关系数组
   */
  private extractNameReferences(
    node: Parser.SyntaxNode,
    relationships: ReferenceRelationship[]
  ): void {
    HtmlHelperMethods.traverseAST(node, (currentNode) => {
      if (HtmlHelperMethods.isElementNode(currentNode)) {
        const elementId = HtmlHelperMethods.generateElementId(currentNode);
        const attributes = HtmlHelperMethods.getAllAttributes(currentNode);
        const tagName = HtmlHelperMethods.getTagName(currentNode) || 'unknown';

        // 检查可能引用name的属性
        const nameRefAttributes = ['form', 'data-form', 'list'];

        for (const attr of nameRefAttributes) {
          const attrValue = attributes[attr];
          if (attrValue) {
            const targetElement = this.nameToElementMap.get(attrValue);

            if (targetElement) {
              const targetElementId = HtmlHelperMethods.generateElementId(targetElement);
              const targetTagName = HtmlHelperMethods.getTagName(targetElement) || 'unknown';

              relationships.push({
                type: 'name-reference',
                source: elementId,
                target: targetElementId,
                referenceType: 'name',
                referenceValue: attrValue,
                referenceAttribute: attr,
                metadata: {
                  sourceTagName: tagName,
                  targetTagName,
                  attributeName: attr,
                  sourceAttributes: attributes,
                  targetAttributes: HtmlHelperMethods.getAllAttributes(targetElement),
                  referenceContext: this.getNameReferenceContext(tagName, attr),
                  isFormReference: targetTagName === 'form'
                }
              });
            }
          }
        }
      }
    });
  }

  /**
   * 提取for引用（label与表单控件）
   * @param node AST根节点
   * @param relationships 关系数组
   */
  private extractForReferences(
    node: Parser.SyntaxNode,
    relationships: ReferenceRelationship[]
  ): void {
    // 查找所有label元素
    const labelElements = HtmlHelperMethods.findNodesByType(node, 'element');

    for (const labelElement of labelElements) {
      const tagName = HtmlHelperMethods.getTagName(labelElement);
      if (tagName === 'label') {
        const labelId = HtmlHelperMethods.generateElementId(labelElement);
        const attributes = HtmlHelperMethods.getAllAttributes(labelElement);

        const forValue = attributes.for;
        if (forValue) {
          // 查找目标元素（通过id或name）
          let targetElement = this.idToElementMap.get(forValue);
          if (!targetElement) {
            targetElement = this.nameToElementMap.get(forValue);
          }

          if (targetElement) {
            const targetElementId = HtmlHelperMethods.generateElementId(targetElement);
            const targetTagName = HtmlHelperMethods.getTagName(targetElement) || 'unknown';

            relationships.push({
              type: 'for-reference',
              source: labelId,
              target: targetElementId,
              referenceType: 'for',
              referenceValue: forValue,
              referenceAttribute: 'for',
              metadata: {
                sourceTagName: 'label',
                targetTagName,
                sourceAttributes: attributes,
                targetAttributes: HtmlHelperMethods.getAllAttributes(targetElement),
                isFormControl: this.isFormControl(targetTagName),
                accessibilityImpact: 'improves-form-accessibility'
              }
            });
          }
        }
      }
    }
  }

  /**
   * 提取data-*属性引用
   * @param node AST根节点
   * @param relationships 关系数组
   */
  private extractDataAttributeReferences(
    node: Parser.SyntaxNode,
    relationships: ReferenceRelationship[]
  ): void {
    // 收集所有data-*属性
    const dataAttributes = new Map<string, Parser.SyntaxNode[]>();

    HtmlHelperMethods.traverseAST(node, (currentNode) => {
      if (HtmlHelperMethods.isElementNode(currentNode)) {
        const attributes = HtmlHelperMethods.getAllAttributes(currentNode);

        for (const [attrName, attrValue] of Object.entries(attributes)) {
          if (attrName.startsWith('data-') && attrValue) {
            // 查找可能的目标元素
            if (attrValue.startsWith('#')) {
              // ID引用
              const targetId = attrValue.substring(1);
              const targetElement = this.idToElementMap.get(targetId);

              if (targetElement) {
                if (!dataAttributes.has(attrName)) {
                  dataAttributes.set(attrName, []);
                }
                dataAttributes.get(attrName)!.push(currentNode);
              }
            }
          }
        }
      }
    });

    // 为每个data-*属性创建引用关系
    for (const [dataAttr, sourceElements] of dataAttributes) {
      for (const sourceElement of sourceElements) {
        const sourceId = HtmlHelperMethods.generateElementId(sourceElement);
        const sourceAttributes = HtmlHelperMethods.getAllAttributes(sourceElement);
        const attrValue = sourceAttributes[dataAttr];

        if (attrValue && attrValue.startsWith('#')) {
          const targetId = attrValue.substring(1);
          const targetElement = this.idToElementMap.get(targetId);

          if (targetElement) {
            const targetId = HtmlHelperMethods.generateElementId(targetElement);
            const targetTagName = HtmlHelperMethods.getTagName(targetElement) || 'unknown';

            relationships.push({
              type: 'id-reference',
              source: sourceId,
              target: targetId,
              referenceType: 'data-*',
              referenceValue: targetId,
              referenceAttribute: dataAttr,
              metadata: {
                sourceTagName: HtmlHelperMethods.getTagName(sourceElement) || 'unknown',
                targetTagName,
                attributeName: dataAttr,
                fullAttributeValue: attrValue,
                sourceAttributes,
                targetAttributes: HtmlHelperMethods.getAllAttributes(targetElement),
                dataAttributeType: this.getDataAttributeType(dataAttr),
                isCustomDataAttribute: true
              }
            });
          }
        }
      }
    }
  }

  /**
   * 提取aria-*属性引用
   * @param node AST根节点
   * @param relationships 关系数组
   */
  private extractAriaAttributeReferences(
    node: Parser.SyntaxNode,
    relationships: ReferenceRelationship[]
  ): void {
    // 这个方法在extractIdReferences中已经调用了extractAriaIdReferences
    // 这里可以处理其他aria引用关系
  }

  /**
   * 提取aria ID引用
   * @param currentNode 当前节点
   * @param elementId 元素ID
   * @param tagName 标签名
   * @param attributes 属性映射
   * @param relationships 关系数组
   */
  private extractAriaIdReferences(
    currentNode: Parser.SyntaxNode,
    elementId: string,
    tagName: string,
    attributes: Record<string, string>,
    relationships: ReferenceRelationship[]
  ): void {
    const ariaIdRefAttributes = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns'];

    for (const attr of ariaIdRefAttributes) {
      const attrValue = attributes[attr];
      if (attrValue) {
        const ids = attrValue.split(/\s+/);

        for (const targetId of ids) {
          const targetElement = this.idToElementMap.get(targetId);

          if (targetElement) {
            const targetElementId = HtmlHelperMethods.generateElementId(targetElement);
            const targetTagName = HtmlHelperMethods.getTagName(targetElement) || 'unknown';

            relationships.push({
              type: 'id-reference',
              source: elementId,
              target: targetElementId,
              referenceType: 'aria-*',
              referenceValue: targetId,
              referenceAttribute: attr,
              metadata: {
                sourceTagName: tagName,
                targetTagName,
                attributeName: attr,
                fullAttributeValue: attrValue,
                sourceAttributes: attributes,
                targetAttributes: HtmlHelperMethods.getAllAttributes(targetElement),
                ariaRelationship: this.getAriaRelationshipType(attr),
                accessibilityImpact: 'enhances-accessibility',
                isAriaReference: true
              }
            });
          }
        }
      }
    }
  }

  /**
   * 获取ID引用上下文
   * @param tagName 标签名
   * @param attributeName 属性名
   * @returns 引用上下文
   */
  private getIdReferenceContext(tagName: string, attributeName: string): string {
    const contexts: Record<string, Record<string, string>> = {
      'a': {
        'href': 'navigation-link'
      },
      'img': {
        'src': 'image-source',
        'data-target': 'image-gallery-target'
      },
      'button': {
        'data-target': 'button-target',
        'data-toggle': 'button-toggle'
      }
    };

    return contexts[tagName]?.[attributeName] || 'general-id-reference';
  }

  /**
   * 获取类引用上下文
   * @param tagName 标签名
   * @param attributeName 属性名
   * @returns 引用上下文
   */
  private getClassReferenceContext(tagName: string, attributeName: string): string {
    const contexts: Record<string, Record<string, string>> = {
      'div': {
        'data-class': 'styling-reference',
        'data-target-class': 'dynamic-styling'
      },
      'button': {
        'data-toggle-class': 'class-toggle'
      }
    };

    return contexts[tagName]?.[attributeName] || 'general-class-reference';
  }

  /**
   * 获取名称引用上下文
   * @param tagName 标签名
   * @param attributeName 属性名
   * @returns 引用上下文
   */
  private getNameReferenceContext(tagName: string, attributeName: string): string {
    const contexts: Record<string, Record<string, string>> = {
      'input': {
        'form': 'form-association',
        'list': 'datalist-association'
      },
      'select': {
        'form': 'form-association'
      },
      'textarea': {
        'form': 'form-association'
      },
      'button': {
        'form': 'form-association'
      },
    };

    return contexts[tagName]?.[attributeName] || 'general-name-reference';
  }

  /**
   * 判断ID引用是否有效
   * @param sourceTagName 源标签名
   * @param attributeName 属性名
   * @param targetTagName 目标标签名
   * @returns 是否有效
   */
  private isValidIdReference(sourceTagName: string, attributeName: string, targetTagName: string): boolean {
    // 基本的语义验证
    if (attributeName === 'href' && sourceTagName === 'a') {
      // a标签的href应该引用可导航的目标
      const navigableTargets = ['section', 'article', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
      return navigableTargets.includes(targetTagName);
    }

    if (attributeName === 'data-target') {
      // data-target通常引用可交互的元素
      const interactiveTargets = ['button', 'div', 'span', 'section', 'article'];
      return interactiveTargets.includes(targetTagName);
    }

    return true; // 默认认为有效
  }

  /**
   * 判断是否为表单控件
   * @param tagName 标签名
   * @returns 是否为表单控件
   */
  private isFormControl(tagName: string): boolean {
    const formControls = ['input', 'select', 'textarea', 'button', 'output'];
    return formControls.includes(tagName);
  }

  /**
   * 获取data属性类型
   * @param dataAttr data属性名
   * @returns 属性类型
   */
  private getDataAttributeType(dataAttr: string): string {
    if (dataAttr.includes('toggle')) return 'toggle';
    if (dataAttr.includes('target')) return 'target';
    if (dataAttr.includes('class')) return 'class';
    if (dataAttr.includes('style')) return 'style';
    return 'custom';
  }

  /**
   * 获取aria关系类型
   * @param ariaAttr aria属性名
   * @returns 关系类型
   */
  private getAriaRelationshipType(ariaAttr: string): string {
    const mapping: Record<string, string> = {
      'aria-labelledby': 'labeling',
      'aria-describedby': 'describing',
      'aria-controls': 'controlling',
      'aria-owns': 'owning',
      'aria-activedescendant': 'active-descendant'
    };

    return mapping[ariaAttr] || 'aria-reference';
  }

  /**
   * 清理引用映射表
   */
  private clearReferenceMaps(): void {
    this.idToElementMap.clear();
    this.classToElementsMap.clear();
    this.nameToElementMap.clear();
  }

  /**
   * 获取引用关系统计信息
   * @param relationships 关系数组
   * @returns 统计信息
   */
  public getRelationshipStats(relationships: ReferenceRelationship[]): {
    id: number;
    class: number;
    name: number;
    for: number;
    data: number;
    aria: number;
    total: number;
    referenceTypeDistribution: Record<string, number>;
    attributeDistribution: Record<string, number>;
    validReferences: number;
    invalidReferences: number;
  } {
    const stats = {
      id: 0,
      class: 0,
      name: 0,
      for: 0,
      data: 0,
      aria: 0,
      total: relationships.length,
      referenceTypeDistribution: {} as Record<string, number>,
      attributeDistribution: {} as Record<string, number>,
      validReferences: 0,
      invalidReferences: 0
    };

    for (const rel of relationships) {
      switch (rel.referenceType) {
        case 'id':
          stats.id++;
          break;
        case 'class':
          stats.class++;
          break;
        case 'name':
          stats.name++;
          break;
        case 'for':
          stats.for++;
          break;
        case 'data-*':
          stats.data++;
          break;
        case 'aria-*':
          stats.aria++;
          break;
      }

      // 统计引用类型分布
      stats.referenceTypeDistribution[rel.referenceType] =
        (stats.referenceTypeDistribution[rel.referenceType] || 0) + 1;

      // 统计属性分布
      stats.attributeDistribution[rel.referenceAttribute] =
        (stats.attributeDistribution[rel.referenceAttribute] || 0) + 1;

      // 统计有效/无效引用
      if (rel.metadata.isValidReference !== false) {
        stats.validReferences++;
      } else {
        stats.invalidReferences++;
      }
    }

    return stats;
  }
}