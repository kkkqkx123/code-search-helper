import { Router, Request, Response, NextFunction } from 'express';
import { DIContainer } from '../../core/DIContainer';
import { TYPES } from '../../types';
import { ParserController } from '../../controllers/ParserController';

export class ParserRoutes {
  private router: Router;
  private parserController: ParserController;

  constructor() {
    const container = DIContainer.getInstance();
    this.parserController = container.get<ParserController>(TYPES.ParserController);
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    /**
     * @route POST /api/v1/parser/parse
     * @desc Parse a single file
     * @body {object} request body
     * @property {string} filePath.required - File path to parse
     * @property {object} options.optional - Parse options
     * @returns {object} 200 - Parse result
     */
    this.router.post('/parse', this.parseFile.bind(this));

    /**
     * @route POST /api/v1/parser/parse-multiple
     * @desc Parse multiple files
     * @body {object} request body
     * @property {string[]} filePaths.required - Array of file paths
     * @property {object} options.optional - Parse options
     * @returns {object} 200 - Parse results
     */
    this.router.post('/parse-multiple', this.parseFiles.bind(this));

    /**
     * @route POST /api/v1/parser/extract-functions
     * @desc Extract functions from a file
     * @body {object} request body
     * @property {string} filePath.required - File path
     * @returns {object} 200 - Extracted functions
     */
    this.router.post('/extract-functions', this.extractFunctions.bind(this));

    /**
     * @route POST /api/v1/parser/extract-classes
     * @desc Extract classes from a file
     * @body {object} request body
     * @property {string} filePath.required - File path
     * @returns {object} 200 - Extracted classes
     */
    this.router.post('/extract-classes', this.extractClasses.bind(this));

    /**
     * @route POST /api/v1/parser/extract-imports
     * @desc Extract imports from a file
     * @body {object} request body
     * @property {string} filePath.required - File path
     * @returns {object} 200 - Extracted imports
     */
    this.router.post('/extract-imports', this.extractImports.bind(this));

    /**
     * @route POST /api/v1/parser/validate-syntax
     * @desc Validate file syntax
     * @body {object} request body
     * @property {string} filePath.required - File path
     * @returns {object} 200 - Validation result
     */
    this.router.post('/validate-syntax', this.validateSyntax.bind(this));

    /**
     * @route POST /api/v1/parser/query-ast
     * @desc Query AST nodes using XPath-like syntax
     * @body {object} request body
     * @property {string} filePath.required - File path
     * @property {string} query.required - AST query
     * @returns {object} 200 - Query results
     */
    this.router.post('/query-ast', this.queryAST.bind(this));

    /**
     * @route POST /api/v1/parser/ast-summary
     * @desc Get AST summary statistics
     * @body {object} request body
     * @property {string} filePath.required - File path
     * @returns {object} 200 - AST summary
     */
    this.router.post('/ast-summary', this.getASTSummary.bind(this));

    /**
     * @route POST /api/v1/parser/compare-asts
     * @desc Compare two file ASTs
     * @body {object} request body
     * @property {string} filePath1.required - First file path
     * @property {string} filePath2.required - Second file path
     * @returns {object} 200 - Comparison result
     */
    this.router.post('/compare-asts', this.compareASTs.bind(this));

    /**
     * @route POST /api/v1/parser/search-ast
     * @desc Search for patterns in AST
     * @body {object} request body
     * @property {string} filePath.required - File path
     * @property {object} pattern.required - Search pattern
     * @property {string} pattern.type.optional - Node type
     * @property {string} pattern.name.optional - Node name
     * @property {string} pattern.contains.optional - Text to contain
     * @returns {object} 200 - Search results
     */
    this.router.post('/search-ast', this.searchInAST.bind(this));

    /**
     * @route POST /api/v1/parser/language-stats
     * @desc Get language statistics for files
     * @body {object} request body
     * @property {string[]} filePaths.required - Array of file paths
     * @returns {object} 200 - Language statistics
     */
    this.router.post('/language-stats', this.getLanguageStats.bind(this));

    /**
     * @route GET /api/v1/parser/supported-languages
     * @desc Get list of supported languages
     * @returns {object} 200 - Supported languages
     */
    this.router.get('/supported-languages', this.getSupportedLanguages.bind(this));

    /**
     * @route POST /api/v1/parser/detect-language
     * @desc Detect language from file path
     * @body {object} request body
     * @property {string} filePath.required - File path
     * @returns {object} 200 - Detected language
     */
    this.router.post('/detect-language', this.detectLanguage.bind(this));
  }

  private async parseFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.parserController.parseFile(req, res, next);
  }

  private async parseFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.parserController.parseFiles(req, res, next);
  }

  private async extractFunctions(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.parserController.extractFunctions(req, res, next);
  }

  private async extractClasses(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.parserController.extractClasses(req, res, next);
  }

  private async extractImports(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.parserController.extractImports(req, res, next);
  }

  private async validateSyntax(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.parserController.validateSyntax(req, res, next);
  }

  private async queryAST(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.parserController.queryAST(req, res, next);
  }

  private async getASTSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.parserController.getASTSummary(req, res, next);
  }

  private async compareASTs(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.parserController.compareASTs(req, res, next);
  }

  private async searchInAST(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.parserController.searchInAST(req, res, next);
  }

  private async getLanguageStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.parserController.getLanguageStats(req, res, next);
  }

  private async getSupportedLanguages(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.parserController.getSupportedLanguages(req, res, next);
  }

  private async detectLanguage(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.parserController.detectLanguage(req, res, next);
  }

  public getRouter(): Router {
    return this.router;
  }
}