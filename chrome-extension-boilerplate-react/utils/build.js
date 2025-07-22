// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';
process.env.ASSET_PATH = '/';

// Ensure NODE_ENV is available for webpack's EnvironmentPlugin
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

var webpack = require('webpack'),
  path = require('path'),
  fs = require('fs'),
  { execSync } = require('child_process'),
  config = require('../webpack.config');

delete config.chromeExtensionBoilerplate;

config.mode = 'production';

var packageInfo = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

// Ensure the zip directory exists
const zipDir = path.join(__dirname, '../zip');
if (!fs.existsSync(zipDir)) {
  fs.mkdirSync(zipDir, { recursive: true });
}

webpack(config, function (err) {
  if (err) throw err;

  console.log(`\n\n🎉 Success! Built ${packageInfo.name} v${packageInfo.version}\n`);

  // Update manifest.json with correct version
  const buildDir = path.join(__dirname, '../build');
  const manifestPath = path.join(buildDir, 'manifest.json');
  
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    manifest.version = packageInfo.version;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`✅ Updated manifest version to ${packageInfo.version}`);
  } catch (error) {
    console.error('❌ Error updating manifest version:', error.message);
  }

  // Create ZIP file manually
  const zipFilename = `${packageInfo.name}-${packageInfo.version}.zip`;
  const targetZipPath = path.join(zipDir, zipFilename);

  try {
    // Change to build directory and create zip
    process.chdir(buildDir);
    execSync(`zip -r "${targetZipPath}" . -x "*.map" "*.zip"`);
    console.log(`✅ ZIP file created: ${targetZipPath}`);
  } catch (error) {
    console.error('❌ Error creating ZIP file:', error.message);
  }
});
