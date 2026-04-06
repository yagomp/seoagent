import { describe, it, expect } from "vitest";
import { parsePage, extractLinks, resolveUrl } from "../audit/fetcher.js";

const SAMPLE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Page Title</title>
  <meta name="description" content="A test meta description">
</head>
<body>
  <h1>Main Heading</h1>
  <p>This is a paragraph with enough words to not be thin content. We need at least a hundred words
  so let us keep writing more text here. The quick brown fox jumps over the lazy dog. Lorem ipsum
  dolor sit amet consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore
  magna aliqua. Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip
  ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum
  dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident sunt in culpa
  qui officia deserunt mollit anim id est laborum.</p>
  <a href="/about">About Us</a>
  <a href="https://external.com/page">External</a>
  <a href="/contact">Contact</a>
  <img src="logo.png" alt="Logo">
  <img src="photo.jpg">
  <img src="banner.png">
</body>
</html>
`;

const EMPTY_HTML = `
<!DOCTYPE html>
<html>
<head></head>
<body><p>Short.</p></body>
</html>
`;

describe("parsePage", () => {
  it("extracts title from HTML", () => {
    const result = parsePage(SAMPLE_HTML, "https://example.com/");
    expect(result.title).toBe("Test Page Title");
  });

  it("extracts meta description", () => {
    const result = parsePage(SAMPLE_HTML, "https://example.com/");
    expect(result.metaDescription).toBe("A test meta description");
  });

  it("extracts h1", () => {
    const result = parsePage(SAMPLE_HTML, "https://example.com/");
    expect(result.h1).toBe("Main Heading");
  });

  it("counts words in body text", () => {
    const result = parsePage(SAMPLE_HTML, "https://example.com/");
    expect(result.wordCount).toBeGreaterThan(50);
  });

  it("counts images without alt", () => {
    const result = parsePage(SAMPLE_HTML, "https://example.com/");
    expect(result.imagesWithoutAlt).toBe(2);
  });

  it("returns null for missing title", () => {
    const result = parsePage(EMPTY_HTML, "https://example.com/");
    expect(result.title).toBeNull();
  });

  it("returns null for missing meta description", () => {
    const result = parsePage(EMPTY_HTML, "https://example.com/");
    expect(result.metaDescription).toBeNull();
  });

  it("returns null for missing h1", () => {
    const result = parsePage(EMPTY_HTML, "https://example.com/");
    expect(result.h1).toBeNull();
  });
});

describe("extractLinks", () => {
  it("separates internal and external links", () => {
    const { internal, external } = extractLinks(
      SAMPLE_HTML,
      "https://example.com/"
    );
    expect(internal).toHaveLength(2);
    expect(external).toHaveLength(1);
  });

  it("resolves relative URLs to absolute", () => {
    const { internal } = extractLinks(SAMPLE_HTML, "https://example.com/");
    expect(internal[0].href).toBe("https://example.com/about");
    expect(internal[1].href).toBe("https://example.com/contact");
  });

  it("extracts anchor text", () => {
    const { internal } = extractLinks(SAMPLE_HTML, "https://example.com/");
    expect(internal[0].anchor).toBe("About Us");
  });

  it("identifies external links by domain", () => {
    const { external } = extractLinks(SAMPLE_HTML, "https://example.com/");
    expect(external[0].href).toBe("https://external.com/page");
  });
});

describe("resolveUrl", () => {
  it("resolves relative path", () => {
    expect(resolveUrl("/about", "https://example.com/page")).toBe(
      "https://example.com/about"
    );
  });

  it("returns absolute URL as-is", () => {
    expect(resolveUrl("https://other.com/x", "https://example.com/")).toBe(
      "https://other.com/x"
    );
  });

  it("strips fragment from URL", () => {
    expect(resolveUrl("/about#section", "https://example.com/")).toBe(
      "https://example.com/about"
    );
  });

  it("preserves trailing slash (important for redirects)", () => {
    expect(resolveUrl("/about/", "https://example.com/")).toBe(
      "https://example.com/about/"
    );
  });

  it("keeps root path as single slash", () => {
    expect(resolveUrl("/", "https://example.com/page")).toBe(
      "https://example.com/"
    );
  });
});
