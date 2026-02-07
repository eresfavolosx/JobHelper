const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

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
