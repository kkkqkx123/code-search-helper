import * as Parser from 'tree-sitter';
import { SnippetChunk, SnippetMetadata } from '../../../../types';
import { AbstractSnippetRule } from '../../../AbstractSnippetRule';

/**
 * CI/CD Configuration Rule - Extracts CI/CD pipeline and automation patterns
 */
export class CICDConfigurationRule extends AbstractSnippetRule {
  readonly name = 'CICDConfigurationRule';
  readonly supportedNodeTypes = new Set([
    'workflow',
    'job',
    'step',
    'stages',
    'stage',
    'pipeline',
    'script',
    'before_script',
    'after_script',
    'services',
    'cache',
    'artifacts',
    'environment',
    'deploy',
    'variables',
    'secrets',
    'matrix',
    'strategy',
    'trigger',
    'workflow_dispatch',
    'schedule',
    'pull_request',
    'push',
    'workflow_call',
    'workflow_run',
    'container',
    'runs_on',
    'needs',
    'timeout_minutes',
    'retry',
    'continue_on_error',
    'if',
    'name',
    'on',
    'permissions',
    'concurrency',
    'outputs',
  ]);

  protected snippetType = 'cicd_configuration' as const;

  // GitHub Actions patterns
  private readonly githubActionsPatterns = [
    'name:',
    'on:',
    'jobs:',
    'runs-on:',
    'steps:',
    'uses:',
    'with:',
    'env:',
    'secrets:',
    'strategy:',
    'matrix:',
    'container:',
    'services:',
    'outputs:',
    'needs:',
    'timeout-minutes:',
    'permissions:',
    'concurrency:',
    'workflow_dispatch:',
    'schedule:',
    'pull_request:',
    'push:',
    'workflow_call:',
    'workflow_run:',
    'checkout@v',
    'setup-node@v',
    'setup-python@v',
    'setup-java@v',
    'docker/build-push-action@v',
    'actions/checkout@v',
    'actions/setup-node@v',
    'actions/setup-python@v',
    'actions/setup-java@v',
    'github/codeql-action@v',
    'codecov/codecov-action@v',
  ];

  // GitLab CI patterns
  private readonly gitlabCIPatterns = [
    'stages:',
    'before_script:',
    'after_script:',
    'script:',
    'cache:',
    'artifacts:',
    'dependencies:',
    'coverage:',
    'only:',
    'except:',
    'tags:',
    'allow_failure:',
    'when:',
    'environment:',
    'resource_group:',
    'interruptible:',
    'services:',
    'variables:',
    'include:',
    'extends:',
    'rules:',
    'retry:',
    'timeout:',
    'parallel:',
    'image:',
    'tags:',
    '.pre:',
    '.post:',
    'default:',
  ];

  // Jenkins patterns
  private readonly jenkinsPatterns = [
    'pipeline',
    'agent',
    'stages',
    'stage',
    'steps',
    'script',
    'post',
    'environment',
    'tools',
    'options',
    'parameters',
    'triggers',
    'properties',
    'library',
    'input',
    'timeout',
    'retry',
    'parallel',
    'matrix',
    'when',
    'built-in',
    'credentials',
    'archiveArtifacts',
    'junit',
    'checkout',
    'sh',
    'bat',
    'powershell',
    'node',
    'docker',
    'kubernetes',
  ];

  // CircleCI patterns
  private readonly circleCIPatterns = [
    'version:',
    'jobs:',
    'workflows:',
    'executors:',
    'commands:',
    'parameters:',
    'orbs:',
    'steps:',
    'docker:',
    'machine:',
    'macos:',
    'windows:',
    'shell:',
    'environment:',
    'parallelism:',
    'working_directory:',
    'no_output_timeout:',
    'resource_class:',
    'branches:',
    'filters:',
    'requires:',
    'context:',
    'when:',
    'unless:',
  ];

