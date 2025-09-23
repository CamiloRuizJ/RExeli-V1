#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read current package.json
const packagePath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Get current version and increment patch version
const currentVersion = packageJson.version;
const versionParts = currentVersion.split('.');
const major = parseInt(versionParts[0]);
const minor = parseInt(versionParts[1]);
const patch = parseInt(versionParts[2]) + 1;
const newVersion = `${major}.${minor}.${patch}`;

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`🚀 Version bumped: ${currentVersion} → ${newVersion}`);
console.log('📦 Committing and pushing to trigger deployment...');

try {
  // Git commands to commit and push
  execSync('git add package.json', { stdio: 'inherit' });
  execSync(`git commit -m "bump version to trigger Vercel deployment

🚀 Version ${newVersion} - Production deployment
✅ Authentication system enabled
🔒 Encrypted API keys configured
🛡️ Security headers active

Admin Login:
- Email: admin@rexeli.com
- Password: RExeli2025!Admin

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"`, { stdio: 'inherit' });

  execSync('git push', { stdio: 'inherit' });

  console.log('✅ Successfully triggered deployment!');
  console.log('🔍 Monitor progress at: https://github.com/CamiloRuizJ/RExeli-V1/actions');
  console.log('🌐 Application will be available at your Vercel domain shortly');

} catch (error) {
  console.error('❌ Error during deployment trigger:', error.message);
  process.exit(1);
}