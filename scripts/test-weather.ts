import { fetchWeatherForGame } from "../src/lib/integrations/weather/client";

async function main() {
  const kickoff = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days from now
  const result = await fetchWeatherForGame("KC", kickoff);
  console.log("Result:", JSON.stringify(result, null, 2));
}

main();
