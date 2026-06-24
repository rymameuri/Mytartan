const axios = require("axios");

function parseNextLink(linkHeader) {
  if (!linkHeader || typeof linkHeader !== "string") return null;
  const parts = linkHeader.split(",");
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}

async function canvasRequest(url, token, { responseType } = {}) {
  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 30000,
    responseType: responseType ?? "json",
    maxRedirects: 5,
  });
  return response;
}

async function canvasGet(url, token) {
  const response = await canvasRequest(url, token);
  return response.data;
}

async function canvasGetAllPages(url, token) {
  const results = [];
  let nextUrl = url;

  while (nextUrl) {
    const response = await canvasRequest(nextUrl, token);
    if (Array.isArray(response.data)) {
      results.push(...response.data);
    }
    nextUrl = parseNextLink(response.headers?.link);
  }

  return results;
}

async function canvasDownload(url, token) {
  const response = await canvasRequest(url, token, { responseType: "arraybuffer" });
  return Buffer.from(response.data);
}

module.exports = {
  canvasGet,
  canvasGetAllPages,
  canvasDownload,
  parseNextLink,
};
