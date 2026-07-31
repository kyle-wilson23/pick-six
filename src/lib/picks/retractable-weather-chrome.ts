/** Whether retractable-roof tooltip/chip chrome should render (requires weather data). */
export function shouldShowRetractableWeatherChrome(
  weather: unknown,
  stadiumRoof: string | null | undefined,
): boolean {
  return Boolean(weather) && stadiumRoof === "retractable";
}
