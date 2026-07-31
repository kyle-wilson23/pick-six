import { describe, expect, it } from "vitest";

import { shouldShowRetractableWeatherChrome } from "./retractable-weather-chrome";

const sampleWeather = { tempF: 72, condition: "Clear", windMph: 5 };

describe("shouldShowRetractableWeatherChrome", () => {
  it("returns false when weather is missing even for retractable stadium", () => {
    expect(shouldShowRetractableWeatherChrome(null, "retractable")).toBe(false);
    expect(shouldShowRetractableWeatherChrome(undefined, "retractable")).toBe(false);
  });

  it("returns true when weather is present and stadium is retractable", () => {
    expect(shouldShowRetractableWeatherChrome(sampleWeather, "retractable")).toBe(true);
  });

  it("returns false for dome or open stadiums regardless of weather", () => {
    expect(shouldShowRetractableWeatherChrome(sampleWeather, "dome")).toBe(false);
    expect(shouldShowRetractableWeatherChrome(sampleWeather, "open")).toBe(false);
    expect(shouldShowRetractableWeatherChrome(sampleWeather, null)).toBe(false);
  });
});