  // Azure DevOps patterns
  private readonly azureDevOpsPatterns = [
    'trigger:',
    'pr:',
    'pool:',
    'variables:',
    'stages:',
    'stage:',
    'jobs:',
    'job:',
    'steps:',
    'strategy:',
    'matrix:',
    'parallel:',
    'maxParallel:',
    'container:',
    'services:',
    'workspace:',
    'condition:',
    'continueOnError:',
    'enabled:',
    'timeoutInMinutes:',
    'displayName:',
    'name:',
    'dependsOn:',
    'task:',
    'script:',
    'bash:',
    'pwsh:',
    'powershell:',
    'checkout:',
    'download:',
    'publish:',
    'template:',
  ];

  protected isValidNodeType(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const nodeText = this.getNodeText(node, sourceCode);
    return this.isCICDPattern(nodeText);
  }

  private isCICDPattern(text: string): boolean {
    const isGitHubActions = text.includes('on:') && text.includes('jobs:');
    const isGitLabCI = text.includes('stages:') && text.includes('script:');
    const isJenkins = text.includes('pipeline') && text.includes('agent');
    const isCircleCI = text.includes('version:') && text.includes('jobs:');
    const isAzureDevOps = text.includes('trigger:') && text.includes('stages:');

    const hasGitHubPatterns = this.githubActionsPatterns.some(pattern => text.includes(pattern));
    const hasGitLabPatterns = this.gitlabCIPatterns.some(pattern => text.includes(pattern));
    const hasJenkinsPatterns = this.jenkinsPatterns.some(pattern => text.includes(pattern));
    const hasCirclePatterns = this.circleCIPatterns.some(pattern => text.includes(pattern));
    const hasAzurePatterns = this.azureDevOpsPatterns.some(pattern => text.includes(pattern));

    return (
      isGitHubActions ||
      isGitLabCI ||
      isJenkins ||
      isCircleCI ||
      isAzureDevOps ||
      hasGitHubPatterns ||
      hasGitLabPatterns ||
      hasJenkinsPatterns ||
      hasCirclePatterns ||
      hasAzurePatterns
    );
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const contextInfo = { nestingLevel };

    // Extract CI/CD-specific information
    const cicdInfo = this.extractCICDInfo(content);
    const complexity = this.calculateCICDComplexity(content);

    const metadata: SnippetMetadata = {
      snippetType: this.snippetType,
      contextInfo,
      languageFeatures: this.analyzeLanguageFeatures(content),
      complexity,
      isStandalone: true,
      hasSideEffects: this.hasSideEffects(content),
    };

    return {
      id: this.generateSnippetId(content, node.startPosition.row + 1),
      content,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: [],
      exports: [],
      metadata: {},
      snippetMetadata: metadata,
    };
  }

  private extractCICDInfo(text: string): {
    platform: string;
    pipelineType: string;
    jobCount: number;
    stageCount: number;
    stepCount: number;
    hasMatrix: boolean;
    hasParallel: boolean;
    hasConditionalExecution: boolean;
  } {
    const info = {
      platform: this.determinePlatform(text),
      pipelineType: this.determinePipelineType(text),
      jobCount: this.countJobs(text),
      stageCount: this.countStages(text),
      stepCount: this.countSteps(text),
      hasMatrix: text.includes('matrix:'),
      hasParallel: text.includes('parallel:') || text.includes('parallelism:'),
      hasConditionalExecution:
        text.includes('if:') || text.includes('when:') || text.includes('condition:'),
    };

    return info;
  }

  private determinePlatform(text: string): string {
    if (text.includes('on:') && text.includes('jobs:')) return 'github-actions';
    if (text.includes('stages:') && text.includes('script:')) return 'gitlab-ci';
    if (text.includes('pipeline') && text.includes('agent')) return 'jenkins';
    if (text.includes('version:') && text.includes('jobs:')) return 'circleci';
    if (text.includes('trigger:') && text.includes('stages:')) return 'azure-devops';
    if (text.includes('.travis.yml')) return 'travis-ci';
    if (text.includes('build:')) return 'generic-ci';
    return 'unknown';
  }

  private determinePipelineType(text: string): string {
    if (text.includes('deploy:') || text.includes('deployment')) return 'deployment';
    if (text.includes('test:')) return 'testing';
    if (text.includes('build:')) return 'build';
    if (text.includes('security:') || text.includes('sast') || text.includes('dast'))
      return 'security';
    if (text.includes('quality:') || text.includes('sonar') || text.includes('code-quality'))
      return 'quality';
    if (text.includes('integration:')) return 'integration';
    if (text.includes('release:') || text.includes('publish')) return 'release';
    return 'general';
  }

