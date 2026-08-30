import fs from 'fs';

function convert(filename) {
    if (fs.existsSync(filename)) {
        const content = fs.readFileSync(filename, 'utf16le');
        fs.writeFileSync(filename + '.utf8', content, 'utf8');
        console.log(`Converted ${filename} to ${filename}.utf8`);
    } else {
        console.log(`${filename} does not exist.`);
    }
}

convert('error_log.txt');
convert('error.txt');
convert('chatbot_errors.log');
