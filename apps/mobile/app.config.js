const appJson = require('./app.json');

const expo = appJson.expo;

/**
 * EAS uploads gitignored credential files as "file" environment variables.
 * Locally the paths in app.json are still used.
 */
module.exports = () => ({
  ...expo,
  android: {
    ...expo.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON_FILE || expo.android.googleServicesFile,
  },
  ios: {
    ...expo.ios,
    googleServicesFile: process.env.GOOGLE_SERVICE_INFO_PLIST_FILE || expo.ios.googleServicesFile,
  },
});