  private extractTriggerEvents(text: string): string[] {
    const events: string[] = [];

    // GitHub Actions triggers
    if (text.includes('push:')) events.push('push');
    if (text.includes('pull_request:')) events.push('pull-request');
    if (text.includes('workflow_dispatch:')) events.push('manual');
    if (text.includes('schedule:')) events.push('scheduled');
    if (text.includes('workflow_call:')) events.push('workflow-call');
    if (text.includes('workflow_run:')) events.push('workflow-run');

    // GitLab CI triggers
    if (text.includes('only:')) events.push('conditional');
    if (text.includes('except:')) events.push('exclusion');
    if (text.includes('tags:')) events.push('tags');

    // Azure DevOps triggers
    if (text.includes('pr:')) events.push('pull-request');
    if (text.includes('trigger:')) events.push('trigger');

    return [...new Set(events)];
  }

  private extractEnvironments(text: string): string[] {
    const environments: string[] = [];

    // Look for environment references
    const envMatches = text.match(/environment:\s*([^\n]+)/gi) || [];
    envMatches.forEach(match => {
      const env = match.match(/environment:\s*([^\n]+)/i)?.[1];
      if (env) {
        environments.push(env.replace(/['"]/g, '').trim());
      }
    });

    // Look for environment variable patterns
    const envVarMatches =
      text.match(/(prod|production|staging|dev|development|test|uat)\s*[:=]/gi) || [];
    envVarMatches.forEach(match => {
      const env = match.match(/(prod|production|staging|dev|development|test|uat)/i)?.[0];
      if (env) environments.push(env.toLowerCase());
    });

    return [...new Set(environments)];
  }

  private countJobs(text: string): number {
    const jobPatterns = [/jobs:\s*\n([\s\S]*?)(?=\n\w+:\s*$|\n*$)/i, /(\w+):\s*\n\s+script:/g];

    let jobCount = 0;
    if (text.includes('jobs:')) {
      const jobsSection = text.match(/jobs:\s*\n([\s\S]*?)(?=\n\w+:\s*$|\n*$)/i);
      if (jobsSection) {
        jobCount = (jobsSection[1].match(/^\s+\w+:\s*$/gm) || []).length;
      }
    }

    return jobCount;
  }

  private countStages(text: string): number {
    let stageCount = 0;

    if (text.includes('stages:')) {
      const stagesSection = text.match(/stages:\s*\n([\s\S]*?)(?=\n\w+:\s*$|\n*$)/i);
      if (stagesSection) {
        stageCount = (stagesSection[1].match(/^\s+-\s*([^\n]+)/gm) || []).length;
      }
    }

    // GitHub Actions jobs can act as stages
    if (text.includes('jobs:') && !text.includes('stages:')) {
      stageCount = this.countJobs(text);
    }

    return stageCount;
  }

  private countSteps(text: string): number {
    let stepCount = 0;

    // GitHub Actions steps
    if (text.includes('steps:')) {
      const stepsSections = text.match(/steps:\s*\n([\s\S]*?)(?=\n\s+\w+:\s*$|\n*$)/gi) || [];
      stepsSections.forEach(section => {
        stepCount += (section.match(/^\s+-\s*(name:|uses:|run:)/gm) || []).length;
      });
    }

    // GitLab CI script steps
    const scriptSteps = (text.match(/script:\s*\n([\s\S]*?)(?=\n\s+\w+:\s*$|\n*$)/gi) || []).length;
    stepCount += scriptSteps;

    return stepCount;
  }

  private hasArtifacts(text: string): boolean {
    return (
      text.includes('artifacts:') || text.includes('archiveArtifacts') || text.includes('publish:')
    );
  }

  private hasCache(text: string): boolean {
    return text.includes('cache:') || text.includes('caching');
  }

  private hasDeployments(text: string): boolean {
    return text.includes('deploy:') || text.includes('deployment') || text.includes('environment:');
  }

  private extractSecurityFeatures(text: string): string[] {
    const features: string[] = [];

    // Static application security testing
    if (
      text.includes('sast') ||
      text.includes('security-scan') ||
      text.includes('bandit') ||
      text.includes('semgrep')
    ) {
      features.push('sast');
    }

    // Dynamic application security testing
    if (text.includes('dast') || text.includes('owasp-zap') || text.includes('burp')) {
      features.push('dast');
    }

    // Dependency scanning
    if (text.includes('dependency-check') || text.includes('snyk') || text.includes('dependabot')) {
      features.push('dependency-scanning');
    }

    // Container security
    if (text.includes('trivy') || text.includes('clair') || text.includes('container-scan')) {
      features.push('container-security');
    }

    // Code quality
    if (text.includes('sonar') || text.includes('code-quality') || text.includes('lint')) {
      features.push('code-quality');
    }

    // Secret scanning
    if (
      text.includes('secret-scan') ||
      text.includes('gitleaks') ||
      text.includes('detect-secrets')
    ) {
      features.push('secret-scanning');
    }

    return features;
  }

  private extractNotifications(text: string): string[] {
    const notifications: string[] = [];

    if (text.includes('slack') || text.includes('mattermost')) notifications.push('slack');
    if (text.includes('email') || text.includes('mail')) notifications.push('email');
    if (text.includes('teams') || text.includes('microsoft-teams')) notifications.push('teams');
    if (text.includes('discord')) notifications.push('discord');
    if (text.includes('telegram')) notifications.push('telegram');

    return notifications;
  }

  private extractIntegrationPoints(text: string): string[] {
    const integrations: string[] = [];

    // Cloud providers
    if (text.includes('aws') || text.includes('amazon')) integrations.push('aws');
    if (text.includes('azure') || text.includes('microsoft')) integrations.push('azure');
    if (text.includes('gcp') || text.includes('google-cloud')) integrations.push('gcp');

    // Container registries
    if (text.includes('docker-hub') || text.includes('ghcr') || text.includes('ecr')) {
      integrations.push('container-registry');
    }

    // Package registries
    if (text.includes('npm') || text.includes('pypi') || text.includes('maven')) {
      integrations.push('package-registry');
    }

    // Monitoring
    if (text.includes('prometheus') || text.includes('grafana') || text.includes('datadog')) {
      integrations.push('monitoring');
    }

    // Testing platforms
    if (text.includes('browserstack') || text.includes('saucelabs'))
      integrations.push('testing-platform');

    return integrations;
  }

  private extractJobs(text: string): Record<string, any> {
    const jobs: Record<string, any> = {};

    if (text.includes('jobs:')) {
      const jobsSection = text.match(/jobs:\s*\n([\s\S]*?)(?=\n\w+:\s*$|\n*$)/i);
      if (jobsSection) {
        const jobDefs = jobsSection[1].match(/^\s+(\w+):\s*$/gm) || [];
        jobDefs.forEach(def => {
          const jobName = def.match(/^\s+(\w+):\s*$/)?.[1];
          if (jobName) {
            jobs[jobName] = {
              runsOn: this.extractJobRunsOn(text, jobName),
              steps: this.countJobSteps(text, jobName),
              needs: this.extractJobNeeds(text, jobName),
            };
          }
        });
      }
    }

    return jobs;
  }

  private extractJobRunsOn(text: string, jobName: string): string {
    const jobSection = text.match(
      new RegExp(`${jobName}:\\s*\\n([\\s\\S]*?)(?=\\n\\s+\\w+:\\s*$|\\n*$)`, 'i')
    );
    if (jobSection) {
      const runsOnMatch = jobSection[1].match(/runs-on:\s*([^\n]+)/i);
      return runsOnMatch ? runsOnMatch[1].trim() : 'unknown';
    }
    return 'unknown';
  }

  private countJobSteps(text: string, jobName: string): number {
    const jobSection = text.match(
      new RegExp(`${jobName}:\\s*\\n([\\s\\S]*?)(?=\\n\\s+\\w+:\\s*$|\\n*$)`, 'i')
    );
    if (jobSection) {
      const stepsSection = jobSection[1].match(/steps:\s*\n([\s\S]*?)(?=\n\s+\w+:\s*$|\n*$)/i);
      if (stepsSection) {
        return (stepsSection[1].match(/^\s+-\s*(name:|uses:|run:)/gm) || []).length;
      }
    }
    return 0;
  }

  private extractJobNeeds(text: string, jobName: string): string[] {
    const jobSection = text.match(
      new RegExp(`${jobName}:\\s*\\n([\\s\\S]*?)(?=\\n\\s+\\w+:\\s*$|\\n*$)`, 'i')
    );
    if (jobSection) {
      const needsMatch = jobSection[1].match(/needs:\s*\n([\s\S]*?)(?=\n\s+\w+:\s*$|\n*$)/i);
      if (needsMatch) {
        const needsDefs = needsMatch[1].match(/^\s+-\s*(\w+)/gm) || [];
        return needsDefs.map(def => def.match(/-\s*(\w+)/)?.[1] || '').filter(Boolean);
      }
    }
    return [];
  }

  private extractVariables(text: string): Record<string, string> {
    const variables: Record<string, string> = {};

    // GitHub Actions variables
    const envSection = text.match(/env:\s*\n([\s\S]*?)(?=\n\s+\w+:\s*$|\n*$)/i);
    if (envSection) {
      const varDefs = envSection[1].match(/^\s+(\w+):\s*([^\n]+)/gm) || [];
      varDefs.forEach(def => {
        const varMatch = def.match(/^\s+(\w+):\s*([^\n]+)/);
        if (varMatch) {
          variables[varMatch[1]] = varMatch[2].replace(/['"]/g, '');
        }
      });
    }

    // Global variables section
    const variablesSection = text.match(/variables:\s*\n([\s\S]*?)(?=\n\s+\w+:\s*$|\n*$)/i);
    if (variablesSection) {
      const varDefs = variablesSection[1].match(/^\s+(\w+):\s*([^\n]+)/gm) || [];
      varDefs.forEach(def => {
        const varMatch = def.match(/^\s+(\w+):\s*([^\n]+)/);
        if (varMatch) {
          variables[varMatch[1]] = varMatch[2].replace(/['"]/g, '');
        }
      });
    }

    return variables;
  }

  private extractSecrets(text: string): string[] {
    const secrets: string[] = [];

    // GitHub Actions secrets
    const secretsSection = text.match(/secrets:\s*\n([\s\S]*?)(?=\n\s+\w+:\s*$|\n*$)/i);
    if (secretsSection) {
      const secretDefs = secretsSection[1].match(/^\s+(\w+):\s*\${{\s*secrets\.(\w+)\s*}}/gm) || [];
      secretDefs.forEach(def => {
        const secretMatch = def.match(/secrets\.(\w+)/);
        if (secretMatch) {
          secrets.push(secretMatch[1]);
        }
      });
    }

    // GitLab CI variables marked as secret
    const secretVars = text.match(/(\w+):\s*\$\(.*?SECRET.*?\)/gi) || [];
    secretVars.forEach(varDef => {
      const varMatch = varDef.match(/^(\w+):/);
      if (varMatch) {
        secrets.push(varMatch[1]);
      }
    });

    return [...new Set(secrets)];
  }

  private calculateCICDComplexity(text: string): number {
    let complexity = 1;

    // Base complexity
    complexity += text.split('\n').length * 0.2;

    // Job complexity
    const jobCount = this.countJobs(text);
    complexity += jobCount * 2;

    // Stage complexity
    const stageCount = this.countStages(text);
    complexity += stageCount * 1.5;

    // Step complexity
    const stepCount = this.countSteps(text);
    complexity += stepCount * 0.5;

    // Matrix strategy complexity
    if (text.includes('matrix:')) complexity += 3;

    // Parallel execution complexity
    if (text.includes('parallel:') || text.includes('parallelism:')) complexity += 2;

    // Conditional execution complexity
    if (text.includes('if:') || text.includes('when:') || text.includes('condition:'))
      complexity += 2;

    // Artifact complexity
    if (this.hasArtifacts(text)) complexity += 1.5;

    // Cache complexity
    if (this.hasCache(text)) complexity += 1.5;

    // Deployment complexity
    if (this.hasDeployments(text)) complexity += 3;

    // Environment complexity
    const envCount = this.extractEnvironments(text).length;
    complexity += envCount * 1;

    // Integration complexity
    const integrationCount = this.extractIntegrationPoints(text).length;
    complexity += integrationCount * 1.5;

    // Security feature complexity
    const securityCount = this.extractSecurityFeatures(text).length;
    complexity += securityCount * 2;

    // Notification complexity
    const notificationCount = this.extractNotifications(text).length;
    complexity += notificationCount * 1;

    // Secret complexity
    const secretCount = this.extractSecrets(text).length;
    complexity += secretCount * 1.5;

    return Math.min(complexity, 100);
  }

  private generateCICDTags(text: string): string[] {
    const tags: string[] = ['cicd', 'automation'];

    // Platform tags
    const platform = this.determinePlatform(text);
    tags.push(platform);

    // Pipeline type tags
    const pipelineType = this.determinePipelineType(text);
    tags.push(pipelineType);

    // Event tags
    this.extractTriggerEvents(text).forEach(event => tags.push(event));

    // Environment tags
    this.extractEnvironments(text).forEach(env => tags.push(env));

    // Integration tags
    this.extractIntegrationPoints(text).forEach(integration => tags.push(integration));

    // Security tags
    this.extractSecurityFeatures(text).forEach(feature => tags.push(feature));

    // Notification tags
    this.extractNotifications(text).forEach(notification => tags.push(notification));

    // Architecture tags
    if (text.includes('matrix:')) tags.push('matrix-builds');
    if (text.includes('parallel:')) tags.push('parallel-execution');
    if (text.includes('cache:')) tags.push('caching');
    if (text.includes('artifacts:')) tags.push('artifacts');
    if (text.includes('needs:')) tags.push('job-dependencies');

    // Testing tags
    if (text.includes('test:') || text.includes('pytest') || text.includes('jest')) {
      tags.push('testing', 'automated-tests');
    }

    // Build tags
    if (text.includes('build:') || text.includes('compile')) {
      tags.push('build', 'compilation');
    }

    // Quality tags
    if (text.includes('sonar') || text.includes('lint') || text.includes('code-quality')) {
      tags.push('code-quality', 'static-analysis');
    }

    return tags;
  }

  protected analyzeLanguageFeatures(content: string): {
    usesAsync?: boolean;
    usesGenerators?: boolean;
    usesDestructuring?: boolean;
    usesSpread?: boolean;
    usesTemplateLiterals?: boolean;
  } {
    return {
      usesAsync: /\basync\s+function\b|\bawait\s+\w+/i.test(content),
      usesGenerators: /\bfunction\s*\*\s*\w+|\byield\s+\*?\w*/i.test(content),
      usesDestructuring: /\{\s*\w+|\[\s*\w+/i.test(content),
      usesSpread: /\.\.\./.test(content),
      usesTemplateLiterals: /`[^`]*\${[^}]*}/.test(content),
    };
  }

  protected hasSideEffects(content: string): boolean {
    const sideEffectPatterns = [
      /\bconsole\./,
      /\bdocument\./,
      /\bwindow\./,
      /\.write\(/,
      /\.appendChild\(/,
      /\.removeChild\(/,
      /\.insertBefore\(/,
      /\.replaceChild\(/,
      /\.setAttribute\(/,
      /\.removeAttribute\(/,
      /\.addEventListener\(/,
      /\.removeEventListener\(/,
      /\.dispatchEvent\(/,
      /\.postMessage\(/,
      /fetch\(/,
      /XMLHttpRequest/,
      /localStorage\./,
      /sessionStorage\./,
      /alert\(/,
      /confirm\(/,
      /prompt\(/,
    ];

    return sideEffectPatterns.some(pattern => pattern.test(content));
  }

  protected getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
    const lines = sourceCode.split('\n');
    const startLine = node.startPosition.row;
    const endLine = node.endPosition.row;

    return lines.slice(startLine, endLine + 1).join('\n');
  }

  protected generateSnippetId(content: string, startLine: number): string {
    const hash = this.localSimpleHash(content).substring(0, 8);
    return `${this.name}_${startLine}_${hash}`;
  }

  private localSimpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}
