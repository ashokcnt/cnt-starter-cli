#!/usr/bin/env node

const prompts = require('prompts');

prompts.override(require('yargs').argv);
import path, { basename, resolve } from 'node:path'
import { validateNpmName } from './helpers/validate-pkg';
import { downloadAndExtractZip, ensureDirectoryExists } from './helpers/download';
import { exec, spawn } from 'node:child_process';

const { Command } = require('commander');
const { execSync } = require('child_process');
const fs = require('fs');


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

let projectPath: string = '';

(async () => {
  //project path
  const { path } = await prompts({
    // onState: onPromptState,
    type: 'text',
    name: 'path',
    message: 'What is your project named?',
    initial: 'my-cnt-app',
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
    const { cms } = await prompts(questions);

    options.cms = cms
  }

  if (options.cms === 'contentful' || options.contentful) {

    options.cms = 'contentful';

    const questions = [
      {
        type: 'text',
        name: 'accessToken',
        message: 'Please provide a contentful access token',
        validate: (accessToken: string) => {
          if (accessToken.trim() !== '') {
            return true
          }
          return 'Access token can not be empty'
        },
      },
      {
        type: 'text',
        name: 'spaceId',
        message: 'Please provide a contentful space id',
        validate: (spaceId: string) => {
          if (spaceId.trim() !== '') {
            return true
          }
          return 'Space id can not be empty'
        },
      },
      {
        type: 'text',
        name: 'environment',
        message: 'Please provide a contentful enviroment id',
        validate: (environment: string) => {
          if (environment.trim() !== '') {
            return true
          }
          return 'Environment id can not be empty'
        },
      },
      {
        type: 'text',
        name: 'collectionName',
        message: 'Please provide a contentful collection name',
        validate: (collectionName: string) => {
          if (collectionName.trim() !== '') {
            return true
          }
          return 'Collection name can not be empty'
        },
      },
    ];
    const { accessToken, spaceId, environment, collectionName } = await prompts(questions);

    options = { ...options, accessToken, spaceId, environment, collectionName }

  }

  try {
    await createApplication(options)
  } catch (reason) {
    if (!(reason instanceof DownloadError)) {
      throw reason
    }
  }

})();


export async function createApplication(options: {
  projectPath: string,
  cms: string,
  accessToken?: string,
  spaceId?: string,
  environment?: string,
  collectionName: string
}) {

  try {
    const { projectPath, cms, accessToken, spaceId, environment, collectionName } = options
    console.log(projectPath, cms, accessToken, spaceId, environment, collectionName);
  
    // download a zip file from github and exptract in to the app directory
  
    // Example usage
    // const githubZipUrl = `https://github.com/ashokcnt/cnt-starter`; // Replace with your GitHub URL
    const outputDirectory = basename(projectPath); // Directory where files will be extracted
  
    console.log(outputDirectory);
  
    await ensureDirectoryExists(outputDirectory);
  
    // stderr is sent to stderr of parent process
    // you can set options.stdio if you want it to go elsewhere
    let stdout = await execSync('git clone https://github.com/codeandtheory/candt-nextjs-template.git ' + outputDirectory, { stdio: 'inherit' });
  
    // run npm install in outputDirectory
    await execSync(`yarn add graphql graphql-codegen graphql-request graphql-tag dotenv`, { cwd: outputDirectory });
    await execSync(`yarn add -D @graphql-codegen/cli  @graphql-codegen/typescript-operations @graphql-codegen/typescript-resolvers @graphql-codegen/typescript @graphql-codegen/typescript-graphql-request @parcel/watcher`, { cwd: outputDirectory });
  
    await addscriptsToPackageJson(outputDirectory);
  
  
    await createEnv(accessToken, spaceId, environment, outputDirectory);
  
    
    await addRequireFiles(outputDirectory, collectionName);

    
    // const gql = await execSync(`yarn generate:watch`, { cwd: outputDirectory });
    
    // console.log(gql.toString());

    await spawn('yarn', ['generate'], { cwd: outputDirectory, detached: false, stdio: 'inherit' });
    
    await spawn('yarn', ['dev'], { cwd: outputDirectory, detached: false, stdio: 'inherit' });;

  } catch (error) {
    console.log(error);
  }

}


export class DownloadError extends Error { }
async function addRequireFiles(outputDirectory: string, collectionName: string) {
  await ensureDirectoryExists(`${outputDirectory}/src/data`);
  const clientTsPath = resolve(outputDirectory, 'src', 'data', 'client.ts');
  await fs.promises.writeFile(clientTsPath, `
import { GraphQLClient } from "graphql-request";
import { getSdk } from "./graphql/types";
import "dotenv/config";
const endPoint = \`https://graphql.contentful.com/content/v1/spaces/\${process.env.CONTENTFUL_SPACE_ID}/environments/\${process.env.CONTENTFUL_ENVIRONMENT}\`;
const client = new GraphQLClient(endPoint, {
  fetch,
  headers: {
    Authorization: \`Bearer \${process.env.CONTENTFUL_ACCESS_TOKEN}\`,
  },
  errorPolicy: "all",
});
export const sdk = getSdk(client);
`);

  const codegenTsPath = resolve(outputDirectory, 'codegen.ts');
  await fs.promises.writeFile(codegenTsPath, `
import type { CodegenConfig } from "@graphql-codegen/cli";
import "dotenv/config";
const endPoint = \`https://graphql.contentful.com/content/v1/spaces/\${process.env.CONTENTFUL_SPACE_ID}/environments/\${process.env.CONTENTFUL_ENVIRONMENT}\`;
const config: CodegenConfig = {
  overwrite: true,
  schema: [
    {
      [\`\${endPoint}\`]: {
        headers: {
          Authorization: \`Bearer \${process.env.CONTENTFUL_ACCESS_TOKEN}\`,
        },
      },
    },
  ],
  documents: "./src/data/graphql/**/*.graphql",
  generates: {
    "./src/data/graphql/types.ts": {
      plugins: [
        "typescript",
        "typescript-operations",
        "typescript-graphql-request",
      ],
      config: {
        avoidOptionals: false,
        maybeValue: "T | undefined",
        skipTypename: true,
        onlyOperationTypes: true,
        dedupeFragments: true,
        inlineFragmentTypes: "combine",
      },
    },
  },
  hooks: { afterAllFileWrite: ["prettier --write"] },
};
export default config;
`);

await ensureDirectoryExists(`${outputDirectory}/src/data/graphql`);

  const titleCaseCollectionName = collectionName
    .toLowerCase()
    .replace(/\b[a-z]/g, char => char.toUpperCase())
    .replace(/-/g, ' ');

const getPath = resolve(outputDirectory, `src/data/graphql/get${titleCaseCollectionName}.graphql`);
await fs.promises.writeFile(getPath, `
query Get${titleCaseCollectionName}($limit: Int!, $skip: Int!) {
  ${collectionName}Collection(limit: $limit, skip: $skip) {
    items {
      sys {
        id
      }
    }
  }
}
`);

}

async function addscriptsToPackageJson(outputDirectory: string) {
  const packageJsonPath = resolve(outputDirectory, 'package.json');
  const packageJson = require(packageJsonPath);
  packageJson.scripts = {
    ...packageJson.scripts,
    "generate": "graphql-codegen dotenv/config",
    "generate:watch": "yarn generate -watch"
  };
  require('fs').writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

export async function createEnv(accessToken?: string, spaceId?: string, environment?: string, outputDirectory?: string) {
  const envFileContent = `
CONTENTFUL_SPACE_ID=${spaceId}
CONTENTFUL_ACCESS_TOKEN=${accessToken}
CONTENTFUL_ENVIRONMENT=${environment}
`;

  fs.writeFileSync(`${outputDirectory}/.env`, envFileContent);
}

