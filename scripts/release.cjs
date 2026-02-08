const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const PACKAGE_JSON_PATH = path.join(__dirname, '../package.json');
const VERSION_JS_PATH = path.join(__dirname, '../src/version.js');
const CHANGELOG_PATH = path.join(__dirname, '../CHANGELOG.md');

function incrementVersion(currentVersion, type) {
    const parts = currentVersion.split('.').map(Number);
    if (type === 'major') {
        parts[0]++;
        parts[1] = 0;
        parts[2] = 0;
    } else if (type === 'minor') {
        parts[1]++;
        parts[2] = 0;
    } else if (type === 'patch') {
        parts[2]++;
    }
    return parts.join('.');
}

function updateFile(filePath, regex, replacement) {
    const content = fs.readFileSync(filePath, 'utf8');
    const newContent = content.replace(regex, replacement);
    fs.writeFileSync(filePath, newContent);
}

function prependChangelog(version) {
    const date = new Date().toISOString().split('T')[0];
    const header = `## [${version}] - ${date}\n### Changed\n- Bumped version to ${version}\n\n`;
    const content = fs.readFileSync(CHANGELOG_PATH, 'utf8');
    const insertPosition = content.indexOf('## [');

    if (insertPosition !== -1) {
        const newContent = content.slice(0, insertPosition) + header + content.slice(insertPosition);
        fs.writeFileSync(CHANGELOG_PATH, newContent);
    } else {
        // Fallback if no existing version header found
        fs.writeFileSync(CHANGELOG_PATH, '# Changelog\n\n' + header + content.replace('# Changelog\n\n', ''));
    }
}

const packageJson = require(PACKAGE_JSON_PATH);
const currentVersion = packageJson.version;

console.log(`Current version: ${currentVersion}`);
rl.question('Enter release type (major, minor, patch) or specific version: ', (answer) => {
    let newVersion;
    if (['major', 'minor', 'patch'].includes(answer)) {
        newVersion = incrementVersion(currentVersion, answer);
    } else if (/^\d+\.\d+\.\d+$/.test(answer)) {
        newVersion = answer;
    } else {
        console.error('Invalid input.');
        rl.close();
        process.exit(1);
    }

    console.log(`Bumping to version: ${newVersion}`);

    // Update package.json
    updateFile(PACKAGE_JSON_PATH, `"version": "${currentVersion}"`, `"version": "${newVersion}"`);
    console.log('Updated package.json');

    // Update src/version.js
    updateFile(VERSION_JS_PATH, /export const APP_VERSION = '.*';/, `export const APP_VERSION = '${newVersion}';`);
    console.log('Updated src/version.js');

    // Update CHANGELOG.md
    prependChangelog(newVersion);
    console.log('Updated CHANGELOG.md');

    // Git commit suggestion
    console.log('\nDone! You can now run:\n');
    console.log(`git add . && git commit -m "chore: release v${newVersion}"`);

    rl.close();
});
