import { Heading, Section, Text } from "@react-email/components";

import { TEST_LEAGUE_EMAIL_BODY_NOTICE } from "@/lib/email/test-league-labeling";

import { EmailLayout, PrimaryCta } from "./EmailLayout";
import {
  headingStyle,
  sectionStyle,
  subheadingStyle,
  tableStyle,
  tdRightStyle,
  tdStyle,
  testNoticeStyle,
  textStyle,
  thRightStyle,
  thStyle,
} from "./email-styles";

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
  isTestLeague?: boolean;
};

export function TuesdayDigestEmail({
  leagueName,
  weekNumber,
  standings,
  jailedTeamName,
  jailedTeamAbbreviation,
  picksUrl,
  adminNote,
  isTestLeague = false,
}: TuesdayDigestEmailProps) {
  const jailedLabel =
    jailedTeamName != null && jailedTeamAbbreviation != null
      ? `${jailedTeamName} (${jailedTeamAbbreviation})`
      : "Not yet computed for this week";

  return (
    <EmailLayout preview={`${leagueName} — Week ${weekNumber} update`}>
      {isTestLeague ? <Text style={testNoticeStyle}>{TEST_LEAGUE_EMAIL_BODY_NOTICE}</Text> : null}
      <Heading as="h1" style={headingStyle}>
        {leagueName} — Week {weekNumber}
      </Heading>

      <Section style={sectionStyle}>
        <Heading as="h2" style={subheadingStyle}>
          Standings
        </Heading>
        {standings.length === 0 ? (
          <Text style={textStyle}>No standings yet for this season.</Text>
        ) : (
          <table cellPadding={8} cellSpacing={0} style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Rank</th>
                <th style={thStyle}>Name</th>
                <th align="right" style={thRightStyle}>
                  Points
                </th>
              </tr>
            </thead>
            <tbody>
              {standings.map((entry, index) => (
                <tr key={`${entry.rank}-${entry.displayName}-${index}`}>
                  <td style={tdStyle}>{entry.rank}</td>
                  <td style={tdStyle}>{entry.displayName}</td>
                  <td align="right" style={tdRightStyle}>
                    {entry.totalPoints}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section style={sectionStyle}>
        <Heading as="h2" style={subheadingStyle}>
          Jailed team
        </Heading>
        <Text style={textStyle}>{jailedLabel}</Text>
      </Section>

      <PrimaryCta href={picksUrl} label="Make your picks" />

      {adminNote != null && adminNote.trim() !== "" ? (
        <Section style={{ ...sectionStyle, marginTop: "28px" }}>
          <Heading as="h2" style={subheadingStyle}>
            Note from your commissioner
          </Heading>
          <Text style={{ ...textStyle, whiteSpace: "pre-wrap" }}>{adminNote}</Text>
        </Section>
      ) : null}
    </EmailLayout>
  );
}
