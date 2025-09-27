import * as Parser from 'tree-sitter';
import { SnippetChunk, SnippetMetadata } from '../../../types';
import { AbstractSnippetRule } from '../../AbstractSnippetRule';

/**
 * Docker Containerization Rule - Extracts Dockerfile and docker-compose patterns
 */
export class DockerContainerizationRule extends AbstractSnippetRule {
  readonly name = 'DockerContainerizationRule';
  readonly supportedNodeTypes = new Set([
    'comment',
    'instruction',
    'from_instruction',
    'run_instruction',
    'copy_instruction',
    'add_instruction',
    'cmd_instruction',
    'entrypoint_instruction',
    'expose_instruction',
    'env_instruction',
    'arg_instruction',
    'volume_instruction',
    'user_instruction',
    'workdir_instruction',
    'label_instruction',
    'stop_signal_instruction',
    'healthcheck_instruction',
    'shell_instruction',
    'onbuild_instruction',
    'docker_compose_file',
    'service',
    'volume',
    'network',
    'config',
    'secret',
    'environment',
    'build',
    'ports',
    'deploy',
  ]);

  protected snippetType = 'docker_containerization' as const;

  // Dockerfile patterns
  private readonly dockerfilePatterns = [
    'FROM',
    'RUN',
    'COPY',
    'ADD',
    'CMD',
    'ENTRYPOINT',
    'EXPOSE',
    'ENV',
    'ARG',
    'VOLUME',
    'USER',
    'WORKDIR',
    'LABEL',
    'STOPSIGNAL',
    'HEALTHCHECK',
    'SHELL',
    'ONBUILD',
    'as builder',
    'multi-stage',
    'alpine',
    'ubuntu',
    'debian',
    'centos',
    'node:',
    'python:',
    'openjdk:',
    'nginx:',
    'apache:',
    'mysql:',
    'postgres:',
    'redis:',
    'mongo:',
  ];

  // Docker Compose patterns
  private readonly composePatterns = [
    'version:',
    'services:',
    'volumes:',
    'networks:',
    'configs:',
    'secrets:',
    'build:',
    'context:',
    'dockerfile:',
    'image:',
    'container_name:',
    'ports:',
    'expose:',
    'environment:',
    'env_file:',
    'depends_on:',
    'restart:',
    'networks:',
    'volumes:',
    'command:',
    'entrypoint:',
    'user:',
    'working_dir:',
    'deploy:',
    'replicas:',
    'resources:',
    'limits:',
    'healthcheck:',
    'logging:',
    'sysctls:',
    'cap_add:',
    'cap_drop:',
    'security_opt:',
    'extra_hosts:',
    'devices:',
    'dns:',
    'dns_search:',
    'tmpfs:',
    'privileged:',
  ];

  protected isValidNodeType(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const nodeText = this.getNodeText(node, sourceCode);
    return this.isDockerPattern(nodeText);
  }

  private isDockerPattern(text: string): boolean {
    const isDockerfile = text.includes('FROM') || text.includes('RUN') || text.includes('CMD');
    const isCompose =
      text.includes('version:') || text.includes('services:') || text.includes('build:');
    const hasDockerPatterns = this.dockerfilePatterns.some(pattern => text.includes(pattern));
    const hasComposePatterns = this.composePatterns.some(pattern => text.includes(pattern));

    return isDockerfile || isCompose || hasDockerPatterns || hasComposePatterns;
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);

    if (
      !this.validateSnippet({
        id: '',
        content,
        startLine: location.startLine,
        endLine: location.endLine,
        startByte: node.startIndex,
        endByte: node.endIndex,
        type: 'snippet',
        imports: [],
        exports: [],
        metadata: {},
        snippetMetadata: {} as SnippetMetadata,
      })
    ) {
      return null;
    }

    // Extract Docker-specific information
    const dockerInfo = this.extractDockerInfo(content);
    const complexity = this.calculateDockerComplexity(content);

