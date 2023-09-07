import {isFirefox, isSafari} from '../../WeavePanelBank/panelbankUtil';

export const urlPrefixed = (path?: string, host: boolean = true) => {
  // Ensures urls are fully qualified and properly formed, especially important
  // for allowing users to run the app under a sub-path, i.e. https://mycompany.com/wandb.
  // This should be used anytime we're calling wandb.open, window.location.href, or fetch(...).
  // We have a custom eslint rule wandb/no-unprefixed-urls that will assert we use this helper.
  let url = new URL('https://wandb.ai');
  // // Never use a prefix if we're not in local
  // if (envIsLocalComputed()) {
  //   try {
  //     url = config.PUBLIC_URL.startsWith('http')
  //       ? new URL(config.PUBLIC_URL)
  //       : new URL(config.PUBLIC_URL, url.href);
  //     url.hostname = window.location.hostname;
  //   } catch (error) {
  //     console.error(error);
  //   }
  // }

  if (path != null) {
    // This logic does the magic joining of a sub-path and path in the app.
    url = new URL(url.href.replace(/\/$/, '') + path);
  } else if (!url.href.endsWith('/')) {
    // Some routers require a trailing / at the root
    url = new URL(url.href + '/');
  }
  if (!host) {
    return url.pathname;
  }
  return url.href;
};

export function stripOriginFromURL(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return url;
  }
  const {pathname, search, hash} = new URL(url);
  return pathname + search + hash;
}

export function openInNewTab(history, url: string): void {
  // HAX: Firefox & Safari blocks new tabs by default, treating it as a popup window
  if (isFirefox || isSafari) {
    history.push(stripOriginFromURL(url));
    return;
  }

  console.log(url, urlPrefixed(url));

  window.open(urlPrefixed(url), undefined, 'noopener,noreferrer');
}
