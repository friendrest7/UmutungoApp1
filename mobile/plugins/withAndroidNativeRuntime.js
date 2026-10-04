const {
  withAppBuildGradle,
  withProjectBuildGradle,
} = require('@expo/config-plugins');

const marker = '// Umutungo shared libc++ runtime';
const appMarker = '// Umutungo app shared libc++ runtime';

const nativeRuntimeBlock = `
${marker}
subprojects { subproject ->
  // The Android modules declare their CMake blocks during evaluation, so wait
  // until each module has finished configuring before adding the shared STL.
  def configureNativeRuntime = {
    def androidExtension = subproject.extensions.findByName('android')
    def defaultConfig = androidExtension?.defaultConfig
    def nativeBuild = defaultConfig?.externalNativeBuild
    def cmake = nativeBuild?.cmake
    if (cmake != null) {
      cmake.arguments '-DCMAKE_ANDROID_STL_TYPE=c++_shared'
      cmake.arguments '-DCMAKE_SHARED_LINKER_FLAGS=-lc++_shared'
    }
  }
  if (subproject.state.executed) {
    configureNativeRuntime()
  } else {
    subproject.afterEvaluate(configureNativeRuntime)
  }
}
`;

const appNativeRuntimeBlock = `
${appMarker}
android {
  defaultConfig {
    externalNativeBuild {
      cmake {
        arguments '-DCMAKE_ANDROID_STL_TYPE=c++_shared'
        arguments '-DCMAKE_SHARED_LINKER_FLAGS=-lc++_shared'
      }
    }
  }
}
`;

module.exports = function withAndroidNativeRuntime(config) {
  config = withProjectBuildGradle(config, (projectConfig) => {
    if (projectConfig.modResults.language !== 'groovy') {
      return projectConfig;
    }

    if (!projectConfig.modResults.contents.includes(marker)) {
      projectConfig.modResults.contents += nativeRuntimeBlock;
    }

    return projectConfig;
  });

  return withAppBuildGradle(config, (appConfig) => {
    if (
      appConfig.modResults.language === 'groovy' &&
      !appConfig.modResults.contents.includes(appMarker)
    ) {
      appConfig.modResults.contents += appNativeRuntimeBlock;
    }

    return appConfig;
  });
};
