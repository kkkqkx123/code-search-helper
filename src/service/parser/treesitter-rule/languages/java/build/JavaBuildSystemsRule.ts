import * as Parser from 'tree-sitter';
import { SnippetChunk } from '../../../../types';
import { AbstractSnippetRule } from '../../../AbstractSnippetRule';

/**
 * Java Build Systems Rule - Extracts Maven and Gradle build configuration patterns
 */
export class JavaBuildSystemsRule extends AbstractSnippetRule {
  readonly name = 'JavaBuildSystemsRule';
  readonly supportedNodeTypes = new Set([
    'xml_element',
    'xml_attribute',
    'xml_text',
    'dependency',
    'plugin',
    'configuration',
    'property',
    'profile',
    'repository',
    'build',
    'task',
    'extension',
    'source_set',
  ]);

  protected snippetType = 'build_configuration' as const;

  // Maven patterns
  private readonly mavenPatterns = [
    '<project>',
    '<modelVersion>4.0.0</modelVersion>',
    '<groupId>',
    '<artifactId>',
    '<version>',
    '<packaging>',
    '<dependencies>',
    '<dependency>',
    '<scope>',
    '<plugins>',
    '<plugin>',
    '<build>',
    '<properties>',
    '<profiles>',
    '<profile>',
    '<repositories>',
    '<repository>',
    '<dependencies>',
    '<dependencyManagement>',
    '<modules>',
    '<module>',
    '<parent>',
    '<inherited>',
    '<relativePath>',
  ];

  // Gradle patterns
  private readonly gradlePatterns = [
    'plugins {',
    "id 'java'",
    "id 'org.springframework.boot'",
    "id 'com.github.johnrengelman.shadow'",
    "id 'war'",
    'implementation ',
    'api ',
    'compileOnly ',
    'runtimeOnly ',
    'testImplementation ',
    'testRuntimeOnly ',
    'testCompileOnly ',
    'dependencies {',
    'repositories {',
    'mavenCentral()',
    'mavenLocal()',
    'jcenter()',
    'google()',
    'sourceSets {',
    'main {',
    'test {',
    'java {',
    'resources {',
    'buildscript {',
    'ext {',
    'task ',
    'def ',
    'apply plugin:',
    'version =',
    'group =',
    'sourceCompatibility =',
    'targetCompatibility =',
    'jar {',
    'bootJar {',
    'war {',
    'shadowJar {',
    'test {',
    'checkstyle {',
    'pmd {',
    'findbugs {',
    'jacoco {',
    'sonarqube {',
    'publishing {',
    'docker {',
  ];

  protected isValidNodeType(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const nodeText = this.getNodeText(node, sourceCode);
    return this.isMavenPattern(nodeText) || this.isGradlePattern(nodeText);
  }

  private isMavenPattern(text: string): boolean {
    return (
      this.mavenPatterns.some(pattern => text.includes(pattern)) ||
      (text.includes('.xml') &&
        (text.includes('<project>') || text.includes('<dependency>') || text.includes('<plugin>')))
    );
  }

