// server stand-in for src/net.ts: the server is not a browser, so it reads the sites directly
exports.xfetch = (url, init) => fetch(url, init);
