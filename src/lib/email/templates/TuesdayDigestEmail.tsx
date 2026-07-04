import {
  Body,
  Button,
  Container,
  Heading,
  Html,
  Section,
  Text,
} from "@react-email/components";

export type TuesdayDigestEmailProps = {
  leagueName: string;
  weekNumber: number;
  standings: Array<{
    rank: number;
    displayName: string;
    totalPoints: number;
    wins: number;
    losses: number;
  }>;
  jailedTeamName: string | null;
  jailedTeamAbbreviation: string | null;
  picksUrl: string;
  adminNote: string | null;
};

export function TuesdayDigestEmail({
  leagueName,
  weekNumber,
  standings,
  jailedTeamName,
  jailedTeamAbbreviation,
  picksUrl,
  adminNote,
}: TuesdayDigestEmailProps) {
  const jailedLabel =
    jailedTeamName != null && jailedTeamAbbreviation != null
      ? `${jailedTeamName} (${jailedTeamAbbreviation})`
      : "Not yet computed for this week";

  return (
    <Html>
      <Body style={{ fontFamily: "sans-serif", color: "#111" }}>
        <Container>
          <Heading as="h1">
            {leagueName} — Week {weekNumber}
          </Heading>

          <Section>
            <Heading as="h2" style={{ fontSize: "18px" }}>
              Standings
            </Heading>
            {standings.length === 0 ? (
              <Text>No standings yet for this season.</Text>
            ) : (
              <table
                cellPadding={8}
                cellSpacing={0}
                style={{ borderCollapse: "collapse", width: "100%" }}
              >
                <thead>
                  <tr>
                    <th align="left">Rank</th>
                    <th align="left">Name</th>
                    <th align="right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((entry) => (
                    <tr key={entry.rank + entry.displayName}>
                      <td>{entry.rank}</td>
                      <td>{entry.displayName}</td>
                      <td align="right">{entry.totalPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section style={{ marginTop: "24px" }}>
            <Heading as="h2" style={{ fontSize: "18px" }}>
              Jailed team
            </Heading>
            <Text>{jailedLabel}</Text>
          </Section>

          {adminNote != null && adminNote.trim() !== "" ? (
            <Section style={{ marginTop: "24px" }}>
              <Heading as="h2" style={{ fontSize: "18px" }}>
                Note from your commissioner
              </Heading>
              <Text style={{ whiteSpace: "pre-wrap" }}>{adminNote}</Text>
            </Section>
          ) : null}

          <Section style={{ marginTop: "32px" }}>
            <Button href={picksUrl}>Make your picks</Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
