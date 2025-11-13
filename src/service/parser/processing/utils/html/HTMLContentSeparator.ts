import { HTMLContentExtractor } from './HTMLContentExtractor';
import { ScriptBlock, StyleBlock } from './LayeredHTMLConfig';

/**
 * HTML内容分离器
 * 负责将HTML内容分离为HTML结构、脚本和样式部分
 */
export class HTMLContentSeparator {
    private htmlExtractor: HTMLContentExtractor;

    constructor(htmlExtractor?: HTMLContentExtractor) {
        this.htmlExtractor = htmlExtractor || new HTMLContentExtractor();
    }

    /**
     * 分离HTML内容
     * @param content HTML内容
     * @returns 分离后的内容
     */
    separateContent(content: string): {
        html: string;
        scripts: ScriptBlock[];
        styles: StyleBlock[];
    } {
        // 使用HTMLContentExtractor提取内容
        const scripts = this.htmlExtractor.extractScripts(content);
        const styles = this.htmlExtractor.extractStyles(content);

        // 移除script和style标签，只保留HTML结构
        let htmlContent = content;

        // 移除script标签
        htmlContent = htmlContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

        // 移除style标签
        htmlContent = htmlContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

        return {
            html: htmlContent,
            scripts,
            styles
        };
    }
}