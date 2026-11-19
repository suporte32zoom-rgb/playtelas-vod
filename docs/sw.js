/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "460cecb8a6d84190add302b3290fad8c"
  }, {
    "url": "pwa-512x512.png",
    "revision": "460cecb8a6d84190add302b3290fad8c"
  }, {
    "url": "pwa-192x192.png",
    "revision": "04ed02d3aa36c5e2902813a3d465e138"
  }, {
    "url": "index.html",
    "revision": "77f75096e79f5f85c8e1bc39c828f21d"
  }, {
    "url": "icon.svg",
    "revision": "f6f4b044f8a0be4ab3b42ca63cc8f94c"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "04ed02d3aa36c5e2902813a3d465e138"
  }, {
    "url": "assets/index-D3K2i0-g.js",
    "revision": null
  }, {
    "url": "assets/index-Cf_xQq9y.css",
    "revision": null
  }, {
    "url": ".nojekyll",
    "revision": "d41d8cd98f00b204e9800998ecf8427e"
  }, {
    "url": "CNAME",
    "revision": "3b803a9b7821a10f47291c3da1cf9ada"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "04ed02d3aa36c5e2902813a3d465e138"
  }, {
    "url": "icon.svg",
    "revision": "f6f4b044f8a0be4ab3b42ca63cc8f94c"
  }, {
    "url": "pwa-192x192.png",
    "revision": "04ed02d3aa36c5e2902813a3d465e138"
  }, {
    "url": "pwa-512x512.png",
    "revision": "460cecb8a6d84190add302b3290fad8c"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "460cecb8a6d84190add302b3290fad8c"
  }, {
    "url": "manifest.webmanifest",
    "revision": "69ec7160e5d70e597ac42436c8e52d1f"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));

}));
