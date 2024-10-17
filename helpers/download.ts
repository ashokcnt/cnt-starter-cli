import axios from 'axios';
import unzipper from 'unzipper';
import * as fs from 'fs';
import * as path from 'path';
import admZip from 'adm-zip';
import { pipeline, Readable } from 'node:stream';
import { x } from 'tar';

// Function to create the output directory if it doesn't exist
export async function ensureDirectoryExists(directory: string): Promise<void> {
  try {
    await fs.promises.mkdir(directory, { recursive: true });
    console.log(`Directory created: ${directory}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      console.error(`Error creating directory: ${(error as Error).message}`);
      throw error;
    }
  }
}

async function downloadTarStream(url: string) {
    const res = await fetch(url)
  
    if (!res.body) {
      throw new Error(`Failed to download: ${url}`)
    }
  
    return Readable.fromWeb(res.body as import('stream/web').ReadableStream)
  }

// Function to download and extract the GitHub ZIP file
export async function downloadAndExtractZip(repoUrl: string, outputDir: string): Promise<void> {
  const zipFilePath = await path.join(outputDir, 'template.tar.gz'); // Path to save the downloaded ZIP file
//   console.log(path.join(__dirname, 'next.js-canary.tar.gz'));


  try {
    // Step 1: Ensure the output directory exists
    await ensureDirectoryExists(outputDir);

    // Step 2: Download the ZIP file
    const response = await axios({
      url: repoUrl,
      method: 'GET',
      responseType: 'stream',
      validateStatus: (status) => status === 200,
    });

    // Step 3: Save the ZIP file locally
    const writer = await fs.createWriteStream(zipFilePath);
    response.data.pipe(writer);

    // Wait for the file to be written
    await new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log(`Downloaded to: ${zipFilePath}`);

    // Step 4: Extract the ZIP file to the output directory
    await fs.createReadStream(zipFilePath)
      .pipe(x({
        cwd: outputDir,
        strip: 1
      }
      ))
      .on('close', () => {
        console.log(`Extracted to: ${outputDir}`);
      })
      .on('error', (err: Error) => {
        console.error('Error extracting ZIP file:', err);
      });
    // let zip = new admZip(path.join(__dirname, 'next.js-canary.tar.gz')); 
    // zip.extractAllTo(outputDir, true);
  } catch (error) {
    console.error('Error downloading or extracting:', error);
  } finally {
    // Clean up: Remove the downloaded ZIP file
    fs.unlink(zipFilePath, (err) => {
      if (err) {
        console.error('Error deleting ZIP file:', err);
      } else {
        console.log('ZIP file deleted.');
      }
    });
  }
}


