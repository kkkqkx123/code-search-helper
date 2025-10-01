import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { IGraphService } from '../core/IGraphService';
import { GraphServiceComposite } from './GraphServiceComposite';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { IGraphAnalysisService } from './IGraphAnalysisService';
import { IGraphDataService } from './IGraphDataService';
import { IGraphTransactionService } from './IGraphTransactionService';
import { IGraphSearchService } from './IGraphSearchService';

@injectable()
export class GraphServiceNewAdapter extends GraphServiceComposite implements IGraphService {
  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.GraphAnalysisService) graphAnalysisService: IGraphAnalysisService,
    @inject(TYPES.GraphDataService) graphDataService: IGraphDataService,
    @inject(TYPES.GraphTransactionService) graphTransactionService: IGraphTransactionService,
    @inject(TYPES.GraphSearchServiceNew) graphSearchService: IGraphSearchService
  ) {
    super(logger, errorHandler, graphAnalysisService, graphDataService, graphTransactionService, graphSearchService);
  }
}