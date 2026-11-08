import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.join(__dirname, '../public');
const sourceDir = path.join(__dirname, '../src/extension');
const outputFile = path.join(outputDir, 'extension.zip');

// Ensure public directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const output = fs.createWriteStream(outputFile);
const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
});

output.on('close', function () {
    console.log(archive.pointer() + ' total bytes');
    console.log('Extension has been zipped to public/extension.zip');
});

archive.on('error', function (err) {
    throw err;
});

archive.pipe(output);
archive.directory(sourceDir, false);
archive.finalize();