    const metadata: SnippetMetadata = {
      snippetType: this.snippetType,
      contextInfo,
      languageFeatures: this.analyzeLanguageFeatures(content),
      complexity,
      isStandalone: true,
      hasSideEffects: this.hasSideEffects(content),
    };

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: [],
      exports: [],
      metadata: {},
      snippetMetadata: metadata,
    };
  }

  private extractDockerInfo(text: string): {
    isDockerfile: boolean;
    isCompose: boolean;
    stageCount: number;
    instructionCount: number;
    serviceCount: number;
  } {
    const info = {
      isDockerfile: text.includes('FROM'),
      isCompose: text.includes('version:') || text.includes('services:'),
      stageCount: 0,
      instructionCount: 0,
      serviceCount: 0,
    };

    // Count stages (multi-stage builds)
    info.stageCount = (text.match(/FROM\s+/g) || []).length;

    // Count instructions
    const instructions = ['FROM', 'RUN', 'COPY', 'ADD', 'CMD', 'ENTRYPOINT', 'EXPOSE', 'ENV'];
    instructions.forEach(inst => {
      info.instructionCount += (text.match(new RegExp(inst + '\\s+', 'g')) || []).length;
    });

    // Count services (compose only)
    if (info.isCompose) {
      const serviceMatches = text.match(/^\s+\w+:\s*$/gm) || [];
      info.serviceCount = serviceMatches.length;
    }

    return info;
  }

  private determineDockerType(text: string): string {
    if (text.includes('version:') || text.includes('services:')) {
      return 'docker-compose';
    }
    if (text.includes('FROM')) {
      return 'dockerfile';
    }
    return 'docker-config';
  }

  private extractBaseImage(text: string): string {
    const fromMatch = text.match(/FROM\s+([^\s\n]+)/i);
    return fromMatch ? fromMatch[1] : 'unknown';
  }

  private isMultiStage(text: string): boolean {
    const fromCount = (text.match(/FROM\s+/gi) || []).length;
    const asStages = (text.match(/AS\s+\w+/gi) || []).length;
    return fromCount > 1 || asStages > 0;
  }

  private hasHealthcheck(text: string): boolean {
    return text.includes('HEALTHCHECK') || text.includes('healthcheck:');
  }

  private extractExposedPorts(text: string): string[] {
    const ports: string[] = [];

    // Dockerfile EXPOSE
    const exposeMatches = text.match(/EXPOSE\s+(\d+(?:\/\w+)?)/gi) || [];
    exposeMatches.forEach(match => {
      const port = match.match(/EXPOSE\s+(\d+(?:\/\w+)?)/i)?.[1];
      if (port) ports.push(port);
    });

    // Compose ports
    const composePortMatches = text.match(/-\s*"?\d+:\d+"?/g) || [];
    composePortMatches.forEach(match => {
      const port = match.match(/"?\d+:\d+"?/)?.[0];
      if (port) ports.push(port);
    });

    return ports;
  }

  private extractVolumes(text: string): string[] {
    const volumes: string[] = [];

    // Dockerfile VOLUME
    const volumeMatches = text.match(/VOLUME\s+\[([^\]]+)\]/gi) || [];
    volumeMatches.forEach(match => {
      const volList = match.match(/\[([^\]]+)\]/)?.[1];
      if (volList) {
        const volItems = volList.match(/"([^"]+)"/g) || [];
        volItems.forEach(item => {
          volumes.push(item.replace(/"/g, ''));
        });
      }
    });

    // Compose volumes
    const composeVolumes = text.match(/volumes:\s*\n([\s\S]*?)(?=\n\w+:\s*$|\n*$)/i);
    if (composeVolumes) {
      const volumeDefs = composeVolumes[1].match(/^\s+-\s+([^:]+):/gm) || [];
      volumeDefs.forEach(def => {
        const volume = def.match(/-\s+([^:]+):/)?.[1];
        if (volume) volumes.push(volume.trim());
      });
    }

    return [...new Set(volumes)];
  }

  private extractNetworks(text: string): string[] {
    const networks: string[] = [];

    if (text.includes('networks:')) {
      const networkSection = text.match(/networks:\s*\n([\s\S]*?)(?=\n\w+:\s*$|\n*$)/i);
      if (networkSection) {
        const networkDefs = networkSection[1].match(/^\s+(\w+):\s*$/gm) || [];
        networkDefs.forEach(def => {
          const network = def.match(/^\s+(\w+):\s*$/)?.[1];
          if (network) networks.push(network);
        });
      }
    }

    return networks;
  }

  private extractEnvironment(text: string): Record<string, string> {
    const env: Record<string, string> = {};

    // Dockerfile ENV
    const envMatches = text.match(/ENV\s+(\w+)\s+([^\s\n]+)/gi) || [];
    envMatches.forEach(match => {
      const envMatch = match.match(/ENV\s+(\w+)\s+([^\s\n]+)/i);
      if (envMatch) {
        env[envMatch[1]] = envMatch[2];
      }
    });

    // Compose environment
    const composeEnvSection = text.match(/environment:\s*\n([\s\S]*?)(?=\n\w+:\s*$|\n*$)/i);
    if (composeEnvSection) {
      const envVars = composeEnvSection[1].match(/^\s+(\w+):\s*([^\n]+)/gm) || [];
      envVars.forEach(varDef => {
        const varMatch = varDef.match(/^\s+(\w+):\s*([^\n]+)/);
        if (varMatch) {
          env[varMatch[1]] = varMatch[2].replace(/['"]/g, '');
        }
      });
    }

    return env;
  }

  private extractBuildContext(text: string): {
    context?: string;
    dockerfile?: string;
    args?: Record<string, string>;
  } {
    const buildContext: any = {};

    if (text.includes('build:')) {
      const buildSection = text.match(/build:\s*\n([\s\S]*?)(?=\n\w+:\s*$|\n*$)/i);
      if (buildSection) {
        const contextMatch = buildSection[1].match(/context:\s*([^\n]+)/i);
        if (contextMatch) buildContext.context = contextMatch[1].trim();

        const dockerfileMatch = buildSection[1].match(/dockerfile:\s*([^\n]+)/i);
        if (dockerfileMatch) buildContext.dockerfile = dockerfileMatch[1].trim();

        const argsSection = buildSection[1].match(/args:\s*\n([\s\S]*?)(?=\n\w+:\s*$|\n*$)/i);
        if (argsSection) {
          const args: Record<string, string> = {};
          const argDefs = argsSection[1].match(/^\s+(\w+):\s*([^\n]+)/gm) || [];
          argDefs.forEach(argDef => {
            const argMatch = argDef.match(/^\s+(\w+):\s*([^\n]+)/);
            if (argMatch) {
              args[argMatch[1]] = argMatch[2].replace(/['"]/g, '');
            }
          });
          buildContext.args = args;
        }
      }
    }

    return buildContext;
  }

  private extractDeploymentConfig(text: string): {
    replicas?: number;
    resources?: {
      limits?: Record<string, string>;
      reservations?: Record<string, string>;
    };
    restartPolicy?: string;
  } {
    const deployConfig: any = {};

    if (text.includes('deploy:')) {
      const deploySection = text.match(/deploy:\s*\n([\s\S]*?)(?=\n\w+:\s*$|\n*$)/i);
      if (deploySection) {
        const replicasMatch = deploySection[1].match(/replicas:\s*(\d+)/i);
        if (replicasMatch) deployConfig.replicas = parseInt(replicasMatch[1]);

        const restartMatch = deploySection[1].match(/restart_policy:\s*([^\n]+)/i);
        if (restartMatch) deployConfig.restartPolicy = restartMatch[1].trim();

        // Extract resource limits
        const resourcesSection = deploySection[1].match(
          /resources:\s*\n([\s\S]*?)(?=\n\w+:\s*$|\n*$)/i
        );
        if (resourcesSection) {
          deployConfig.resources = {};

          const limitsSection = resourcesSection[1].match(
            /limits:\s*\n([\s\S]*?)(?=\n\w+:\s*$|\n*$)/i
          );
          if (limitsSection) {
            deployConfig.resources.limits = {};
            const limitDefs = limitsSection[1].match(/^\s+(\w+):\s*([^\n]+)/gm) || [];
            limitDefs.forEach(def => {
              const limitMatch = def.match(/^\s+(\w+):\s*([^\n]+)/);
              if (limitMatch) deployConfig.resources.limits[limitMatch[1]] = limitMatch[2];
            });
          }
        }
      }
    }

    return deployConfig;
  }

  private extractSecurityFeatures(text: string): string[] {
    const features: string[] = [];

    if (text.includes('USER') && !text.includes('USER root')) {
      features.push('non-root-user');
    }
    if (text.includes('HEALTHCHECK')) {
      features.push('health-checks');
    }
    if (text.includes('security_opt:')) {
      features.push('security-options');
    }
    if (text.includes('cap_drop:')) {
      features.push('capability-dropping');
    }
    if (text.includes('read_only:')) {
      features.push('read-only-filesystem');
    }
    if (text.includes('tmpfs:')) {
      features.push('temporary-filesystem');
    }

    return features;
  }

  private extractServices(text: string): Record<string, any> {
    const services: Record<string, any> = {};

    if (text.includes('services:')) {
      const servicesSection = text.match(/services:\s*\n([\s\S]*?)(?=\n\w+:\s*$|\n*$)/i);
      if (servicesSection) {
        const serviceDefs = servicesSection[1].match(/^\s+(\w+):\s*$/gm) || [];
        serviceDefs.forEach(def => {
          const serviceName = def.match(/^\s+(\w+):\s*$/)?.[1];
          if (serviceName) {
            services[serviceName] = {
              image: this.extractServiceImage(text, serviceName),
              ports: this.extractServicePorts(text, serviceName),
              depends_on: this.extractServiceDependencies(text, serviceName),
            };
          }
        });
      }
    }

    return services;
  }

  private extractServiceImage(text: string, serviceName: string): string {
    const serviceSection = text.match(
      new RegExp(`${serviceName}:\\s*\\n([\\s\\S]*?)(?=\\n\\w+:\\s*$|\\n*$)`, 'i')
    );
    if (serviceSection) {
      const imageMatch = serviceSection[1].match(/image:\s*([^\n]+)/i);
      return imageMatch ? imageMatch[1].trim() : 'unknown';
    }
    return 'unknown';
  }

  private extractServicePorts(text: string, serviceName: string): string[] {
    const ports: string[] = [];
    const serviceSection = text.match(
      new RegExp(`${serviceName}:\\s*\\n([\\s\\S]*?)(?=\\n\\w+:\\s*$|\\n*$)`, 'i')
    );
    if (serviceSection) {
      const portDefs = serviceSection[1].match(/^\s*-\s*"?\d+:\d+"?/gm) || [];
      portDefs.forEach(def => {
        const port = def.match(/"?\d+:\d+"?/)?.[0];
        if (port) ports.push(port);
      });
    }
    return ports;
  }

  private extractServiceDependencies(text: string, serviceName: string): string[] {
    const dependencies: string[] = [];
    const serviceSection = text.match(
      new RegExp(`${serviceName}:\\s*\\n([\\s\\S]*?)(?=\\n\\w+:\\s*$|\\n*$)`, 'i')
    );
    if (serviceSection) {
      const dependsSection = serviceSection[1].match(
        /depends_on:\s*\n([\s\S]*?)(?=\n\w+:\s*$|\n*$)/i
      );
      if (dependsSection) {
        const depDefs = dependsSection[1].match(/^\s*-\s*(\w+)/gm) || [];
        depDefs.forEach(def => {
          const dep = def.match(/-\s*(\w+)/)?.[1];
          if (dep) dependencies.push(dep);
        });
      }
    }
    return dependencies;
  }

  private extractDockerDependencies(text: string): string[] {
    const dependencies: string[] = [];

    // FROM dependencies
    const fromMatches = text.match(/FROM\s+([^\s\n]+)/gi) || [];
    fromMatches.forEach(match => {
      const image = match.match(/FROM\s+([^\s\n]+)/i)?.[1];
      if (image && !image.includes('as')) {
        dependencies.push(image);
      }
    });

    // Service dependencies
    Object.values(this.extractServices(text)).forEach(service => {
      if (service.depends_on) {
        dependencies.push(...service.depends_on);
      }
    });

    return [...new Set(dependencies)];
  }

  private calculateDockerComplexity(text: string): number {
    let complexity = 1;

    // Base complexity
    complexity += text.split('\n').length * 0.3;

    // Instruction complexity
    const instructionCount = (
      text.match(
        /(FROM|RUN|COPY|ADD|CMD|ENTRYPOINT|EXPOSE|ENV|ARG|VOLUME|USER|WORKDIR|LABEL|HEALTHCHECK)\s+/gi
      ) || []
    ).length;
    complexity += instructionCount * 0.5;

    // Multi-stage complexity
    if (this.isMultiStage(text)) complexity += 3;

    // Service complexity (compose)
    const serviceCount = Object.keys(this.extractServices(text)).length;
    complexity += serviceCount * 2;

    // Volume complexity
    const volumeCount = this.extractVolumes(text).length;
    complexity += volumeCount * 1.5;

    // Network complexity
    const networkCount = this.extractNetworks(text).length;
    complexity += networkCount * 1.5;

    // Environment complexity
    const envCount = Object.keys(this.extractEnvironment(text)).length;
    complexity += envCount * 0.3;

    // Port complexity
    const portCount = this.extractExposedPorts(text).length;
    complexity += portCount * 0.5;

    // Healthcheck complexity
    if (this.hasHealthcheck(text)) complexity += 2;

    // Security features complexity
    const securityFeatures = this.extractSecurityFeatures(text);
    complexity += securityFeatures.length * 1.5;

    // Build context complexity
    if (text.includes('build:')) complexity += 2;
    if (text.includes('deploy:')) complexity += 3;

    return Math.min(complexity, 100);
  }

  private generateDockerTags(text: string): string[] {
    const tags: string[] = ['docker', 'containerization'];

    // Type tags
    const dockerType = this.determineDockerType(text);
    tags.push(dockerType);

    // Image tags
    const baseImage = this.extractBaseImage(text);
    if (baseImage.includes('alpine')) tags.push('alpine');
    if (baseImage.includes('ubuntu')) tags.push('ubuntu');
    if (baseImage.includes('debian')) tags.push('debian');
    if (baseImage.includes('node')) tags.push('nodejs');
    if (baseImage.includes('python')) tags.push('python');
    if (baseImage.includes('openjdk')) tags.push('java');
    if (baseImage.includes('nginx')) tags.push('nginx');
    if (baseImage.includes('mysql')) tags.push('mysql');
    if (baseImage.includes('postgres')) tags.push('postgresql');

    // Architecture tags
    if (this.isMultiStage(text)) tags.push('multi-stage');
    if (text.includes('services:')) tags.push('orchestration');
    if (text.includes('deploy:')) tags.push('deployment');
    if (text.includes('volumes:')) tags.push('persistent-storage');
    if (text.includes('networks:')) tags.push('networking');

    // Security tags
    if (text.includes('USER') && !text.includes('USER root')) tags.push('non-root');
    if (text.includes('HEALTHCHECK')) tags.push('health-monitoring');
    if (text.includes('security_opt:')) tags.push('security-hardened');

    // Configuration tags
    if (text.includes('environment:')) tags.push('environment-variables');
    if (text.includes('ports:')) tags.push('port-mapping');
    if (text.includes('depends_on:')) tags.push('service-dependencies');

    return tags;
  }

  protected getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
    const lines = sourceCode.split('\n');
    const startLine = node.startPosition.row;
    const endLine = node.endPosition.row;

    return lines.slice(startLine, endLine + 1).join('\n');
  }

  // Remove duplicate generateSnippetId - use base class implementation
}
