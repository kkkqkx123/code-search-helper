/**
 * 结构感知分割示例
 * 展示如何使用新的查询结果标准化转换系统
 */

import { QueryResultNormalizer } from '../QueryResultNormalizer';
import { StructureAwareStrategy } from '../../../processing/strategies/impl/StructureAwareStrategy';
import { TreeSitterCoreService } from '../../parse/TreeSitterCoreService';
import { LoggerService } from '../../../../../utils/LoggerService';

/**
 * 结构感知分割示例类
 */
export class StructureAwareSplittingExample {
  private logger: LoggerService;
  private normalizer: QueryResultNormalizer;
  private splitter: StructureAwareStrategy;
  private treeSitterService: TreeSitterCoreService;

  constructor() {
    this.logger = new LoggerService();
    this.normalizer = new QueryResultNormalizer({
      enableCache: true,
      debug: true
    });
    this.splitter = new StructureAwareStrategy();
    this.treeSitterService = new TreeSitterCoreService();

    // 设置依赖关系
    this.normalizer.setTreeSitterService(this.treeSitterService);
    this.splitter.setQueryNormalizer(this.normalizer);
  }

  /**
   * 处理TypeScript代码示例
   */
  async processTypeScriptExample(): Promise<void> {
    const typescriptCode = `
import { Component, ReactNode } from 'react';
import { UserService } from './services/UserService';

interface UserProps {
  id: string;
  name: string;
  email?: string;
}

export class UserProfile extends Component<UserProps> {
  private userService: UserService;

  constructor(props: UserProps) {
    super(props);
    this.userService = new UserService();
  }

  async componentDidMount(): Promise<void> {
    const userData = await this.userService.fetchUser(this.props.id);
    this.setState({ userData });
  }

  render(): ReactNode {
    const { name, email } = this.props;
    return (
      <div className="user-profile">
        <h2>{name}</h2>
        {email && <p>{email}</p>}
      </div>
    );
  }
}

export function formatUserName(name: string): string {
  return name.trim().toUpperCase();
}

const API_BASE_URL = 'https://api.example.com';
`;

    try {
      this.logger.info('Processing TypeScript code with structure-aware splitting...');

      const chunks = await this.splitter.split(typescriptCode, 'typescript', 'UserProfile.tsx');

      this.logger.info(`Generated ${chunks.length} chunks:`);
      chunks.forEach((chunk, index) => {
        this.logger.info(`Chunk ${index + 1}:`, {
          type: chunk.metadata.type,
          name: chunk.metadata.name,
          lines: `${chunk.metadata.startLine}-${chunk.metadata.endLine}`,
          complexity: chunk.metadata.complexity,
          dependencies: chunk.metadata.dependencies
        });
      });

    } catch (error) {
      this.logger.error('Failed to process TypeScript code:', error);
    }
  }

  /**
   * 处理Python代码示例
   */
  async processPythonExample(): Promise<void> {
    const pythonCode = `
import asyncio
import json
from typing import Dict, List, Optional
from dataclasses import dataclass

@dataclass
class User:
    id: int
    name: str
    email: Optional[str] = None

class UserService:
    def __init__(self, api_url: str):
        self.api_url = api_url
    
    async def fetch_user(self, user_id: int) -> Optional[User]:
        """Fetch user data from API."""
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.api_url}/users/{user_id}"
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        return User(**data)
        except Exception as e:
            print(f"Error fetching user {user_id}: {e}")
        return None
    
    def _validate_user_data(self, data: Dict) -> bool:
        """Validate user data structure."""
        required_fields = ['id', 'name']
        return all(field in data for field in required_fields)

async def main():
    service = UserService('https://api.example.com')
    user = await service.fetch_user(123)
    
    if user:
        print(f"User: {user.name}")
    else:
        print("User not found")

if __name__ == "__main__":
    asyncio.run(main())
`;

    try {
      this.logger.info('Processing Python code with structure-aware splitting...');

      const chunks = await this.splitter.split(pythonCode, 'python', 'user_service.py');

      this.logger.info(`Generated ${chunks.length} chunks:`);
      chunks.forEach((chunk, index) => {
        this.logger.info(`Chunk ${index + 1}:`, {
          type: chunk.metadata.type,
          name: chunk.metadata.name,
          lines: `${chunk.metadata.startLine}-${chunk.metadata.endLine}`,
          complexity: chunk.metadata.complexity,
          modifiers: chunk.metadata.modifiers,
          extra: chunk.metadata.extra
        });
      });

    } catch (error) {
      this.logger.error('Failed to process Python code:', error);
    }
  }

  /**
   * 展示标准化器的统计信息
   */
  showNormalizationStats(): void {
    const stats = this.normalizer.getStats();

    this.logger.info('Normalization Statistics:', {
      totalNodes: stats.totalNodes,
      successfulNormalizations: stats.successfulNormalizations,
      failedNormalizations: stats.failedNormalizations,
      processingTime: `${stats.processingTime}ms`,
      cacheHitRate: `${(stats.cacheHitRate * 100).toFixed(2)}%`,
      typeStats: stats.typeStats
    });
  }

  /**
   * 运行所有示例
   */
  async runAllExamples(): Promise<void> {
    this.logger.info('=== Structure-Aware Splitting Examples ===');

    await this.processTypeScriptExample();
    this.logger.info('');

    await this.processPythonExample();
    this.logger.info('');

    this.showNormalizationStats();
  }
}

/**
 * 使用示例的便捷函数
 */
export async function runStructureAwareSplittingExample(): Promise<void> {
  const example = new StructureAwareSplittingExample();
  await example.runAllExamples();
}

// 如果直接运行此文件，执行示例
if (require.main === module) {
  runStructureAwareSplittingExample().catch(console.error);
}