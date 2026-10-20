import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { resolvePricingLocation } from "../src/lib/pricing-maps.server.ts";

const testKey = "test-only-google-maps-server-key";
const address = "123 Private Test Street, Salt Lake City, UT";
const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalKey = process.env.GOOGLE_MAPS_SERVER_KEY;
let diagnostics;

beforeEach(() => {
  process.env.GOOGLE_MAPS_SERVER_KEY = testKey;
  diagnostics = [];
  globalThis.fetch = async () => new Response(JSON.stringify({ status: "OK", results: [] }));
  console.error = (...args) => diagnostics.push(args);
  console.warn = (...args) => diagnostics.push(args);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  if (originalKey === undefined) delete process.env.GOOGLE_MAPS_SERVER_KEY;
  else process.env.GOOGLE_MAPS_SERVER_KEY = originalKey;
});

function geocodeLocation() {
  return resolvePricingLocation({ address, placeId: null });
}

describe("server-side Google Maps diagnostics", () => {
  test("does not call Google when the server key is missing", async () => {
    delete process.env.GOOGLE_MAPS_SERVER_KEY;
    let requests = 0;
    globalThis.fetch = async () => {
      requests += 1;
      return new Response(JSON.stringify({ status: "OK", results: [] }));
    };

    await expect(geocodeLocation()).rejects.toThrow(
      "Google Maps is not configured for server-side pricing requests.",
    );
    expect(requests).toBe(0);
  });

  test("distinguishes ZERO_RESULTS from provider denial in HTTP 200 responses", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ status: "ZERO_RESULTS", results: [] }));
    await expect(geocodeLocation()).rejects.toThrow("could not find this address");
    expect(diagnostics).toContainEqual([
      "[pricing-maps] Google API error",
      { operation: "geocoding", httpStatus: 200, apiStatus: "ZERO_RESULTS" },
    ]);

    diagnostics = [];
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          status: "REQUEST_DENIED",
          error_message: "The API key and private address must not be logged.",
          results: [],
        }),
      );
    await expect(geocodeLocation()).rejects.toThrow("rejected this request");
    expect(diagnostics).toContainEqual([
      "[pricing-maps] Google API error",
      { operation: "geocoding", httpStatus: 200, apiStatus: "REQUEST_DENIED" },
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain(testKey);
    expect(JSON.stringify(diagnostics)).not.toContain(address);
    expect(JSON.stringify(diagnostics)).not.toContain("private address");
  });

  test("classifies structured HTTP errors without logging provider payloads", async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: { code: 403, status: "PERMISSION_DENIED", message: "sensitive payload" },
        }),
        { status: 403 },
      );

    await expect(geocodeLocation()).rejects.toThrow("rejected this request");
    expect(diagnostics).toContainEqual([
      "[pricing-maps] Google API error",
      { operation: "geocoding", httpStatus: 403, apiStatus: "PERMISSION_DENIED" },
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain(testKey);
    expect(JSON.stringify(diagnostics)).not.toContain(address);
    expect(JSON.stringify(diagnostics)).not.toContain("sensitive payload");
  });

  test("adds a bounded timeout and reports it without exposing the request", async () => {
    globalThis.fetch = async (_url, init) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      throw new DOMException("request for private address timed out", "TimeoutError");
    };

    await expect(geocodeLocation()).rejects.toThrow("too long to respond");
    expect(diagnostics).toContainEqual([
      "[pricing-maps] Google request failed",
      { operation: "geocoding", failure: "timeout", errorName: "TimeoutError" },
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain(testKey);
    expect(JSON.stringify(diagnostics)).not.toContain(address);
  });

  test("returns coordinates for a valid Geocoding response", async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            {
              formatted_address: "Resolved test address",
              geometry: { location: { lat: 40.75, lng: -111.89 } },
            },
          ],
        }),
      );

    await expect(geocodeLocation()).resolves.toEqual({
      address: "Resolved test address",
      latitude: 40.75,
      longitude: -111.89,
    });
    expect(diagnostics).toEqual([]);
  });
});
