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
  config = require('../webpack.config'),
  ZipPlugin = require('zip-webpack-plugin');

delete config.chromeExtensionBoilerplate;

config.mode = 'production';

var packageInfo = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

config.plugins = (config.plugins || []).concat(
  new ZipPlugin({
    filename: `${packageInfo.name}-${packageInfo.version}.zip`,
    path: '../zip', // Relative to output directory (build), so ../zip goes to project/zip
    pathPrefix: '', // Ensure files are at root of zip
    exclude: [/\.map$/], // Exclude source maps from zip
  })
);

webpack(config, function (err) {
  if (err) throw err;
  
  // After successful build, move the ZIP file to the correct location
  const buildZipPath = path.join(__dirname, '../build/zip', `${packageInfo.name}-${packageInfo.version}.zip`);
  const targetZipPath = path.join(__dirname, '../zip', `${packageInfo.name}-${packageInfo.version}.zip`);
  
  if (fs.existsSync(buildZipPath)) {
    try {
      fs.copyFileSync(buildZipPath, targetZipPath);
      console.log(`ZIP file copied to: ${targetZipPath}`);
      
      // Optionally remove the ZIP from build directory
      fs.unlinkSync(buildZipPath);
      console.log(`ZIP file removed from build directory`);
    } catch (copyErr) {
      console.error('Error copying ZIP file:', copyErr);
    }
  }
});
