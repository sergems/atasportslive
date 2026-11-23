import React from 'react';
import { Text } from 'react-native';
import { Card, Screen, SectionTitle } from '@/components/ui';
import { colors, fontSize } from '@/theme';

export default function PredictionsScreen() {
  return (
    <Screen>
      <SectionTitle>Predictions</SectionTitle>
      <Card>
        <Text style={{ color: colors.text, fontWeight: '700' }}>Bet on live matches</Text>
        <Text style={{ color: colors.muted, fontSize: fontSize.sm, marginTop: 6 }}>
          Game listings, placing predictions and your bet history will be wired to the existing
          /api/games and /api/bets endpoints in the next phase.
        </Text>
      </Card>
    </Screen>
  );
}
