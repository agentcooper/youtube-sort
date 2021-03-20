/* run on playlist page */

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cache(fn) {
  return async function (...args) {
    const key = `${fn.name}(${JSON.stringify(args)})`;

    try {
      const item = localStorage.getItem(key);
      if (typeof item === "string") {
        return JSON.parse(item);
      }

      throw new Error("Cache miss");
    } catch (e) {
      // cache miss, use network
    }

    const json = await fn(...args);
    try {
	    localStorage.setItem(key, JSON.stringify(json));
    } catch (e) {
	    // failed saving to cache
    }
    return json;
  }
}

function isOnYoutube() {
  return Boolean(window.ytcfg);
}

function isLoggedIn() {
  return Boolean(window.ytcfg && ytcfg.get("ID_TOKEN"));
}

function getVersion() {
  const clientVersion = ytcfg.get("INNERTUBE_CONTEXT_CLIENT_VERSION");

  const isMajorVersion1 = String(clientVersion).indexOf("1.") === 0;

  // backend does not output json for version 1.*
  if (isMajorVersion1) {
    return "2.20180308";
  }

  return clientVersion;
}

async function getVideoJSON(id) {
  return fetch(`/watch?v=${id}&pbj=1`, {
    credentials: 'same-origin', headers: {
      "x-spf-referer": location.href,
      "x-youtube-client-name": "1",
      "x-youtube-client-version": getVersion(),
      "x-youtube-identity-token": ytcfg.get("ID_TOKEN")
    }
  }).then(res => res.json());
}

function isHidden(el) {
  return el.offsetParent === null;
}

function getPageUrls() {
  return Array.from(
    document.querySelectorAll("a[href^='/watch']")
  ).filter(a => !isHidden(a)).map(a => a.getAttribute("href"));
}

function getPageIds() {
  const ids = getPageUrls().map(url => {
    const match = url.match(/v=([-\w]+)/);
    if (match && match.length > 1) {
      return match[1];
    } else {
      console.warn(`Failed to parse ${url}`);
    }

    return null;
  }).filter(Boolean);

  return [...new Set(ids)]
}

async function getVideoDetails(id) {
  const jsonArray = await getVideoJSON(id);

  try {
    const playerResponse = jsonArray.find(item => Boolean(item.playerResponse)).playerResponse;
    const ownerChannelName = playerResponse.microformat.playerMicroformatRenderer.ownerChannelName;
    return { ...playerResponse.videoDetails, ownerChannelName };
  } catch (e) {
    console.error(`Failed to get videoDetails from`, jsonArray);
  }
}

function youtubeLink(videoId, children) {
  return `<a href="/watch?v=${videoId}" target="_blank">${children}</a>`;
}

function print(videos, sortKey) {
  const sorted = Array.from(videos).sort((a, b) => {
	if (a[sortKey] > b[sortKey]) return 1;
	if (a[sortKey] < b[sortKey]) return -1;
	return 0;
  });

  const html = `
    <table style="color: hsl(0, 0%, 6.7%); font-family: Roboto, Arial, sans-serif; border-spacing: 1em;">
      <thead>
        <tr>
          <th></th>
          <th style="cursor: pointer; border-bottom: 1px solid;">${sortKey}</th>
          <th></th>
          <th>Video</th>
        </tr>
      </thead>
      <tbody>
      ${sorted.map((video, index) => `
        <tr style="padding: 1em;">
          <td style="color: hsla(0, 0%, 6.7%, .6);">${index + 1}</td>
          <td>${video[sortKey]}</td>
          <td>${youtubeLink(video.videoId, `<img src="${video.thumbnail.thumbnails[0].url}">`)}</td>
          <td>${youtubeLink(video.videoId, video.title)}</a></td>
        </tr>
      `).join("\n")}
      </tbody>
    </table>
  `;

  document.write(html);
  document.close();
}

function logStatus(done, total) {
  document.write(`
    <main style="font-family: Roboto, Arial, sans-serif;">
      <div style="display: inline-block;">
        <p>Processing videos: ${done} out of ${total}</p>
        <div><progress style="width: 100%;" value="${done}" max="${total}"></progress></div>
      </div>
    </main>
  `);
  document.close();
}

async function main() {
  if (!isOnYoutube()) {
    alert(`You don't seem to be on youtube.com.\n\n(window.ytcfg is missing)`);
    return;
  }

  if (!isLoggedIn()) {
    alert(`You need to be logged in to use YouTube sort.\n\nIf you're logged in, please refresh your browser and try again.`);
    return;
  }

  const ids = getPageIds();
  console.log(`Found ${ids.length} videos`);

  const getVideoDetailsCached = (getVideoDetails);

  let videos = [];
  for (const id of ids) {
    console.log(`Processing id ${id}`);
    const details = await getVideoDetailsCached(id);

    if (details) {
      videos.push(details);
    } else {
      console.warn(`Couldn't fetch details for id ${id}`);
    }

    logStatus(videos.length, ids.length);
  }

  window.videos = {
    data: videos,
    print(sortKey = "ownerChannelName") {
      return print(this.data, sortKey)
    }
  };

  console.log(`Done! Access stored videos using window.videos`);
  window.videos.print();
}

main();