  private isGradlePattern(text: string): boolean {
    return (
      this.gradlePatterns.some(pattern => text.includes(pattern)) ||
      text.includes('.gradle') ||
      text.includes('build.gradle') ||
      text.includes('settings.gradle')
    );
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const nodeText = this.getNodeText(node, sourceCode);

    // Extract build system information
    const buildInfo = this.extractBuildInfo(nodeText);

    // Calculate complexity based on build configuration
    const complexity = this.calculateBuildComplexity(nodeText);

    // Create enhanced metadata for build configurations
    const metadata = {
      complexity,
      tags: this.generateBuildTags(nodeText),
      buildSystem: this.determineBuildSystem(nodeText),
      buildType: this.determineBuildType(nodeText),
      dependencies: this.extractDependencies(nodeText),
      plugins: this.extractPlugins(nodeText),
      repositories: this.extractRepositories(nodeText),
      properties: this.extractProperties(nodeText),
      profiles: this.extractProfiles(nodeText),
    };

    return {
      id: this.generateSnippetId(nodeText, node.startPosition.row + 1),
      content: nodeText,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: [],
      exports: [],
      metadata: {},
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo: {
          nestingLevel: nestingLevel,
        },
        languageFeatures: this.analyzeLanguageFeatures(nodeText),
        complexity: complexity,
        isStandalone: true,
        hasSideEffects: this.hasSideEffects(nodeText),
        buildInfo: metadata,
      },
    };
  }

  private extractBuildInfo(text: string): {
    buildSystem: 'maven' | 'gradle' | 'unknown';
    isMultiModule: boolean;
    hasParentPom: boolean;
    packagingType?: string;
    javaVersion?: string;
  } {
    const buildSystem = this.determineBuildSystem(text);
    const isMultiModule = text.includes('<modules>') || text.includes('include ');
    const hasParentPom = text.includes('<parent>') || text.includes('settings.gradle');

    // Extract packaging type
    const packagingMatch = text.match(/<packaging>([^<]+)<\/packaging>/);
    const packagingType = packagingMatch ? packagingMatch[1].trim() : undefined;

    // Extract Java version
    const javaVersionMatch = text.match(
      /(?:sourceCompatibility|targetCompatibility|maven\.compiler\.(source|target))\s*=\s*['"]([^'"\\s]+)['"]/
    );
    const javaVersion = javaVersionMatch ? javaVersionMatch[2] : undefined;

    return {
      buildSystem,
      isMultiModule,
      hasParentPom,
      packagingType,
      javaVersion,
    };
  }

  private determineBuildSystem(text: string): 'maven' | 'gradle' | 'unknown' {
    if (text.includes('<project>') && text.includes('modelVersion')) {
      return 'maven';
    }
    if (
      text.includes('build.gradle') ||
      text.includes('settings.gradle') ||
      text.includes('plugins {')
    ) {
      return 'gradle';
    }
    return 'unknown';
  }

  private determineBuildType(text: string): string {
    if (text.includes('org.springframework.boot')) {
      return 'spring-boot';
    }
    if (text.includes('war') || text.includes('<packaging>war</packaging>')) {
      return 'web-application';
    }
    if (text.includes('com.github.johnrengelman.shadow')) {
      return 'uber-jar';
    }
    if (text.includes('docker')) {
      return 'dockerized';
    }
    return 'standard';
  }

  private calculateBuildComplexity(text: string): number {
    let complexity = 1;

    // Base complexity
    complexity += text.split('\n').length * 0.3;

    // Dependency count
    const dependencyCount = (text.match(/<dependency>|implementation |api /g) || []).length;
    complexity += dependencyCount * 0.5;

    // Plugin count
    const pluginCount = (text.match(/<plugin>|id '[^']+'/g) || []).length;
    complexity += pluginCount * 0.7;

    // Multi-module complexity
    if (text.includes('<modules>') || text.includes('include ')) {
      complexity += 2;
    }

    // Profile complexity
    if (text.includes('<profiles>') || text.includes('profiles {')) {
      complexity += 1.5;
    }

    // Repository complexity
    const repoCount = (text.match(/<repository>|repositories {/g) || []).length;
    complexity += repoCount * 0.3;

    // Custom task complexity
    const taskCount = (text.match(/task\s+\w+|def\s+\w+/g) || []).length;
    complexity += taskCount * 0.4;

    return Math.min(complexity, 100);
  }

  private generateBuildTags(text: string): string[] {
    const tags: string[] = ['build-system', 'java'];

    // Build system tags
    if (this.isMavenPattern(text)) {
      tags.push('maven', 'pom', 'xml');
    } else if (this.isGradlePattern(text)) {
      tags.push('gradle', 'groovy', 'kotlin');
    }

    // Framework tags
    if (text.includes('org.springframework.boot')) {
      tags.push('spring-boot');
    }
    if (text.includes('jakarta') || text.includes('javax')) {
      tags.push('java-ee');
    }

    // Packaging tags
    if (text.includes('war') || text.includes('<packaging>war</packaging>')) {
      tags.push('web-app', 'war');
    }
    if (text.includes('jar') || text.includes('<packaging>jar</packaging>')) {
      tags.push('library', 'jar');
    }

    // Plugin tags
    if (text.includes('shadow')) tags.push('shadow-jar');
    if (text.includes('docker')) tags.push('docker');
    if (text.includes('sonarqube')) tags.push('code-quality');
    if (text.includes('jacoco')) tags.push('test-coverage');
    if (text.includes('checkstyle') || text.includes('pmd') || text.includes('findbugs')) {
      tags.push('code-analysis');
    }

    // Architecture tags
    if (text.includes('<modules>') || text.includes('include ')) {
      tags.push('multi-module');
    }
    if (text.includes('<parent>')) tags.push('inheritance');

    return tags;
  }

  private extractDependencies(text: string): string[] {
    const dependencies: string[] = [];

    // Maven dependencies
    const mavenDeps = text.match(/<dependency>[\s\S]*?<\/dependency>/g) || [];
    mavenDeps.forEach(dep => {
      const groupIdMatch = dep.match(/<groupId>([^<]+)<\/groupId>/);
      const artifactIdMatch = dep.match(/<artifactId>([^<]+)<\/artifactId>/);
      const versionMatch = dep.match(/<version>([^<]+)<\/version>/);

      if (groupIdMatch && artifactIdMatch) {
        const groupId = groupIdMatch[1].trim();
        const artifactId = artifactIdMatch[1].trim();
        const version = versionMatch ? versionMatch[1].trim() : '';

        dependencies.push(`${groupId}:${artifactId}${version ? ':' + version : ''}`);
      }
    });

    // Gradle dependencies
    const gradleDeps =
      text.match(
        /(?:implementation|api|compileOnly|runtimeOnly|testImplementation|testRuntimeOnly)\s+['"]([^'"\\s]+)['"]/g
      ) || [];
    gradleDeps.forEach(dep => {
      const dependency = dep.match(/['"]([^'"\\s]+)['"]/)?.[1];
      if (dependency) dependencies.push(dependency);
    });

    return dependencies;
  }

  private extractPlugins(text: string): string[] {
    const plugins: string[] = [];

    // Maven plugins
    const mavenPlugins = text.match(/<plugin>[\s\S]*?<\/plugin>/g) || [];
    mavenPlugins.forEach(plugin => {
      const groupIdMatch = plugin.match(/<groupId>([^<]+)<\/groupId>/);
      const artifactIdMatch = plugin.match(/<artifactId>([^<]+)<\/artifactId>/);

      if (groupIdMatch && artifactIdMatch) {
        const groupId = groupIdMatch[1].trim();
        const artifactId = artifactIdMatch[1].trim();
        plugins.push(`${groupId}:${artifactId}`);
      }
    });

    // Gradle plugins
    const gradlePlugins = text.match(/id\s+['"]([^'"\\s]+)['"]/g) || [];
    gradlePlugins.forEach(plugin => {
      const pluginId = plugin.match(/['"]([^'"\\s]+)['"]/)?.[1];
      if (pluginId) plugins.push(pluginId);
    });

    return plugins;
  }

  private extractRepositories(text: string): string[] {
    const repositories: string[] = [];

    // Maven repositories
    const mavenRepos = text.match(/<repository>[\s\S]*?<\/repository>/g) || [];
    mavenRepos.forEach(repo => {
      const urlMatch = repo.match(/<url>([^<]+)<\/url>/);
      if (urlMatch) repositories.push(urlMatch[1].trim());
    });

    // Gradle repositories
    const gradleRepos =
      text.match(/(?:mavenCentral|mavenLocal|jcenter|google)\(\)|url\s+['"]([^'"\\s]+)['"]/g) || [];
    gradleRepos.forEach(repo => {
      if (repo.includes('url')) {
        const url = repo.match(/url\s+['"]([^'"\\s]+)['"]/)?.[1];
        if (url) repositories.push(url);
      } else {
        repositories.push(repo.trim());
      }
    });

    return [...new Set(repositories)];
  }

  private extractProperties(text: string): Record<string, string> {
    const properties: Record<string, string> = {};

    // Maven properties
    const mavenProps = text.match(/<([^>]+)>([^<]+)<\/\1>/g) || [];
    mavenProps.forEach(prop => {
      const match = prop.match(/<([^>]+)>([^<]+)<\/\1>/);
      if (match && match[1] !== 'dependency' && match[1] !== 'plugin') {
        properties[match[1]] = match[2];
      }
    });

    // Gradle properties
    const gradleProps = text.match(/(\w+)\s*=\s*['"]([^'"\\s]+)['"]/g) || [];
    gradleProps.forEach(prop => {
      const match = prop.match(/(\w+)\s*=\s*['"]([^'"\\s]+)['"]/);
      if (match) properties[match[1]] = match[2];
    });

    return properties;
  }

  private extractProfiles(text: string): string[] {
    const profiles: string[] = [];

    // Maven profiles
    const mavenProfiles = text.match(/<profile>[\s\S]*?<\/profile>/g) || [];
    mavenProfiles.forEach(profile => {
      const idMatch = profile.match(/<id>([^<]+)<\/id>/);
      if (idMatch) profiles.push(idMatch[1].trim());
    });

    return profiles;
  }
}
