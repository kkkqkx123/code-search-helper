"""GraphSearchService Python算法服务入口"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routes import fuzzy_match, graph_search, index_management
from core.monitoring import setup_monitoring
from utils.logging_config import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化
    setup_logging()
    setup_monitoring(app)
    
    # 初始化核心服务
    from core.fuzzy_match.service import FuzzyMatchService
    from core.graph_index.service import GraphIndexService
    from core.query_optimizer.service import QueryOptimizerService
    
    app.state.fuzzy_match_service = FuzzyMatchService()
    app.state.graph_index_service = GraphIndexService()
    app.state.query_optimizer_service = QueryOptimizerService()
    
    # 异步初始化
    await asyncio.gather(
        app.state.fuzzy_match_service.initialize(),
        app.state.graph_index_service.initialize(),
        app.state.query_optimizer_service.initialize()
    )
    
    yield
    
    # 关闭时清理
    await asyncio.gather(
        app.state.fuzzy_match_service.cleanup(),
        app.state.graph_index_service.cleanup(),
        app.state.query_optimizer_service.cleanup()
    )


app = FastAPI(
    title="GraphSearchService Algorithm API",
    description="Python实现的图搜索算法微服务",
    version="1.0.0",
    lifespan=lifespan
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logging.error(f"全局异常: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "内部服务器错误", "detail": str(exc)}
    )


# 注册路由
app.include_router(fuzzy_match.router, prefix="/api/v1/fuzzy-match", tags=["模糊匹配"])
app.include_router(graph_search.router, prefix="/api/v1/graph-search", tags=["图搜索"])
app.include_router(index_management.router, prefix="/api/v1/index", tags=["索引管理"])


@app.get("/")
async def root():
    """健康检查端点"""
    return {
        "service": "GraphSearchService Algorithm API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """详细健康检查"""
    services_status = {
        "fuzzy_match": await app.state.fuzzy_match_service.health_check(),
        "graph_index": await app.state.graph_index_service.health_check(),
        "query_optimizer": await app.state.query_optimizer_service.health_check()
    }
    
    return {
        "status": "healthy" if all(services_status.values()) else "degraded",
        "services": services_status
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )