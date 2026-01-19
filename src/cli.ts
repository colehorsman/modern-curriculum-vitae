#!/usr/bin/env node
/**
 * CLI Interface for Career Showcase Platform
 * 
 * Provides command-line access to platform functionality.
 * @see Requirements: All
 */

import { Platform } from './platform.js';
import * as fs from 'fs';
import * as path from 'path';

interface CLIOptions {
  githubToken?: string;
  resumePath?: string;
  outputDir?: string;
}

/**
 * Parses command line arguments
 */
function parseArgs(args: string[]): { command: string; options: CLIOptions } {
  const command = args[0] || 'help';
  const options: CLIOptions = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    if (arg === '--token' && nextArg) {
      options.githubToken = nextArg;
      i++;
    } else if (arg === '--resume' && nextArg) {
      options.resumePath = nextArg;
      i++;
    } else if (arg === '--output' && nextArg) {
      options.outputDir = nextArg;
      i++;
    }
  }

  return { command, options };
}

/**
 * Displays help information
 */
function showHelp(): void {
  console.log(`
Career Showcase Platform CLI

Usage: career-showcase <command> [options]

Commands:
  connect-github    Connect to GitHub and fetch repositories
  scrape-jobs       Scrape job listings from configured sources
  build-website     Build the portfolio website
  generate-readme   Generate GitHub profile README
  help              Show this help message

Options:
  --token <token>   GitHub OAuth token
  --resume <path>   Path to resume file (PDF or DOCX)
  --output <dir>    Output directory for generated files

Examples:
  career-showcase connect-github --token ghp_xxxx
  career-showcase build-website --resume ./resume.pdf --output ./dist
  career-showcase generate-readme --token ghp_xxxx --resume ./resume.pdf
`);
}

/**
 * Connects to GitHub and displays repository info
 */
async function connectGitHub(platform: Platform, token: string): Promise<void> {
  console.log('Connecting to GitHub...');
  
  const result = await platform.connectGitHub(token);
  
  if (!result.success) {
    console.error('Failed to connect:', result.error);
    process.exit(1);
  }

  console.log(`Connected as: ${result.profile?.name || result.profile?.username}`);
  console.log('Fetching repositories...');

  const repos = await platform.fetchRepositories();
  console.log(`Found ${repos.length} repositories:`);
  
  repos.slice(0, 10).forEach(repo => {
    const visibility = repo.isPrivate ? '🔒' : '🌐';
    console.log(`  ${visibility} ${repo.name} - ⭐ ${repo.stars}`);
  });

  if (repos.length > 10) {
    console.log(`  ... and ${repos.length - 10} more`);
  }
}

/**
 * Scrapes jobs from configured sources
 */
async function scrapeJobs(platform: Platform): Promise<void> {
  console.log('Job scraping is configured but requires source setup.');
  console.log('Configure job sources in your platform settings.');
  
  // Example sources would be configured here
  const result = await platform.scrapeJobs([], []);
  console.log(`Scrape complete: ${result.jobsFound} jobs found`);
}

/**
 * Builds the portfolio website
 */
async function buildWebsite(
  platform: Platform,
  resumePath: string,
  outputDir: string
): Promise<void> {
  console.log('Building portfolio website...');

  // Parse resume
  console.log(`Parsing resume: ${resumePath}`);
  const resume = await platform.parseResume(resumePath);
  console.log(`Extracted profile for: ${resume.name}`);

  // Create unified profile
  await platform.createUnifiedProfile(resume);

  // Build website
  console.log('Generating website...');
  const build = await platform.buildWebsite();

  // Write files to output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const file of build.files) {
    const filePath = path.join(outputDir, file.path);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, file.content);
    console.log(`  Created: ${file.path}`);
  }

  console.log(`\nWebsite built successfully!`);
  console.log(`Output: ${outputDir}`);
  console.log(`Total size: ${(build.totalSize / 1024).toFixed(2)} KB`);
}

/**
 * Generates GitHub profile README
 */
async function generateReadme(
  platform: Platform,
  token: string,
  resumePath: string,
  outputDir: string
): Promise<void> {
  console.log('Generating GitHub profile README...');

  // Connect to GitHub
  await platform.connectGitHub(token);
  await platform.fetchRepositories();

  // Generate abstracts
  console.log('Generating project abstracts...');
  await platform.generateAllAbstracts();

  // Parse resume and create profile
  console.log(`Parsing resume: ${resumePath}`);
  const resume = await platform.parseResume(resumePath);
  await platform.createUnifiedProfile(resume);

  // Generate README
  const readme = platform.generateProfileReadme();

  // Write to file
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const readmePath = path.join(outputDir, 'README.md');
  fs.writeFileSync(readmePath, readme.markdown);

  console.log(`\nREADME generated successfully!`);
  console.log(`Output: ${readmePath}`);
  console.log(`\nPreview:`);
  console.log('─'.repeat(50));
  console.log(readme.markdown.slice(0, 500));
  if (readme.markdown.length > 500) {
    console.log('...');
  }
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { command, options } = parseArgs(args);

  const platform = new Platform();

  try {
    switch (command) {
      case 'connect-github':
        if (!options.githubToken) {
          console.error('Error: --token is required');
          process.exit(1);
        }
        await connectGitHub(platform, options.githubToken);
        break;

      case 'scrape-jobs':
        await scrapeJobs(platform);
        break;

      case 'build-website':
        if (!options.resumePath) {
          console.error('Error: --resume is required');
          process.exit(1);
        }
        await buildWebsite(
          platform,
          options.resumePath,
          options.outputDir || './dist'
        );
        break;

      case 'generate-readme':
        if (!options.githubToken || !options.resumePath) {
          console.error('Error: --token and --resume are required');
          process.exit(1);
        }
        await generateReadme(
          platform,
          options.githubToken,
          options.resumePath,
          options.outputDir || './dist'
        );
        break;

      case 'help':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await platform.close();
  }
}

// Run CLI
main().catch(console.error);
