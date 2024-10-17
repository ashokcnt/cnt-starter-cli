#!/usr/bin/env node

const prompts = require('prompts');

prompts.override(require('yargs').argv);
import path, { basename, resolve } from 'node:path'
import { validateNpmName } from './helpers/validate-pkg';
import { downloadAndExtractZip, ensureDirectoryExists } from './helpers/download';

const { Command } = require('commander');
const program = new Command();



program
  .name('cnt-starter')
  .description('CLI to some JavaScript string utilities')
  .argument('[directory]')
  .option('--cms-cf, --contentful', 'Initialize as a Contentful project. (default)')
  .option('--cms-s, --sanity', 'Initialize as a Sanity project.')
  .version('0.0.0');

program.parse();

let options = program.opts();

console.log(options);

let projectPath: string = '';


(async () => {
  //project path
  const { path} = await prompts({
    // onState: onPromptState,
    type: 'text',
    name: 'path',
    message: 'What is your project named?',
    initial: 'my-app',
    validate: (name: string) => {
      const validation = validateNpmName(basename(resolve(name)))
      if (validation.valid) {
        return true
      }
      return 'Invalid project name: ' + validation.problems[0]
    },
  })

  if (typeof path === 'string') {
    projectPath = path.trim()
    options.projectPath = projectPath;
  }


  if (!options.contentful) {

  const questions = [
    {
      type: 'select',
      name: 'cms',
      message: 'What is your favorite CMS',
      choices: [
        { title: 'Contentful', value: 'contentful' },
        { title: 'Sanity', value: 'sanity' },
      ],
    },

  ];
  const {cms} = await prompts(questions);

  options.cms = cms
}

if(options.cms === 'contentful' || options.contentful) {

  options.cms = 'contentful';

  const questions = [
    {
        type: 'text',
        name: 'accessToken',
        message: 'Please provide a contentful access token'
      },
      {
        type: 'text',
        name: 'spaceId',
        message: 'Please provide a contentful space id'
      },
      {
        type: 'text',
        name: 'environment',
        message: 'Please provide a contentful enviroment id'
      },

  ];
  const {accessToken, spaceId, environment} = await prompts(questions);

  options = {...options, accessToken, spaceId, environment}

}


  console.log(options);

  try {
    await createApplication(options)
  } catch (reason) {
    if (!(reason instanceof DownloadError)) {
      throw reason
    }
  }




  // {
  //   type: (prev: string) => prev == 'contentful' ? 'text' : null,
  //   name: 'accessToken',
  //   message: 'Please provide a contentful access token'
  // },
  // {
  //   type: (prev: string) => prev == 'accessToken' ? 'text' : null,
  //   name: 'accessToken',
  //   message: 'Please provide a contentful access token'
  // },

  //CONTENTFUL_SPACE_ID=3hz90jo4yos8
// CONTENTFUL_ACCESS_TOKEN=dmAFKVYkkVXCw70FAxbjzJqYUh5fBg4ZydiC9KgkyFw
// CONTENTFUL_ENVIRONMENT=master

})();


export async function createApplication(options: {
  projectPath: string,
  cms: string,
  accessToken?: string,
  spaceId?: string,
  environment?: string,
}) {

  const { projectPath, cms, accessToken, spaceId, environment } = options
  console.log(projectPath, cms, accessToken, spaceId, environment);

  // download a zip file from github and exptract in to the app directory

  // Example usage
const githubZipUrl = `https://github.com/ashokcnt/cnt-starter/archive/refs/tags/template1.0.tar.gz`; // Replace with your GitHub URL
const outputDirectory = basename(projectPath); // Directory where files will be extracted

console.log(outputDirectory);

await ensureDirectoryExists(outputDirectory);

downloadAndExtractZip(githubZipUrl, outputDirectory);
// const root = resolve(projectPath);
// await downloadAndExtractExample(root)

await createEnv(accessToken, spaceId, environment, outputDirectory);

console.log(`cd ${projectPath}`);
console.log(`Install Dependencies npm install`);
console.log(`Start Server npm run dev`);


console.log('Done!');

}


export class DownloadError extends Error { }
export async function createEnv(accessToken?: string, spaceId?: string, environment?: string, outputDirectory?: string) {
  const fs = require('fs');

  const envFileContent = `
CONTENTFUL_SPACE_ID=${spaceId}
CONTENTFUL_ACCESS_TOKEN=${accessToken}
CONTENTFUL_ENVIRONMENT=${environment}
`;

  fs.writeFileSync(`${outputDirectory}/.env`, envFileContent);
}

